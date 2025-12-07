/**
 * Infinite Scroll Query Hook für Einsatz-Liste
 *
 * Optimiert für Infinite Scrolling mit automatischem Page Management.
 * Nutzt TanStack Query's useInfiniteQuery für nahtloses Nachladen.
 */

import { api } from '@/api';
import { getApiErrorMessage } from '@/utils/apiErrorHandler';
import { logger } from '@/utils/logger';
import type { EinsatzControllerFindAllVAlpha200Response, ResponseError } from '@bluelight-hub/shared/client';
import { useInfiniteQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { EINSATZ_QUERY_KEYS, calculateRetryDelay, type EinsatzQueryFilters } from './queries';

/**
 * Hook für Infinite Scroll Einsatz-Liste
 *
 * Lädt Einsätze in Seiten für Infinite Scrolling Pattern.
 * Automatisches Management von Page-Parametern und hasNextPage Detection.
 *
 * @param filters - Filter-Optionen (status, search, limit, orderBy, orderDirection)
 * @returns TanStack InfiniteQuery Result mit Pages-Array und fetchNextPage
 *
 * @example
 * ```tsx
 * const { data, fetchNextPage, hasNextPage } = useEinsaetzeInfiniteQuery({
 *   status: 'AKTIV',
 *   limit: 20,
 * });
 *
 * // Flatten all pages
 * const allEinsaetze = data?.pages.flatMap(page => page.data || []) || [];
 * ```
 */
export const useEinsaetzeInfiniteQuery = (filters?: EinsatzQueryFilters) => {
  const limit = filters?.limit || 20;

  return useInfiniteQuery<EinsatzControllerFindAllVAlpha200Response, ResponseError>({
    queryKey: EINSATZ_QUERY_KEYS.infinite(filters),
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
    staleTime: 30_000, // 30 Sekunden
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};
