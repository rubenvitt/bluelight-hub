import { api } from '@/api';
import { QUERY_KEYS } from '@/queryKeys';
import { useEinsatzStore } from '@/stores/einsatzStore';
import { getApiErrorMessage } from '@/utils/apiErrorHandler';
import { logger } from '@/utils/logger';
import type {
  CreateEinsatzDto,
  EinsatzControllerCreateVAlpha200Response,
  EinsatzControllerFindAllVAlpha200Response,
  EinsatzControllerFindAllVAlphaStatusEnum,
  EinsatzDetailsDto,
  EinsatzListItemDto,
  EinsatzResponseDto,
  ResponseError,
  UpdateEinsatzDto,
} from '@bluelight-hub/shared/client';
import { type EinsatzControllerFindAllVAlphaOrderByEnum, type EinsatzControllerFindAllVAlphaOrderDirectionEnum, EinsatzResponseDtoStatusEnum } from '@bluelight-hub/shared/client';
import { type InfiniteData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';

// Type for infinite query data structure
type InfiniteEinsatzData = InfiniteData<EinsatzControllerFindAllVAlpha200Response>;

// Type for mutation context
interface MutationContext {
  previousEinsatz?: EinsatzControllerCreateVAlpha200Response;
  previousEinsaetze?: EinsatzControllerFindAllVAlpha200Response;
  optimisticEinsatz?: EinsatzResponseDto;
}

/**
 * Exponential Backoff Retry-Verzögerung berechnen
 */
function calculateRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 30000);
}

interface UseEinsaetzeFilters {
  status?: EinsatzControllerFindAllVAlphaStatusEnum;
  search?: string;
  page?: number;
  limit?: number;
  orderBy?: EinsatzControllerFindAllVAlphaOrderByEnum;
  orderDirection?: EinsatzControllerFindAllVAlphaOrderDirectionEnum;
}

interface UseEinsaetzeOptions extends UseEinsaetzeFilters {
  infinite?: boolean;
}

/**
 * Hook für Einsatz-API-Operationen
 *
 * Stellt alle API-Funktionen für Einsatz-Verwaltung bereit:
 * - Laden der Einsatzliste (paginiert oder infinite scroll)
 * - Erstellen neuer Einsätze
 * - Aktualisieren von Einsätzen
 * - Löschen von Einsätzen
 *
 * @param options - Optionen mit Filtern und infinite scroll toggle
 * @returns Objekt mit Einsatzdaten, Ladezuständen und API-Aktionen
 */
