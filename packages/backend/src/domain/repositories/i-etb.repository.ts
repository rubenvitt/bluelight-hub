import type { EinsatztagebuchAggregate } from '@domain/aggregates/einsatztagebuch.aggregate';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { EtbId } from '@domain/value-objects/etb-id';
import type { EtbSnapshot } from '@domain/value-objects/etb-snapshot';

/**
 * Repository Interface für ETB Aggregate (Port nach Hexagonaler Architektur).
 *
 * Dieses Interface definiert den Vertrag für ETB-Persistierung und ist
 * FRAMEWORK-AGNOSTISCH. Die konkrete Implementation erfolgt im Infrastructure
 * Layer (Epic 4) und kann Prisma, TypeORM, oder andere ORMs verwenden.
 *
 * **Hexagonale Architektur (Ports & Adapters):**
 * - PORT: Dieses Interface (Domain Layer)
 * - ADAPTER: PrismaEtbRepository (Infrastructure Layer, Epic 4)
 * - Dependency Direction: Infrastructure → Domain (NICHT umgekehrt!)
 * - Domain bleibt framework-agnostisch (keine Prisma-Types hier!)
 *
 * **Repository Pattern Prinzipien:**
 * 1. Collection-Like Interface: save(), findById(), findByEinsatzId()
 * 2. Aggregate-Oriented: Lädt/Speichert KOMPLETTE Aggregates (inkl. Child Entities)
 * 3. Transactional Support: Optional `tx` Parameter für Handler-Level Transactions
 * 4. Framework-Agnostic: Keine Prisma/TypeORM Types in Signatures
 *
 * **Warum KEIN delete()?**
 * - Soft-Delete Pattern: Einträge werden via markAsDeleted() gelöscht
 * - Aggregates werden NIE physisch gelöscht (DRK-Compliance)
 * - save() persistiert Soft-Deletes automatisch (isDeleted=true in DB)
 *
 * **Transaction Handling:**
 * - `tx?: any` Parameter für Unit of Work Pattern
 * - Event-Handler können mehrere Aggregates in einer Transaktion speichern
 * - Infrastructure Layer mappt `any` zu konkretem Type (z.B. Prisma.TransactionClient)
 *
 * **Snapshot Management:**
 * - getHistory() lädt Versions-Historie aus DB (NICHT aus Aggregate Memory!)
 * - Repository erstellt Snapshots automatisch bei save() (Epic 4)
 * - Snapshots werden in separater DB-Tabelle gespeichert (etb_snapshots)
 *
 * @example
 * ```typescript
 * // Domain Service Usage (Epic 3)
 * class EtbService {
 *   constructor(private repo: IEtbRepository) {}
 *
 *   async createEtb(einsatzId: EinsatzId): Promise<void> {
 *     const result = EinsatztagebuchAggregate.create(einsatzId);
 *     if (result.isSuccess) {
 *       await this.repo.save(result.value);
 *     }
 *   }
 *
 *   async addEntry(etbId: EtbId, text: string, userId: UserId): Promise<void> {
 *     const etb = await this.repo.findById(etbId);
 *     if (etb) {
 *       const result = etb.addEintrag(text, userId);
 *       if (result.isSuccess) {
 *         await this.repo.save(etb); // Persists entry + events
 *       }
 *     }
 *   }
 * }
 * ```
 */
export interface IEtbRepository {
  /**
   * Speichert das ETB-Aggregat (Create oder Update).
   *
   * Diese Methode persistiert das komplette Aggregate inklusive:
   * - Aggregate Root Properties (status, version, einsatzId)
   * - Child Entities (alle Einträge, inkl. soft-deleted)
   * - Domain Events (werden nach Persistierung publiziert)
   * - Snapshot Creation (automatisch bei Version-Änderung)
   *
   * **Implementation Details (Epic 4):**
   * - Upsert Pattern: INSERT ON CONFLICT UPDATE
   * - Child Entity Cascade: Einträge werden mit-persistiert
   * - Event Publishing: Nach erfolgreichem Save werden Events publiziert
   * - Snapshot Creation: Bei Version-Änderung wird Snapshot erstellt
   *
   * **Transaction Support:**
   * - Wenn `tx` übergeben wird: Verwendet existierende Transaktion
   * - Wenn `tx` nicht übergeben: Erstellt eigene Transaktion
   * - Ermöglicht Unit of Work Pattern in Event-Handlers
   *
   * @param aggregate - ETB Aggregate zum Speichern (inkl. Child Entities)
   * @param tx - Optional: Existierende Transaktion (framework-spezifisch)
   * @returns Promise<void> - Wirft Exception bei Persistierungs-Fehler
   */
  save(aggregate: EinsatztagebuchAggregate, tx?: any): Promise<void>;

