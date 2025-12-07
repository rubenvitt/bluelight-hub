/**
 * Update Mutation Hook für bestehenden Einsatz
 *
 * Aktualisiert Einsatz-Daten mit Optimistic Updates und intelligenter Cache-Invalidierung.
 * Unterstützt sowohl Detail-Updates als auch List-Updates.
 */

import { api } from '@/api';
import { getApiErrorMessage } from '@/utils/apiErrorHandler';
import { logger } from '@/utils/logger';
import type {
  EinsatzControllerCreateVAlpha200Response,
  EinsatzControllerFindAllVAlpha200Response,
  EinsatzListItemDto,
  EinsatzResponseDto,
  ResponseError,
  UpdateEinsatzDto,
} from '@bluelight-hub/shared/client';
import type { InfiniteData } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { EINSATZ_QUERY_KEYS, calculateRetryDelay } from './queries';

// Type für Infinite Query Data
type InfiniteEinsatzData = InfiniteData<EinsatzControllerFindAllVAlpha200Response>;

// Type für Mutation Context
interface UpdateMutationContext {
  previousEinsatz?: EinsatzControllerCreateVAlpha200Response;
  previousEinsaetze?: EinsatzControllerFindAllVAlpha200Response;
  previousActiveWithCounts?: EinsatzListItemDto[];
}

/**
 * Hook für Einsatz aktualisieren mit Optimistic Updates
 *
 * Aktualisiert einen bestehenden Einsatz und propagiert Änderungen
 * intelligent durch alle betroffenen Queries (Detail, List, Infinite, activeWithCounts).
 *
 * Nutzt den Query Cache um alle existierenden Listen-Queries zu finden
 * und zu aktualisieren, unabhängig von den Filter-Parametern.
 *
 * @returns TanStack Mutation Result mit mutate({ id, data })
 *
 * @example
 * ```tsx
 * const updateEinsatz = useUpdateEinsatz();
 *
 * const handleUpdate = (id: string, data: UpdateEinsatzDto) => {
 *   updateEinsatz.mutate({ id, data });
 * };
 * ```
 */
export const useUpdateEinsatz = () => {
  const queryClient = useQueryClient();

  return useMutation<EinsatzResponseDto, ResponseError, { id: string; data: UpdateEinsatzDto }, UpdateMutationContext>({
    mutationFn: async ({ id, data }) => {
      const response = await api.einsatz().einsatzControllerUpdateVAlpha({
        id,
        updateEinsatzDto: data,
      });
      return response.data;
    },
    onMutate: async ({ id, data }) => {
      // Cancel laufende Queries
      await queryClient.cancelQueries({ queryKey: EINSATZ_QUERY_KEYS.detail(id) });
      await queryClient.cancelQueries({ queryKey: EINSATZ_QUERY_KEYS.all });

      // Snapshot für Rollback
      const previousEinsatz = queryClient.getQueryData<EinsatzControllerCreateVAlpha200Response>(EINSATZ_QUERY_KEYS.detail(id));

      if (previousEinsatz?.data) {
        const updatedEinsatz: EinsatzResponseDto = {
          ...previousEinsatz.data,
          ...data,
          completeness: previousEinsatz.data.completeness,
          updatedAt: new Date(),
        };

        // Update Detail Cache
        queryClient.setQueryData<EinsatzControllerCreateVAlpha200Response>(EINSATZ_QUERY_KEYS.detail(id), {
          data: updatedEinsatz,
          meta: previousEinsatz.meta || {},
        });

        // Update ALLE existierenden List/Infinite/activeWithCounts Caches
        const queryCache = queryClient.getQueryCache();
        queryCache.getAll().forEach((query) => {
          const queryKey = query.queryKey;

          // Standard List Query
          if (Array.isArray(queryKey) && queryKey[0] === 'einsatz' && queryKey[1] === 'list') {
            queryClient.setQueryData<EinsatzControllerFindAllVAlpha200Response>(queryKey, (old) => {
              if (!old) return old;
              return {
                ...old,
                data: old.data?.map((e) => (e.id === id ? updatedEinsatz : e)) || [],
              };
            });
          }

          // Infinite Query
          if (Array.isArray(queryKey) && queryKey[0] === 'einsatz' && queryKey[1] === 'infinite') {
            queryClient.setQueryData<InfiniteEinsatzData>(queryKey, (old) => {
              if (!old?.pages) return old;
              return {
                ...old,
                pages: old.pages.map((page) => ({
                  ...page,
                  data: page.data?.map((e) => (e.id === id ? updatedEinsatz : e)) || [],
                })),
              };
            });
          }

          // activeWithCounts Query
          if (Array.isArray(queryKey) && queryKey[0] === 'einsatz' && queryKey[1] === 'activeWithCounts') {
            queryClient.setQueryData<EinsatzListItemDto[]>(queryKey, (old) => {
              if (!old) return old;
              return old.map((e) => {
                if (e.id !== id) return e;
                return {
                  ...e,
                  nummer: data.nummer ?? e.nummer,
                  alarmstichwort: data.alarmstichwort ?? e.alarmstichwort,
                  status: (data.status as EinsatzListItemDto['status']) ?? e.status,
                  einsatzort: data.einsatzort !== undefined ? data.einsatzort : e.einsatzort,
                  // Counts bleiben erhalten, werden bei Invalidierung refreshed
                };
              });
            });
          }
        });
      }

      return { previousEinsatz };
    },
    onError: async (error: ResponseError, { id }, context?: UpdateMutationContext) => {
      // Rollback: Vorherigen Zustand wiederherstellen
      if (context?.previousEinsatz) {
        queryClient.setQueryData(EINSATZ_QUERY_KEYS.detail(id), context.previousEinsatz);
      }

      const message = await getApiErrorMessage(error, 'Der Einsatz konnte nicht aktualisiert werden.', 'updateEinsatz');
      logger.error('Failed to update einsatz', error);
      toast.error('Fehler', { description: message });
    },
    onSuccess: async () => {
      toast.success('Einsatz aktualisiert', {
        description: 'Der Einsatz wurde erfolgreich aktualisiert.',
      });
    },
    onSettled: async (_, __, { id }) => {
      // Invalidierung: Server-Daten neu laden
      await queryClient.invalidateQueries({ queryKey: EINSATZ_QUERY_KEYS.detail(id) });
      await queryClient.invalidateQueries({ queryKey: EINSATZ_QUERY_KEYS.all });
    },
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};
