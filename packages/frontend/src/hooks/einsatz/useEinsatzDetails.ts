import { api } from '@/api';
import { QUERY_KEYS } from '@/queryKeys';
import { logger } from '@/utils/logger';
import type { EinsatzDetailsDto, EinsatzDto, EtbDto, LagekarteDto, ResponseError } from '@bluelight-hub/shared/client';
import { useQuery } from '@tanstack/react-query';

/**
 * Exponential Backoff Retry-Verzögerung berechnen
 */
function calculateRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 30000);
}

export interface UseEinsatzDetailsResult {
  einsatz: EinsatzDto | undefined;
  etb: EtbDto | null | undefined;
  lagekarte: LagekarteDto | null | undefined;
  isLoading: boolean;
  error: Error | null;
  data: EinsatzDetailsDto | undefined;
}

/**
 * Hook to fetch combined Einsatz details (einsatz + etb + lagekarte)
 *
 * Reduces API calls from 3 separate requests to 1 combined request.
 * ETB and Lagekarte may be null if not yet created (lazy creation).
 *
 * @param einsatzId - ID of the Einsatz to fetch
 * @returns Combined data with separate properties for easy access
 *
 * @example
 * ```tsx
 * const { einsatz, etb, lagekarte, isLoading } = useEinsatzDetails(einsatzId);
 *
 * if (isLoading) return <LoadingState />;
 * if (!einsatz) return <ErrorState />;
 *
 * // ETB and Lagekarte may be null (lazy creation)
 * if (!etb) return <CreateEtbPrompt />;
 * ```
 */
export function useEinsatzDetails(einsatzId: string): UseEinsatzDetailsResult {
  const { data, isLoading, error } = useQuery<EinsatzDetailsDto, ResponseError>({
    queryKey: QUERY_KEYS.einsatz.detailsCombined(einsatzId),
    queryFn: async () => {
      if (!einsatzId) throw new Error('ID is required');
      try {
        return await api.einsatz().einsatzControllerGetEinsatzDetailsVAlpha({ id: einsatzId });
      } catch (err) {
        logger.error('Failed to fetch einsatz details', err);
        throw err;
      }
    },
    enabled: !!einsatzId,
    staleTime: 30_000, // 30 seconds
    retry: 3,
    retryDelay: calculateRetryDelay,
  });

  return {
    einsatz: data?.einsatz,
    etb: data?.etb,
    lagekarte: data?.lagekarte,
    isLoading,
    error: error as Error | null,
    data,
  };
}
