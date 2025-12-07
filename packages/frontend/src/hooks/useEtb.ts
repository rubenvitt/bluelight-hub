import { api } from '@/api';
import { getBaseUrl } from '@/api/api';
import { fetchWithRefresh } from '@/api/fetchWithRefresh';
import { QUERY_KEYS } from '@/queryKeys';
import { getApiErrorMessage } from '@/utils/apiErrorHandler';
import { logger } from '@/utils/logger';
import type { AddEintragDto, EintragDto, EtbDto, EtbSnapshotDto, ResponseError, TextbausteinListResponse, UpdateEintragDto } from '@bluelight-hub/shared/client';
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Exponential Backoff Retry-Verzoegerung berechnen
 */
function calculateRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 30000);
}

// ============================================
// CQRS Hooks (neue API)
// ============================================

/**
 * Hook fuer ETB-Abfrage anhand der Einsatz-ID (CQRS API)
 *
 * @param einsatzId - Die ID des Einsatzes
 * @param includeDeleted - Geloeschte Eintraege einschliessen (Standard: false)
 * @returns ETB-Daten mit status, version, eintraege oder undefined wenn ETB nicht existiert (404)
 */
export const useEtb = (einsatzId?: string, includeDeleted?: boolean) => {
  return useQuery<EtbDto | undefined, ResponseError>({
    enabled: !!einsatzId,
    queryKey: QUERY_KEYS.etb.byEinsatz(einsatzId, includeDeleted),
    queryFn: async () => {
      if (!einsatzId) {
        throw new Error('einsatzId must be provided');
      }
      try {
        return await api.etb().etbCqrsControllerGetEtbByEinsatzIdVAlpha({
          einsatzId,
          includeDeleted,
        });
      } catch (error) {
        // 404 ist kein Fehler - ETB existiert einfach noch nicht
        // Kein Toast, kein Error - return undefined
        const statusCode = (error as { status?: number })?.status || (error as { response?: { status?: number } })?.response?.status;

        if (statusCode === 404) {
          logger.debug('ETB nicht gefunden (404) - normaler Zustand', { einsatzId });
          return undefined as unknown as EtbDto; // Return undefined statt Error
        }

        logger.error('Failed to fetch ETB via CQRS API', error);
        throw error;
      }
    },
    staleTime: 30000,
    retry: (failureCount, error) => {
      // Kein Retry bei 404
      const statusCode = (error as { status?: number })?.status || (error as { response?: { status?: number } })?.response?.status;
      if (statusCode === 404) return false;
      return failureCount < 3;
    },
    retryDelay: calculateRetryDelay,
  });
};

/**
 * Hook fuer ETB-Versionshistorie (Snapshots)
 *
 * @param etbId - Die ID des ETB
 * @returns EtbSnapshotDto[] sortiert nach Version absteigend
 */
