/**
 * Mutation-Hook für die Behandlungsstatus-Updates (Story 1.4, AC5, FR18).
 *
 * Wrappt den generierten OpenAPI-Client
 * (`api.patienten().patientenControllerAktualisiereBehandlungVAlpha`) und liefert
 * die TanStack-Mutation mit Optimistic-Patch + Rollback. Pattern: analog
 * `use-sichtung-aktualisieren.ts` (Story 1.3).
 *
 * **Verbote:**
 *  - Kein direkter Low-Level-Request, kein eigener API-Wrapper.
 *  - Kein `toast.success(...)` — UX-Spec verlangt Inline-Feedback.
 */
import { api, type BehandlungsstatusEnum, type PatientDto, type ResponseError } from '@/shared';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { AktualisiereBehandlungFormData } from '../schemas/aktualisiere-behandlung.schema';
import { enrichResponseErrorWithCode } from './extract-error-code';
import { PATIENT_QUERY_KEYS } from './queries';

interface UseBehandlungAktualisierenArgs {
  einsatzId: string;
  patientId: string;
}

interface OptimisticContext {
  detailKey: QueryKey;
  listKey: QueryKey;
  previousDetail: PatientDto | undefined;
  previousList: PatientDto[] | undefined;
  /**
   * `true`, wenn `onMutate` einen optimistischen Patch in den List-Cache
   * geschrieben hat. Wird im Rollback genutzt, falls `previousList` `undefined`
   * war (z. B. wenn die Liste vor dem Mutate nie geladen wurde): in diesem Fall
   * muss `removeQueries` aufgerufen werden, damit der optimistische Eintrag
   * nicht als Server-Wahrheit hängen bleibt.
   */
  listPatched: boolean;
}

export function useBehandlungAktualisieren({ einsatzId, patientId }: UseBehandlungAktualisierenArgs) {
  const queryClient = useQueryClient();

  return useMutation<PatientDto, ResponseError, AktualisiereBehandlungFormData, OptimisticContext>({
    mutationFn: async (input) => {
      try {
        const response = await api.patienten().patientenControllerAktualisiereBehandlungVAlpha({
          einsatzId,
          patientId,
          aktualisiereBehandlungDto: {
            neuerStatus: input.neuerStatus,
          },
        });
        return response.data;
      } catch (error) {
        // Story 1.4 Code-Review Feature 1: `ResponseError.response` JSON parsen
        // und `code` + `message` an den Error attachen, damit der synchrone
        // UI-Helper `extractErrorCode(...)` matchen kann (siehe
        // `extract-error-code.ts`).
        throw await enrichResponseErrorWithCode(error);
      }
    },
    onMutate: async (input) => {
      const detailKey = PATIENT_QUERY_KEYS.detail(einsatzId, patientId);
      const listKey = PATIENT_QUERY_KEYS.list(einsatzId);

      await queryClient.cancelQueries({ queryKey: detailKey });
      await queryClient.cancelQueries({ queryKey: listKey });

      const previousDetail = queryClient.getQueryData<PatientDto>(detailKey);
      const previousList = queryClient.getQueryData<PatientDto[]>(listKey);

      const neuerStatus: BehandlungsstatusEnum = input.neuerStatus;
      if (previousDetail) {
        queryClient.setQueryData<PatientDto>(detailKey, { ...previousDetail, behandlungsstatus: neuerStatus });
      }
      let listPatched = false;
      if (previousList) {
        queryClient.setQueryData<PatientDto[]>(
          listKey,
          previousList.map((p) => (p.id === patientId ? { ...p, behandlungsstatus: neuerStatus } : p)),
        );
        listPatched = true;
      }

      return { detailKey, listKey, previousDetail, previousList, listPatched };
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
      } else if (context.listPatched) {
        // Defensiv: Sollte der Optimistic-Patch je auch ohne `previousList`
        // erfolgen (heute via `if (previousList)` ausgeschlossen), darf der
        // Eintrag nicht hängen bleiben — `removeQueries` erzwingt einen Refetch.
        queryClient.removeQueries({ queryKey: context.listKey });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PATIENT_QUERY_KEYS.detail(einsatzId, patientId) });
      void queryClient.invalidateQueries({ queryKey: PATIENT_QUERY_KEYS.list(einsatzId) });
      void queryClient.invalidateQueries({ queryKey: PATIENT_QUERY_KEYS.kpis(einsatzId) });
    },
  });
}
