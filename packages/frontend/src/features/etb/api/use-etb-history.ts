/**
 * ETB History Query Hook
 *
 * Hook für ETB-Versionshistorie (Snapshots).
 */

import { getBaseUrl } from '@/api/api';
import { fetchWithRefresh } from '@/api/fetchWithRefresh';
import { logger } from '@/utils/logger';
import type { EtbSnapshotDto, ResponseError } from '@bluelight-hub/shared/client';
import { useQuery } from '@tanstack/react-query';
import { ETB_QUERY_KEYS, calculateRetryDelay } from './queries';

export interface UseEtbHistoryOptions {
  /**
   * ETB-ID für Versionshistorie
   */
  etbId?: string;
}

/**
 * Hook für ETB-Versionshistorie (Snapshots)
 *
 * Ruft alle Snapshots eines ETB ab, sortiert nach Version absteigend.
 * Snapshots werden bei jedem Speichern des ETB automatisch erstellt.
 *
 * @param options - Optionen für die Versionshistorie-Abfrage
 * @returns EtbSnapshotDto[] sortiert nach Version absteigend
 *
 * @example
 * ```tsx
 * const { data: snapshots, isLoading } = useEtbHistory({ etbId: 'etb-123' });
 *
 * if (isLoading) return <Spinner />;
 * if (!snapshots?.length) return <EmptyState>Keine Historie</EmptyState>;
 *
 * return <HistoryTimeline snapshots={snapshots} />;
 * ```
 */
export const useEtbHistory = ({ etbId }: UseEtbHistoryOptions) => {
  return useQuery<EtbSnapshotDto[], ResponseError>({
    enabled: !!etbId,
    queryKey: ETB_QUERY_KEYS.history(etbId || ''),
    queryFn: async () => {
      if (!etbId) {
        throw new Error('etbId must be provided');
      }

      try {
        const response = await fetchWithRefresh(`${getBaseUrl()}/api/v-alpha/etb/${etbId}/history`, {
          method: 'GET',
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch ETB history (${response.status})`);
        }

        const json = await response.json();
        const snapshots = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];

        return (snapshots as Array<{ snapshotAt: string | Date }>).map((snapshot) => ({
          ...snapshot,
          snapshotAt: snapshot.snapshotAt instanceof Date ? snapshot.snapshotAt : new Date(snapshot.snapshotAt),
        })) as EtbSnapshotDto[];
      } catch (error) {
        logger.error('Failed to fetch ETB history', error);
        throw error;
      }
    },
    staleTime: 60000, // History ändert sich selten, längere stale time
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};
