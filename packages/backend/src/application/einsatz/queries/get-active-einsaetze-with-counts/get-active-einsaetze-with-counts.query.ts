/**
 * Query fuer aktive Einsaetze mit ETB-Eintraege und POI-Counts.
 *
 * Parameterlose Query - liefert alle nicht-archivierten Einsaetze
 * mit vorberechneten Counts fuer optimale Performance.
 *
 * **CQRS Read-Side Optimization:**
 * - Nutzt direkten PrismaService Zugriff (KEIN Repository Pattern)
 * - Prisma _count Aggregation fuer ETB-Eintraege und POIs
 * - Vermeidet N+1 Query Problem durch include mit _count
 * - Read-Optimierung: Keine Aggregate-Hydration notwendig
 *
 * **Warum parameterlos:**
 * - Standard-Use-Case: Alle aktiven Einsaetze anzeigen
 * - Filter (ARCHIVIERT) ist implizit in Handler-Logik
 * - Sorting (createdAt DESC) ist implizit in Handler-Logik
 * - Einfache API: GET /api/einsatz ohne Query-Parameter
 *
 * **Unterschied zu GetActiveEinsaetzeQuery:**
 * - GetActiveEinsaetzeQuery: Repository Pattern, volle Domain Aggregates
 * - GetActiveEinsaetzeWithCountsQuery: Prisma direkt, DTO mit Counts
 * - GetActiveEinsaetzeQuery: Fuer Domain-Logik (Commands, Events)
 * - GetActiveEinsaetzeWithCountsQuery: Fuer UI-Listen (Dashboard, Uebersicht)
 *
 * @example
 * ```typescript
 * // Controller:
 * @Get()
 * async getActiveEinsaetze() {
 *   const query = new GetActiveEinsaetzeWithCountsQuery();
 *   return this.queryBus.execute(query);
 * }
 * ```
 */
export class GetActiveEinsaetzeWithCountsQuery {
  // Parameterlos - keine Constructor-Parameter
  // Query-Bedingungen sind fest im Handler kodiert:
  // - WHERE status != ARCHIVIERT
  // - ORDER BY createdAt DESC
  // - INCLUDE einsatztagebuch._count.eintraege (WHERE deletedAt IS NULL)
  // - INCLUDE lagekarte._count.pois
}
