import type { LagekarteAggregate } from '../aggregates/lagekarte.aggregate';
import type { TransactionContext } from '../common/transaction';
import type { LagekarteId } from '../value-objects/lagekarte-id';
import type { EinsatzId } from '../value-objects/einsatz-id';

/**
 * Repository Port Interface für Lagekarte-Aggregate (Hexagonal Architecture).
 *
 * Dieses Interface definiert den Contract zwischen Domain Layer und
 * Infrastructure Layer. Die Implementierung erfolgt in Epic 2 (Infrastructure Layer)
 * mit Prisma Repository Adapter.
 *
 * Warum Repository Pattern?
 * - Entkoppelt Domain Logic von Persistence Details (Framework-Agnostik)
 * - Ermöglicht In-Memory Implementierung für Unit Tests
 * - Erlaubt Austausch von Persistence Technologie ohne Domain Changes
 * - Single Responsibility: Domain fokussiert sich auf Business Logic
 *
 * Design Constraints:
 * - KEINE Prisma Types in Signaturen (würde Domain Layer kontaminieren)
 * - Promise-basiert (I/O Boundary zwischen Sync Domain und Async Infrastructure)
 * - Keine delete() Method (NO-DELETE Policy: Retention für Audit/Legal)
 * - TransactionContext für atomare Multi-Aggregate Operationen
 *
 * @example
 * ```typescript
 * // Infrastructure Layer Implementation (Epic 2)
 * class PrismaLagekarteRepository implements ILagekarteRepository {
 *   async save(aggregate: LagekarteAggregate): Promise<void> {
 *     // Map Aggregate → Prisma Model → DB INSERT/UPDATE
 *   }
 *
 *   async findById(id: LagekarteId): Promise<LagekarteAggregate | null> {
 *     // DB → Prisma Model → Map to Aggregate
 *   }
 * }
 *
 * // Application Layer Usage (Epic 3)
 * class CreateLagekarteCommandHandler {
 *   constructor(private repo: ILagekarteRepository) {}
 *
 *   async execute(cmd: CreateLagekarteCommand): Promise<void> {
 *     const lagekarte = LagekarteAggregate.create({...});
 *     await this.repo.save(lagekarte);
 *   }
 * }
 * ```
 */
export interface ILagekarteRepository {
  /**
   * Speichert das Lagekarte-Aggregat (Create oder Update).
   *
   * Dieses Interface wird sowohl für CREATE als auch UPDATE verwendet (Upsert Pattern).
   * Die Infrastructure-Implementierung entscheidet anhand der ID, ob ein INSERT oder
   * UPDATE nötig ist. Dies vereinfacht die Domain API (ein Method für beide Operationen).
   *
   * Transaktionsunterstützung:
   * - Optionale tx Parameter für Handler-Level Transactions
   * - Mehrere Aggregates können in einer Transaktion gespeichert werden
   * - Ermöglicht atomare Multi-Aggregate Operationen (z.B. Einsatz + Lagekarte zusammen)
   *
   * Event Publishing:
   * - Infrastructure Layer ist verantwortlich für Event Publishing nach save()
   * - Via Transactional Outbox Pattern (verhindert "write skew")
   *
   * Warum Upsert statt separater create/update?
   * - Aggregate Root entscheidet über Create vs Update (über ID Präsenz)
   * - Vereinfacht Domain API (ein Method statt zwei)
   * - Infrastructure kann effizient entscheiden (ID Index Lookup)
   *
   * @param aggregate - Das zu speichernde Lagekarte Aggregat
   * @param tx - Optionale Transaktion für atomare Multi-Aggregate Operationen
   * @throws Fehler werden als Promise.reject() propagiert
   *
   * @example
   * ```typescript
   * const lagekarte = LagekarteAggregate.create({
   *   id: lagekarteId,
   *   einsatzId: einsatzId,
   *   coordinates: mgrsCoordinates,
   * });
   *
   * try {
   *   await repository.save(lagekarte);
   *   console.log('Lagekarte saved successfully');
   * } catch (error) {
   *   console.error('Failed to save Lagekarte:', error);
   * }
   * ```
   */
  save(aggregate: LagekarteAggregate, tx?: TransactionContext): Promise<void>;

  /**
   * Lädt eine Lagekarte anhand ihrer ID.
   *
   * Dieser Zugriff ist weniger häufig als findByEinsatzId(), wird aber benötigt für
   * Direct Access (z.B. "Zeige Lagekarte XYZ" via URL Parameter).
   *
   * Aggregate Reconstruction:
   * - Infrastructure Layer mapped Prisma Model → Domain Aggregate
   * - Nur aktueller State wird rekonstruiert (keine Event Sourcing)
   * - Alle Invarianten-Checks werden bei Aggregate.create() durchgeführt
   *
   * Warum null statt Exception?
   * - "Not found" ist kein Error sondern valides Resultat
   * - Caller kann explizit prüfen: if (result === null)
   * - Echte Errors (DB Connection Failed) werden als Promise.reject() propagiert
   *
   * @param id - Type-Safe LagekarteId (verhindert Primitive Obsession mit Strings)
   * @param tx - Optionale Transaktion
   * @returns Promise mit Aggregat oder null wenn nicht gefunden
   *
   * @example
   * ```typescript
   * const id = LagekarteId.create().value!;
   * const lagekarte = await repository.findById(id);
   *
   * if (lagekarte === null) {
   *   console.log('Lagekarte nicht gefunden');
   * } else {
   *   console.log(lagekarte.getId().toString());
   * }
   * ```
   */
  findById(id: LagekarteId, tx?: TransactionContext): Promise<LagekarteAggregate | null>;

