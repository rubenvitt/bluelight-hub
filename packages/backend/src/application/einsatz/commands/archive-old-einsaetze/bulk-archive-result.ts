/**
 * Ergebnis der Bulk-Archivierung.
 *
 * Dieses Interface dokumentiert den vollständigen Ablauf einer Bulk-Archivierung:
 * - eligible: Anzahl der Einsätze die älter als Threshold sind
 * - archived: Anzahl erfolgreich archivierter Einsätze
 * - failed: Details zu fehlgeschlagenen Archivierungen
 * - dryRun: true wenn nur Vorschau ohne Änderungen
 */
export interface BulkArchiveResult {
  eligible: number;
  archived: number;
  failed: Array<{ id: string; error: string }>;
  dryRun: boolean;
}
