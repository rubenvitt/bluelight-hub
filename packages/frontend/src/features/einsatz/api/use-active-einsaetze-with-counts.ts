/**
 * Dashboard Query Hook für aktive Einsätze mit ETB/POI-Counts
 *
 * Optimierter Query für Dashboard-Anzeige mit aggregierten Zählern.
 * Nutzt Backend-Endpoint der direkt EinsatzListItemDto[] mit Counts liefert.
 */

import { api } from '@/api';
import { logger } from '@/utils/logger';
import type { EinsatzListItemDto, ResponseError } from '@bluelight-hub/shared/client';
import { useQuery } from '@tanstack/react-query';
import { EINSATZ_QUERY_KEYS, calculateRetryDelay } from './queries';

/**
 * Hook für Dashboard-Liste mit ETB/POI-Counts
 *
 * Lädt alle aktiven (nicht archivierten) Einsätze mit aggregierten
 * Zählern für ETB-Einträge und POIs. Optimiert für Dashboard-Anzeige.
 *
 * Dieser Hook nutzt den optimierten kombinierten Backend-Endpoint
 * für bessere Performance (eine Query statt mehreren).
 *
 * @returns TanStack Query Result mit EinsatzListItemDto[] inkl. Counts
 *
 * @example
 * ```tsx
 * const { data: einsaetze, isLoading } = useActiveEinsaetzeWithCounts();
 *
 * return (
 *   <DashboardList>
 *     {einsaetze?.map(e => (
 *       <EinsatzCard
 *         key={e.id}
 *         einsatz={e}
 *         etbCount={e.etbEintraegeCount}
 *         poiCount={e.poisCount}
 *       />
 *     ))}
 *   </DashboardList>
 * );
 * ```
 */
export const useActiveEinsaetzeWithCounts = () => {
  return useQuery<EinsatzListItemDto[], ResponseError>({
    queryKey: EINSATZ_QUERY_KEYS.activeWithCounts(),
    queryFn: async () => {
      try {
        // Backend liefert direkt EinsatzListItemDto[] (mit @SkipTransform)
        return await api.einsatz().einsatzControllerGetActiveEinsaetzeWithCountsVAlpha();
      } catch (error) {
        logger.error('Failed to fetch active einsaetze with counts', error);
        throw error;
      }
    },
    staleTime: 30_000, // 30 Sekunden
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};
