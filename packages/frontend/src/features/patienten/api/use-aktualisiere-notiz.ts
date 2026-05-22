/**
 * Mutation-Hook für die Notiz-Korrektur (Story 1.7, AC9).
 *
 * Dünner Wrapper um den existierenden `useKorrigierePatient`-Hook (Story 1.4)
 * mit fixiertem `feld='notiz'`. Backend persistiert die Notiz als Snapshot-
 * Feld + emittiert `PatientKorrigiert(feld='notiz')` als Audit-Event. Der
 * Grund wird default als „Auto-Save Notiz" gesetzt, weil die Notiz-Edits
 * kontinuierlich auflaufen — ein separater Grund-Prompt pro Tastendruck
 * wäre UX-feindlich.
 *
 * **Verbote:**
 *  - Kein direkter Low-Level-Request, kein eigener API-Wrapper.
 *  - Niemals `fetch()` für API-Calls (CLAUDE.md AC5).
 *
 * **`null` als `neu`-Wert** entspricht „Notiz löschen"; das Aggregate
 * akzeptiert sowohl `null` als auch trim'd-leeren String.
 */
import { api, type PatientDto, type ResponseError } from '@/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enrichResponseErrorWithCode } from './extract-error-code';
import { PATIENT_QUERY_KEYS } from './queries';

interface UseAktualisiereNotizArgs {
  einsatzId: string;
  patientId: string;
}

export interface AktualisiereNotizInput {
  /** Neuer Notiz-Text. `null` löscht die Notiz. */
  neueNotiz: string | null;
  /** Optionaler Grund — default „Notiz aktualisiert" (Audit-Trail-Pflicht). */
  grund?: string;
}

const DEFAULT_GRUND = 'Notiz aktualisiert';

export function useAktualisiereNotiz({ einsatzId, patientId }: UseAktualisiereNotizArgs) {
  const queryClient = useQueryClient();

  return useMutation<PatientDto, ResponseError, AktualisiereNotizInput>({
    mutationFn: async ({ neueNotiz, grund }) => {
      try {
        const response = await api.patienten().patientenControllerKorrigiereVAlpha({
          einsatzId,
          patientId,
          korrigierePatientDto: {
            feld: 'notiz',
            neuerWert: neueNotiz,
            grund: grund ?? DEFAULT_GRUND,
          },
        });
        return response.data;
      } catch (error) {
        throw await enrichResponseErrorWithCode(error);
      }
    },
    onSettled: () => {
      // Story 1.7 Code-Review-Patch: KPIs (SK-/Behandlungs-/Transport-Buckets)
      // bleiben durch eine reine Notiz-Korrektur unverändert. KPI-Invalidation
      // bei jedem Auto-Save würde unnötigen Aggregations-Roundtrip-Lärm
      // produzieren (4G im BHP-Zelt) ohne UX-Nutzen.
      void queryClient.invalidateQueries({ queryKey: PATIENT_QUERY_KEYS.detail(einsatzId, patientId) });
      void queryClient.invalidateQueries({ queryKey: PATIENT_QUERY_KEYS.list(einsatzId) });
    },
  });
}
