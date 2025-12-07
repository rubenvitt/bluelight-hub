/**
 * Textbausteine Query Hook
 *
 * Hook für Textbausteine-Abfrage (vordefinierte Textblöcke für ETB-Einträge).
 */

import { api } from '@/api';
import { logger } from '@/utils/logger';
import type { ResponseError, TextbausteinListResponse } from '@bluelight-hub/shared/client';
import { useQuery } from '@tanstack/react-query';
import { ETB_QUERY_KEYS, calculateRetryDelay } from './queries';

/**
 * Hook für Textbausteine-Abfrage
 *
 * Ruft alle verfügbaren Textbausteine ab. Textbausteine sind vordefinierte
 * Textblöcke die in ETB-Einträgen verwendet werden können.
 *
 * @returns Textbausteine-Daten mit Ladezustand und Fehler
 *
 * @example
 * ```tsx
 * const { data: textbausteine, isLoading } = useTextbausteine();
 *
 * if (isLoading) return <Spinner />;
 *
 * return (
 *   <TextbausteinPicker
 *     textbausteine={textbausteine?.data ?? []}
 *     onSelect={handleSelect}
 *   />
 * );
 * ```
 */
export const useTextbausteine = () => {
  return useQuery<TextbausteinListResponse, ResponseError>({
    queryKey: ETB_QUERY_KEYS.textbausteine(),
    queryFn: async () => {
      try {
        return await api.etb().etbCqrsControllerGetTextbausteineVAlpha({});
      } catch (error) {
        logger.error('Failed to fetch Textbausteine', error);
        throw error;
      }
    },
    staleTime: 60000, // Textbausteine ändern sich selten, längere stale time
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};
