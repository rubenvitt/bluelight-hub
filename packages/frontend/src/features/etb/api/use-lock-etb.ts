/**
 * Lock ETB Mutation Hook
 *
 * Hook für ETB-Sperrung (Admin-Only, CQRS API).
 */

import { api } from '@/api';
import { getApiErrorMessage } from '@/utils/apiErrorHandler';
import { logger } from '@/utils/logger';
import type { ResponseError } from '@bluelight-hub/shared/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ETB_QUERY_KEYS, calculateRetryDelay } from './queries';

export interface LockEtbVariables {
  /**
   * ETB-ID
   */
  etbId: string;
}

/**
 * Hook für ETB-Sperrung (nur Admin, CQRS API)
 *
 * Sperrt ein Einsatztagebuch gegen weitere Änderungen. Diese Operation
 * kann nur von Administratoren durchgeführt werden. Bei Erfolg werden
 * automatisch alle ETB-Queries invalidiert um Konsistenz sicherzustellen.
 *
 * @returns Mutation für ETB-Sperrung
 *
 * @example
 * ```tsx
 * const lockEtb = useLockEtb();
 *
 * const handleLock = () => {
 *   if (confirm('ETB wirklich sperren?')) {
 *     lockEtb.mutate({ etbId: 'etb-123' });
 *   }
 * };
 * ```
 */
export const useLockEtb = () => {
  const queryClient = useQueryClient();

  return useMutation<void, ResponseError, LockEtbVariables>({
    mutationFn: async ({ etbId }) => {
      await api.etb().etbCqrsControllerLockEtbVAlpha({ etbId });
    },
    onMutate: async ({ etbId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ETB_QUERY_KEYS.all,
      });

      return { etbId };
    },
    onError: async (error: ResponseError) => {
      const message = await getApiErrorMessage(error, 'Das ETB konnte nicht gesperrt werden.', 'lockEtb');
      logger.error('Failed to lock ETB', error);
      toast.error('Fehler', { description: message });
    },
    onSuccess: () => {
      toast.success('ETB gesperrt', {
        description: 'Das Einsatztagebuch wurde erfolgreich gesperrt.',
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