export const useEtbHistory = (etbId?: string) => {
  return useQuery<EtbSnapshotDto[], ResponseError>({
    enabled: !!etbId,
    queryKey: QUERY_KEYS.etb.history(etbId || ''),
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
    staleTime: 60000, // History aendert sich selten, laengere stale time
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};

/**
 * Hook fuer ETB-Eintrag-Erstellung (CQRS API)
 *
 * @returns Mutation fuer ETB-Eintrag-Erstellung
 */
export const useCreateEtbEintrag = () => {
  const queryClient = useQueryClient();

  return useMutation<EintragDto, ResponseError, { etbId: string; data: AddEintragDto }>({
    mutationFn: async ({ etbId, data }) => {
      return await api.etb().etbCqrsControllerAddEintragVAlpha({
        etbId,
        addEintragDto: data,
      });
    },
    onMutate: async ({ etbId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.etb.all,
      });

      return { etbId };
    },
    onError: async (error: ResponseError) => {
      const message = await getApiErrorMessage(error, 'Der ETB-Eintrag konnte nicht erstellt werden.', 'createEtbEintrag');
      logger.error('Failed to create ETB entry', error);
      toast.error('Fehler', { description: message });
    },
    onSuccess: () => {
      toast.success('Eintrag hinzugefuegt', {
        description: 'Der ETB-Eintrag wurde erfolgreich erstellt.',
      });
    },
    onSettled: async () => {
      // Invalidate all ETB queries to ensure consistency
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.etb.all });
    },
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};

/**
 * Hook fuer ETB-Eintrag-Aktualisierung (CQRS API)
 *
 * @returns Mutation fuer ETB-Eintrag-Aktualisierung
 */
export const useUpdateEtbEintrag = () => {
  const queryClient = useQueryClient();

  return useMutation<EintragDto, ResponseError, { etbId: string; eintragId: string; data: UpdateEintragDto }>({
    mutationFn: async ({ etbId, eintragId, data }) => {
      return await api.etb().etbCqrsControllerUpdateEintragVAlpha({
        etbId,
        eintragId,
        updateEintragDto: data,
      });
    },
    onMutate: async ({ etbId, eintragId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.etb.all,
      });

      return { etbId, eintragId };
    },
    onError: async (error: ResponseError) => {
      const message = await getApiErrorMessage(error, 'Der ETB-Eintrag konnte nicht aktualisiert werden.', 'updateEtbEintrag');
      logger.error('Failed to update ETB entry', error);
      toast.error('Fehler', { description: message });
    },
    onSuccess: () => {
      toast.success('Eintrag aktualisiert', {
        description: 'Der ETB-Eintrag wurde erfolgreich aktualisiert.',
      });
    },
    onSettled: async () => {
      // Invalidate all ETB queries to ensure consistency
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.etb.all });
    },
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};

/**
 * Hook fuer ETB-Eintrag-Loeschung (Soft Delete, CQRS API)
 *
 * @returns Mutation fuer ETB-Eintrag-Loeschung
 */
export const useDeleteEtbEintrag = () => {
  const queryClient = useQueryClient();

  return useMutation<void, ResponseError, { etbId: string; eintragId: string }>({
    mutationFn: async ({ etbId, eintragId }) => {
      await api.etb().etbCqrsControllerDeleteEintragVAlpha({
        etbId,
        eintragId,
      });
    },
    onMutate: async ({ etbId, eintragId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.etb.all,
      });

      return { etbId, eintragId };
    },
    onError: async (error: ResponseError) => {
      const message = await getApiErrorMessage(error, 'Der ETB-Eintrag konnte nicht geloescht werden.', 'deleteEtbEintrag');
      logger.error('Failed to delete ETB entry', error);
      toast.error('Fehler', { description: message });
    },
    onSuccess: () => {
      toast.success('Eintrag geloescht', {
        description: 'Der ETB-Eintrag wurde erfolgreich geloescht.',
      });
    },
    onSettled: async () => {
      // Invalidate all ETB queries to ensure consistency
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.etb.all });
    },
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};

/**
 * Hook fuer ETB-Sperrung (nur Admin, CQRS API)
 *
 * @returns Mutation fuer ETB-Sperrung
 */
export const useLockEtb = () => {
  const queryClient = useQueryClient();

  return useMutation<void, ResponseError, { etbId: string }>({
    mutationFn: async ({ etbId }) => {
      await api.etb().etbCqrsControllerLockEtbVAlpha({ etbId });
    },
    onMutate: async ({ etbId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.etb.all,
      });

      return { etbId };
    },
    onError: async (error: ResponseError) => {
      const message = await getApiErrorMessage(error, 'Das ETB konnte nicht gesperrt werden.', 'lockEtb');
      logger.error('Failed to lock ETB', error);
      toast.error('Fehler', { description: message });
    },
    onSuccess: () => {
      toast.success('ETB gesperrt', {
        description: 'Das Einsatztagebuch wurde erfolgreich gesperrt.',
      });
    },
    onSettled: async () => {
      // Invalidate all ETB queries to ensure consistency
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.etb.all });
    },
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};

// ============================================
// Legacy Hooks (Backward Compatibility)
// ============================================

