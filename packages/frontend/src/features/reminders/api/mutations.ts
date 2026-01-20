/**
 * Erinnerungen Mutation Hooks
 *
 * Mutation Hooks für Erinnerungs-Erstellung und -Verwaltung.
 *
 * **Story 1.1 AC2/AC3:** "Titel-Eingabe + Zeit-Preset auswählen"
 * **Story 1.1 AC6:** "Erinnerungen werden im Backend pro Einsatz gespeichert"
 */

import { api } from '@/shared';
import { getApiErrorMessage } from '@/shared/lib/errors/apiErrorHandler';
import { logger } from '@/shared/lib/logger';
import type { CreateErinnerungDto, ErinnerungResponseDto, ResponseError, UpdateErinnerungDto, ErinnerungControllerDeleteVAlphaRequest } from '@/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ERINNERUNG_QUERY_KEYS, calculateRetryDelay } from './queries';

export interface CreateErinnerungVariables {
  /**
   * Einsatz-ID
   */
  einsatzId: string;

  /**
   * Daten für neue Erinnerung
   */
  data: CreateErinnerungDto;
}

interface CreateErinnerungContext {
  einsatzId: string;
  previousErinnerungen: ErinnerungResponseDto[] | undefined;
}

/**
 * Hook für Erinnerungs-Erstellung mit Optimistic Updates
 *
 * Erstellt eine neue Erinnerung für einen Einsatz. Bei Erfolg werden
 * automatisch alle Erinnerungs-Queries invalidiert um Konsistenz sicherzustellen.
 * Bei Fehler wird der vorherige Zustand wiederhergestellt (Rollback).
 *
 * @returns Mutation für Erinnerungs-Erstellung
 *
 * @example
 * ```tsx
 * const createErinnerung = useCreateErinnerung();
 *
 * const handleSubmit = (formData: CreateErinnerungFormData) => {
 *   const faelligAm = new Date(Date.now() + formData.minuten * 60 * 1000);
 *
 *   createErinnerung.mutate({
 *     einsatzId: 'abc-123',
 *     data: {
 *       titel: formData.titel,
 *       faelligAm: faelligAm.toISOString(),
 *       beschreibung: formData.beschreibung,
 *     },
 *   });
 * };
 * ```
 */
