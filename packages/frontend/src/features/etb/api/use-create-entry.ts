/**
 * Create ETB Entry Mutation Hook
 *
 * Hook für ETB-Eintrag-Erstellung (CQRS API).
 */

import { api } from '@/api';
import { getApiErrorMessage } from '@/utils/apiErrorHandler';
import { logger } from '@/utils/logger';
import type { AddEintragDto, EintragDto, ResponseError } from '@bluelight-hub/shared/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ETB_QUERY_KEYS, calculateRetryDelay } from './queries';

export interface CreateEtbEntryVariables {
  /**
   * ETB-ID
   */
  etbId: string;

  /**
   * Daten für neuen ETB-Eintrag
   */
  data: AddEintragDto;
}

/**
 * Hook für ETB-Eintrag-Erstellung (CQRS API)
 *
 * Erstellt einen neuen Eintrag im Einsatztagebuch. Bei Erfolg werden
 * automatisch alle ETB-Queries invalidiert um Konsistenz sicherzustellen.
 *
 * @returns Mutation für ETB-Eintrag-Erstellung
 *
 * @example
 * ```tsx
 * const createEntry = useCreateEtbEntry();
 *
 * const handleSubmit = (data: AddEintragDto) => {
 *   createEntry.mutate({
 *     etbId: 'etb-123',
 *     data,
 *   });
 * };
 * ```
 */
export const useCreateEtbEntry = () => {
  const queryClient = useQueryClient();

  return useMutation<EintragDto, ResponseError, CreateEtbEntryVariables>({
    mutationFn: async ({ etbId, data }) => {
      return await api.etb().etbCqrsControllerAddEintragVAlpha({
        etbId,
        addEintragDto: data,
      });
    },
    onMutate: async ({ etbId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ETB_QUERY_KEYS.all,
      });

      return { etbId };
    },
    onError: async (error: ResponseError) => {
      const message = await getApiErrorMessage(error, 'Der ETB-Eintrag konnte nicht erstellt werden.', 'createEtbEintrag');
      logger.error('Failed to create ETB entry', error);
      toast.error('Fehler', { description: message });
    },
    onSuccess: () => {
      toast.success('Eintrag hinzugefügt', {
        description: 'Der ETB-Eintrag wurde erfolgreich erstellt.',
      });
    },
    onSettled: async () => {
      // Invalidate all ETB queries to ensure consistency
      await queryClient.invalidateQueries({ queryKey: ETB_QUERY_KEYS.all });
    },
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};
