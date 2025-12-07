/**
 * Delete ETB Entry Mutation Hook
 *
 * Hook für ETB-Eintrag-Löschung (Soft Delete, CQRS API).
 */

import { api } from '@/api';
import { getApiErrorMessage } from '@/utils/apiErrorHandler';
import { logger } from '@/utils/logger';
import type { ResponseError } from '@bluelight-hub/shared/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ETB_QUERY_KEYS, calculateRetryDelay } from './queries';

export interface DeleteEtbEntryVariables {
  /**
   * ETB-ID
   */
  etbId: string;

  /**
   * Eintrag-ID
   */
  eintragId: string;
}

/**
 * Hook für ETB-Eintrag-Löschung (Soft Delete, CQRS API)
 *
 * Löscht einen Eintrag aus dem Einsatztagebuch (Soft Delete). Der Eintrag
 * wird nicht physisch entfernt, sondern nur als gelöscht markiert. Bei Erfolg
 * werden automatisch alle ETB-Queries invalidiert um Konsistenz sicherzustellen.
 *
 * @returns Mutation für ETB-Eintrag-Löschung
 *
 * @example
 * ```tsx
 * const deleteEntry = useDeleteEtbEntry();
 *
 * const handleDelete = (eintragId: string) => {
 *   deleteEntry.mutate({
 *     etbId: 'etb-123',
 *     eintragId,
 *   });
 * };
 * ```
 */
export const useDeleteEtbEntry = () => {
  const queryClient = useQueryClient();

  return useMutation<void, ResponseError, DeleteEtbEntryVariables>({
    mutationFn: async ({ etbId, eintragId }) => {
      await api.etb().etbCqrsControllerDeleteEintragVAlpha({
        etbId,
        eintragId,
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
      const message = await getApiErrorMessage(error, 'Der ETB-Eintrag konnte nicht gelöscht werden.', 'deleteEtbEintrag');
      logger.error('Failed to delete ETB entry', error);
      toast.error('Fehler', { description: message });
    },
    onSuccess: () => {
      toast.success('Eintrag gelöscht', {
        description: 'Der ETB-Eintrag wurde erfolgreich gelöscht.',
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
