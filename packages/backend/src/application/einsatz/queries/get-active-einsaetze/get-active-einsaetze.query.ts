/**
 * Query zum Abrufen aller aktiven Einsaetze.
 *
 * Aktive Einsaetze sind alle Einsaetze mit Status != ARCHIVIERT.
 * Die Query ist parameterlos da keine Filter benoetigt werden.
 *
 * **Verwendung:**
 * - Dashboard: Anzeige aller laufenden Einsaetze
 * - Einsatzuebersicht: Liste aktiver Einsaetze fuer Disposition
 * - Statistiken: Anzahl aktiver Einsaetze fuer Auslastungsanzeige
 *
 * **Warum parameterlos:**
 * - Filter-Logik liegt im Repository (findActive())
 * - Alle aktiven Einsaetze sind fuer User sichtbar
 * - Permissions werden auf Controller-Ebene geprueft
 *
 * @example
 * ```typescript
 * // Handler ausfuehren
 * const query = new GetActiveEinsaetzeQuery();
 * const result = await handler.execute(query);
 *
 * if (result.isSuccess) {
 *   const einsaetze = result.value!; // EinsatzDto[]
 *   console.log(`${einsaetze.length} aktive Einsaetze`);
 * }
 * ```
 */
export class GetActiveEinsaetzeQuery {}
