import type { DomainEvent } from '@domain/common/domain-event';
import type { TransactionContext } from '@domain/common/transaction';

/**
 * Outbox Event DTO für Repository-Rückgaben.
 * Enthält alle Felder der OutboxEvent-Tabelle.
 *
 * Warum DTO statt Domain Entity?
 * - Outbox ist Infrastructure-Concern, kein Domain Aggregate
 * - DTO transportiert Daten zwischen Layers ohne Business Logic
 */
export interface OutboxEventDto {
  id: string;
  eventName: string;
  eventVersion: number;
  aggregateId: string;
  payload: unknown;
  status: OutboxEventStatus;
  retryCount: number;
  lastFailureReason: string | null;
  createdAt: Date;
  occurredAt: Date;
  publishedAt: Date | null;
}

/**
 * Status eines Outbox Events.
 *
 * - PENDING: Event wartet auf Publishing
 * - PUBLISHED: Event erfolgreich publiziert
 * - FAILED: Event nach max Retries fehlgeschlagen (Dead Letter)
 */
export type OutboxEventStatus = 'PENDING' | 'PUBLISHED' | 'FAILED';

/**
 * Repository Port Interface für Transactional Outbox Pattern.
 *
 * Definiert die Abstraction zwischen Domain/Application Layer und Infrastructure Layer
 * für das Outbox Pattern. Events werden atomar mit Aggregates committed und später
 * asynchron publiziert.
 *
 * Warum Outbox Pattern?
 * - Garantiert Atomarität zwischen Aggregate-Änderung und Event-Persistierung
 * - Kein Dual-Write Problem (DB + Message Broker gleichzeitig)
 * - Events gehen niemals verloren (erst published, dann gelöscht/markiert)
 *
 * Race Condition Prevention (Story 0-2):
 * - findAndLockPending() verwendet PostgreSQL FOR UPDATE SKIP LOCKED
 * - Mehrere Scheduler-Instanzen können parallel laufen ohne Duplikate
 * - Jedes Event wird exakt einmal verarbeitet
 *
 * Design Constraints:
 * - KEINE Prisma Types in Signaturen (Framework-Agnostik)
 * - TransactionContext für atomare Operationen
 * - Alle Methods async (I/O Boundary)
 *
 * @example
 * ```typescript
 * // Atomare Event-Persistierung mit Aggregate (Application Layer)
 * await prisma.$transaction(async (tx) => {
 *   await einsatzRepository.save(aggregate, tx);
 *   await outboxRepository.save(aggregate.domainEvents, tx);
 * });
 * aggregate.clearDomainEvents();
 *
 * // Race-Condition-sichere Event-Verarbeitung (Scheduler)
 * await prisma.$transaction(async (tx) => {
 *   const events = await outboxRepository.findAndLockPending(100, tx);
 *   for (const event of events) {
 *     await eventPublisher.publish(event);
 *     await outboxRepository.markAsPublished(event.id, tx);
 *   }
 * });
 * ```
 */
export interface IOutboxRepository {
  /**
   * Persistiert Domain Events atomar in der Outbox-Tabelle.
   *
   * Events werden als PENDING gespeichert und später vom Polling Worker
   * abgeholt und publiziert. Die Serialisierung erfolgt via EventSerializer.
   *
   * Transaction Support (Transactional Outbox Pattern):
   * - Bei tx vorhanden: Events werden in derselben TX wie Aggregate committed
   * - Bei tx nicht vorhanden: Events werden in eigener Transaction committed
   *
   * @param events - Domain Events zum Persistieren
   * @param tx - Optional: Transaction Context für atomare Operationen
   */
  save(events: DomainEvent[], tx?: TransactionContext): Promise<void>;

  /**
   * Findet und sperrt PENDING Events für exklusive Verarbeitung.
   *
   * Warum FOR UPDATE SKIP LOCKED?
   * - Verhindert Race Conditions bei parallelen Scheduler-Instanzen
   * - Scheduler A sperrt Events 1-50, Scheduler B bekommt Events 51-100
   * - Kein Event wird doppelt verarbeitet, keines blockiert
   *
   * WICHTIG: Lock ist nur innerhalb der Transaction gültig!
   * - Events MÜSSEN innerhalb derselben TX als published markiert werden
   * - Lock wird bei TX COMMIT/ROLLBACK automatisch freigegeben
   *
   * @param limit - Maximale Anzahl Events (Default: 100, Batch Size)
   * @param tx - Transaction Context für Row-Level Lock (REQUIRED for locking!)
   * @returns PENDING Events sortiert nach createdAt ASC (FIFO)
   */
  findAndLockPending(limit?: number, tx?: TransactionContext): Promise<OutboxEventDto[]>;

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
  markAsPublished(eventId: string, tx?: TransactionContext): Promise<void>;

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
  markAsFailed(eventId: string, error: string, tx?: TransactionContext): Promise<void>;

  /**
   * Markiert ein Event als FAILED (Dead Letter Queue).
   *
   * Wird aufgerufen bei:
   * - Non-retryable Errors (z.B. Deserialization-Fehler, korrupte Payloads)
   * - Max Retries erreicht (nach Handler-Fehlern)
   *
   * Setzt status = FAILED und optional lastFailureReason.
   * Das Event wird nicht mehr vom Polling Worker abgeholt.
   * retryCount wird NICHT inkrementiert (wichtig für Non-Retryable Errors!).
   *
   * Transaction Support:
   * - Bei tx vorhanden: Update erfolgt in derselben TX wie Lock
   * - Lock wird erst bei TX COMMIT freigegeben
   *
   * @param eventId - ID des Events
   * @param tx - Optional: Transaction Context für atomare Operationen
   * @param error - Optional: Fehlermeldung für lastFailureReason (für Non-Retryable Errors)
   */
  markAsPermanentlyFailed(eventId: string, tx?: TransactionContext, error?: string): Promise<void>;

  /**
   * Findet die Anzahl der aktuellen Retries für ein Event.
   *
   * @param eventId - ID des Events
   * @returns Aktueller retryCount
   */
  getRetryCount(eventId: string): Promise<number>;
}
