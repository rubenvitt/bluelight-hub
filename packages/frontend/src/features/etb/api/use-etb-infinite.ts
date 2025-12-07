/**
 * ETB Infinite Query Hook (Legacy)
 *
 * Hook für ETB-Abfrage mit Infinite Scrolling Support (client-seitig simuliert).
 *
 * @deprecated Für neue Features bitte `useEtb` verwenden. Dieser Hook existiert
 * nur für Backward Compatibility mit bestehenden Komponenten.
 */

import { api } from '@/api';
import { logger } from '@/utils/logger';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ETB_QUERY_KEYS, calculateRetryDelay } from './queries';

export interface UseEtbInfiniteOptions {
  /**
   * Einsatz-ID für ETB-Abfrage
   */
  einsatzId?: string;

  /**
   * Anzahl der Einträge pro Seite (client-seitig angewendet)
   *
   * @default 20
   */
  limit?: number;

  /**
   * Feld nach dem sortiert wird (client-seitig)
   *
   * @default 'timestamp'
   */
  sortBy?: string;

  /**
   * Sortierreihenfolge
   *
   * @default 'desc' - neueste zuerst
   */
  sortOrder?: 'asc' | 'desc';

  /**
   * Gelöschte Einträge einschließen
   *
   * @default false
   */
  includeDeleted?: boolean;

  /**
   * Refetch-Intervall in Millisekunden
   */
  refetchInterval?: number;

  /**
   * Query aktivieren/deaktivieren
   *
   * @default true
   */
  enabled?: boolean;
}

/**
 * Hook für ETB-Abfrage mit Infinite Scrolling
 *
 * Nutzt die CQRS API für ETB-Abrufe. Die Paginierung wird client-seitig simuliert
 * da die CQRS API alle Einträge auf einmal zurückgibt.
 *
 * @deprecated Für neue Features bitte `useEtb` verwenden.
 *
 * @param options - Optionen für die Infinite Query
 * @returns ETB-Daten mit Infinite Scrolling Support (simuliert)
 *
 * @example
 * ```tsx
 * const { data, fetchNextPage, hasNextPage } = useEtbInfinite({
 *   einsatzId: 'abc-123',
 *   limit: 20,
 * });
 * ```
 */
export const useEtbInfinite = ({ einsatzId, limit = 20, sortBy = 'timestamp', sortOrder = 'desc', includeDeleted = false, refetchInterval, enabled = true }: UseEtbInfiniteOptions) => {
  return useInfiniteQuery({
    enabled: enabled && !!einsatzId,
    queryKey: ETB_QUERY_KEYS.infinite(einsatzId, limit, sortBy, sortOrder, includeDeleted),
    initialPageParam: 1,
    queryFn: async () => {
      if (!einsatzId) {
        throw new Error('einsatzId must be provided');
      }

      try {
        const etbData = await api.etb().etbCqrsControllerGetEtbByEinsatzIdVAlpha({
          einsatzId,
          includeDeleted,
        });

        // Return in format expected by infinite query
        return {
          data: etbData,
          pagination: {
            page: 1,
            totalPages: 1,
            total: etbData.eintraege?.length ?? 0,
          },
        };
      } catch (error) {
        logger.error('Failed to fetch ETB', error);
        throw error;
      }
    },
    getNextPageParam: () => undefined, // No pagination with CQRS API
    getPreviousPageParam: () => undefined,
    staleTime: 30000,
    retry: 3,
    retryDelay: calculateRetryDelay,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
    refetchInterval,
  });
};
