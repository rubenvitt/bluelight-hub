/**
 * Mutation-Hook für den Korrektur-Drawer (Story 1.4, AC5, FR42).
 *
 * **Bewusst KEIN Optimistic-Update:** Korrektur-Severity ist hoch — wir warten
 * auf Server-Wahrheit, bevor wir den Snapshot patchen. Stattdessen nur
 * `onSettled`-Invalidation für `detail`, `list` und `kpis`.
 */
import { api, type PatientDto, type ResponseError } from '@/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { KorrigierePatientFormData } from '../schemas/korrigiere-patient.schema';
import { enrichResponseErrorWithCode } from './extract-error-code';
import { PATIENT_QUERY_KEYS } from './queries';

interface UseKorrigierePatientArgs {
  einsatzId: string;
  patientId: string;
}

export function useKorrigierePatient({ einsatzId, patientId }: UseKorrigierePatientArgs) {
  const queryClient = useQueryClient();

  return useMutation<PatientDto, ResponseError, KorrigierePatientFormData>({
    mutationFn: async (input) => {
      try {
        const response = await api.patienten().patientenControllerKorrigiereVAlpha({
          einsatzId,
          patientId,
          korrigierePatientDto: {
            feld: input.feld,
            neuerWert: input.neuerWert,
            grund: input.grund,
            // Story 1.4 Code-Review Feature 2: explizite TOT-Korrektur-Bestätigung.
            // Nur durchreichen, wenn der Drawer den Confirm-Step bestätigt hat —
            // andernfalls lehnt das Aggregate die Korrektur ab.
            ...(input.bestaetigeTotKorrektur === true ? { bestaetigeTotKorrektur: true } : {}),
          },
        });
        return response.data;
      } catch (error) {
        // Story 1.4 Code-Review Feature 1: siehe `use-behandlung-aktualisieren.ts`.
        throw await enrichResponseErrorWithCode(error);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PATIENT_QUERY_KEYS.detail(einsatzId, patientId) });
      void queryClient.invalidateQueries({ queryKey: PATIENT_QUERY_KEYS.list(einsatzId) });
      void queryClient.invalidateQueries({ queryKey: PATIENT_QUERY_KEYS.kpis(einsatzId) });
    },
  });
}
