/**
 * Query zum Abrufen des KPI-Aggregats für einen Einsatz (Story 1.5, AC1).
 *
 * Read-Only — keine Aggregat-Mutation, keine Events. Liefert das Aggregat
 * über alle Patienten des Einsatzes als `KpiAggregatDto`.
 */
export class GetPatientenKpisQuery {
  constructor(public readonly einsatzId: string) {}
}