export const useCreateErinnerung = () => {
  const queryClient = useQueryClient();

  return useMutation<ErinnerungResponseDto, ResponseError, CreateErinnerungVariables, CreateErinnerungContext>({
    mutationFn: async ({ einsatzId, data }) => {
      const response = await api.erinnerungen().erinnerungControllerCreateVAlpha({
        einsatzId,
        createErinnerungDto: data,
      });
      return response.data;
    },
    onMutate: async ({ einsatzId, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ERINNERUNG_QUERY_KEYS.list(einsatzId),
      });

      // Snapshot the previous value
      const previousErinnerungen = queryClient.getQueryData<ErinnerungResponseDto[]>(ERINNERUNG_QUERY_KEYS.list(einsatzId));

      // Optimistically update to the new value
      if (previousErinnerungen) {
        const optimisticErinnerung: ErinnerungResponseDto = {
          id: `temp-${Date.now()}`, // Temporary ID (will be replaced on success)
          einsatzId,
          titel: data.titel,
          beschreibung: data.beschreibung ?? null,
          faelligAm: data.faelligAm,
          status: 'GEPLANT',
          erstelltVon: 'optimistic', // Placeholder (will be replaced on success)
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        queryClient.setQueryData<ErinnerungResponseDto[]>(ERINNERUNG_QUERY_KEYS.list(einsatzId), [...previousErinnerungen, optimisticErinnerung]);
      }

      // Return context object with previous value for rollback
      return { einsatzId, previousErinnerungen };
    },
    onError: async (error: ResponseError, _variables, context) => {
      // Rollback to previous value on error
      if (context?.previousErinnerungen !== undefined) {
        queryClient.setQueryData(ERINNERUNG_QUERY_KEYS.list(context.einsatzId), context.previousErinnerungen);
      }

      const message = await getApiErrorMessage(error, 'Die Erinnerung konnte nicht erstellt werden.', 'createErinnerung');
      logger.error('Failed to create Erinnerung', error);
      toast.error('Fehler', { description: message });
    },
    // Success-Toast wird vom Aufrufer gesteuert (z.B. Dialog mit spezifischer Zeit-Info)
    onSettled: async (_data, _error, { einsatzId }) => {
      // Ensure consistency - invalidate Erinnerungen for this Einsatz
      // Dies ersetzt die optimistische Erinnerung mit der echten vom Server
      await queryClient.invalidateQueries({
        queryKey: ERINNERUNG_QUERY_KEYS.list(einsatzId),
      });
    },
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};

export interface UpdateErinnerungVariables {
  /**
   * Einsatz-ID
   */
  einsatzId: string;

  /**
   * Erinnerungs-ID
   */
  erinnerungId: string;

  /**
   * Daten für Erinnerungs-Update
   */
  data: UpdateErinnerungDto;
}

interface UpdateErinnerungContext {
  einsatzId: string;
  erinnerungId: string;
  previousErinnerungen: ErinnerungResponseDto[] | undefined;
}

/**
 * Hook für Erinnerungs-Update mit Optimistic Updates
 *
 * Aktualisiert eine bestehende Erinnerung. Nur Erinnerungen im Status GEPLANT
 * können bearbeitet werden. Bei Erfolg werden automatisch alle Erinnerungs-Queries
 * invalidiert um Konsistenz sicherzustellen. Bei Fehler wird der vorherige Zustand
 * wiederhergestellt (Rollback).
 *
 * **Story 1.3 AC2:** "Bei Zeit-Änderung: Timer wird neu berechnet"
 *
 * @returns Mutation für Erinnerungs-Update
 *
 * @example
 * ```tsx
 * const updateErinnerung = useUpdateErinnerung();
 *
 * const handleSubmit = (formData: UpdateErinnerungFormData) => {
 *   const data: UpdateErinnerungDto = {
 *     titel: formData.titel,
 *     faelligAm: formData.faelligAm?.toISOString(),
 *     beschreibung: formData.beschreibung,
 *   };
 *
 *   updateErinnerung.mutate({
 *     einsatzId: 'abc-123',
 *     erinnerungId: 'def-456',
 *     data,
 *   });
 * };
 * ```
 */
export const useUpdateErinnerung = () => {
  const queryClient = useQueryClient();

  return useMutation<ErinnerungResponseDto, ResponseError, UpdateErinnerungVariables, UpdateErinnerungContext>({
    mutationFn: async ({ einsatzId, erinnerungId, data }) => {
      const response = await api.erinnerungen().erinnerungControllerUpdateVAlpha({
        einsatzId,
        id: erinnerungId,
        updateErinnerungDto: data,
      });
      return response.data;
    },
    onMutate: async ({ einsatzId, erinnerungId, data }) => {
      // Cancel ALL related queries to prevent race conditions
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: ERINNERUNG_QUERY_KEYS.list(einsatzId),
        }),
        queryClient.cancelQueries({
          queryKey: ERINNERUNG_QUERY_KEYS.detail(erinnerungId),
        }),
      ]);

      // Snapshot the previous value
      const previousErinnerungen = queryClient.getQueryData<ErinnerungResponseDto[]>(ERINNERUNG_QUERY_KEYS.list(einsatzId));

      // Optimistically update to the new value
      if (previousErinnerungen) {
        const updatedErinnerungen = previousErinnerungen.map((e) => {
          if (e.id === erinnerungId) {
            return {
              ...e,
              titel: data.titel ?? e.titel,
              faelligAm: data.faelligAm ?? e.faelligAm,
              beschreibung: data.beschreibung !== undefined ? (data.beschreibung as string | null) : e.beschreibung,
              updatedAt: new Date().toISOString(),
            };
          }
          return e;
        });

        queryClient.setQueryData<ErinnerungResponseDto[]>(ERINNERUNG_QUERY_KEYS.list(einsatzId), updatedErinnerungen);
      }

      // Return context object with previous value for rollback
      return { einsatzId, erinnerungId, previousErinnerungen };
    },
    onError: async (error: ResponseError, _variables, context) => {
      // Rollback to previous value on error
      if (context?.previousErinnerungen !== undefined) {
        queryClient.setQueryData(ERINNERUNG_QUERY_KEYS.list(context.einsatzId), context.previousErinnerungen);
      }
      // KEIN toast.error hier - Dialog handled Error via apiErrorMessage (verhindert Double Error Display)
      logger.error('Failed to update Erinnerung', error);
    },
    // Success-Toast wird vom Aufrufer gesteuert (z.B. Dialog mit spezifischer Info)
    onSettled: async (_data, _error, { einsatzId, erinnerungId }) => {
      // Ensure consistency - invalidate Erinnerungen list and detail for this Einsatz
      await queryClient.invalidateQueries({
        queryKey: ERINNERUNG_QUERY_KEYS.list(einsatzId),
      });
      // Invalidate specific detail query if it exists
      await queryClient.invalidateQueries({
        queryKey: ERINNERUNG_QUERY_KEYS.detail(erinnerungId),
      });
    },
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};

