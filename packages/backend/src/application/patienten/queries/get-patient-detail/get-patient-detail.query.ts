/**
 * Query zum Abrufen der Patient-Detail-Sicht (Story 1.7, AC1/AC4).
 *
 * Read-only — keine Aggregate-Mutation, keine Events. Liefert Patient-
 * Snapshot + chronologisch sortierte Event-Historie als `PatientDetailDto`.
 * `einsatzId` wird vom Controller zur Defense-in-Depth-Validierung mitgegeben
 * (zusätzlich zu `EinsatzScopeGuard`), damit Cross-Einsatz-ID-Injection nicht
 * über den Detail-Endpoint geht.
 */
export class GetPatientDetailQuery {
  constructor(
    public readonly einsatzId: string,
    public readonly patientId: string,
  ) {}
}
