/**
 * Detail Query Hook für einzelnen Einsatz
 *
 * Lädt vollständige Einsatz-Details mit Store-Integration.
 * Automatische Sync mit globalem Einsatz-Store für selectedEinsatzId.
 */

import { api } from '@/api';
import { useEinsatzStore } from '@/stores/einsatzStore';
import type { EinsatzControllerCreateVAlpha200Response, ResponseError } from '@bluelight-hub/shared/client';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { EINSATZ_QUERY_KEYS, calculateRetryDelay } from './queries';

/**
 * Hook für einzelnen Einsatz mit Store-Integration
 *
 * Lädt vollständige Einsatz-Details und synchronisiert automatisch
 * mit dem globalen Einsatz-Store (selectedEinsatzId).
 *
 * @param id - Einsatz-ID (null = disabled Query)
 * @returns TanStack Query Result mit Einsatz-Details und Completeness
 *
 * @example
 * ```tsx
 * const { einsatz, completeness, isLoading } = useEinsatzDetail(id);
 *
 * if (isLoading) return <Spinner />;
 * if (!einsatz) return <NotFound />;
 *
 * return <EinsatzDetails data={einsatz} />;
 * ```
 */
export const useEinsatzDetail = (id: string | null) => {
  const { selectedEinsatzId, setSelectedEinsatzId } = useEinsatzStore();

  const query = useQuery<EinsatzControllerCreateVAlpha200Response, ResponseError>({
    enabled: !!id,
    queryKey: EINSATZ_QUERY_KEYS.detail(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('ID is required');
      return await api.einsatz().einsatzControllerFindOneVAlpha({ id });
    },
    staleTime: 30_000, // 30 Sekunden
    retry: 3,
    retryDelay: calculateRetryDelay,
  });

  // Sync mit einsatzStore wenn sich selectedEinsatzId ändert
  useEffect(() => {
    if (id && id !== selectedEinsatzId) {
      setSelectedEinsatzId(id);
    }
  }, [id, selectedEinsatzId, setSelectedEinsatzId]);

  const completeness = query.data?.data?.completeness;

  return {
    isLoading: query.isLoading,
    error: query.error,
    einsatz: query.data?.data,
    completeness,
    refetch: query.refetch,
  };
};
