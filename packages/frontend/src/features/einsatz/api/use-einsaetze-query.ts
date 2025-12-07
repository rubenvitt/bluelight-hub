/**
 * Paginated Query Hook für Einsatz-Liste
 *
 * Standard-Query für Server-Side Pagination mit Filtern, Sorting und Suche.
 * Verwendet TanStack Query für automatisches Caching und Background-Updates.
 */

import { api } from '@/api';
import { logger } from '@/utils/logger';
import type { EinsatzControllerFindAllVAlpha200Response, ResponseError } from '@bluelight-hub/shared/client';
import { useQuery } from '@tanstack/react-query';
import { EINSATZ_QUERY_KEYS, calculateRetryDelay, type EinsatzQueryFilters } from './queries';

/**
 * Hook für paginated Einsatz-Liste
 *
 * Lädt eine paginierte Liste von Einsätzen mit optionalen Filtern,
 * Sorting und Suche. Optimiert für Server-Side Pagination.
 *
 * @param filters - Filter-Optionen (status, search, page, limit, orderBy, orderDirection)
 * @returns TanStack Query Result mit Einsatz-Daten und Pagination-Info
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useEinsaetzeQuery({
 *   status: 'AKTIV',
 *   search: 'Brand',
 *   page: 1,
 *   limit: 20,
 * });
 * ```
 */
export const useEinsaetzeQuery = (filters?: EinsatzQueryFilters) => {
  return useQuery<EinsatzControllerFindAllVAlpha200Response, ResponseError>({
    queryKey: EINSATZ_QUERY_KEYS.list(filters),
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
    staleTime: 30_000, // 30 Sekunden
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};
