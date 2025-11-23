import type { EtbVersion } from '@domain/value-objects/etb-version';

/**
 * JSON-serialisierbares Format eines ETB-Eintrags fuer Snapshots.
 *
 * Enthaelt keine Domain-Objekte, nur primitive Typen, damit der Snapshot
 * problemlos in JSONB-Spalten der Datenbank gespeichert werden kann.
 *
 * **Warum eigenes Interface statt EtbEintrag?**
 * - EtbEintrag enthaelt Value Objects (EintragId, EtbSequenceNumber, UserId)
 * - Diese koennen nicht direkt als JSON serialisiert werden
 * - Dieses Interface mappt alle VOs auf ihre primitiven Werte
 */
export interface EtbEintragSnapshot {
  /** EintragId als String (nanoid) */
  id: string;
  /** Sequenznummer als Number */
  sequenceNumber: number;
  /** Textinhalt des Eintrags */
  text: string;
  /** UserId des Erstellers als String */
  createdBy: string;
  /** Creation timestamp als ISO 8601 String */
  createdAt: string;
  /** Optional: Update timestamp als ISO 8601 String */
  updatedAt?: string;
  /** Soft-Delete Flag */
  isDeleted: boolean;
}

/**
 * JSON-serialisierbares Format eines kompletten Snapshots.
 *
 * Wird fuer DB-Persistierung und Rekonstitution verwendet.
 * Enthaelt nur primitive Typen und das EtbEintragSnapshot Array.
 */
export interface EtbSnapshotData {
  /** Versionsnummer zum Zeitpunkt des Snapshots */
  versionNumber: number;
  /** Version-Timestamp als ISO 8601 String */
  versionTimestamp: string;
  /** Array aller Eintraege als serialisierbare Snapshots */
  eintraege: EtbEintragSnapshot[];
  /** Snapshot-Erstellungszeitpunkt als ISO 8601 String */
  snapshotAt: string;
}

/**
 * Versioning Snapshot fuer Audit-Trail (gespeichert in DB via Repository).
 *
 * Diese Klasse repraesentiert einen unveraenderlichen Snapshot des ETB-Zustands
 * zu einem bestimmten Zeitpunkt. Snapshots werden VOR jeder mutierenden Operation
 * automatisch erstellt und in der Datenbank persistiert, um eine vollstaendige
 * Aenderungshistorie fuer DRK-Compliance zu gewaehrleisten.
 *
 * **Snapshot-Erstellung:**
 * - Wird VOR addEintrag(), updateEintrag(), deleteEintrag() erstellt
 * - Enthaelt den Zustand BEVOR die Mutation angewendet wird
 * - Ermoeglicht Rollback und Audit-Trail ("Was war vorher?")
 *
 * **Verwendung:**
 * - Audit-Trail: Nachvollziehen aller ETB-Aenderungen
 * - Rollback: Wiederherstellen frueherer Versionen
 * - Compliance: DRK-konforme Revisionssicherheit
 *
 * **Wichtig:**
 * - Snapshots sind unveraenderlich (immutable)
 * - Werden im Aggregate erstellt, vom Repository persistiert
 * - Eintraege sind Deep Copies als EtbEintragSnapshot[], nicht Referenzen
 *
 * @example
 * ```typescript
 * // Snapshot erstellen (im Aggregate)
 * const snapshotData: EtbEintragSnapshot[] = eintraege.map(e => ({
 *   id: e.id.value,
 *   sequenceNumber: e.sequenceNumber.value,
 *   text: e.text,
 *   createdBy: e.createdBy.value,
 *   createdAt: e.createdAt.toISOString(),
 *   updatedAt: e.updatedAt?.toISOString(),
 *   isDeleted: e.isDeleted,
 * }));
 *
 * const snapshot = new EtbSnapshot(version, snapshotData, new Date());
 *
 * // Serialisieren fuer DB
 * const json = snapshot.toJSON();
 *
 * // Rekonstitution aus DB
 * const restored = EtbSnapshot.fromData(json, version);
 * ```
 */
export class EtbSnapshot {
  /**
   * Version, die dieser Snapshot repraesentiert.
   * Enthaelt Versionsnummer und Timestamp.
   */
  public readonly version: EtbVersion;

  /**
   * Deep Copy aller ETB-Eintraege zu diesem Zeitpunkt.
   * Als serialisierbares Format (keine Domain-Objekte).
   */
  public readonly eintraege: EtbEintragSnapshot[];

  /**
   * Zeitstempel der Snapshot-Erstellung.
   */
  public readonly snapshotAt: Date;

  /**
   * Erstellt einen neuen EtbSnapshot.
   *
   * @param version - EtbVersion zum Zeitpunkt des Snapshots
   * @param eintraege - Array von serialisierbaren Eintrags-Snapshots
   * @param snapshotAt - Zeitpunkt der Snapshot-Erstellung
   */
  constructor(version: EtbVersion, eintraege: EtbEintragSnapshot[], snapshotAt: Date) {
    this.version = version;
    // Deep copy des Arrays um Mutation-Safety zu garantieren
    this.eintraege = eintraege.map((e) => ({ ...e }));
    this.snapshotAt = snapshotAt;
  }

  /**
   * Gibt die Versionsnummer zurueck.
   * Convenience getter fuer haeufigen Zugriff.
   */
  get versionNumber(): number {
    return this.version.versionNumber;
  }

  /**
   * Konvertiert den Snapshot in ein JSON-serialisierbares Format.
   *
   * Wird vom Repository fuer die Persistierung in JSONB-Spalten verwendet.
   * Alle Domain-Objekte (EtbVersion) werden auf primitive Typen gemappt.
   *
   * @returns EtbSnapshotData mit nur primitiven Typen
   */
  public toJSON(): EtbSnapshotData {
    return {
      versionNumber: this.version.versionNumber,
      versionTimestamp: this.version.timestamp.toISOString(),
      eintraege: this.eintraege.map((e) => ({ ...e })),
      snapshotAt: this.snapshotAt.toISOString(),
    };
  }

  /**
   * Prueft ob der Snapshot leer ist (keine Eintraege).
   *
   * Nuetzlich fuer initiale ETBs vor dem ersten Eintrag.
   *
   * @returns true wenn keine Eintraege vorhanden
   */
  public isEmpty(): boolean {
    return this.eintraege.length === 0;
  }

  /**
   * Gibt die Anzahl der Eintraege im Snapshot zurueck.
   *
   * @returns Anzahl der Eintraege (inkl. soft-deleted)
   */
  public getEintragCount(): number {
    return this.eintraege.length;
  }

  /**
   * Gibt die Anzahl der aktiven (nicht geloeschten) Eintraege zurueck.
   *
   * @returns Anzahl der aktiven Eintraege
   */
  public getActiveEintragCount(): number {
    return this.eintraege.filter((e) => !e.isDeleted).length;
  }
}
