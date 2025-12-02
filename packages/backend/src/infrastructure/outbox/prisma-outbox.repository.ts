import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { OutboxEvent } from '@prisma/client';
import type { DomainEvent } from '@domain/common/domain-event';
import type { TransactionContext } from '@domain/common/transaction';
import type { IOutboxRepository, OutboxEventDto } from '@domain/repositories/i-outbox.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { EventSerializer, type SerializedEvent } from './event-serializer';

/**
 * Prisma Transaction Client Type für atomare Operationen.
 * Cast-Ziel für TransactionContext aus dem Domain Layer.
 */
type PrismaTransactionClient = Omit<PrismaService, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends' | 'onModuleInit' | 'onModuleDestroy'>;

/**
 * Prisma Transaction Type für atomare Operationen (Legacy Export).
 * @deprecated Verwende TransactionContext aus @domain/common/transaction
 */
export type PrismaTransaction = PrismaTransactionClient;

// Re-export OutboxEventDto from domain for backwards compatibility
export type { OutboxEventDto } from '@domain/repositories/i-outbox.repository';

/**
 * Prisma Implementation des Outbox Repositories.
 *
 * Persistiert Domain Events in der outbox_events Tabelle für das
 * Transactional Outbox Pattern. Events werden mit dem Aggregate in
 * einer Transaction committed und später asynchron publiziert.
 *
 * Warum Repository statt direkter Prisma-Aufrufe?
 * - Abstraktion: Infrastructure-Details (Prisma) sind gekapselt
 * - Testbarkeit: Repository kann gemockt werden
 * - Single Responsibility: Nur Outbox-Logik
 *
 * @example
 * ```typescript
 * // In Application Handler mit Transaction
 * await prisma.$transaction(async (tx) => {
 *   await einsatzRepository.save(aggregate, tx);
 *   await outboxRepository.save(aggregate.domainEvents, tx);
 * });
 * aggregate.clearDomainEvents();
 * ```
 */
@Injectable()
export class PrismaOutboxRepository implements IOutboxRepository {
  private readonly logger = new Logger(PrismaOutboxRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventSerializer: EventSerializer,
  ) {}

  /**
   * Persistiert Domain Events atomar in der Outbox-Tabelle.
   *
   * Events werden als PENDING gespeichert und später vom Polling Worker
   * abgeholt und publiziert. Die Serialisierung erfolgt via EventSerializer.
   *
   * WICHTIG: Bei Verwendung mit Transaction wird die Events in der gleichen
   * TX wie das Aggregate committed → Garantiert Konsistenz (kein Event-Verlust).
   *
   * @param events - Domain Events zum Persistieren
   * @param tx - Optional: Transaction Context für atomare Operationen
   */
  async save(events: DomainEvent[], tx?: TransactionContext): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const client = (tx as PrismaTransactionClient | undefined) ?? this.prisma;

    // Serialize all events
    const outboxRecords: Prisma.OutboxEventCreateInput[] = events.map((event) => {
      const serialized = this.eventSerializer.serialize(event);

      return {
        id: serialized.eventId, // Use Domain Event ID as Outbox ID
        eventName: serialized.eventName,
        eventVersion: serialized.eventVersion,
        aggregateId: serialized.aggregateId ?? '',
        payload: serialized as unknown as Prisma.InputJsonValue,
        occurredAt: new Date(serialized.occurredAt),
        // status, retryCount, createdAt use defaults from schema
      };
    });

    // Batch insert for efficiency
    await client.outboxEvent.createMany({
      data: outboxRecords,
    });