  /**
   * Lädt eine Lagekarte anhand der Einsatz-ID.
   *
   * Dies ist der primäre Zugriffspfad für Lagekartenabfragen, da eine Lagekarte
   * typischerweise über den Einsatz zugegriffen wird (1:1 Beziehung),
   * nicht über die Lagekarte-ID direkt.
   *
   * Use Cases:
   * - "Zeige mir die Lagekarte für diesen Einsatz"
   * - Lazy Creation: Prüfen ob Lagekarte bereits existiert vor dem Erstellen
   * - Einsatz-Details View: Lade zugehörige Lagekarte
   *
   * Beziehungsmodell (1:1):
   * - Ein Einsatz kann maximal eine Lagekarte haben
   * - Lagekarte kann NICHT ohne Einsatz existieren (obligatorische Dependency)
   * - Wenn Einsatz gelöscht wird → Lagekarte wird auch gelöscht (Cascade)
   *
   * Performance:
   * - Infrastructure Layer sollte Index auf einsatz_id anlegen
   * - Schneller Lookup ohne Full Table Scan
   *
   * @param einsatzId - Einsatz-Identifier (Foreign Key)
   * @param tx - Optionale Transaktion
   * @returns Promise mit Aggregat oder null wenn nicht gefunden
   *
   * @example
   * ```typescript
   * const einsatzId = EinsatzId.create('A1B2C3D4E5F6G7H8I9J0K').value!;
   * const lagekarte = await repository.findByEinsatzId(einsatzId);
   *
   * if (lagekarte === null) {
   *   // Lagekarte existiert noch nicht - müsste erstellt werden
   *   const newLagekarte = LagekarteAggregate.create({ einsatzId, ... });
   *   await repository.save(newLagekarte);
   * } else {
   *   // Lagekarte existiert - Update
   *   lagekarte.updateCoordinates(...);
   *   await repository.save(lagekarte);
   * }
   * ```
   */
  findByEinsatzId(einsatzId: EinsatzId, tx?: TransactionContext): Promise<LagekarteAggregate | null>;

  /**
   * Prüft ob eine Lagekarte für einen Einsatz existiert.
   *
   * Diese Methode wird für das Lazy Creation Pattern verwendet:
   * Application Layer prüft vor dem Erstellen, ob bereits eine Lagekarte
   * existiert, um Duplikate zu vermeiden.
   *
   * Performance Optimization:
   * - Effektiver als findByEinsatzId() da nur Existence-Check
   * - Infrastructure Layer führt EXISTS/COUNT Query aus
   * - Keine Row Materialization, nur Boolean result
   * - Wichtig bei vielen Lagekartenabfragen (besserer Query Plan)
   *
   * Warum separate exists() Method?
   * - Semantik: Caller braucht nur Boolean, nicht gesamtes Aggregate
   * - Performance: EXISTS/COUNT schneller als SELECT * bei großen Tables
   * - SQL Query Plan: DB kann spezialisierte Indizes nutzen
   *
   * Typischerweise verwendet in Command Handlers:
   * - Validierung: "Kann Lagekarte nur erstellen wenn nicht bereits vorhanden"
   * - Guard Clause: if (await repo.exists(einsatzId)) return alreadyExistsError;
   *
   * @param einsatzId - Einsatz-Identifier (Foreign Key)
   * @returns Promise mit true wenn Lagekarte existiert, false sonst
   *
   * @example
   * ```typescript
   * // In CreateLagekarteCommandHandler
   * const exists = await this.lagekarteRepository.exists(einsatzId);
   * if (exists) {
   *   throw new AlreadyExistsError('Lagekarte existiert bereits für diesen Einsatz');
   * }
   *
   * // Lagekarte erstellen und speichern
   * const lagekarte = LagekarteAggregate.create({ einsatzId, ... });
   * await this.lagekarteRepository.save(lagekarte);
   * ```
   */
  exists(einsatzId: EinsatzId): Promise<boolean>;

  /**
   * HINWEIS: KEINE delete() Method!
   *
   * Warum kein delete()?
   * - NO-DELETE Policy: DRK-Compliance erfordert Datenretention für Audit/Legal
   * - Lagekartenhistorie ist rechtlich relevant für Nachbereitung
   * - Operativ können Lagekartenaktualisierungen via neue Aggregate geschehen
   * - Alternative: Archive Flag statt Hard-Delete
   *
   * Falls physische Löschung später nötig (z.B. nach Datenschutz-Anfrage):
   * - Separater Admin-Batch-Job in Infrastructure Layer
   * - Mit Audit-Log (wer, wann, warum, UID wird anonymisiert)
   * - Nur für explizit freigegebene Einsätze
   * - NIEMALS aus Domain Layer, da "nicht gedacht" (Separation of Concerns)
   */
}