  /**
   * Lädt ein ETB-Aggregat anhand seiner ID.
   *
   * Diese Methode rekonstruiert das komplette Aggregate inklusive:
   * - Aggregate Root mit allen Properties
   * - Alle Child Entities (Einträge, inkl. soft-deleted)
   * - Sortierung: Einträge nach sequenceNumber aufsteigend
   *
   * **Aggregate Reconstitution:**
   * - Infrastructure Layer mappt DB-Rows zu Domain Objects
   * - Verwendet protected Constructor (NICHT Factory Method!)
   * - Rekonstruiert exakten State wie beim letzten save()
   *
   * **Performance:**
   * - Lazy Loading: NUR bei explizitem findById() Aufruf
   * - Eager Loading: Lädt Einträge mit (JOIN oder separate Query)
   * - Cache-Strategie: Infrastructure-Layer Entscheidung
   *
   * @param id - ETB Aggregate ID
   * @param tx - Optional: Existierende Transaktion für konsistente Reads
   * @returns Promise<EinsatztagebuchAggregate | null> - Aggregate oder null wenn nicht gefunden
   */
  findById(id: EtbId, tx?: any): Promise<EinsatztagebuchAggregate | null>;

  /**
   * Lädt ein ETB-Aggregat anhand der Einsatz-ID.
   *
   * Diese Methode nutzt die 1:1 Beziehung zwischen Einsatz und ETB:
   * - Ein Einsatz hat maximal ein ETB
   * - Praktisch für "Öffne ETB für Einsatz X" Use Cases
   * - Vermeidet extra ETB-ID Lookup in Application Layer
   *
   * **Warum diese Methode?**
   * - Business Use Case: "Zeige ETB für aktuellen Einsatz"
   * - UI-Convenience: Frontend kennt nur Einsatz-ID, nicht ETB-ID
   * - Performance: Optimiert für häufigen Use Case (DB-Index auf einsatzId)
   *
   * **Implementation (Epic 4):**
   * - Unique Index auf einsatzId Spalte (1:1 Constraint)
   * - Returniert null wenn kein ETB für Einsatz existiert
   * - Lädt komplettes Aggregate (gleich wie findById)
   *
   * @param einsatzId - ID des zugehörigen Einsatzes (Foreign Aggregate Reference)
   * @param tx - Optional: Existierende Transaktion
   * @returns Promise<EinsatztagebuchAggregate | null> - Aggregate oder null wenn nicht gefunden
   */
  findByEinsatzId(einsatzId: EinsatzId, tx?: any): Promise<EinsatztagebuchAggregate | null>;

  /**
   * Lädt die Versions-Historie eines ETBs.
   *
   * Diese Methode lädt alle gespeicherten Snapshots für ein ETB:
   * - Sortierung: Neueste Version zuerst (descending)
   * - Verwendung: Audit-Trail UI, Rollback-Funktionalität
   * - Snapshots werden von Repository automatisch erstellt (Epic 4)
   *
   * **Warum separate Snapshots-Tabelle?**
   * - Performance: Aggregate-Query lädt keine Historie mit
   * - Compliance: DRK-konforme langfristige Archivierung
   * - Rollback: Wiederherstellen früherer Versionen möglich
   * - Audit-Trail: Vollständige Change-History für Forensik
   *
   * **Snapshot Schema (Epic 4):**
   * - etb_snapshots Tabelle mit Columns:
   *   - id (PK)
   *   - etb_id (FK zu etb Tabelle)
   *   - version_number
   *   - eintraege (JSONB mit Deep Copy aller Einträge)
   *   - snapshot_at (Timestamp)
   *
   * **WICHTIG: NO Transaction Support!**
   * - Snapshots sind historical read-only data
   * - Keine transaktionale Konsistenz erforderlich
   * - Separate Query außerhalb von Aggregate-Lifecycle
   *
   * @param id - ETB Aggregate ID
   * @returns Promise<EtbSnapshot[]> - Array von Snapshots (neueste zuerst)
   */
  getHistory(id: EtbId): Promise<EtbSnapshot[]>;
}