export interface DeleteErinnerungVariables {
  /**
   * Einsatz-ID
   */
  einsatzId: string;

  /**
   * Erinnerungs-ID
   */
  erinnerungId: string;
}

interface DeleteErinnerungContext {
  einsatzId: string;
  erinnerungId: string;
  previousErinnerungen: ErinnerungResponseDto[] | undefined;
}

/**
 * Hook für Erinnerungs-Löschung mit Optimistic Updates
 *
 * Löscht eine Erinnerung (Soft-Delete). Nur Erinnerungen im Status GEPLANT
 * oder AUSGELOEST können gelöscht werden. Bei Erfolg werden automatisch alle
 * Erinnerungs-Queries invalidiert um Konsistenz sicherzustellen. Bei Fehler
 * wird der vorherige Zustand wiederhergestellt (Rollback).
 *
 * **Story 1.4 AC1:** "Nur GEPLANT oder AUSGELOEST Status löschbar"
 * **Story 1.4 AC3:** "Soft-Delete (nicht physisch löschen)"
 *
 * @returns Mutation für Erinnerungs-Löschung
 *
 * @example
 * ```tsx
 * const deleteErinnerung = useDeleteErinnerung();
 *
 * const handleDelete = () => {
 *   deleteErinnerung.mutate({
 *     einsatzId: 'abc-123',
 *     erinnerungId: 'def-456',
 *   });
 * };
 * ```
 */
export const useDeleteErinnerung = () => {
  const queryClient = useQueryClient();

  return useMutation<void, ResponseError, DeleteErinnerungVariables, DeleteErinnerungContext>({
    mutationFn: async ({ einsatzId, erinnerungId }) => {
      await api.erinnerungen().erinnerungControllerDeleteVAlpha({
        einsatzId,
        id: erinnerungId,
      });
    },
    onMutate: async ({ einsatzId, erinnerungId }) => {
      // Cancel ALL related queries to prevent race conditions
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: ERINNERUNG_QUERY_KEYS.list(einsatzId),
        }),
        queryClient.cancelQueries({
          queryKey: ERINNERUNG_QUERY_KEYS.detail(erinnerungId),
        }),
      ]);

      // Snapshot the previous value
      const previousErinnerungen = queryClient.getQueryData<ErinnerungResponseDto[]>(ERINNERUNG_QUERY_KEYS.list(einsatzId));

      // Optimistically remove the erinnerung from the list
      if (previousErinnerungen) {
        const filteredErinnerungen = previousErinnerungen.filter((e) => e.id !== erinnerungId);
        queryClient.setQueryData<ErinnerungResponseDto[]>(ERINNERUNG_QUERY_KEYS.list(einsatzId), filteredErinnerungen);
      }

      // Return context object with previous value for rollback
      return { einsatzId, erinnerungId, previousErinnerungen };
    },
    onError: async (error: ResponseError, _variables, context) => {
      // Rollback to previous value on error
      if (context?.previousErinnerungen !== undefined) {
        queryClient.setQueryData(ERINNERUNG_QUERY_KEYS.list(context.einsatzId), context.previousErinnerungen);
      }

      const message = await getApiErrorMessage(error, 'Die Erinnerung konnte nicht gelöscht werden.', 'deleteErinnerung');
      logger.error('Failed to delete Erinnerung', error);
      toast.error('Fehler', { description: message });
    },
    onSuccess: () => {
      toast.success('Erinnerung gelöscht', {
        description: 'Die Erinnerung wurde erfolgreich gelöscht.',
      });
    },
    onSettled: async (_data, _error, { einsatzId, erinnerungId }) => {
      // Ensure consistency - invalidate Erinnerungen list and detail for this Einsatz
      await queryClient.invalidateQueries({
        queryKey: ERINNERUNG_QUERY_KEYS.list(einsatzId),
      });
      // Remove specific detail query from cache
      queryClient.removeQueries({
        queryKey: ERINNERUNG_QUERY_KEYS.detail(erinnerungId),
      });
    },
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};
