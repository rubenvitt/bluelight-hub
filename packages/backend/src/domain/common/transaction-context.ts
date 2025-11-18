/**
 * Opaque Transaction Context Type für Hexagonal Architecture.
 *
 * **Warum Opaque Type:**
 * - Domain Layer kennt KEINE technischen Details der Transaktion (kein Prisma, kein TypeORM)
 * - Infrastructure Layer kann eigene Transaction-Implementierung verwenden
 * - Ermöglicht Framework-Agnostic Domain Layer
 *
 * **Warum `unknown` statt `any`:**
 * - Type-Safe: Caller kann TransactionContext nicht direkt manipulieren
 * - Pass-Through Pattern: Domain Layer reicht Context nur durch, nutzt ihn aber nicht
 * - Infrastructure Layer castet zu konkretem Typ (z.B. `Prisma.TransactionClient`)
 *
 * **Use Case:**
 * ```typescript
 * // Domain Layer (Repository Interface)
 * interface IUserRepository {
 *   save(user: UserAggregate, tx?: TransactionContext): Promise<Result<void>>;
 * }
 *
 * // Infrastructure Layer (Prisma Implementation)
 * class PrismaUserRepository implements IUserRepository {
 *   async save(user: UserAggregate, tx?: TransactionContext): Promise<Result<void>> {
 *     const prismaClient = tx ? (tx as Prisma.TransactionClient) : this.prisma;
 *     // ... use prismaClient for operations
 *   }
 * }
 * ```
 *
 * **Transaction Flow:**
 * 1. Application Layer startet Transaction (z.B. `prisma.$transaction()`)
 * 2. Application Layer ruft Domain Service auf mit TransactionContext
 * 3. Domain Service ruft Repository auf mit TransactionContext (Pass-Through)
 * 4. Infrastructure Layer nutzt TransactionContext für Datenbankoperationen
 *
 * @see {@link https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-8.html#conditional-types Opaque Types in TypeScript}
 */
export type TransactionContext = unknown;
