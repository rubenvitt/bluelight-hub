/**
 * Domain Layer Repository Interfaces Barrel Export.
 *
 * Diese Datei exportiert alle Repository Port Interfaces aus dem Domain Layer.
 * Repository Interfaces definieren die Abstraction zwischen Domain Layer und
 * Infrastructure Layer (Hexagonal Architecture / Ports & Adapters Pattern).
 *
 * **Warum Barrel Export:**
 * - Zentrale Import-Stelle für alle Repository Interfaces
 * - Vermeidet Deep Imports (z.B. `@domain/repositories/i-einsatz.repository`)
 * - Erleichtert Refactoring (File Moves brechen keine Imports)
 * - Bessere IDE Auto-Complete Unterstützung
 *
 * **Dependency Direction (Hexagonal Architecture):**
 * - Domain Layer: Definiert Repository Interfaces (Ports)
 * - Infrastructure Layer: Implementiert Repository Interfaces (Adapters)
 * - Application Layer: Nutzt Repository Interfaces via Dependency Injection
 *
 * **Import Pattern:**
 * ```typescript
 * // Application Layer
 * import { IEinsatzRepository } from '@domain/repositories';
 *
 * // Infrastructure Layer
 * import { IEinsatzRepository } from '@domain/repositories';
 * class PrismaEinsatzRepository implements IEinsatzRepository { ... }
 * ```
 *
 * **WICHTIG:**
 * - Nur Interfaces exportieren (i-*.repository.ts Dateien)
 * - KEINE Implementierungen hier (die gehören in Infrastructure Layer)
 * - KEINE Prisma/TypeORM/etc. Types (Domain bleibt framework-agnostisch)
 */

// Einsatz Repository Interface
export { IEinsatzRepository } from './ieinsatz.repository';

// Einsatztagebuch (ETB) Repository Interface
export { IEtbRepository } from './i-etb.repository';

// Lagekarte Repository Interface
export { ILagekarteRepository } from './i-lagekarte.repository';

// Outbox Repository Interface (Transactional Outbox Pattern)
export {
  IOutboxRepository,
  type OutboxEventDto,
  type OutboxEventStatus,
} from './i-outbox.repository';

// User Repository Interface
export { IUserRepository } from './i-user.repository';