export const useEinsaetze = (options?: UseEinsaetzeOptions) => {
  const queryClient = useQueryClient();
  const { infinite = false, ...filters } = options || {};
  const limit = filters?.limit || 20;

  // Standard Query für paginierte Liste
  const standardQuery = useQuery<EinsatzControllerFindAllVAlpha200Response, ResponseError>({
    enabled: !infinite,
    queryKey: QUERY_KEYS.einsatz.list(filters),
    queryFn: async () => {
      try {
        return await api.einsatz().einsatzControllerFindAllVAlpha({
          limit: filters?.limit,
          page: filters?.page,
          search: filters?.search,
          status: filters?.status,
          orderBy: filters?.orderBy,
          orderDirection: filters?.orderDirection,
        });
      } catch (error) {
        logger.error('Failed to fetch einsaetze', error);
        throw error;
      }
    },
    staleTime: 30000,
    retry: 3,
    retryDelay: calculateRetryDelay,
  });

  // Infinite Query für Infinite Scrolling
  const infiniteQuery = useInfiniteQuery<EinsatzControllerFindAllVAlpha200Response, ResponseError>({
    enabled: infinite,
    queryKey: QUERY_KEYS.einsatz.infinite(filters),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      try {
        const response = await api.einsatz().einsatzControllerFindAllVAlpha({
          limit,
          page: pageParam as number,
          search: filters?.search,
          status: filters?.status,
          orderBy: filters?.orderBy,
          orderDirection: filters?.orderDirection,
        });

        logger.debug(`Fetched page ${pageParam} with ${response.data?.length || 0} items`);
        return response;
      } catch (error) {
        const message = await getApiErrorMessage(error as ResponseError, 'Fehler beim Laden der Einsätze');
        logger.error('Failed to fetch einsaetze', error);
        toast.error('Fehler', { description: message });
        throw error;
      }
    },
    getNextPageParam: (lastPage) => {
      const currentPage = lastPage.pagination?.page || 1;
      const totalPages = Math.ceil((lastPage.pagination?.total || 0) / limit);

      if (currentPage < totalPages) {
        return currentPage + 1;
      }
      return undefined;
    },
    staleTime: 30000,
    retry: 3,
    retryDelay: calculateRetryDelay,
  });

  // Mutation für Einsatz erstellen mit Optimistic Updates
  const createEinsatzMutation = useMutation<EinsatzResponseDto, ResponseError, CreateEinsatzDto>({
    mutationFn: async (data: CreateEinsatzDto) => {
      const response = await api.einsatz().einsatzControllerCreateVAlpha({
        createEinsatzDto: data,
      });
      return response.data;
    },
    onMutate: async (newEinsatz) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.einsatz.all });

      const previousEinsaetze = queryClient.getQueryData<EinsatzControllerFindAllVAlpha200Response>(QUERY_KEYS.einsatz.list(filters));

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

      queryClient.setQueryData<EinsatzControllerFindAllVAlpha200Response>(QUERY_KEYS.einsatz.list(filters), (old) => {
        if (!old) return old;
        return {
          ...old,
          data: [optimisticEinsatz, ...(old.data || [])],
          pagination: old.pagination ? { ...old.pagination, total: (old.pagination.total || 0) + 1 } : old.pagination,
        };
      });

      // Also update infinite query cache if it exists
      const infiniteData = queryClient.getQueryData<InfiniteEinsatzData>(QUERY_KEYS.einsatz.infinite(filters));
      if (infiniteData?.pages) {
        queryClient.setQueryData<InfiniteEinsatzData>(QUERY_KEYS.einsatz.infinite(filters), {
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

      return { previousEinsaetze, optimisticEinsatz };
    },
    onError: async (error: ResponseError, _newEinsatz, context?: MutationContext) => {
      if (context?.previousEinsaetze) {
        queryClient.setQueryData(QUERY_KEYS.einsatz.list(filters), context.previousEinsaetze);
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
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.einsatz.all });
    },
    retry: 3,
    retryDelay: calculateRetryDelay,
  });

  // Mutation für Einsatz archivieren mit Optimistic Updates
  const archiveEinsatzMutation = useMutation<EinsatzResponseDto, ResponseError, { id: string }>({
    mutationFn: async ({ id }) => {
      const response = await api.einsatz().einsatzControllerArchiveVAlpha({ id });
      return response.data;
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.einsatz.detail(id) });
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.einsatz.all });

      const previousEinsatz = queryClient.getQueryData<EinsatzControllerCreateVAlpha200Response>(QUERY_KEYS.einsatz.detail(id));
      const previousEinsaetze = queryClient.getQueryData<EinsatzControllerFindAllVAlpha200Response>(QUERY_KEYS.einsatz.list(filters));

      if (previousEinsatz?.data) {
        const archivedEinsatz: EinsatzResponseDto = {
          ...previousEinsatz.data,
          status: EinsatzResponseDtoStatusEnum.Archiviert,
          updatedAt: new Date(),
        };

        queryClient.setQueryData<EinsatzControllerCreateVAlpha200Response>(QUERY_KEYS.einsatz.detail(id), {
          data: archivedEinsatz,
          meta: previousEinsatz.meta || {},
        });

        queryClient.setQueryData<EinsatzControllerFindAllVAlpha200Response>(QUERY_KEYS.einsatz.list(filters), (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data?.map((e) => (e.id === id ? archivedEinsatz : e)) || [],
          };
        });

        // Also update infinite query cache if it exists
        const infiniteData = queryClient.getQueryData<InfiniteEinsatzData>(QUERY_KEYS.einsatz.infinite(filters));
        if (infiniteData?.pages) {
          queryClient.setQueryData<InfiniteEinsatzData>(QUERY_KEYS.einsatz.infinite(filters), {
            ...infiniteData,
            pages: infiniteData.pages.map((page) => ({
              ...page,
              data: page.data?.map((e) => (e.id === id ? archivedEinsatz : e)) || [],
            })),
          });
        }
      }

      return { previousEinsatz, previousEinsaetze };
    },
    onError: async (error: ResponseError, { id }, context?: MutationContext) => {
      if (context?.previousEinsatz) {
        queryClient.setQueryData(QUERY_KEYS.einsatz.detail(id), context.previousEinsatz);
      }
      if (context?.previousEinsaetze) {
        queryClient.setQueryData(QUERY_KEYS.einsatz.list(filters), context.previousEinsaetze);
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
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.einsatz.detail(id) });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.einsatz.all });
    },
    retry: 3,
    retryDelay: calculateRetryDelay,
  });

  // Mutation für Einsatz aktualisieren mit Optimistic Updates
  const updateEinsatzMutation = useMutation<EinsatzResponseDto, ResponseError, { id: string; data: UpdateEinsatzDto }>({
    mutationFn: async ({ id, data }) => {
      const response = await api.einsatz().einsatzControllerUpdateVAlpha({
        id,
        updateEinsatzDto: data,
      });
      return response.data;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.einsatz.detail(id) });
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.einsatz.all });

      const previousEinsatz = queryClient.getQueryData<EinsatzControllerCreateVAlpha200Response>(QUERY_KEYS.einsatz.detail(id));
      const previousEinsaetze = queryClient.getQueryData<EinsatzControllerFindAllVAlpha200Response>(QUERY_KEYS.einsatz.list(filters));

      if (previousEinsatz?.data) {
        const updatedEinsatz: EinsatzResponseDto = {
          ...previousEinsatz.data,
          ...data,
          completeness: previousEinsatz.data.completeness,
          updatedAt: new Date(),
        };

        queryClient.setQueryData<EinsatzControllerCreateVAlpha200Response>(QUERY_KEYS.einsatz.detail(id), {
          data: updatedEinsatz,
          meta: previousEinsatz.meta || {},
        });

        queryClient.setQueryData<EinsatzControllerFindAllVAlpha200Response>(QUERY_KEYS.einsatz.list(filters), (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data?.map((e) => (e.id === id ? updatedEinsatz : e)) || [],
          };
        });

        // Also update infinite query cache if it exists
        const infiniteData = queryClient.getQueryData<InfiniteEinsatzData>(QUERY_KEYS.einsatz.infinite(filters));
        if (infiniteData?.pages) {
          queryClient.setQueryData<InfiniteEinsatzData>(QUERY_KEYS.einsatz.infinite(filters), {
            ...infiniteData,
            pages: infiniteData.pages.map((page) => ({
              ...page,
              data: page.data?.map((e) => (e.id === id ? updatedEinsatz : e)) || [],
            })),
          });
        }
      }

      return { previousEinsatz, previousEinsaetze };
    },
    onError: async (error: ResponseError, { id }, context?: MutationContext) => {
      if (context?.previousEinsatz) {
        queryClient.setQueryData(QUERY_KEYS.einsatz.detail(id), context.previousEinsatz);
      }
      if (context?.previousEinsaetze) {
        queryClient.setQueryData(QUERY_KEYS.einsatz.list(filters), context.previousEinsaetze);
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
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.einsatz.detail(id) });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.einsatz.all });
    },
    retry: 3,
    retryDelay: calculateRetryDelay,
  });

  // Daten je nach Modus aufbereiten
  const allEinsaetze = infinite ? infiniteQuery.data?.pages.flatMap((page) => page.data || []) || [] : standardQuery.data?.data || [];

  const total = infinite ? infiniteQuery.data?.pages[0]?.pagination?.total || 0 : standardQuery.data?.pagination?.total || 0;

  return {
    // Einsatzdaten
    einsaetze: allEinsaetze,
    total,
    pagination: infinite ? undefined : standardQuery.data?.pagination,

    // Lade-Zustände
    isLoading: infinite ? infiniteQuery.isLoading : standardQuery.isLoading,
    error: infinite ? infiniteQuery.error : standardQuery.error,

    // Infinite Scrolling (nur wenn aktiviert)
    ...(infinite && {
      isFetchingNextPage: infiniteQuery.isFetchingNextPage,
      hasNextPage: infiniteQuery.hasNextPage,
      fetchNextPage: infiniteQuery.fetchNextPage,
    }),

    // Gemeinsame Aktionen
    refetch: infinite ? infiniteQuery.refetch : standardQuery.refetch,
    createEinsatz: createEinsatzMutation,
    updateEinsatz: updateEinsatzMutation,
    archiveEinsatz: archiveEinsatzMutation,
  };
};

