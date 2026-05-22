/**
 * Mutation-Hook für die Sichtungs-Reevaluierung (Story 1.3, AC5, FR17).
 *
 * Wrappt den generierten OpenAPI-Client
 * (`api.patienten().patientenControllerAktualisiereSichtungVAlpha`) und liefert
 * die TanStack-Mutation mit Optimistic-Patch + Rollback.
 *
 * **Verbote:**
 * - Kein direkter Low-Level-Request, kein eigener API-Wrapper —
 *   der generierte Client ist die einzige Quelle (CLAUDE.md API-Workflow).
 * - Kein `toast.success(...)` — UX-Spec verlangt Inline-Feedback im
 *   Patienten-Modul; Fehler werden in der `SkUpgradePillGroup` als
 *   ARIA-live-Pill gerendert.
 */
import { api, type PatientDto, type ResponseError, type SkEnum } from '@/shared';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { AktualisiereSichtungFormData } from '../schemas/aktualisiere-sichtung.schema';
import { PATIENT_QUERY_KEYS } from './queries';

interface UseSichtungAktualisierenArgs {
  einsatzId: string;
  patientId: string;
}

interface OptimisticContext {
  detailKey: QueryKey;
  listKey: QueryKey;
  previousDetail: PatientDto | undefined;
  previousList: PatientDto[] | undefined;
}

export function useSichtungAktualisieren({ einsatzId, patientId }: UseSichtungAktualisierenArgs) {
  const queryClient = useQueryClient();

  return useMutation<PatientDto, ResponseError, AktualisiereSichtungFormData, OptimisticContext>({
    mutationFn: async (input) => {
      const response = await api.patienten().patientenControllerAktualisiereSichtungVAlpha({
        einsatzId,
        patientId,
        aktualisiereSichtungDto: {
          neueSk: input.neueSk,
          sichtungArt: input.sichtungArt,
          grund: input.grund,
        },
      });
      return response.data;
    },
    onMutate: async (input) => {
      const detailKey = PATIENT_QUERY_KEYS.detail(einsatzId, patientId);
      const listKey = PATIENT_QUERY_KEYS.list(einsatzId);

      await queryClient.cancelQueries({ queryKey: detailKey });
      await queryClient.cancelQueries({ queryKey: listKey });

      const previousDetail = queryClient.getQueryData<PatientDto>(detailKey);
      const previousList = queryClient.getQueryData<PatientDto[]>(listKey);

      if (previousDetail) {
        queryClient.setQueryData<PatientDto>(detailKey, { ...previousDetail, aktuelleSk: input.neueSk as SkEnum });
      }
      if (previousList) {
        queryClient.setQueryData<PatientDto[]>(
          listKey,
          previousList.map((p) => (p.id === patientId ? { ...p, aktuelleSk: input.neueSk as SkEnum } : p)),
        );
      }

      return { detailKey, listKey, previousDetail, previousList };
    },
    onError: (_error, _input, context) => {
      if (!context) return;
      if (context.previousDetail) {
        queryClient.setQueryData(context.detailKey, context.previousDetail);
      } else {
        queryClient.removeQueries({ queryKey: context.detailKey });
      }
      if (context.previousList) {
        queryClient.setQueryData(context.listKey, context.previousList);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PATIENT_QUERY_KEYS.detail(einsatzId, patientId) });
      void queryClient.invalidateQueries({ queryKey: PATIENT_QUERY_KEYS.list(einsatzId) });
      void queryClient.invalidateQueries({ queryKey: PATIENT_QUERY_KEYS.kpis(einsatzId) });
    },
  });
}
