import { Injectable, Logger } from '@nestjs/common';
// biome-ignore lint/style/useImportType: PrismaService needed for DI at runtime
import { PrismaService } from './prisma.service';
import type { ITransactionManager, TransactionContext } from '@domain/common/transaction';

/**
 * Prisma Implementation des ITransactionManager Interfaces.
 *
 * Implementiert Framework-agnostische Transaction Management API
 * für atomare Multi-Repository-Operationen mit Prisma ORM.
 *
 * **Warum separate Manager-Klasse?**
 * - Kapselung: Transaction-Logik ist zentralisiert (nicht über Services verstreut)
 * - Testbarkeit: ITransactionManager kann gemockt werden in Tests
 * - Abstraktion: Application Layer kennt KEINE Prisma-spezifischen Details
 * - Single Responsibility: Nur Transaction Coordination, keine Business Logic
 *
 * **Transaction Configuration:**
 * - Isolation Level: READ_COMMITTED (Prisma Default)
 * - Max Wait: 5000ms (Lock Acquisition Timeout)
 * - Timeout: 10000ms (Transaction Execution Timeout)
 *
 * **Use Cases:**
 * 1. **Transactional Outbox Pattern:** Aggregate + Events atomar persistieren
 * 2. **Multi-Aggregate Updates:** Mehrere Aggregates konsistent ändern
 * 3. **Cross-Repository Atomicity:** Garantierte Atomarität über Repository-Grenzen
 *
 * **Error Handling:**
 * - Prisma Connection Errors: Propagiert als Exception
 * - Deadlocks: Prisma wirft Exception → automatischer Rollback
 * - Timeout: Prisma wirft Exception → automatischer Rollback
 * - Business Logic Errors: Handler entscheidet (Result.fail() oder Exception)
 *
 * @implements ITransactionManager
 *
 * @example
 * ```typescript
 * // DI Setup in Module
 * @Module({
 *   providers: [
 *     { provide: DI_TOKENS.TRANSACTION_MANAGER, useClass: PrismaTransactionManager },
 *   ],
 * })
 * export class InfrastructureModule {}
 *
 * // Usage in Command Handler
 * @Injectable()
 * class CreateEinsatzHandler {
 *   constructor(
 *     @Inject(DI_TOKENS.TRANSACTION_MANAGER) private readonly txManager: ITransactionManager,
 *     @Inject(DI_TOKENS.REPOSITORIES.EINSATZ) private readonly repo: IEinsatzRepository,
 *   ) {}
 *
 *   async execute(cmd: CreateEinsatzCommand): Promise<Result<string>> {
 *     return await this.txManager.executeInTransaction(async (tx) => {
 *       const einsatz = Einsatz.create(cmd).value!;
 *       await this.repo.save(einsatz, tx);
 *       return Result.ok(einsatz.id.value);
 *     });
 *   }
 * }
 * ```
 */
@Injectable()
export class PrismaTransactionManager implements ITransactionManager {
  private readonly logger = new Logger(PrismaTransactionManager.name);

  /**
   * Constructor mit PrismaService Dependency Injection.
   *
   * @param prisma - PrismaService für $transaction() API Access
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Führt eine Operation innerhalb einer Prisma Transaction aus.
   *
   * Delegiert an Prisma's $transaction() API und wrapped das
   * Prisma TransactionClient als framework-agnostischen TransactionContext.
   *
   * **Transaction Lifecycle (Prisma):**
   * 1. BEGIN TRANSACTION (READ_COMMITTED Isolation)
   * 2. operation(tx) wird ausgeführt mit Prisma TransactionClient
   * 3. Bei Success: COMMIT
   * 4. Bei Exception: ROLLBACK + Exception re-throw
   *
   * **Timeout & Deadlock Handling:**
   * - maxWait: 5000ms - Maximale Wartezeit für Lock Acquisition
   * - timeout: 10000ms - Maximale Transaction Duration
   * - Bei Timeout: Prisma wirft Exception, Transaction wird automatisch rolled back
   * - Bei Deadlock: Prisma detektiert und wirft Exception
   *
   * **WICHTIG:**
   * - TransactionContext ist Opaque Type (unknown)
   * - Infrastructure Repositories casten zu Prisma.TransactionClient
   * - Nested Transactions sind NICHT supported (würde Exception werfen)
   *
   * @template T - Result Type der Operation
   * @param operation - Funktion die innerhalb der Transaktion ausgeführt wird
   * @returns Promise<T> - Result der Operation
   * @throws Error wenn Transaction fehlschlägt (DB-Fehler, Timeout, Deadlock)
   *
   * @example
   * ```typescript
   * // Single Repository Operation
   * const result = await txManager.executeInTransaction(async (tx) => {
   *   const saveResult = await repository.save(aggregate, tx);
   *   if (saveResult.isFailure) {
   *     throw new Error(saveResult.error); // Rollback
   *   }
   *   return Result.ok(aggregate.id);
   * });
   *
   * // Multiple Repository Operations (Atomic)
   * await txManager.executeInTransaction(async (tx) => {
   *   await einsatzRepo.save(einsatz, tx);
   *   await outboxRepo.save(events, tx);
   *   // Beide Operationen werden atomar committed oder rolled back
   * });
   * ```
   */
  async executeInTransaction<T>(operation: (tx: TransactionContext) => Promise<T>): Promise<T> {
    this.logger.debug('Starting database transaction');

    try {
      const result = await this.prisma.$transaction(
        async (prismaTx) => {
          // Prisma TransactionClient wird als Opaque TransactionContext übergeben
          // Infrastructure Repositories casten intern zu Prisma.TransactionClient
          return await operation(prismaTx as TransactionContext);
        },
        {
          // Maximale Wartezeit für DB-Lock Acquisition (Concurrent Write Contention)
          maxWait: 5000,
          // Maximale Transaktionsdauer (Deadlock Prevention + Resource Cleanup)
          timeout: 10000,
        },
      );

      this.logger.debug('Database transaction committed successfully');
      return result;
    } catch (error) {
      // Transaction wurde automatisch von Prisma rolled back
      this.logger.error('Database transaction failed and was rolled back', error);
      throw error; // Re-throw für Handler Error Handling
    }
  }
}