/**
 * Hook for dashboard list with ETB/POI counts.
 * Uses the optimized combined endpoint for better performance.
 *
 * This hook fetches all active (non-archived) Einsätze with aggregated counts
 * for ETB entries and POIs, optimized for dashboard display.
 *
 * @returns Query result with EinsatzListItemDto[] containing counts
 */
export const useActiveEinsaetzeWithCounts = () => {
  return useQuery<EinsatzListItemDto[], ResponseError>({
    queryKey: [...QUERY_KEYS.einsatz.all, 'activeWithCounts'] as const,
    queryFn: async () => {
      try {
        return await api.einsatz().einsatzControllerGetActiveEinsaetzeWithCountsVAlpha();
      } catch (error) {
        logger.error('Failed to fetch active einsaetze with counts', error);
        throw error;
      }
    },
    staleTime: 30_000, // 30 seconds
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};

/**
 * Hook for combined Einsatz details (Einsatz + ETB + Lagekarte).
 * Reduces API calls from 3 to 1 for the detail view.
 *
 * This hook fetches all relevant data for an Einsatz detail page in a single request,
 * significantly improving performance and reducing network overhead.
 *
 * @param id - The Einsatz ID to fetch details for (null to disable query)
 * @returns Query result with destructured einsatz, etb, and lagekarte data
 */
export const useEinsatzDetails = (id: string | null) => {
  const query = useQuery<EinsatzDetailsDto, ResponseError>({
    queryKey: QUERY_KEYS.einsatz.detailsCombined(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('ID is required');
      try {
        return await api.einsatz().einsatzControllerGetEinsatzDetailsVAlpha({ id });
      } catch (error) {
        logger.error('Failed to fetch einsatz details', error);
        throw error;
      }
    },
    enabled: !!id,
    staleTime: 30_000, // 30 seconds
    retry: 3,
    retryDelay: calculateRetryDelay,
  });

  return {
    ...query,
    einsatz: query.data?.einsatz ?? null,
    etb: query.data?.etb ?? null,
    lagekarte: query.data?.lagekarte ?? null,
  };
};

/**
 * Hook für einzelnen Einsatz mit Store-Integration
 */
export const useEinsatz = (id: string | null) => {
  const queryClient = useQueryClient();
  const { selectedEinsatzId, setSelectedEinsatzId } = useEinsatzStore();

  const einsatz = useQuery<EinsatzControllerCreateVAlpha200Response, ResponseError>({
    enabled: !!id,
    queryKey: QUERY_KEYS.einsatz.detail(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('ID is required');
      return await api.einsatz().einsatzControllerFindOneVAlpha({ id });
    },
    staleTime: 30000,
    retry: 3,
    retryDelay: calculateRetryDelay,
  });

  // Sync mit einsatzStore wenn sich selectedEinsatzId ändert
  useEffect(() => {
    if (id && id !== selectedEinsatzId) {
      setSelectedEinsatzId(id);
    }
  }, [id, selectedEinsatzId, setSelectedEinsatzId]);

  const updateEinsatzMutation = useMutation<EinsatzResponseDto, ResponseError, { data: UpdateEinsatzDto }>({
    mutationFn: async ({ data }) => {
      if (!id) {
        throw new Error('ID is required');
      }
      const response = await api.einsatz().einsatzControllerUpdateVAlpha({
        id,
        updateEinsatzDto: data,
      });
      return response.data;
    },
    onMutate: async ({ data }) => {
      if (!id) return;

      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.einsatz.detail(id) });
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.einsatz.all });

      const previousEinsatz = queryClient.getQueryData<EinsatzControllerCreateVAlpha200Response>(QUERY_KEYS.einsatz.detail(id));

      if (previousEinsatz?.data) {
        const updatedEinsatz: EinsatzResponseDto = {
          ...previousEinsatz.data,
          ...data,
          completeness: previousEinsatz.data.completeness,
          updatedAt: new Date(),
        };

        // Update detail cache
        queryClient.setQueryData<EinsatzControllerCreateVAlpha200Response>(QUERY_KEYS.einsatz.detail(id), {
          data: updatedEinsatz,
          meta: previousEinsatz.meta || {},
        });

        // Update all existing list caches
        const queryCache = queryClient.getQueryCache();
        queryCache.getAll().forEach((query) => {
          const queryKey = query.queryKey;
          // Check if this is an einsatz list query
          if (Array.isArray(queryKey) && queryKey[0] === 'einsatz' && queryKey[1] === 'list') {
            queryClient.setQueryData<EinsatzControllerFindAllVAlpha200Response>(queryKey, (old) => {
              if (!old) return old;
              return {
                ...old,
                data: old.data?.map((e) => (e.id === id ? updatedEinsatz : e)) || [],
              };
            });
          }
          // Check if this is an infinite query
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
        });
      }

      return { previousEinsatz };
    },
    onError: async (error: ResponseError, _, context?: MutationContext) => {
      if (context?.previousEinsatz && id) {
        queryClient.setQueryData(QUERY_KEYS.einsatz.detail(id), context.previousEinsatz);
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
    onSettled: async () => {
      if (!id) return;
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.einsatz.detail(id) });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.einsatz.all });
    },
    retry: 3,
    retryDelay: calculateRetryDelay,
  });

  const completeness = einsatz.data?.data?.completeness;

  return {
    isLoading: einsatz.isLoading,
    error: einsatz.error,
    einsatz: einsatz.data?.data,
    completeness,
    updateEinsatz: updateEinsatzMutation,
    refetch: einsatz.refetch,
  };
};
