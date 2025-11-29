import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { OutboxEvent, OutboxEventStatus } from '@prisma/client';
import type { DomainEvent } from '@domain/common/domain-event';
import { PrismaService } from '@/prisma/prisma.service';
import { EventSerializer, type SerializedEvent } from './event-serializer';

/**
 * Prisma Transaction Type für atomare Operationen.
 * Wird verwendet, um Events in derselben Transaktion wie das Aggregate zu persistieren.
 */
export type PrismaTransaction = Omit<PrismaService, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Outbox Event DTO für Repository-Rückgaben.
 * Enthält alle Felder der OutboxEvent-Tabelle.
 */
export interface OutboxEventDto {
  id: string;
  eventName: string;
  eventVersion: number;
  aggregateId: string;
  payload: SerializedEvent;
  status: OutboxEventStatus;
  retryCount: number;
  lastFailureReason: string | null;
  createdAt: Date;
  occurredAt: Date;
  publishedAt: Date | null;
}

/**
 * Repository Interface für Outbox Pattern (Port).
 * Definiert die Schnittstelle für Outbox-Operationen.
 */
export interface IOutboxRepository {
  /**
   * Persistiert Domain Events atomar in der Outbox-Tabelle.
   *
   * @param events - Domain Events zum Persistieren
   * @param tx - Optional: Prisma Transaction für atomare Operationen
   */
  save(events: DomainEvent[], tx?: PrismaTransaction): Promise<void>;

  /**
   * Lädt PENDING Events für Polling-Worker.
   *
   * @param limit - Maximale Anzahl Events (Default: 100)
   * @returns PENDING Events sortiert nach createdAt ASC
   */
  findPendingEvents(limit?: number): Promise<OutboxEventDto[]>;

  /**
   * Markiert ein Event als erfolgreich publiziert.
   *
   * @param eventId - ID des Events (Outbox ID, nicht Domain Event ID)
   */
  markAsPublished(eventId: string): Promise<void>;

  /**
   * Markiert ein Event als fehlgeschlagen mit Retry-Increment.
   *
   * @param eventId - ID des Events (Outbox ID, nicht Domain Event ID)
   * @param error - Fehlermeldung für lastFailureReason
   */
  markAsFailed(eventId: string, error: string): Promise<void>;

  /**
   * Findet die Anzahl der aktuellen Retries für ein Event.
   *
   * @param eventId - ID des Events
   * @returns Aktueller retryCount
   */
  getRetryCount(eventId: string): Promise<number>;
}

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
   * @param tx - Optional: Prisma Transaction für atomare Operationen
   */
  async save(events: DomainEvent[], tx?: PrismaTransaction): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const client = tx ?? this.prisma;

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
   * Lädt PENDING Events für Polling-Worker.
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
   * Markiert ein Event als erfolgreich publiziert.
   *
   * Setzt status = PUBLISHED und publishedAt auf aktuellen Timestamp.
   * Das Event wird nicht mehr vom Polling Worker abgeholt.
   *
   * @param eventId - ID des Events (Outbox ID = Domain Event ID)
   */
  async markAsPublished(eventId: string): Promise<void> {
    await this.prisma.outboxEvent.update({
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
   * @param eventId - ID des Events
   * @param error - Fehlermeldung für lastFailureReason
   */
  async markAsFailed(eventId: string, error: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        retryCount: { increment: 1 },
        lastFailureReason: error.substring(0, 1000), // Limit to 1000 chars
      },
    });

    this.logger.warn(`Marked event ${eventId} as failed: ${error.substring(0, 100)}`);
  }

  /**
   * Markiert ein Event als FAILED (nach Max Retries).
   *
   * Setzt status = FAILED. Das Event wird nicht mehr vom Polling Worker
   * abgeholt und erfordert manuelle Intervention oder Alert-Benachrichtigung.
   *
   * @param eventId - ID des Events
   */
  async markAsPermanentlyFailed(eventId: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'FAILED',
      },
    });

    this.logger.error(`Event ${eventId} permanently FAILED`);
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
