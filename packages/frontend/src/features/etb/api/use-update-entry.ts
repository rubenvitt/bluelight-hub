/**
 * Update ETB Entry Mutation Hook
 *
 * Hook für ETB-Eintrag-Aktualisierung (CQRS API).
 */

import { api } from '@/api';
import { getApiErrorMessage } from '@/utils/apiErrorHandler';
import { logger } from '@/utils/logger';
import type { EintragDto, ResponseError, UpdateEintragDto } from '@bluelight-hub/shared/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ETB_QUERY_KEYS, calculateRetryDelay } from './queries';

export interface UpdateEtbEntryVariables {
  /**
   * ETB-ID
   */
  etbId: string;

  /**
   * Eintrag-ID
   */
  eintragId: string;

  /**
   * Aktualisierte Daten
   */
  data: UpdateEintragDto;
}

/**
 * Hook für ETB-Eintrag-Aktualisierung (CQRS API)
 *
 * Aktualisiert einen bestehenden Eintrag im Einsatztagebuch. Bei Erfolg werden
 * automatisch alle ETB-Queries invalidiert um Konsistenz sicherzustellen.
 *
 * @returns Mutation für ETB-Eintrag-Aktualisierung
 *
 * @example
 * ```tsx
 * const updateEntry = useUpdateEtbEntry();
 *
 * const handleUpdate = (eintragId: string, data: UpdateEintragDto) => {
 *   updateEntry.mutate({
 *     etbId: 'etb-123',
 *     eintragId,
 *     data,
 *   });
 * };
 * ```
 */
export const useUpdateEtbEntry = () => {
  const queryClient = useQueryClient();

  return useMutation<EintragDto, ResponseError, UpdateEtbEntryVariables>({
    mutationFn: async ({ etbId, eintragId, data }) => {
      return await api.etb().etbCqrsControllerUpdateEintragVAlpha({
        etbId,
        eintragId,
        updateEintragDto: data,
      });
    },
    onMutate: async ({ etbId, eintragId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ETB_QUERY_KEYS.all,
      });

      return { etbId, eintragId };
    },
    onError: async (error: ResponseError) => {
      const message = await getApiErrorMessage(error, 'Der ETB-Eintrag konnte nicht aktualisiert werden.', 'updateEtbEintrag');
      logger.error('Failed to update ETB entry', error);
      toast.error('Fehler', { description: message });
    },
    onSuccess: () => {
      toast.success('Eintrag aktualisiert', {
        description: 'Der ETB-Eintrag wurde erfolgreich aktualisiert.',
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
