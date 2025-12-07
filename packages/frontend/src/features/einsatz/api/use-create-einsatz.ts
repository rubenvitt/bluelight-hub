/**
 * Create Mutation Hook für neuen Einsatz
 *
 * Erstellt einen neuen Einsatz mit Optimistic Updates für sofortiges UI-Feedback.
 * Invalidiert automatisch alle betroffenen Queries nach erfolgreicher Erstellung.
 */

import { api } from '@/api';
import { getApiErrorMessage } from '@/utils/apiErrorHandler';
import { logger } from '@/utils/logger';
import type {
  CreateEinsatzDto,
  EinsatzControllerCreateVAlpha200Response,
  EinsatzControllerFindAllVAlpha200Response,
  EinsatzListItemDto,
  EinsatzResponseDto,
  ResponseError,
} from '@bluelight-hub/shared/client';
import { EinsatzResponseDtoStatusEnum } from '@bluelight-hub/shared/client';
import type { InfiniteData } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { EINSATZ_QUERY_KEYS, calculateRetryDelay, type EinsatzQueryFilters } from './queries';

// Type für Infinite Query Data
type InfiniteEinsatzData = InfiniteData<EinsatzControllerFindAllVAlpha200Response>;

// Type für Mutation Context
interface CreateMutationContext {
  previousEinsaetze?: EinsatzControllerFindAllVAlpha200Response;
  previousActiveWithCounts?: EinsatzListItemDto[];
  optimisticEinsatz?: EinsatzResponseDto;
  optimisticListItem?: EinsatzListItemDto;
}

/**
 * Hook für Einsatz erstellen mit Optimistic Updates
 *
 * Erstellt einen neuen Einsatz und aktualisiert sofort die UI
 * (Optimistic Update), noch bevor die Server-Antwort zurückkommt.
 *
 * Bei Fehlern wird der optimistische State automatisch zurückgerollt
 * und eine Fehler-Toast-Benachrichtigung angezeigt.
 *
 * @param filters - Aktuelle Filter für Cache-Updates (optional)
 * @returns TanStack Mutation Result mit mutate/mutateAsync
 *
 * @example
 * ```tsx
 * const createEinsatz = useCreateEinsatz({ status: 'AKTIV' });
 *
 * const handleSubmit = (data: CreateEinsatzDto) => {
 *   createEinsatz.mutate(data, {
 *     onSuccess: () => router.push(`/einsatz/${data.id}`),
 *   });
 * };
 * ```
 */
export const useCreateEinsatz = (filters?: EinsatzQueryFilters) => {
  const queryClient = useQueryClient();

  return useMutation<EinsatzResponseDto, ResponseError, CreateEinsatzDto, CreateMutationContext>({
    mutationFn: async (data: CreateEinsatzDto) => {
      const response = await api.einsatz().einsatzControllerCreateVAlpha({
        createEinsatzDto: data,
      });
      return response.data;
    },
    onMutate: async (newEinsatz) => {
      // Cancel laufende Queries um Race Conditions zu vermeiden
      await queryClient.cancelQueries({ queryKey: EINSATZ_QUERY_KEYS.all });

      // Snapshot des vorherigen Zustands für Rollback
      const previousEinsaetze = queryClient.getQueryData<EinsatzControllerFindAllVAlpha200Response>(EINSATZ_QUERY_KEYS.list(filters));
      const previousActiveWithCounts = queryClient.getQueryData<EinsatzListItemDto[]>(EINSATZ_QUERY_KEYS.activeWithCounts());

      // Optimistischen Einsatz erstellen
      const optimisticEinsatz: EinsatzResponseDto = {
        id: `temp-${Date.now()}`,
        ...newEinsatz,
        status: ('status' in newEinsatz ? newEinsatz.status : undefined) || EinsatzResponseDtoStatusEnum.Angelegt,
        createdBy: 'current-user',
        name: `${newEinsatz.alarmstichwort || 'Einsatz'} (wird erstellt)`,
        completeness: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Optimistischen List Item erstellen für activeWithCounts
      const optimisticListItem: EinsatzListItemDto = {
        id: optimisticEinsatz.id,
        nummer: newEinsatz.nummer || 'E{YEAR}-{ID}',
        alarmstichwort: newEinsatz.alarmstichwort || 'Einsatz',
        status: optimisticEinsatz.status as EinsatzListItemDto['status'],
        einsatzort: newEinsatz.einsatzort || null,
        createdAt: optimisticEinsatz.createdAt,
        etbEintraegeCount: 0,
        poisCount: 0,
      };

      // Optimistic Update für standard list query
      queryClient.setQueryData<EinsatzControllerFindAllVAlpha200Response>(EINSATZ_QUERY_KEYS.list(filters), (old) => {
        if (!old) return old;
        return {
          ...old,
          data: [optimisticEinsatz, ...(old.data || [])],
          pagination: old.pagination ? { ...old.pagination, total: (old.pagination.total || 0) + 1 } : old.pagination,
        };
      });

      // Optimistic Update für activeWithCounts query
      queryClient.setQueryData<EinsatzListItemDto[]>(EINSATZ_QUERY_KEYS.activeWithCounts(), (old) => {
        if (!old) return old;
        return [optimisticListItem, ...old];
      });

      // Optimistic Update für infinite query (falls vorhanden)
      const infiniteData = queryClient.getQueryData<InfiniteEinsatzData>(EINSATZ_QUERY_KEYS.infinite(filters));
      if (infiniteData?.pages) {
        queryClient.setQueryData<InfiniteEinsatzData>(EINSATZ_QUERY_KEYS.infinite(filters), {
          ...infiniteData,
          pages: infiniteData.pages.map((page, index) => {
            if (index === 0) {
              return {
                ...page,
                data: [optimisticEinsatz, ...(page.data || [])],
                pagination: page.pagination ? { ...page.pagination, total: (page.pagination.total || 0) + 1 } : page.pagination,
              };
            }
            return page;
          }),
        });
      }

      return { previousEinsaetze, previousActiveWithCounts, optimisticEinsatz, optimisticListItem };
    },
    onError: async (error: ResponseError, _newEinsatz, context?: CreateMutationContext) => {
      // Rollback: Vorherigen Zustand wiederherstellen
      if (context?.previousEinsaetze) {
        queryClient.setQueryData(EINSATZ_QUERY_KEYS.list(filters), context.previousEinsaetze);
      }
      if (context?.previousActiveWithCounts) {
        queryClient.setQueryData(EINSATZ_QUERY_KEYS.activeWithCounts(), context.previousActiveWithCounts);
      }

      const message = await getApiErrorMessage(error, 'Der Einsatz konnte nicht erstellt werden.', 'createEinsatz');
      logger.error('Failed to create einsatz', error);
      toast.error('Fehler', { description: message });
    },
    onSuccess: async () => {
      toast.success('Einsatz erstellt', {
        description: 'Der Einsatz wurde erfolgreich erstellt.',
      });
    },
    onSettled: async () => {
      // Invalidierung: Server-Daten neu laden nach Success oder Error
      await queryClient.invalidateQueries({ queryKey: EINSATZ_QUERY_KEYS.all });
    },
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};
