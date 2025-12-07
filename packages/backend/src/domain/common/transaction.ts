/**
 * Opaque Transaction Context Type für Framework-Agnostische Transaction Support.
 *
 * Dieser Typ abstrahiert Transaktions-Details von der Persistence-Technologie
 * und ermöglicht es dem Domain Layer, vollständig framework-agnostisch zu bleiben.
 *
 * **Warum Opaque Type (unknown)?**
 * - Domain Layer kennt KEINE Persistence-Details (Prisma, TypeORM, etc.)
 * - Infrastructure Layer kann zu konkretem Type casten (z.B. Prisma.TransactionClient)
 * - Ermöglicht Austausch der Persistence-Technologie ohne Domain-Änderungen
 * - Verhindert versehentliche Type-Dependencies vom Domain auf Infrastructure
 *
 * **Hexagonale Architektur:**
 * - PORT: Repository Interfaces verwenden `TransactionContext`
 * - ADAPTER: Infrastructure Repositories casten zu `PrismaTransaction`
 * - Dependency Direction: Infrastructure → Domain (NICHT umgekehrt!)
 *
 * **Transaction Handling Pattern:**
 * ```typescript
 * // Domain Layer (Repository Interface)
 * interface IEinsatzRepository {
 *   save(aggregate: Einsatz, tx?: TransactionContext): Promise<Result<void>>;
 * }
 *
 * // Infrastructure Layer (Repository Implementation)
 * class PrismaEinsatzRepository implements IEinsatzRepository {
 *   async save(aggregate: Einsatz, tx?: TransactionContext): Promise<Result<void>> {
 *     // Cast zu konkretem Type in Infrastructure Layer
 *     const client = (tx as PrismaTransaction | undefined) ?? this.prisma;
 *     // ... use client
 *   }
 * }
 *
 * // Application Layer (Command Handler)
 * class CreateEinsatzHandler {
 *   async execute(command: CreateEinsatzCommand): Promise<void> {
 *     await this.prisma.$transaction(async (tx) => {
 *       // tx ist PrismaTransaction, wird als TransactionContext übergeben
 *       await this.einsatzRepository.save(aggregate, tx);
 *       await this.outboxRepository.save(events, tx);
 *     });
 *   }
 * }
 * ```
 *
 * **WICHTIG:**
 * - Dieser Type darf NIEMALS zu einem konkreten Type (z.B. Prisma Type) werden!
 * - Type Casting erfolgt AUSSCHLIESSLICH im Infrastructure Layer
 * - Domain Layer bleibt dadurch testbar mit In-Memory Repositories
 *
 * @example
 * ```typescript
 * // ✅ RICHTIG: Domain Layer Interface
 * interface IEinsatzRepository {
 *   save(aggregate: Einsatz, tx?: TransactionContext): Promise<Result<void>>;
 * }
 *
 * // ❌ FALSCH: Domain Layer würde Infrastructure Type kennen
 * interface IEinsatzRepository {
 *   save(aggregate: Einsatz, tx?: PrismaTransaction): Promise<Result<void>>;
 * }
 * ```
 */
export type TransactionContext = unknown;

