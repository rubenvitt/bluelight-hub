/**
 * Query-Key-Factory für das Patienten-Feature (Story 1.2).
 *
 * Hierarchisches Pattern (TanStack-Query Best Practice). Story 1.5/1.6
 * konsumieren die `list` / `kpis` / `detail`-Keys später für virtualisierte
 * Listen und Optimistic-UI; Story 1.2 invalidiert sie nur on-success.
 */
export const PATIENT_QUERY_KEYS = {
  all: ['patienten'] as const,
  forEinsatz: (einsatzId: string) => [...PATIENT_QUERY_KEYS.all, 'einsatz', einsatzId] as const,
  list: (einsatzId: string) => [...PATIENT_QUERY_KEYS.forEinsatz(einsatzId), 'list'] as const,
  kpis: (einsatzId: string) => [...PATIENT_QUERY_KEYS.forEinsatz(einsatzId), 'kpis'] as const,
  detail: (einsatzId: string, patientId: string) => [...PATIENT_QUERY_KEYS.forEinsatz(einsatzId), 'detail', patientId] as const,
} as const;
