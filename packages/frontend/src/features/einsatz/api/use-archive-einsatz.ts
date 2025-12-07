/**
 * Archive Mutation Hook für Einsatz-Archivierung
 *
 * Setzt Einsatz-Status auf ARCHIVIERT mit Optimistic Updates.
 * Intelligent Update aller betroffenen Queries und Caches.
 */

import { api } from '@/api';
import { getApiErrorMessage } from '@/utils/apiErrorHandler';
import { logger } from '@/utils/logger';
import type { EinsatzControllerCreateVAlpha200Response, EinsatzControllerFindAllVAlpha200Response, EinsatzListItemDto, EinsatzResponseDto, ResponseError } from '@bluelight-hub/shared/client';
import { EinsatzResponseDtoStatusEnum } from '@bluelight-hub/shared/client';
import type { InfiniteData } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { EINSATZ_QUERY_KEYS, calculateRetryDelay, type EinsatzQueryFilters } from './queries';

// Type für Infinite Query Data
type InfiniteEinsatzData = InfiniteData<EinsatzControllerFindAllVAlpha200Response>;

// Type für Mutation Context
interface ArchiveMutationContext {
  previousEinsatz?: EinsatzControllerCreateVAlpha200Response;
  previousEinsaetze?: EinsatzControllerFindAllVAlpha200Response;
  previousActiveWithCounts?: EinsatzListItemDto[];
}

/**
 * Hook für Einsatz archivieren mit Optimistic Updates
 *
 * Archiviert einen Einsatz (setzt Status auf ARCHIVIERT) und aktualisiert
 * sofort die UI mit Optimistic Update. Bei Fehlern erfolgt automatisches Rollback.
 *
 * Nach Archivierung wird der Einsatz aus der activeWithCounts-Liste entfernt
 * oder als ARCHIVIERT markiert, je nach Filter-Kontext.
 *
 * @param filters - Aktuelle Filter für Cache-Updates (optional)
 * @returns TanStack Mutation Result mit mutate({ id })
 *
 * @example
 * ```tsx
 * const archiveEinsatz = useArchiveEinsatz();
 *
 * const handleArchive = (id: string) => {
 *   if (confirm('Einsatz wirklich archivieren?')) {
 *     archiveEinsatz.mutate({ id });
 *   }
 * };
 * ```
 */
export const useArchiveEinsatz = (filters?: EinsatzQueryFilters) => {
  const queryClient = useQueryClient();

  return useMutation<EinsatzResponseDto, ResponseError, { id: string }, ArchiveMutationContext>({
    mutationFn: async ({ id }) => {
      const response = await api.einsatz().einsatzControllerArchiveVAlpha({ id });
      return response.data;
    },
    onMutate: async ({ id }) => {
      // Cancel laufende Queries
      await queryClient.cancelQueries({ queryKey: EINSATZ_QUERY_KEYS.detail(id) });
      await queryClient.cancelQueries({ queryKey: EINSATZ_QUERY_KEYS.all });

      // Snapshot für Rollback
      const previousEinsatz = queryClient.getQueryData<EinsatzControllerCreateVAlpha200Response>(EINSATZ_QUERY_KEYS.detail(id));
      const previousEinsaetze = queryClient.getQueryData<EinsatzControllerFindAllVAlpha200Response>(EINSATZ_QUERY_KEYS.list(filters));
      const previousActiveWithCounts = queryClient.getQueryData<EinsatzListItemDto[]>(EINSATZ_QUERY_KEYS.activeWithCounts());

      if (previousEinsatz?.data) {
        // Optimistisch archivierten Einsatz erstellen
        const archivedEinsatz: EinsatzResponseDto = {
          ...previousEinsatz.data,
          status: EinsatzResponseDtoStatusEnum.Archiviert,
          updatedAt: new Date(),
        };

        // Update Detail Cache
        queryClient.setQueryData<EinsatzControllerCreateVAlpha200Response>(EINSATZ_QUERY_KEYS.detail(id), {
          data: archivedEinsatz,
          meta: previousEinsatz.meta || {},
        });

        // Update List Cache
        queryClient.setQueryData<EinsatzControllerFindAllVAlpha200Response>(EINSATZ_QUERY_KEYS.list(filters), (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data?.map((e) => (e.id === id ? archivedEinsatz : e)) || [],
          };
        });

        // Update activeWithCounts Cache - markiere als archiviert
        queryClient.setQueryData<EinsatzListItemDto[]>(EINSATZ_QUERY_KEYS.activeWithCounts(), (old) => {
          if (!old) return old;
          return old.map((e) => (e.id === id ? { ...e, status: 'ARCHIVIERT' as const } : e));
        });

        // Update Infinite Query Cache (falls vorhanden)
        const infiniteData = queryClient.getQueryData<InfiniteEinsatzData>(EINSATZ_QUERY_KEYS.infinite(filters));
        if (infiniteData?.pages) {
          queryClient.setQueryData<InfiniteEinsatzData>(EINSATZ_QUERY_KEYS.infinite(filters), {
            ...infiniteData,
            pages: infiniteData.pages.map((page) => ({
              ...page,
              data: page.data?.map((e) => (e.id === id ? archivedEinsatz : e)) || [],
            })),
          });
        }
      }

      return { previousEinsatz, previousEinsaetze, previousActiveWithCounts };
    },
    onError: async (error: ResponseError, { id }, context?: ArchiveMutationContext) => {
      // Rollback: Vorherigen Zustand wiederherstellen
      if (context?.previousEinsatz) {
        queryClient.setQueryData(EINSATZ_QUERY_KEYS.detail(id), context.previousEinsatz);
      }
      if (context?.previousEinsaetze) {
        queryClient.setQueryData(EINSATZ_QUERY_KEYS.list(filters), context.previousEinsaetze);
      }
      if (context?.previousActiveWithCounts) {
        queryClient.setQueryData(EINSATZ_QUERY_KEYS.activeWithCounts(), context.previousActiveWithCounts);
      }

      const message = await getApiErrorMessage(error, 'Der Einsatz konnte nicht archiviert werden.', 'archiveEinsatz');
      logger.error('Failed to archive einsatz', error);
      toast.error('Fehler', { description: message });
    },
    onSuccess: async () => {
      toast.success('Einsatz archiviert', {
        description: 'Der Einsatz wurde erfolgreich archiviert.',
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
