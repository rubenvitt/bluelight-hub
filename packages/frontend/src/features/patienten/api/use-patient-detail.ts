/**
 * Query-Hook für die Patient-Detail-Sicht (Story 1.7, AC10).
 *
 * Wrappt den generierten OpenAPI-Client (`api.patienten().patientenControllerDetailVAlpha`)
 * und liefert die TanStack-Query. Mutation-Hooks (use-erfasse-patient,
 * use-sichtung-aktualisieren, use-behandlung-aktualisieren,
 * use-transport-aktualisieren, use-korrigiere-patient + Notiz-Edit aus AC9)
 * invalidieren `PATIENT_QUERY_KEYS.detail(einsatzId, patientId)` zusätzlich
 * zu `list` und `kpis` — das Detail-Panel reflektiert Live-Updates ohne
 * manuelles Refetch.
 *
 * **Verbote:**
 *  - Kein direkter Low-Level-Request, kein eigener API-Wrapper.
 *  - Niemals `fetch()` für API-Calls (CLAUDE.md AC5).
 *
 * **Default-Optionen:**
 *  - `staleTime: 2_000` — analog Story 1.6 (Liste); Mutationen invalidieren
 *    explizit.
 *  - `gcTime: 60_000` — Garbage-Collection nach 1 min Inaktivität.
 *  - `refetchOnWindowFocus: false` — Tablet im BHP-Zelt, kein Focus-Refetch.
 *  - `placeholderData: keepPreviousData` (gesetzt per Konvention im Caller) —
 *    sanfter Patient-zu-Patient-Wechsel im D4-Split-View.
 */
import { api, type PatientDetailDto, type ResponseError } from '@/shared';
import { useQuery } from '@tanstack/react-query';
import { PATIENT_QUERY_KEYS } from './queries';

interface UsePatientDetailOptions {
  /** Query aktivieren — default `true`, falls einsatzId+patientId vorhanden. */
  enabled?: boolean;
}

export function usePatientDetail(einsatzId: string, patientId: string, options: UsePatientDetailOptions = {}) {
  // IDs einmal trimmen — `'pat_1'` und `'pat_1 '` dürfen nicht zwei distincte
  // Cache-Einträge erzeugen (Invalidation des einen würde den anderen
  // unangetastet lassen). Trim wird sowohl für `enabled` als auch für
  // `queryKey` und den Request-Body benutzt.
  const trimmedEinsatzId = typeof einsatzId === 'string' ? einsatzId.trim() : '';
  const trimmedPatientId = typeof patientId === 'string' ? patientId.trim() : '';
  const hasValidIds = trimmedEinsatzId.length > 0 && trimmedPatientId.length > 0;

  return useQuery<PatientDetailDto, ResponseError>({
    queryKey: PATIENT_QUERY_KEYS.detail(trimmedEinsatzId, trimmedPatientId),
    queryFn: async () => {
      const response = await api.patienten().patientenControllerDetailVAlpha({ einsatzId: trimmedEinsatzId, patientId: trimmedPatientId });
      return response.data;
    },
    enabled: options.enabled ?? hasValidIds,
    staleTime: 2_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
