import { Injectable } from '@nestjs/common';
import type { DomainEvent } from '@domain/common/domain-event';
import type { TransactionContext } from '@domain/common/transaction';
// biome-ignore lint/style/useImportType: PrismaService needed for DI at runtime
import { PrismaService } from '@/prisma/prisma.service';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';

/**
 * Abstract Base Class für transaktionale Command Handler im Transactional Outbox Pattern.
 *
 * Orchestriert Aggregate-Persistierung und Domain-Event-Speicherung in einer
 * einzelnen Datenbank-Transaktion. Garantiert atomare Persistierung von
 * State Changes (Aggregate) und Events (Outbox) - verhindert Datenverlust
 * und inkonsistente Zustände bei Fehlerszenarien.
 *
 * **Warum dieses Pattern?**
 *
 * 1. **Konsistenz-Garantie:**
 *    - Aggregate und Events werden atomar committed oder beide zurückgerollt
 *    - Keine "lost events" bei DB-Fehlern nach Aggregate-Save
 *
 * 2. **Event-Publishing Entkopplung:**
 *    - Events landen zuerst in Outbox-Tabelle (PENDING status)
 *    - OutboxEventPublisher pollt asynchron und publiziert zu Event Bus
 *    - Command Handler blockiert nicht auf externen Event Bus
 *
 * 3. **Fehlertoleranz:**
 *    - Bei Transaction-Rollback: weder Aggregate noch Events persistiert
 *    - Retry-Safe: Idempotente Operations möglich (z.B. via CUID2 IDs)
 *
 * 4. **Single Responsibility:**
 *    - Handler fokussiert auf Business Logic (executeInTransaction)
 *    - Base Class handled Transaction Coordination und Outbox Persistierung
 *
 * **Transaction-Konfiguration:**
 *
 * - `maxWait: 5000ms` - Maximale Wartezeit für DB-Lock Acquisition
 * - `timeout: 10000ms` - Maximale Transaktionsdauer (Deadlock Prevention)
 *
 * Diese Werte sind Trade-offs:
 * - Höhere Werte: Mehr Toleranz für concurrent writes, höheres Deadlock-Risiko
 * - Niedrigere Werte: Schnellere Fehler-Erkennung, höhere Retry-Rate bei Contention
 *
 * @template TCommand - Command DTO Type (z.B. CreateEinsatzCommand)
 * @template TResult - Result Type nach erfolgreicher Ausführung (z.B. EinsatzId)
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class CreateEinsatzHandler extends TransactionalCommandHandler<CreateEinsatzCommand, EinsatzId> {
 *   constructor(
 *     prisma: PrismaService,
 *     outboxRepository: IOutboxRepository,
 *     @Inject(EINSATZ_REPOSITORY) private readonly einsatzRepository: IEinsatzRepository,
 *   ) {
 *     super(prisma, outboxRepository);
 *   }
 *
 *   protected async executeInTransaction(
 *     command: CreateEinsatzCommand,
 *     tx: PrismaTransaction,
 *   ): Promise<{ result: EinsatzId; events: DomainEvent[] }> {
 *     // 1. Business Logic - Create Aggregate
 *     const einsatz = Einsatz.create({ ... });
 *
 *     // 2. Persist Aggregate in Transaction
 *     await this.einsatzRepository.save(einsatz, tx);
 *
 *     // 3. Extract Events BEFORE clearing
 *     const events = einsatz.getDomainEvents();
 *
 *     // 4. Return for atomic commit
 *     return { result: einsatz.id, events };
 *   }
 * }
 *
 * // Usage in Controller
 * const einsatzId = await handler.execute(command);
 * ```
 */
@Injectable()
export abstract class TransactionalCommandHandler<TCommand, TResult> {
  /**
   * Constructor mit Required Dependencies für Transaction Coordination.
   *
   * @param prisma - PrismaService für $transaction() API
   * @param outboxRepository - IOutboxRepository für Event-Persistierung
   */
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly outboxRepository: IOutboxRepository,
  ) {}

  /**
   * Abstract Method - Subclasses implementieren Business Logic innerhalb der Transaktion.
   *
   * **Wichtig:** Diese Methode läuft innerhalb einer Prisma Transaction (tx).
   * - Verwende den `tx` Parameter für alle DB-Operations (NICHT this.prisma)
   * - Return events NACH Domain Logic aber VOR clearDomainEvents()
   * - Events werden automatisch vom Base Handler im Outbox persistiert
   *
   * **Lifecycle:**
   * 1. Aggregate erstellen/modifizieren (Business Rules enforced)
   * 2. Aggregate.save(tx) - Persistierung in Transaction
   * 3. events = aggregate.getDomainEvents() - Events extrahieren
   * 4. return { result, events } - Für atomic commit
   * 5. [Base Handler] Outbox.save(events, tx) - Events atomar persistieren
   * 6. [Base Handler] aggregate.clearDomainEvents() - Nach erfolgreicher TX
   *
   * @param command - Validierter Command DTO
   * @param tx - Transaction Context (framework-agnostisch, Infrastructure castet zu Prisma)
   * @returns result: Business Logic Result, events: Domain Events für Outbox
   * @throws Error bei Business Rule Violations oder DB-Fehlern (triggert Rollback)
   */
  protected abstract executeInTransaction(command: TCommand, tx: TransactionContext): Promise<{ result: TResult; events: DomainEvent[] }>;

  /**
   * Public Entry Point - Führt Command in Transaction aus und persistiert Events im Outbox.
   *
   * **Transactional Flow:**
   * 1. Start Prisma Transaction (Isolation Level: READ_COMMITTED)
   * 2. Execute Business Logic (executeInTransaction)
   * 3. Save Events to Outbox (atomar in gleicher TX)
   * 4. Commit Transaction (beide persisted) oder Rollback bei Error (beide verworfen)
   *
   * **Error Handling:**
   * - Business Logic Fehler → Transaction wird automatisch zurückgerollt
   * - DB Constraint Violations → Transaction Rollback, Exception propagiert
   * - Timeout/Deadlock → Transaction abgebrochen, Retry empfohlen
   *
   * **Post-Transaction:**
   * - Events bleiben in Outbox mit status = PENDING
   * - OutboxEventPublisher pollt und publiziert asynchron
   * - Command Handler returned sofort (non-blocking)
   *
   * @param command - Validierter Command DTO
   * @returns Result der Business Logic (TResult)
   * @throws Error bei Business Rule Violations, DB Errors, oder Timeouts
   */
  async execute(command: TCommand): Promise<TResult> {
    return this.prisma.$transaction(
      async (tx) => {
        // 1. Business Logic ausführen (Aggregate erstellen/ändern + persistieren)
        // WICHTIG: tx wird als TransactionContext übergeben (Opaque Type)
        // Infrastructure Repositories casten zu PrismaTransaction
        const { result, events } = await this.executeInTransaction(command, tx as TransactionContext);

        // 2. Domain Events atomar im Outbox persistieren
        // Nur wenn Events vorhanden (z.B. Read-Only Queries haben keine Events)
        if (events.length > 0) {
          // TransactionContext wird an Infrastructure Layer übergeben
          // Infrastructure Repository castet intern zu konkretem Type (z.B. PrismaTransaction)
          await this.outboxRepository.save(events, tx as TransactionContext);
        }

        // 3. Result zurückgeben (Transaction wird committed)
        return result;
      },
      {
        // Maximale Wartezeit für DB-Lock Acquisition (Concurrent Write Contention)
        maxWait: 5000,
        // Maximale Transaktionsdauer (Deadlock Prevention + Resource Cleanup)
        timeout: 10000,
      },
    );
  }
}
