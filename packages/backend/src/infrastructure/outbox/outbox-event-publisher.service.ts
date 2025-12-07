import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { TransactionContext } from '@domain/common/transaction';
import { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import type { OutboxEventDto } from '@domain/repositories/i-outbox.repository';
import type { IAlertService } from '@domain/services/ports/i-alert.service';
import { EVENT_PUBLISHER, ALERT_SERVICE } from '@/infrastructure/di-tokens';
import { PrismaService } from '@/prisma/prisma.service';
import { PrismaOutboxRepository } from './prisma-outbox.repository';
import { EventDeserializer } from './event-deserializer';

/**
 * Konfiguration für den Outbox Event Publisher.
 */
export interface OutboxPublisherConfig {
  /** Maximale Anzahl Retries bevor Event als FAILED markiert wird */
  maxRetries: number;
  /** Batch-Größe für Polling (max Events pro Durchlauf) */
  batchSize: number;
}

/**
 * Default-Konfiguration für den Outbox Event Publisher.
 */
export const DEFAULT_OUTBOX_PUBLISHER_CONFIG: OutboxPublisherConfig = {
  maxRetries: 3,
  batchSize: 100,
};

/**
 * Injection Token für OutboxPublisherConfig.
 */
export const OUTBOX_PUBLISHER_CONFIG = 'OUTBOX_PUBLISHER_CONFIG';

/**
 * Outbox Event Publisher Service (Polling Worker).
 *
 * Dieser Service pollt regelmäßig die Outbox-Tabelle nach PENDING Events
 * und publiziert diese via EventEmitter2. Fehlgeschlagene Events werden
 * bis zu MAX_RETRIES Mal wiederholt, danach als FAILED markiert.
 *
 * **Transactional Outbox Pattern:**
 * Events werden atomar mit dem Aggregate in einer DB-Transaktion gespeichert.
 * Der Polling Worker holt diese Events und publiziert sie asynchron.
 * → Keine Event-Verluste bei App-Crash zwischen save() und publish().
 *
 * **Race Condition Prevention (Story 0-2):**
 * - PostgreSQL FOR UPDATE SKIP LOCKED verhindert Duplikate bei parallelen Schedulern
 * - Scheduler A sperrt Events 1-50, Scheduler B bekommt Events 51-100
 * - Lock wird erst bei Transaction COMMIT freigegeben
 * - `isRunning` Flag bleibt als zusätzliche In-Process-Sicherheit (Defense in Depth)
 *
 * **Error Handling:**
 * - Deserialization Errors → Event wird direkt FAILED (nicht retry-bar)
 * - Handler Errors → Retry mit incrementiertem retryCount
 * - Nach MAX_RETRIES → FAILED Status + Alert Notification
 *
 * @example
 * ```typescript
 * // Module Registration:
 * @Module({
 *   imports: [ScheduleModule.forRoot()],
 *   providers: [OutboxEventPublisher],
 * })
 * export class OutboxModule {}
 * ```
 */
@Injectable()
export class OutboxEventPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxEventPublisher.name);
  private isRunning = false;
  private isEnabled = true;
  private readonly config: OutboxPublisherConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxRepository: PrismaOutboxRepository,
    private readonly eventDeserializer: EventDeserializer,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
    @Optional() @Inject(ALERT_SERVICE) private readonly alertService?: IAlertService,
    @Optional() @Inject(OUTBOX_PUBLISHER_CONFIG) config?: OutboxPublisherConfig,
  ) {
    this.config = config ?? DEFAULT_OUTBOX_PUBLISHER_CONFIG;
  }

  /**
   * Lifecycle Hook: Logging bei Module-Start.
   */
  onModuleInit(): void {
    this.logger.log('OutboxEventPublisher started', {
      batchSize: this.config.batchSize,
      maxRetries: this.config.maxRetries,
    });
  }

  /**
   * Lifecycle Hook: Graceful Shutdown bei Module-Destroy.
   */
  onModuleDestroy(): void {
    this.isEnabled = false;
    this.logger.log('OutboxEventPublisher stopped');
  }

  /**
   * Cron Job: Pollt alle 5 Sekunden nach PENDING Events.
   *
   * Warum 5 Sekunden?
   * - Kurz genug für Near-Real-Time Event Delivery
   * - Lang genug um DB-Load zu minimieren
   * - Bei hohem Event-Volumen kann Intervall angepasst werden
   */
  @Cron(CronExpression.EVERY_5_SECONDS)
  async publishPendingEvents(): Promise<void> {
    // Concurrent Prevention: Skip if already running
    if (this.isRunning) {
      this.logger.debug('Skipping: Previous job still running');
      return;
    }

    // Graceful Shutdown: Skip if disabled
    if (!this.isEnabled) {
      return;
    }

    this.isRunning = true;

    try {
      await this.processPendingEvents();
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Verarbeitet PENDING Events aus der Outbox mit Pessimistic Locking.
   *
   * Warum Transaction mit FOR UPDATE SKIP LOCKED?
   * - Verhindert Race Conditions bei parallelen Scheduler-Instanzen
   * - Jedes Event wird exakt einmal verarbeitet, auch bei horizontaler Skalierung
   * - Lock wird bei Transaction COMMIT/ROLLBACK automatisch freigegeben
   *
   * Flow:
   * 1. Starte Transaction
   * 2. Lade und LOCKE PENDING Events (FOR UPDATE SKIP LOCKED)
   * 3. Für jedes Event (innerhalb der TX):
   *    a. Deserialize JSON → DomainEvent
   *    b. Publish via EventEmitter2
   *    c. Mark as PUBLISHED oder handle Failure
   * 4. Commit Transaction → Locks werden freigegeben
   */
  private async processPendingEvents(): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        // findAndLockPending() verwendet FOR UPDATE SKIP LOCKED
        // Andere Scheduler-Instanzen überspringen diese Events automatisch
        const events = await this.outboxRepository.findAndLockPending(this.config.batchSize, tx as TransactionContext);

        if (events.length === 0) {
          return;
        }

        this.logger.debug(`Processing ${events.length} pending events (locked)`);

        for (const event of events) {
          await this.processEvent(event, tx as TransactionContext);
        }

        this.logger.debug(`Finished processing ${events.length} events`);
      },
      {
        // Transaction Timeout: 10 Sekunden (wie in TransactionalCommandHandler)
        timeout: 10000,
        maxWait: 5000,
      },
    );
  }

  /**
   * Verarbeitet ein einzelnes Outbox Event innerhalb einer Transaction.
   *
   * Error Handling:
   * - Deserialization Error → Mark as FAILED immediately (non-retryable)
   * - Handler Error → Increment retryCount, mark FAILED after maxRetries
   *
   * WICHTIG: Alle DB-Operationen nutzen den übergebenen Transaction Context,
   * damit der Row-Level Lock bis zum COMMIT gehalten wird.
   *
   * @param outboxEvent - Das zu verarbeitende Event
   * @param tx - Transaction Context für atomare Operationen
   */
  private async processEvent(outboxEvent: OutboxEventDto, tx: TransactionContext): Promise<void> {
    const { id, eventName, retryCount } = outboxEvent;

    try {
      // Step 1: Deserialize JSON → DomainEvent
      // Cast payload zu SerializedEvent (im Domain Interface als unknown deklariert für Framework-Agnostik)
      const deserializeResult = this.eventDeserializer.deserialize(outboxEvent.payload as Parameters<typeof this.eventDeserializer.deserialize>[0]);

      if (deserializeResult.isFailure) {
        // Non-retryable: Deserialization failed (corrupt data)
        // WICHTIG: Kein markAsFailed() → retryCount bleibt bei 0 (AC3: Deserialization Errors Non-Retryable)
        const errorMessage = deserializeResult.error ?? 'Unknown deserialization error';
        this.logger.error(`Deserialization failed for event ${id}`, {
          eventName,
          error: errorMessage,
        });
        await this.outboxRepository.markAsPermanentlyFailed(id, tx, errorMessage);
        await this.notifyFailure(outboxEvent, errorMessage);
        return;
      }

      // Guard: Nach isFailure-Check ist value garantiert definiert
      // (Result Pattern: isFailure === false impliziert value !== undefined)
      const domainEvent = deserializeResult.value;
      if (!domainEvent) {
        // Sollte nie erreicht werden, aber TypeScript braucht den Check
        throw new Error(`Unexpected: deserializeResult.value is undefined after success check`);
      }

      // Step 2: Publish via EventEmitter2
      await this.eventPublisher.publish(domainEvent);

      // Step 3: Mark as PUBLISHED (innerhalb der Transaction → Lock bleibt gehalten)
      await this.outboxRepository.markAsPublished(id, tx);
      this.logger.debug(`Event ${id} published successfully`, { eventName });
    } catch (error) {
      // Handler Error: Retryable
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Event ${id} failed`, { eventName, error: errorMessage, retryCount });

      await this.outboxRepository.markAsFailed(id, errorMessage, tx);

      // Check if max retries reached
      const newRetryCount = retryCount + 1;
      if (newRetryCount >= this.config.maxRetries) {
        this.logger.error(`Event ${id} exceeded max retries (${this.config.maxRetries})`, { eventName });
        await this.outboxRepository.markAsPermanentlyFailed(id, tx);
        await this.notifyFailure(outboxEvent, errorMessage);
      }
    }
  }

  /**
   * Benachrichtigt über fehlgeschlagene Events via AlertService.
   *
   * Nutzt den IAlertService Port um SUPER_ADMIN User über kritische
   * Fehler zu informieren. Falls kein AlertService konfiguriert ist,
   * wird nur geloggt (Graceful Degradation).
   *
   * @param event - Das fehlgeschlagene Event
   * @param error - Die Fehlermeldung
   */
  private async notifyFailure(event: OutboxEventDto, error: string): Promise<void> {
    // Always log for visibility
    this.logger.error(`ALERT: Event ${event.id} permanently failed`, {
      eventName: event.eventName,
      aggregateId: event.aggregateId,
      error,
      retryCount: event.retryCount,
    });

    // Notify via AlertService if configured
    if (this.alertService) {
      try {
        await this.alertService.notifyOutboxFailure({
          eventId: event.id,
          eventName: event.eventName,
          aggregateId: event.aggregateId,
          lastError: error,
          retryCount: event.retryCount,
          occurredAt: event.occurredAt,
          failedAt: new Date(),
        });
      } catch (alertError) {
        // Fire-and-Forget: Log aber nicht propagieren
        this.logger.warn('Failed to send alert notification', {
          error: alertError instanceof Error ? alertError.message : String(alertError),
        });
      }
    }
  }

  /**
   * Manueller Trigger für Testing und Debugging.
   * Ermöglicht das sofortige Verarbeiten von Events ohne Cron-Wartezeit.
   */
  async triggerManually(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Publisher already running');
    }
    await this.publishPendingEvents();
  }
}