    this.logger.debug(`Saved ${events.length} events to outbox`, {
      eventNames: events.map((e) => (e.constructor as typeof DomainEvent).eventName()),
    });
  }

  /**
   * Lädt PENDING Events für Polling-Worker (ohne Locking).
   *
   * @deprecated Verwende findAndLockPending() für Race-Condition-sichere Verarbeitung
   *
   * Events werden nach createdAt ASC sortiert (FIFO), um Event-Ordering zu gewährleisten.
   * Der Index auf [status, createdAt] optimiert diese Query.
   *
   * @param limit - Maximale Anzahl Events (Default: 100, Batch Size)
   * @returns PENDING Events sortiert nach createdAt ASC
   */
  async findPendingEvents(limit = 100): Promise<OutboxEventDto[]> {
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        status: 'PENDING',
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: limit,
    });

    return events.map((event) => this.mapToDto(event));
  }

  /**
   * Findet und sperrt PENDING Events für exklusive Verarbeitung.
   *
   * Warum FOR UPDATE SKIP LOCKED statt normaler Query?
   * - Verhindert Race Conditions bei parallelen Scheduler-Instanzen
   * - Scheduler A sperrt Events 1-50, Scheduler B bekommt Events 51-100
   * - Kein Event wird doppelt verarbeitet, keines blockiert
   * - Skalierbar: Mehrere Worker können parallel arbeiten
   *
   * PostgreSQL-spezifisch: FOR UPDATE SKIP LOCKED
   * - FOR UPDATE: Exklusiver Row-Level Lock für die selektierten Zeilen
   * - SKIP LOCKED: Überspringt bereits gesperrte Zeilen (kein Warten)
   * - Lock wird bei TX COMMIT/ROLLBACK automatisch freigegeben
   *
   * WICHTIG: Lock ist nur innerhalb der Transaction gültig!
   * - Events MÜSSEN innerhalb derselben TX als published/failed markiert werden
   * - Ohne TX-Parameter werden Events NICHT gesperrt (kein Lock ohne Transaction)
   *
   * @param limit - Maximale Anzahl Events (Default: 100, Batch Size)
   * @param tx - Transaction Context für Row-Level Lock (empfohlen für Locking)
   * @returns PENDING Events sortiert nach createdAt ASC (FIFO)
   */
  async findAndLockPending(limit = 100, tx?: TransactionContext): Promise<OutboxEventDto[]> {
    const client = (tx as PrismaTransactionClient | undefined) ?? this.prisma;

    // Raw Query mit FOR UPDATE SKIP LOCKED für Pessimistic Locking
    // Der Index idx_outbox_pending_poll [status, createdAt] optimiert diese Query
    const events = await client.$queryRaw<OutboxEvent[]>`
      SELECT
        id,
        "eventName",
        "eventVersion",
        "aggregateId",
        payload,
        status,
        "retryCount",
        "lastFailureReason",
        "createdAt",
        "occurredAt",
        "publishedAt"
      FROM outbox_events
      WHERE status = 'PENDING'
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;

    this.logger.debug(`Found and locked ${events.length} pending events (limit: ${limit})`);

    return events.map((event) => this.mapToDto(event));
  }

  /**
   * Markiert ein Event als erfolgreich publiziert.
   *
   * Setzt status = PUBLISHED und publishedAt auf aktuellen Timestamp.
   * Das Event wird nicht mehr vom Polling Worker abgeholt.
   *
   * Transaction Support:
   * - Bei tx vorhanden: Update erfolgt in derselben TX wie Lock
   * - Lock wird erst bei TX COMMIT freigegeben
   *
   * @param eventId - ID des Events (Outbox ID = Domain Event ID)
   * @param tx - Optional: Transaction Context für atomare Operationen
   */
  async markAsPublished(eventId: string, tx?: TransactionContext): Promise<void> {
    const client = (tx as PrismaTransactionClient | undefined) ?? this.prisma;

    await client.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    this.logger.debug(`Marked event ${eventId} as PUBLISHED`);
  }

  /**
   * Markiert ein Event als fehlgeschlagen mit Retry-Increment.
   *
   * Incrementiert retryCount und setzt lastFailureReason.
   * Status bleibt PENDING für weitere Retry-Versuche (bis MAX_RETRIES).
   * Die Entscheidung ob status = FAILED wird, liegt beim Polling Worker.
   *
   * Transaction Support:
   * - Bei tx vorhanden: Update erfolgt in derselben TX wie Lock
   * - Lock wird erst bei TX COMMIT freigegeben
   *
   * @param eventId - ID des Events
   * @param error - Fehlermeldung für lastFailureReason
   * @param tx - Optional: Transaction Context für atomare Operationen
   */
  async markAsFailed(eventId: string, error: string, tx?: TransactionContext): Promise<void> {
    const client = (tx as PrismaTransactionClient | undefined) ?? this.prisma;

    await client.outboxEvent.update({
      where: { id: eventId },
      data: {
        retryCount: { increment: 1 },
        lastFailureReason: error.substring(0, 1000), // Limit to 1000 chars
      },
    });

    this.logger.warn(`Marked event ${eventId} as failed: ${error.substring(0, 100)}`);
  }

  /**
   * Markiert ein Event als FAILED (Dead Letter Queue).
   *
   * Wird aufgerufen bei Non-Retryable Errors (Deserialization) oder nach Max Retries.
   * Setzt status = FAILED. retryCount wird NICHT inkrementiert.
   * Optional kann eine Fehlermeldung für lastFailureReason übergeben werden.
   *
   * @param eventId - ID des Events
   * @param tx - Optional: Transaction Context für atomare Operationen
   * @param error - Optional: Fehlermeldung für lastFailureReason (für Non-Retryable Errors)
   */
  async markAsPermanentlyFailed(eventId: string, tx?: TransactionContext, error?: string): Promise<void> {
    const client = (tx as PrismaTransactionClient | undefined) ?? this.prisma;

    await client.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'FAILED',
        // Nur setzen wenn error übergeben wurde (für Non-Retryable Errors)
        ...(error && { lastFailureReason: error.substring(0, 1000) }),
      },
    });

    this.logger.error(`Event ${eventId} permanently FAILED${error ? `: ${error.substring(0, 100)}` : ''}`);
  }

  /**
   * Findet die Anzahl der aktuellen Retries für ein Event.
   *
   * @param eventId - ID des Events
   * @returns Aktueller retryCount
   */
  async getRetryCount(eventId: string): Promise<number> {
    const event = await this.prisma.outboxEvent.findUnique({
      where: { id: eventId },
      select: { retryCount: true },
    });

    return event?.retryCount ?? 0;
  }

  /**
   * Findet ein Event by ID.
   *
   * @param eventId - ID des Events
   * @returns OutboxEventDto oder null
   */
  async findById(eventId: string): Promise<OutboxEventDto | null> {
    const event = await this.prisma.outboxEvent.findUnique({
      where: { id: eventId },
    });

    return event ? this.mapToDto(event) : null;
  }

  /**
   * Mappt Prisma OutboxEvent zu OutboxEventDto.
   */
  private mapToDto(event: OutboxEvent): OutboxEventDto {
    return {
      id: event.id,
      eventName: event.eventName,
      eventVersion: event.eventVersion,
      aggregateId: event.aggregateId,
      payload: event.payload as unknown as SerializedEvent,
      status: event.status,
      retryCount: event.retryCount,
      lastFailureReason: event.lastFailureReason,
      createdAt: event.createdAt,
      occurredAt: event.occurredAt,
      publishedAt: event.publishedAt,
    };
  }
}
