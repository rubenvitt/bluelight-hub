import type { Befehl } from '@domain/aggregates/befehl.aggregate';
import type { Result } from '@domain/common/result';
import type { TransactionContext } from '@domain/common/transaction';
import type { BefehlId } from '@domain/value-objects/befehl-id';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';

/**
 * Filter-Parameter fuer gefilterte Befehl-Abfragen.
 */
export interface BefehlFilterParams {
  /** Filter nach BefehlStatus-Werten (ERTEILT, ZUGESTELLT, QUITTIERT, KORRIGIERT). */
  status?: string[];
  /** Filter auf Empfaenger-User-ID (DB-Level Sichtbarkeitsfilter fuer EMPFAENGER-Rolle). */
  empfaengerUserId?: string;
  /** Freitext-Filter auf Empfaenger-Name (case-insensitive, contains). */
  empfaengerName?: string;
  /** Freitext-Filter auf Befehlsgeber-Name (case-insensitive, contains). */
  befehlsgeberName?: string;
  /** Volltextsuche ueber Auftrag (case-insensitive, contains). */
  q?: string;
  /** Zeitfilter: Befehle ab diesem Datum (erteiltAm >= von). */
  von?: Date;
  /** Zeitfilter: Befehle bis zu diesem Datum (erteiltAm <= bis). */
  bis?: Date;
}

/**
 * Repository Port Interface für Befehl Aggregate Persistence.
 *
 * Definiert die Abstraktion zwischen Domain Layer und Infrastructure Layer.
 * Implementierung erfolgt in Infrastructure Layer (Story 1.4) via Prisma Repository Adapter.
 *
 * **Design Constraints:**
 * - KEINE Prisma Types in Signaturen
 * - Result<T> Pattern für explizite Error Handling
 * - Alle Methods async (I/O Boundary)
 * - NO delete() Method (Append-Only Policy, GoBD-Compliance)
 */
export interface IBefehlRepository {
  /**
   * Speichert ein Befehl Aggregate (Create oder Update).
   * Transaction Support via optionalem tx Parameter (Transactional Outbox Pattern).
   */
  save(befehl: Befehl, tx?: TransactionContext): Promise<Result<void>>;

  /**
   * Findet ein Befehl Aggregate by ID.
   * Gibt null zurück wenn nicht gefunden (kein Error).
   */
  findById(id: BefehlId, tx?: TransactionContext): Promise<Result<Befehl | null>>;

  /**
   * Findet alle Befehle eines Einsatzes.
   * Sortierung nach erteiltAm DESC (neueste zuerst).
   */
  findByEinsatzId(einsatzId: EinsatzId, tx?: TransactionContext): Promise<Result<Befehl[]>>;

  /**
   * Findet alle Befehle eines Einsatzes, die an einen bestimmten Empfänger gerichtet sind.
   * Sortierung nach erteiltAm DESC (neueste zuerst).
   */
  findByEmpfaengerId(einsatzId: EinsatzId, empfaengerId: string, tx?: TransactionContext): Promise<Result<Befehl[]>>;

  /**
   * Findet alle Befehle eines Einsatzes, die offene Rückfragen haben.
   * Eine Rückfrage gilt als "offen" wenn isRueckfrage=true und keine Kind-Kommentare existieren.
   * Sortierung nach erteiltAm DESC.
   */
  findWithOpenRueckfragen(einsatzId: EinsatzId, tx?: TransactionContext): Promise<Result<Befehl[]>>;

  /**
   * Findet Befehle eines Einsatzes mit dynamischen Filtern.
   * Unterstuetzt Status, Empfaenger-Name, Befehlsgeber-Name, Freitextsuche und Zeitraum.
   * Sortierung nach erteiltAm DESC (neueste zuerst).
   */
  findFiltered(einsatzId: EinsatzId, filters: BefehlFilterParams, tx?: TransactionContext): Promise<Result<Befehl[]>>;

  /**
   * Gibt die nächste Sequenznummer für Befehle eines Einsatzes zurück.
   * Wird für die Generierung der Befehlsnummer (B-{SEQ}) benötigt.
   *
   * @param einsatzId - EinsatzId für die Sequenznummer
   * @param tx - Optional: Transaction Context
   * @returns Result<number> - Nächste Sequenznummer (1-basiert)
   */
  getNextSequenceNumber(einsatzId: EinsatzId, tx?: TransactionContext): Promise<Result<number>>;

  // ===== DSGVO-Löschkonzept (Story 5.5) =====

  /**
   * Findet Befehle archivierter Einsätze, deren Aufbewahrungsfrist abgelaufen ist.
   * Filtert auf: Einsatz.archivedAt + aufbewahrungsfristJahre < cutoffDate
   * Gibt nur nicht-anonymisierte, nicht-gelöschte Befehle zurück.
   */
  findAbgelaufene(cutoffDate: Date, tx?: TransactionContext): Promise<Result<Befehl[]>>;

  /**
   * Bulk-Update: Setzt anonymisierte Befehl-Daten für einen Einsatz.
   * Wird vom DSGVO-CronJob nach der Domain-Anonymisierung aufgerufen.
   */
  bulkAnonymisiere(einsatzId: EinsatzId, befehle: Befehl[], tx?: TransactionContext): Promise<Result<void>>;

  /**
   * Bulk Soft-Delete: Markiert alle Befehle eines Einsatzes als gelöscht.
   * Wird nach Ablauf der Freigabeperiode aufgerufen.
   */
  bulkSoftDelete(einsatzId: EinsatzId, deletedBy: string, tx?: TransactionContext): Promise<Result<void>>;
}
