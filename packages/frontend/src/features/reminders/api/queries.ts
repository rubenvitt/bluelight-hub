/**
 * Erinnerungen Query Hooks
 *
 * Query Keys Factory und Query Hooks für Erinnerungen.
 *
 * **Story 1.1 AC6:** "Erinnerungen werden im Backend pro Einsatz gespeichert"
 */

import { api } from '@/shared';
import { logger } from '@/shared/lib/logger';
import type { ErinnerungResponseDto, ResponseError } from '@/shared';
import { useQuery } from '@tanstack/react-query';

/**
 * Query Keys Factory für Erinnerungen.
 *
 * Hierarchische Struktur für granulare Cache-Invalidierung.
 * Pattern: all -> lists -> list(einsatzId)
 *
 * @example
 * ```typescript
 * // Alle Erinnerungen-Caches invalidieren
 * queryClient.invalidateQueries({ queryKey: ERINNERUNG_QUERY_KEYS.all });
 *
 * // Nur Listen für spezifischen Einsatz invalidieren
 * queryClient.invalidateQueries({ queryKey: ERINNERUNG_QUERY_KEYS.list(einsatzId) });
 * ```
 */
export const ERINNERUNG_QUERY_KEYS = {
  all: ['erinnerungen'] as const,
  lists: () => [...ERINNERUNG_QUERY_KEYS.all, 'list'] as const,
  list: (einsatzId: string) => [...ERINNERUNG_QUERY_KEYS.lists(), einsatzId] as const,
  details: () => [...ERINNERUNG_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...ERINNERUNG_QUERY_KEYS.details(), id] as const,
} as const;

/**
 * Berechnet Retry-Delay mit Exponential Backoff.
 *
 * @param attemptIndex - Aktueller Retry-Versuch (0-basiert)
 * @returns Delay in Millisekunden (max 30 Sekunden)
 */
export function calculateRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 30_000);
}

export interface UseErinnerungenByEinsatzOptions {
  /**
   * Einsatz-ID für Erinnerungen-Abfrage
   */
  einsatzId?: string;
}

/**
 * Hook für Erinnerungen-Abfrage anhand der Einsatz-ID
 *
 * Ruft alle Erinnerungen für einen Einsatz ab. Behandelt 404-Fehler
 * als leere Liste (noch keine Erinnerungen vorhanden).
 *
 * @param options - Optionen für die Erinnerungen-Abfrage
 * @returns Array von Erinnerungen oder leeres Array
 *
 * @example
 * ```tsx
 * const { data: erinnerungen, isLoading } = useErinnerungenByEinsatz({
 *   einsatzId: 'abc-123'
 * });
 *
 * if (isLoading) return <Spinner />;
 * if (!erinnerungen?.length) return <EmptyState>Keine Erinnerungen</EmptyState>;
 *
 * return <ErinnerungsList erinnerungen={erinnerungen} />;
 * ```
 */
export const useErinnerungenByEinsatz = ({ einsatzId }: UseErinnerungenByEinsatzOptions) => {
  return useQuery<ErinnerungResponseDto[], ResponseError>({
    enabled: !!einsatzId,
    queryKey: ERINNERUNG_QUERY_KEYS.list(einsatzId ?? ''),
    queryFn: async () => {
      if (!einsatzId) {
        throw new Error('einsatzId must be provided');
      }

      try {
        const response = await api.erinnerungen().erinnerungControllerGetByEinsatzVAlpha({
          einsatzId,
        });
        return response.data ?? [];
      } catch (error) {
        // 404 bedeutet keine Erinnerungen vorhanden - leeres Array zurückgeben
        const statusCode = (error as { status?: number })?.status || (error as { response?: { status?: number } })?.response?.status;

        if (statusCode === 404) {
          logger.debug('Keine Erinnerungen gefunden (404) - normaler Zustand', {
            einsatzId,
          });
          return [];
        }

        logger.error('Failed to fetch Erinnerungen', error);
        throw error;
      }
    },
    staleTime: 30_000, // 30 Sekunden
    retry: (failureCount, error) => {
      // Kein Retry bei 404
      const statusCode = (error as { status?: number })?.status || (error as { response?: { status?: number } })?.response?.status;
      if (statusCode === 404) return false;
      return failureCount < 3;
    },
    retryDelay: calculateRetryDelay,
  });
};
