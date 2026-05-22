/**
 * Mutation-Hook für die Patient-Erfassung im Einsatz (Story 1.2, AC5).
 *
 * Wrappt den generierten OpenAPI-Client (`api.patienten().patientenControllerErfassePatientVAlpha`)
 * und liefert die TanStack-Mutation. `onSuccess` invalidiert `PATIENT_QUERY_KEYS.list` und
 * `PATIENT_QUERY_KEYS.kpis` für Stories 1.5 / 1.6.
 *
 * **Verbot:** Kein direkter Low-Level-Request, kein eigener API-Wrapper —
 * der generierte Client ist die einzige Quelle (CLAUDE.md API-Workflow).
 */
import { api, type PatientDto, type ResponseError } from '@/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ErfassePatientFormData } from '../schemas/erfasse-patient.schema';
import { PATIENT_QUERY_KEYS } from './queries';

interface UseErfassePatientArgs {
  einsatzId: string;
}

export function useErfassePatient({ einsatzId }: UseErfassePatientArgs) {
  const queryClient = useQueryClient();

  return useMutation<PatientDto, ResponseError, ErfassePatientFormData>({
    mutationFn: async (input) => {
      const response = await api.patienten().patientenControllerErfassePatientVAlpha({
        einsatzId,
        erfassePatientDto: {
          initialeSk: input.initialeSk,
          diviVakNummer: input.diviVakNummer,
          notiz: input.notiz,
        },
      });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PATIENT_QUERY_KEYS.list(einsatzId) });
      void queryClient.invalidateQueries({ queryKey: PATIENT_QUERY_KEYS.kpis(einsatzId) });
    },
  });
}
