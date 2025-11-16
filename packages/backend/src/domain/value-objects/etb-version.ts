import { ValueObject } from '@domain/common/value-object';
import { Result } from '@domain/common/result';

interface EtbVersionProps extends Record<string, unknown> {
  versionNumber: number;
  timestamp: Date;
}

/**
 * Version Tracking Value Object mit monotoner Versionsnummer und Zeitstempel.
 *
 * Diese Klasse modelliert die Versionierung eines ETB Aggregates
 * für Audit-Trail und Revisionssicherheit (DRK-Compliance).
 * Jede Version ist unveränderlich; Änderungen erzeugen eine neue Version
 * mit inkrementierter Nummer und aktuellem Zeitstempel.
 *
 * **Invarianten:**
 * - Versionsnummer ist monoton steigend (≥1)
 * - Jede Version hat einen eindeutigen Zeitstempel
 * - Versionen sind unveränderlich (immutable)
 *
 * **Verwendung:**
 * - Optimistic Locking (Concurrency Control)
 * - Snapshot-Versionierung für Änderungshistorie
 * - Audit-Trail für DRK-Compliance
 *
 * @example
 * ```typescript
 * const v1 = EtbVersion.create(1).value;
 * console.log(v1.versionNumber); // 1
 *
 * const v2 = v1.increment();
 * console.log(v2.versionNumber); // 2
 * console.log(v2.timestamp > v1.timestamp); // true
 * ```
 */
export class EtbVersion extends ValueObject<EtbVersionProps> {
  get versionNumber(): number {
    return this.props.versionNumber;
  }

  get timestamp(): Date {
    return this.props.timestamp;
  }

  private constructor(versionNumber: number, timestamp: Date) {
    super({ versionNumber, timestamp });
  }

  static create(versionNumber: number): Result<EtbVersion> {
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      return Result.fail<EtbVersion>('Version number must be a positive integer ≥ 1');
    }
    return Result.ok<EtbVersion>(new EtbVersion(versionNumber, new Date()));
  }

  /**
   * Erzeugt eine neue Version mit inkrementierter Versionsnummer.
   *
   * Diese Methode implementiert die Unveränderlichkeit des Value Objects:
   * Anstatt die aktuelle Instanz zu modifizieren, wird eine komplett neue
   * Version mit erhöhter Nummer und neuem Zeitstempel zurückgegeben.
   *
   * @returns Neue EtbVersion-Instanz mit versionNumber + 1
   */
  public increment(): EtbVersion {
    return new EtbVersion(this.versionNumber + 1, new Date());
  }

  public toString(): string {
    return `v${this.versionNumber} (${this.timestamp.toISOString()})`;
  }
}
