import type { EtbVersion } from '@domain/value-objects/etb-version';

/**
 * Versioning Snapshot für Audit-Trail (gespeichert in DB via Repository).
 *
 * Diese Klasse repräsentiert einen unveränderlichen Snapshot des ETB-Zustands
 * zu einem bestimmten Zeitpunkt. Snapshots werden bei jeder Version
 * automatisch erstellt und in der Datenbank persistiert, um eine vollständige
 * Änderungshistorie für DRK-Compliance zu gewährleisten.
 *
 * **Verwendung:**
 * - Audit-Trail: Nachvollziehen aller ETB-Änderungen
 * - Rollback: Wiederherstellen früherer Versionen
 * - Compliance: DRK-konforme Revisionssicherheit
 *
 * **Wichtig:**
 * - Snapshots sind unveränderlich (immutable)
 * - Werden NUR durch Repository-Layer erstellt
 * - Einträge sind Deep Copies, nicht Referenzen
 *
 * @example
 * ```typescript
 * const snapshot = new EtbSnapshot(
 *   EtbVersion.create(5).value,
 *   [entry1, entry2], // deep copies of entries
 *   new Date()
 * );
 * ```
 */
export class EtbSnapshot {
  /**
   * Version, die dieser Snapshot repräsentiert.
   */
  public readonly version: EtbVersion;

  /**
   * Deep Copy aller ETB-Einträge zu diesem Zeitpunkt.
   * TODO: Replace with EtbEintrag[] after Task 2
   */
  public readonly eintraege: any[];

  /**
   * Zeitstempel der Snapshot-Erstellung.
   */
  public readonly snapshotAt: Date;

  constructor(version: EtbVersion, eintraege: any[], snapshotAt: Date) {
    this.version = version;
    this.eintraege = eintraege;
    this.snapshotAt = snapshotAt;
  }
}
