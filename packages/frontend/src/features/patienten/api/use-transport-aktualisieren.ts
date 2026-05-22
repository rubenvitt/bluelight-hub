/**
 * Mutation-Hook für die Transportstatus-Updates (Story 1.4, AC5, FR19).
 * Analog `use-behandlung-aktualisieren.ts`.
 */
import { api, type PatientDto, type ResponseError, type TransportstatusEnum } from '@/shared';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { AktualisiereTransportFormData } from '../schemas/aktualisiere-transport.schema';
import { enrichResponseErrorWithCode } from './extract-error-code';
import { PATIENT_QUERY_KEYS } from './queries';

interface UseTransportAktualisierenArgs {
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
   * war: in diesem Fall muss `removeQueries` aufgerufen werden, damit der
   * optimistische Eintrag nicht als Server-Wahrheit hängen bleibt.
   */
  listPatched: boolean;
}

export function useTransportAktualisieren({ einsatzId, patientId }: UseTransportAktualisierenArgs) {
  const queryClient = useQueryClient();

  return useMutation<PatientDto, ResponseError, AktualisiereTransportFormData, OptimisticContext>({
    mutationFn: async (input) => {
      try {
        const response = await api.patienten().patientenControllerAktualisiereTransportVAlpha({
          einsatzId,
          patientId,
          aktualisiereTransportDto: {
            neuerStatus: input.neuerStatus,
          },
        });
        return response.data;
      } catch (error) {
        // Story 1.4 Code-Review Feature 1: siehe `use-behandlung-aktualisieren.ts`.
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

      const neuerStatus: TransportstatusEnum = input.neuerStatus;
      if (previousDetail) {
        queryClient.setQueryData<PatientDto>(detailKey, { ...previousDetail, transportstatus: neuerStatus });
      }
      let listPatched = false;
      if (previousList) {
        queryClient.setQueryData<PatientDto[]>(
          listKey,
          previousList.map((p) => (p.id === patientId ? { ...p, transportstatus: neuerStatus } : p)),
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
        // Defensiv: Optimistic-Patch ohne `previousList` ist aktuell durch
        // den `if (previousList)`-Guard ausgeschlossen — sollte sich das ändern,
        // sorgt `removeQueries` für einen Refetch statt eines Phantom-Eintrags.
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