/**
 * Framework-agnostisches Transaction Manager Interface.
 *
 * Ermöglicht atomare Operationen über Repository-Grenzen hinweg,
 * ohne dass der Domain/Application Layer Framework-Details kennen muss.
 *
 * **Warum ITransactionManager?**
 * - Abstraktion: Domain Layer kennt KEINE Framework-spezifischen Transaction-APIs
 * - Testbarkeit: In Tests kann Mock-Implementation verwendet werden
 * - Flexibilität: Infrastructure kann Prisma, TypeORM, oder Custom Solution nutzen
 * - Single Responsibility: Transaction Management ist klar separiert
 *
 * **Implementierung:**
 * - Infrastructure Layer implementiert ITransactionManager (z.B. PrismaTransactionManager)
 * - Application Layer injiziert ITransactionManager via DI
 * - TransactionContext wird als Opaque Type durch den Stack gereicht
 *
 * **Use Cases:**
 * 1. **Transactional Outbox Pattern:** Aggregate + Events atomar persistieren
 * 2. **Multi-Aggregate Consistency:** Mehrere Aggregates in einer Transaction
 * 3. **Cross-Bounded-Context Transactions:** (selten, aber möglich bei Strong Consistency Requirement)
 *
 * @example
 * ```typescript
 * // Infrastructure Layer (Prisma Implementation)
 * @Injectable()
 * class PrismaTransactionManager implements ITransactionManager {
 *   constructor(private readonly prisma: PrismaService) {}
 *
 *   async executeInTransaction<T>(
 *     operation: (tx: TransactionContext) => Promise<T>
 *   ): Promise<T> {
 *     return await this.prisma.$transaction(async (prismaTx) => {
 *       return await operation(prismaTx as TransactionContext);
 *     });
 *   }
 * }
 *
 * // Application Layer (Command Handler)
 * @Injectable()
 * class CreateEinsatzHandler {
 *   constructor(
 *     private readonly txManager: ITransactionManager,
 *     @Inject(EINSATZ_REPOSITORY) private readonly repo: IEinsatzRepository,
 *     @Inject(OUTBOX_REPOSITORY) private readonly outbox: IOutboxRepository
 *   ) {}
 *
 *   async execute(cmd: CreateEinsatzCommand): Promise<Result<string>> {
 *     return await this.txManager.executeInTransaction(async (tx) => {
 *       const einsatz = Einsatz.create(cmd).value!;
 *       await this.repo.save(einsatz, tx);
 *       await this.outbox.save(einsatz.getDomainEvents(), tx);
 *       return Result.ok(einsatz.id.value);
 *     });
 *   }
 * }
 * ```
 */
export interface ITransactionManager {
  /**
   * Führt eine Operation innerhalb einer Transaktion aus.
   *
   * Die Transaktion wird automatisch committed bei Erfolg
   * oder rolled back bei Fehler (Exception).
   *
   * **Transaction Lifecycle:**
   * 1. Transaction START (z.B. Prisma BEGIN TRANSACTION)
   * 2. operation(tx) wird ausgeführt
   * 3. Bei Success: COMMIT
   * 4. Bei Exception: ROLLBACK + Exception propagieren
   *
   * **Error Handling:**
   * - Business Logic Fehler: Result.fail() returnen (Handler entscheidet ob Commit/Rollback)
   * - Unerwartete Fehler: Exception werfen → automatischer Rollback
   * - Infrastructure Fehler (DB Connection): Exception propagieren
   *
   * **WICHTIG:**
   * - operation erhält TransactionContext (Opaque Type)
   * - Repositories müssen tx Parameter akzeptieren und nutzen
   * - Nested Transactions sind NICHT supported (Infrastructure kann dies ggf. via Savepoints lösen)
   *
   * @template T - Result Type der Operation
   * @param operation - Funktion die innerhalb der Transaktion ausgeführt wird
   * @returns Promise<T> - Result der Operation
   * @throws Error wenn Transaction fehlschlägt (DB-Fehler, Timeout, Deadlock)
   *
   * @example
   * ```typescript
   * // Single Repository Operation
   * await txManager.executeInTransaction(async (tx) => {
   *   await repository.save(aggregate, tx);
   *   return Result.ok(aggregate.id);
   * });
   *
   * // Multiple Repository Operations (Atomic)
   * await txManager.executeInTransaction(async (tx) => {
   *   await einsatzRepo.save(einsatz, tx);
   *   await outboxRepo.save(events, tx);
   *   await lagekarteRepo.save(lagekarte, tx);
   *   return Result.ok();
   * });
   * ```
   */
  executeInTransaction<T>(operation: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
