/**
 * Query für aktive Einsätze mit ETB-Einträge und POI-Counts.
 *
 * Parameterlose Query - liefert alle nicht-archivierten Einsätze
 * mit vorberechneten Counts für optimale Performance.
 *
 * **CQRS Read-Side Optimization:**
 * - Nutzt direkten PrismaService Zugriff (KEIN Repository Pattern)
 * - Prisma _count Aggregation für ETB-Einträge und POIs
 * - Vermeidet N+1 Query Problem durch include mit _count
 * - Read-Optimierung: Keine Aggregate-Hydration notwendig
 *
 * **Warum parameterlos:**
 * - Standard-Use-Case: Alle aktiven Einsätze anzeigen
 * - Filter (ARCHIVIERT) ist implizit in Handler-Logik
 * - Sorting (createdAt DESC) ist implizit in Handler-Logik
 * - Einfache API: GET /api/einsatz ohne Query-Parameter
 *
 * **Unterschied zu GetActiveEinsaetzeQuery:**
 * - GetActiveEinsaetzeQuery: Repository Pattern, volle Domain Aggregates
 * - GetActiveEinsaetzeWithCountsQuery: Prisma direkt, DTO mit Counts
 * - GetActiveEinsaetzeQuery: Für Domain-Logik (Commands, Events)
 * - GetActiveEinsaetzeWithCountsQuery: Für UI-Listen (Dashboard, Übersicht)
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
