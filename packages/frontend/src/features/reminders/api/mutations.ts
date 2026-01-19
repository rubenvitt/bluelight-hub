/**
 * Erinnerungen Mutation Hooks
 *
 * Mutation Hooks für Erinnerungs-Erstellung und -Verwaltung.
 *
 * **Story 1.1 AC2/AC3:** "Titel-Eingabe + Zeit-Preset auswählen"
 * **Story 1.1 AC6:** "Erinnerungen werden im Backend pro Einsatz gespeichert"
 */

import { api } from '@/shared';
import { getApiErrorMessage } from '@/shared/lib/errors/apiErrorHandler';
import { logger } from '@/shared/lib/logger';
import type { CreateErinnerungDto, ErinnerungResponseDto, ResponseError } from '@/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ERINNERUNG_QUERY_KEYS, calculateRetryDelay } from './queries';

export interface CreateErinnerungVariables {
  /**
   * Einsatz-ID
   */
  einsatzId: string;

  /**
   * Daten für neue Erinnerung
   */
  data: CreateErinnerungDto;
}

interface CreateErinnerungContext {
  einsatzId: string;
  previousErinnerungen: ErinnerungResponseDto[] | undefined;
}

/**
 * Hook für Erinnerungs-Erstellung mit Optimistic Updates
 *
 * Erstellt eine neue Erinnerung für einen Einsatz. Bei Erfolg werden
 * automatisch alle Erinnerungs-Queries invalidiert um Konsistenz sicherzustellen.
 * Bei Fehler wird der vorherige Zustand wiederhergestellt (Rollback).
 *
 * @returns Mutation für Erinnerungs-Erstellung
 *
 * @example
 * ```tsx
 * const createErinnerung = useCreateErinnerung();
 *
 * const handleSubmit = (formData: CreateErinnerungFormData) => {
 *   const faelligAm = new Date(Date.now() + formData.minuten * 60 * 1000);
 *
 *   createErinnerung.mutate({
 *     einsatzId: 'abc-123',
 *     data: {
 *       titel: formData.titel,
 *       faelligAm: faelligAm.toISOString(),
 *       beschreibung: formData.beschreibung,
 *     },
 *   });
 * };
 * ```
 */
export const useCreateErinnerung = () => {
  const queryClient = useQueryClient();

  return useMutation<ErinnerungResponseDto, ResponseError, CreateErinnerungVariables, CreateErinnerungContext>({
    mutationFn: async ({ einsatzId, data }) => {
      const response = await api.erinnerungen().erinnerungControllerCreateVAlpha({
        einsatzId,
        createErinnerungDto: data,
      });
      return response.data;
    },
    onMutate: async ({ einsatzId, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ERINNERUNG_QUERY_KEYS.list(einsatzId),
      });

      // Snapshot the previous value
      const previousErinnerungen = queryClient.getQueryData<ErinnerungResponseDto[]>(ERINNERUNG_QUERY_KEYS.list(einsatzId));

      // Optimistically update to the new value
      if (previousErinnerungen) {
        const optimisticErinnerung: ErinnerungResponseDto = {
          id: `temp-${Date.now()}`, // Temporary ID (will be replaced on success)
          einsatzId,
          titel: data.titel,
          beschreibung: data.beschreibung ?? null,
          faelligAm: data.faelligAm,
          status: 'GEPLANT',
          erstelltVon: 'optimistic', // Placeholder (will be replaced on success)
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        queryClient.setQueryData<ErinnerungResponseDto[]>(ERINNERUNG_QUERY_KEYS.list(einsatzId), [...previousErinnerungen, optimisticErinnerung]);
      }

      // Return context object with previous value for rollback
      return { einsatzId, previousErinnerungen };
    },
    onError: async (error: ResponseError, _variables, context) => {
      // Rollback to previous value on error
      if (context?.previousErinnerungen !== undefined) {
        queryClient.setQueryData(ERINNERUNG_QUERY_KEYS.list(context.einsatzId), context.previousErinnerungen);
      }

      const message = await getApiErrorMessage(error, 'Die Erinnerung konnte nicht erstellt werden.', 'createErinnerung');
      logger.error('Failed to create Erinnerung', error);
      toast.error('Fehler', { description: message });
    },
    onSuccess: () => {
      toast.success('Erinnerung erstellt', {
        description: 'Die Erinnerung wurde erfolgreich angelegt.',
      });
    },
    onSettled: async (_data, _error, { einsatzId }) => {
      // Ensure consistency - invalidate Erinnerungen for this Einsatz
      // Dies ersetzt die optimistische Erinnerung mit der echten vom Server
      await queryClient.invalidateQueries({
        queryKey: ERINNERUNG_QUERY_KEYS.list(einsatzId),
      });
    },
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};
