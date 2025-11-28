/**
 * Query zum Abrufen der Einsatz-Status-Statistiken.
 *
 * Gibt die Anzahl der Einsaetze pro Status zurueck (ANGELEGT, IN_BEARBEITUNG, ABGESCHLOSSEN, ARCHIVIERT).
 * Die Query ermoeglicht optional die Einbeziehung archivierter Einsaetze.
 *
 * **Verwendung:**
 * - Dashboard: Anzeige der aktuellen Einsatzverteilung
 * - Statistiken: Auslastungsmetriken und Systemmonitoring
 * - Reporting: Status-Uebersicht fuer Management
 *
 * **Warum includeArchived Parameter:**
 * - Default (false): Zeigt nur operativ relevante Einsaetze (archiviert = 0)
 * - true: Inkludiert archivierte Einsaetze in Statistik (fuer Reporting)
 * - Archivierte Einsaetze koennen in Compliance-Reports relevant sein
 *
 * **Performance:**
 * - Verwendet COUNT() Queries (keine Row Materialization)
 * - Parallel Execution via Promise.all() in Repository
 * - Schneller als findAll() + Array.length
 *
 * @example
 * ```typescript
 * // Nur aktive Einsaetze
 * const query = new GetStatusCountsQuery();
 * const result = await handler.execute(query);
 * // result.value.counts.archiviert === 0
 *
 * // Inkl. archivierte Einsaetze
 * const queryWithArchived = new GetStatusCountsQuery(true);
 * const result = await handler.execute(queryWithArchived);
 * // result.value.counts.archiviert > 0
 * ```
 */
export class GetStatusCountsQuery {
  constructor(public readonly includeArchived: boolean = false) {}
}
