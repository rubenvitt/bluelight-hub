/**
 * Query zum Abrufen der Vollständigkeitsinformationen eines Einsatzes.
 *
 * Diese Query ermöglicht es, die Vollständigkeit eines Einsatzes zu überprüfen,
 * inkl. fehlender Felder und Verbesserungsvorschläge.
 *
 * **Query Parameter:**
 * - einsatzId: Die ID des zu prüfenden Einsatzes
 * - refresh: Optional - Cache umgehen und Vollständigkeit neu berechnen (Default: false)
 *
 * **Warum refresh Parameter:**
 * - Vollständigkeitsberechnungen werden für 1 Minute gecacht
 * - refresh=true erzwingt Neuberechnung (z.B. nach Updates)
 * - Reduziert Serverlast bei wiederholten Abfragen
 *
 * @example
 * ```typescript
 * // Standard-Abfrage (nutzt Cache wenn vorhanden)
 * new GetEinsatzCompletenessQuery('einsatz_123');
 *
 * // Erzwinge Neuberechnung
 * new GetEinsatzCompletenessQuery('einsatz_123', true);
 * ```
 */
export class GetEinsatzCompletenessQuery {
  constructor(
    public readonly einsatzId: string,
    public readonly refresh: boolean = false,
  ) {}
}
