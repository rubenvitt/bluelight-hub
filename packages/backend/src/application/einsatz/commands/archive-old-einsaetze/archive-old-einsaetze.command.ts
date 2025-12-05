import { validateRequiredStringResult } from '@application/common/validators/string-validator';
import { Result } from '@domain/common/result';

/**
 * Command für Bulk-Archivierung alter Einsätze (DRK 10-Jahres-Policy).
 *
 * Kapselt alle erforderlichen Daten für die Bulk-Archivierung:
 * - archivedBy: User-ID des Archivierenden (für Audit Trail)
 * - dryRun: Safety-First Flag (default: true)
 * - olderThanYears: Schwellenwert in Jahren (default: 10 - DRK Compliance)
 * - olderThan: Berechnetes Schwellenwert-Datum
 *
 * **Business Rule:** DRK 10-Jahres-Aufbewahrungspflicht.
 * **Safety-First:** dryRun ist standardmäßig true (zeigt nur was archiviert würde).
 *
 * Bulk-Archivierung wird typischerweise jährlich ausgeführt, um
 * abgeschlossene Einsätze älter als 10 Jahre zu archivieren.
 *
 * @example
 * ```typescript
 * // Dry-Run (zeigt nur Anzahl)
 * const dryRun = ArchiveOldEinsaetzeCommand.create({ archivedBy: 'admin-123' });
 *
 * // Tatsächliche Archivierung
 * const execute = ArchiveOldEinsaetzeCommand.create({
 *   archivedBy: 'admin-123',
 *   dryRun: false,
 *   olderThanYears: 10
 * });
 * ```
 */
export class ArchiveOldEinsaetzeCommand {
  private constructor(
    public readonly archivedBy: string,
    public readonly dryRun: boolean,
    public readonly olderThan: Date,
    public readonly olderThanYears: number,
  ) {}

  /**
   * Factory-Methode mit Validierung und Default-Werten.
   *
   * Verwendet Result<T> Pattern für explizite Fehlerbehandlung.
   * Berechnet automatisch das olderThan-Datum basierend auf olderThanYears.
   *
   * **Warum Factory statt Constructor:**
   * - Validierung vor Objekt-Erstellung
   * - Result Pattern für fehlerfreie Verarbeitung
   * - Immutability durch private Constructor
   * - Default-Werte zentral verwaltet
   *
   * @param dto - Input DTO mit Required/Optional Feldern
   * @param dto.archivedBy - User ID für Audit Trail (Required)
   * @param dto.dryRun - Safety Flag (Optional, default: true)
   * @param dto.olderThanYears - Schwellenwert in Jahren (Optional, default: 10)
   * @returns Result<ArchiveOldEinsaetzeCommand> - Success oder Validation Error
   */
  static create(dto: { archivedBy: string; dryRun?: boolean; olderThanYears?: number }): Result<ArchiveOldEinsaetzeCommand> {
    // archivedBy ist required für Audit Trail
    const archivedByError = validateRequiredStringResult(dto.archivedBy, 'archivedBy');
    if (archivedByError) {
      return Result.fail(archivedByError);
    }

    // Apply defaults
    const dryRun = dto.dryRun ?? true; // Safety-First: default to dry-run
    const olderThanYears = dto.olderThanYears ?? 10; // DRK: 10 Jahre Aufbewahrungspflicht

    // Validate olderThanYears range
    if (olderThanYears < 1 || olderThanYears > 100) {
      return Result.fail('olderThanYears muss zwischen 1 und 100 liegen');
    }

    // Calculate threshold date (heute minus X Jahre)
    const olderThan = new Date();
    olderThan.setFullYear(olderThan.getFullYear() - olderThanYears);

    return Result.ok(new ArchiveOldEinsaetzeCommand(dto.archivedBy.trim(), dryRun, olderThan, olderThanYears));
  }
}