/**
 * Hook fuer ETB-Abfrage mit Infinite Scrolling
 *
 * Nutzt die CQRS API fuer ETB-Abrufe. Die Paginierung wird client-seitig simuliert
 * da die CQRS API alle Eintraege auf einmal zurueckgibt.
 *
 * @param einsatzId - Die ID des Einsatzes
 * @param limit - Anzahl der Eintraege pro Seite (Standard: 20) - wird client-seitig angewendet
 * @param sortBy - Feld nach dem sortiert wird (Standard: 'timestamp') - client-seitig
 * @param sortOrder - Sortierreihenfolge (Standard: 'desc' = neueste zuerst)
 * @param includeDeleted - Geloeschte Eintraege einschliessen (Standard: false)
 * @param options - Zusaetzliche TanStack Query Optionen (z.B. refetchInterval)
 * @returns ETB-Daten mit Infinite Scrolling Support (simuliert)
 */
export const useEtbInfinite = (
  einsatzId?: string,
  _limit: number = 20,
  _sortBy: string = 'timestamp',
  _sortOrder: 'asc' | 'desc' = 'desc',
  includeDeleted: boolean = false,
  options?: { refetchInterval?: number; enabled?: boolean },
) => {
  return useInfiniteQuery({
    enabled: options?.enabled !== false && !!einsatzId,
    queryKey: QUERY_KEYS.etb.infinite(einsatzId, _limit, _sortBy, _sortOrder, includeDeleted),
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
    refetchInterval: options?.refetchInterval,
  });
};

/**
 * Hook fuer Textbausteine-Abfrage
 *
 * @returns Textbausteine-Daten mit Ladezustand und Fehler
 */
export const useTextbausteine = () => {
  return useQuery<TextbausteinListResponse, ResponseError>({
    queryKey: QUERY_KEYS.etb.textbausteine(),
    queryFn: async () => {
      try {
        return await api.etb().etbCqrsControllerGetTextbausteineVAlpha({});
      } catch (error) {
        logger.error('Failed to fetch Textbausteine', error);
        throw error;
      }
    },
    staleTime: 60000, // Textbausteine aendern sich selten, laengere stale time
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};

// Note: useCreateEtb and useEtbEntryHistory have been removed as the
// corresponding API endpoints no longer exist in the CQRS API.
// ETBs are now created automatically when adding the first entry.

// ============================================
// Combined Operations Hook
// ============================================

/**
 * Kombinierter Hook fuer alle ETB-Operationen (CQRS)
 *
 * @param einsatzId - Die ID des Einsatzes (optional fuer queries)
 * @param includeDeleted - Geloeschte Eintraege einschliessen (Standard: false)
 * @returns Objekt mit allen ETB-bezogenen Hooks und Daten
 */
export const useEtbOperations = (einsatzId?: string, includeDeleted?: boolean) => {
  const etbQuery = useEtb(einsatzId, includeDeleted);
  const textbausteineQuery = useTextbausteine();
  const createEintrag = useCreateEtbEintrag();
  const updateEintrag = useUpdateEtbEintrag();
  const deleteEintrag = useDeleteEtbEintrag();
  const lockEtb = useLockEtb();

  return {
    // Query results
    etb: etbQuery.data,
    isLoadingEtb: etbQuery.isLoading,
    etbError: etbQuery.error,
    textbausteine: textbausteineQuery.data,
    isLoadingTextbausteine: textbausteineQuery.isLoading,
    textbausteineError: textbausteineQuery.error,

    // Mutations
    createEintrag: createEintrag.mutate,
    updateEintrag: updateEintrag.mutate,
    deleteEintrag: deleteEintrag.mutate,
    lockEtb: lockEtb.mutate,

    // Mutation states
    isCreatingEintrag: createEintrag.isPending,
    isUpdatingEintrag: updateEintrag.isPending,
    isDeletingEintrag: deleteEintrag.isPending,
    isLockingEtb: lockEtb.isPending,

    // Full mutation objects for advanced usage
    createEintragMutation: createEintrag,
    updateEintragMutation: updateEintrag,
    deleteEintragMutation: deleteEintrag,
    lockEtbMutation: lockEtb,
  };
};
