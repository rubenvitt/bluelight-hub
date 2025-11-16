import type { Result } from '@domain/common/result';
import type { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';

/**
 * Repository Port Interface für Einsatz Aggregate Persistence.
 *
 * Definiert die Abstraction zwischen Domain Layer und Infrastructure Layer.
 * Implementierung erfolgt in Infrastructure Layer (Epic 4) via Prisma Repository Adapter.
 *
 * Warum Repository Pattern?
 * - Entkoppelt Domain Logic von Persistence Details (Framework-Agnostik)
 * - Ermöglicht In-Memory Implementierung für Testing
 * - Erlaubt Austausch von Persistence Technologie ohne Domain Changes
 * - Single Responsibility: Domain fokussiert sich auf Business Logic
 *
 * Design Constraints:
 * - KEINE Prisma Types in Signaturen (würde Domain Layer kontaminieren)
 * - Result<T> Pattern für explizite Error Handling
 * - Alle Methods async (I/O Boundary)
 * - NO delete() Method (NO-DELETE Policy enforcement)
 *
 * @example
 * ```typescript
 * // Infrastructure Layer Implementation (Epic 4)
 * class PrismaEinsatzRepository implements IEinsatzRepository {
 *   async save(aggregate: Einsatz): Promise<Result<void>> {
 *     // Map Aggregate → Prisma Model → DB
 *   }
 *
 *   async findById(id: EinsatzId): Promise<Result<Einsatz | null>> {
 *     // DB → Prisma Model → Map to Aggregate
 *   }
 * }
 *
 * // Application Layer Usage (Epic 4)
 * class CreateEinsatzCommandHandler {
 *   constructor(private repo: IEinsatzRepository) {}
 *
 *   async execute(cmd: CreateEinsatzCommand): Promise<Result<void>> {
 *     const einsatz = Einsatz.create(cmd);
 *     return await this.repo.save(einsatz.value!);
 *   }
 * }
 * ```
 */
export interface IEinsatzRepository {
  /**
   * Speichert ein Einsatz Aggregate (Create oder Update).
   *
   * Warum kein separates update()?
   * - Aggregate Root entscheidet über Create vs Update (via ID Existenz)
   * - Infrastructure Layer prüft ob ID existiert und führt INSERT/UPDATE aus
   * - Vereinfacht Domain API (ein Method für beide Operationen)
   *
   * Event Publishing:
   * - Infrastructure Layer ist verantwortlich für Event Publishing nach save()
   * - Via Transactional Outbox Pattern (Epic 4)
   *
   * @param aggregate - Das zu speichernde Einsatz Aggregate
   * @returns Result<void> - Success (void) oder Failure mit Error Message
   *
   * @example
   * ```typescript
   * const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy: userId }).value!;
   * const result = await repository.save(einsatz);
   * if (result.isFailure) {
   *   console.error(result.error); // "Database connection failed"
   * }
   * ```
   */
  save(aggregate: Einsatz): Promise<Result<void>>;

  /**
   * Findet ein Einsatz Aggregate by ID.
   *
   * Warum null statt Result.fail()?
   * - "Not found" ist kein Error sondern valides Resultat
   * - Caller kann explizit prüfen: if (result.value === null)
   * - Echte Errors (DB Connection Failed) via Result.fail()
   *
   * Aggregate Reconstruction:
   * - Infrastructure Layer mapped Prisma Model → Domain Aggregate
   * - Alle Events werden NICHT rekonstruiert (nur aktueller State)
   * - Event Sourcing würde Events aus Event Store laden
   *
   * @param id - Type-Safe EinsatzId (verhindert String ID Primitive Obsession)
   * @returns Result<Einsatz | null> - Success mit Aggregate oder null wenn nicht gefunden
   *
   * @example
   * ```typescript
   * const id = EinsatzId.create('A1B2C3D4E5F6G7H8I9J0K').value!;
   * const result = await repository.findById(id);
   * if (result.isSuccess) {
   *   if (result.value === null) {
   *     console.log('Einsatz not found');
   *   } else {
   *     console.log(result.value.alarmstichwort);
   *   }
   * }
   * ```
   */
  findById(id: EinsatzId): Promise<Result<Einsatz | null>>;

  /**
   * Findet alle aktiven Einsätze (Status !== ARCHIVIERT).
   *
   * Warum findActive() statt findAll()?
   * - DRK-Compliance: Archivierte Einsätze sind rechtlich relevant aber operativ irrelevant
   * - UI zeigt nur aktive Einsätze (Archivierte in separatem "Archiv" View)
   * - Performance: Reduziert Result Set (Archive wächst über Jahre)
   *
   * Filtering Logic:
   * - Infrastructure Layer filtert via SQL WHERE status != 'ARCHIVIERT'
   * - Domain Layer Definition was "aktiv" bedeutet bleibt hier (nicht in Infrastructure)
   *
   * @returns Result<Einsatz[]> - Success mit Array (leer wenn keine aktiven Einsätze)
   *
   * @example
   * ```typescript
   * const result = await repository.findActive();
   * if (result.isSuccess) {
   *   const activeEinsaetze = result.value!;
   *   console.log(`${activeEinsaetze.length} aktive Einsätze`);
   * }
   * ```
   */
  findActive(): Promise<Result<Einsatz[]>>;

  /**
   * Findet ein Einsatz Aggregate by Einsatznummer.
   *
   * Warum separate Method (statt Generic Query)?
   * - Einsatznummer ist Business Key (Alternative ID für User-Facing Referenzen)
   * - UI verwendet Einsatznummer für Suche (User kennen keine UUIDs/Nanoids)
   * - Performance: Infrastructure Layer kann Index auf Nummer anlegen
   *
   * Uniqueness Constraint:
   * - Infrastructure Layer enforced UNIQUE constraint auf `nummer` Column
   * - Domain Layer generiert Nummer via nanoid (collision-resistant)
   * - Race Condition Handling via DB Unique Constraint Error
   *
   * @param nummer - Einsatznummer (z.B. "E2024-A1B2C3")
   * @returns Result<Einsatz | null> - Success mit Aggregate oder null wenn nicht gefunden
   *
   * @example
   * ```typescript
   * const result = await repository.findByNummer('E2024-A1B2C3');
   * if (result.isSuccess && result.value !== null) {
   *   console.log(`Gefunden: ${result.value.alarmstichwort}`);
   * }
   * ```
   */
  findByNummer(nummer: string): Promise<Result<Einsatz | null>>;

  /**
   * Prüft ob ein Einsatz Aggregate mit gegebener ID existiert.
   *
   * Warum separate exists() Method?
   * - Performance: EXISTS Query schneller als SELECT * (keine Row Materialization)
   * - Semantik: Caller braucht nur Boolean, nicht gesamtes Aggregate
   * - Use Case: Dependency Checks (z.B. "Kann Lagekarte nur erstellen wenn Einsatz existiert")
   *
   * @param id - Type-Safe EinsatzId
   * @returns Result<boolean> - Success mit true/false
   *
   * @example
   * ```typescript
   * const id = EinsatzId.create().value!;
   * const result = await repository.exists(id);
   * if (result.isSuccess) {
   *   if (result.value) {
   *     console.log('Einsatz exists');
   *   } else {
   *     console.log('Einsatz not found');
   *   }
   * }
   * ```
   */
  exists(id: EinsatzId): Promise<Result<boolean>>;

  /**
   * HINWEIS: KEINE delete() Method!
   *
   * Warum kein delete()?
   * - NO-DELETE Policy: DRK-Compliance erfordert 10-year retention
   * - Einsätze können NICHT physisch gelöscht werden (legal/forensisch relevant)
   * - Alternative: archive() macht Einsatz operativ unsichtbar (findActive() filtert)
   * - Soft-Delete via Status statt Hard-Delete aus DB
   *
   * Wenn physische Löschung (z.B. nach 10 Jahren) benötigt wird:
   * - Separater Batch-Job in Infrastructure Layer
   * - Audit-Log der Löschung (wer, wann, warum)
   * - Nur für ARCHIVIERT Status + älter als 10 Jahre
   */
}
