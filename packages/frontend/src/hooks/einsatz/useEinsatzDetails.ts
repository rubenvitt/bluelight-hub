import { api } from '@/api';
import { QUERY_KEYS } from '@/queryKeys';
import type { EinsatzDetailsDto, EinsatzDto, EtbDto, LagekarteDto } from '@bluelight-hub/shared/client';
import { useQuery } from '@tanstack/react-query';

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
  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.einsatz.detailsCombined(einsatzId),
    queryFn: () => api.einsatz().einsatzControllerGetEinsatzDetailsVAlpha({ id: einsatzId }),
    enabled: !!einsatzId,
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
