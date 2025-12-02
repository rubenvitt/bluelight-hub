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
