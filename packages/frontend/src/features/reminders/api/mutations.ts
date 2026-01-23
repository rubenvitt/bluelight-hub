/**
 * Erinnerungen Mutation Hooks
 *
 * Mutation Hooks für Erinnerungs-Erstellung und -Verwaltung.
 *
 * **Story 1.1 AC2/AC3:** "Titel-Eingabe + Zeit-Preset auswählen"
 * **Story 1.1 AC6:** "Erinnerungen werden im Backend pro Einsatz gespeichert"
 * **Story 1.8 AC1/AC2:** Offline-Support mit lokaler Speicherung und Sync-Queue
 */

import { api } from '@/shared';
import { getApiErrorMessage } from '@/shared/lib/errors/apiErrorHandler';
import { logger } from '@/shared/lib/logger';
import type {
  CreateErinnerungDto,
  ErinnerungResponseDto,
  ResponseError,
  UpdateErinnerungDto,
  ErinnerungControllerDeleteVAlphaRequest,
  ErinnerungControllerAcknowledgeVAlphaRequest,
  SnoozeErinnerungDto,
  ErinnerungControllerSnoozeVAlphaRequest,
  MarkErledigtErinnerungDto,
  ErinnerungControllerMarkErledigtVAlphaRequest,
  AssignErinnerungDto,
  ErinnerungControllerAssignVAlphaRequest,
} from '@/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ERINNERUNG_QUERY_KEYS, calculateRetryDelay } from './queries';
import { offlineDetectionService } from '../services/offline-detection.service';
import { syncService } from '../services/sync.service';
import { soundService, timerService, intensificationService } from '../services';
import { hideFloatingPill } from '../stores';

/**
 * Prueft ob ein Error ein Netzwerkfehler ist (Connection Lost, Timeout, etc.)
 *
 * Wird verwendet um bei Race Conditions zwischen isOffline() Check und
 * API-Call zu erkennen, dass das Netzwerk waehrend des Calls wegfiel.
 *
 * @param error - Der zu pruefende Fehler
 * @returns true wenn es ein Netzwerkfehler ist
 */
function isNetworkError(error: unknown): boolean {
  // TypeError mit 'fetch' - typisch fuer Browser fetch() Netzwerkfehler
  if (error instanceof TypeError && error.message.toLowerCase().includes('fetch')) {
    return true;
  }

  // Allgemeine Error-Message Checks
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('failed to fetch') ||
      msg.includes('timeout') ||
      msg.includes('connection') ||
      msg.includes('net::err_') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound') ||
      msg.includes('offline')
    );
  }

  return false;
}

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
      /**
       * Helper fuer Offline-Erstellung (DRY - wird bei initial offline UND network error verwendet)
       */
      const handleOfflineCreate = (): ErinnerungResponseDto => {
        const tempId = syncService.generateTempId();
        const now = new Date().toISOString();

        // Erstelle optimistische Response
        const offlineErinnerung: ErinnerungResponseDto = {
          id: tempId,
          einsatzId,
          titel: data.titel,
          beschreibung: data.beschreibung ?? null,
          faelligAm: data.faelligAm,
          status: 'GEPLANT',
          erstelltVon: 'offline',
          createdAt: now,
          updatedAt: now,
          snoozeCount: 0,
          requiresNote: data.requiresNote ?? false,
        };

        // Queue für Sync bei Reconnect
        syncService.queueCreateAction({
          id: tempId,
          einsatzId,
          titel: data.titel,
          beschreibung: data.beschreibung ?? null,
          faelligAm: data.faelligAm,
          createdAt: now,
          requiresNote: data.requiresNote ?? false,
        });

        logger.debug('[useCreateErinnerung] Created offline erinnerung', { tempId });
        return offlineErinnerung;
      };

      // Story 1.8 AC1: Offline-Modus - lokale Erstellung ohne API-Call
      if (offlineDetectionService.isOffline()) {
        return handleOfflineCreate();
      }

      // Online-Modus: API-Call mit Network Error Handling
      // Fix Issue #1: Race Condition - Netzwerk kann WAEHREND des API-Calls wegfallen
      try {
        const response = await api.erinnerungen().erinnerungControllerCreateVAlpha({
          einsatzId,
          createErinnerungDto: data,
        });
        return response.data;
      } catch (error) {
        // Bei Netzwerkfehler: Fallback zu Offline-Logik
        if (isNetworkError(error)) {
          logger.warn('[useCreateErinnerung] Network error during API call - falling back to offline mode', { error });
          offlineDetectionService.markOffline(); // Update offline status
          return handleOfflineCreate();
        }
        // Andere Fehler (Business Logic, Validation, etc.) - normal propagieren
        throw error;
      }
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
          snoozeCount: 0,
          requiresNote: data.requiresNote ?? false,
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
      // Fix Issue #1: Race Condition - Netzwerk kann WAEHREND des API-Calls wegfallen
      try {
        const response = await api.erinnerungen().erinnerungControllerUpdateVAlpha({
          einsatzId,
          id: erinnerungId,
          updateErinnerungDto: data,
        });
        return response.data;
      } catch (error) {
        // Bei Netzwerkfehler: Propagiere als spezieller Fehler fuer besseres Error Handling
        if (isNetworkError(error)) {
          logger.warn('[useUpdateErinnerung] Network error during API call', { error, erinnerungId });
          offlineDetectionService.markOffline();
          // Update hat keine Offline-Queue - Error propagieren aber mit Context
          throw new Error('Netzwerkverbindung verloren. Bitte erneut versuchen wenn online.');
        }
        throw error;
      }
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
      // Fix Issue #1: Race Condition - Netzwerk kann WAEHREND des API-Calls wegfallen
      try {
        const request: ErinnerungControllerDeleteVAlphaRequest = {
          einsatzId,
          id: erinnerungId,
        };
        await api.erinnerungen().erinnerungControllerDeleteVAlpha(request);
      } catch (error) {
        // Bei Netzwerkfehler: Propagiere als spezieller Fehler fuer besseres Error Handling
        if (isNetworkError(error)) {
          logger.warn('[useDeleteErinnerung] Network error during API call', { error, erinnerungId });
          offlineDetectionService.markOffline();
          // Delete hat keine Offline-Queue - Error propagieren aber mit Context
          throw new Error('Netzwerkverbindung verloren. Bitte erneut versuchen wenn online.');
        }
        throw error;
      }
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
        const existsInCache = previousErinnerungen.some((e) => e.id === erinnerungId);
        if (!existsInCache) {
          // Debug-Hilfe: Element nicht im Cache gefunden (ungewöhnlich)
          logger.warn(`[deleteErinnerung] Erinnerung ${erinnerungId} nicht im Cache gefunden - möglicherweise bereits entfernt`);
        }
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
    onSettled: async (_data, error, { einsatzId, erinnerungId }) => {
      // Ensure consistency - invalidate Erinnerungen list and detail for this Einsatz
      await queryClient.invalidateQueries({
        queryKey: ERINNERUNG_QUERY_KEYS.list(einsatzId),
      });
      // Remove specific detail query from cache
      queryClient.removeQueries({
        queryKey: ERINNERUNG_QUERY_KEYS.detail(erinnerungId),
      });
      // H1: Toast erst nach Cache-Update anzeigen (Race Condition vermeiden)
      if (!error) {
        toast.success('Erinnerung gelöscht', {
          description: 'Die Erinnerung wurde erfolgreich gelöscht.',
        });
      }
    },
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};

export interface TriggerErinnerungVariables {
  /**
   * Einsatz-ID
   */
  einsatzId: string;

  /**
   * Erinnerungs-ID
   */
  erinnerungId: string;
}

interface TriggerErinnerungContext {
  einsatzId: string;
  erinnerungId: string;
  previousErinnerungen: ErinnerungResponseDto[] | undefined;
}

/**
 * Hook fuer Erinnerungs-Ausloesen mit Optimistic Updates
 *
 * Loest eine Erinnerung aus (Status GEPLANT → AUSGELOEST).
 * Wird vom Alarm Trigger Hook aufgerufen wenn eine Erinnerung faellig wird.
 *
 * **Story 1.5 AC1:** "Timer-basiertes Ausloesen bei Faelligkeit"
 * **Story 1.5 AC4:** "Backend emittiert WebSocket Event"
 *
 * @returns Mutation fuer Erinnerungs-Trigger
 *
 * @example
 * ```tsx
 * const triggerErinnerung = useTriggerErinnerung();
 *
 * const handleTrigger = (erinnerung: ErinnerungResponseDto) => {
 *   triggerErinnerung.mutate({
 *     einsatzId: erinnerung.einsatzId,
 *     erinnerungId: erinnerung.id,
 *   });
 * };
 * ```
 */
export const useTriggerErinnerung = () => {
  const queryClient = useQueryClient();

  return useMutation<ErinnerungResponseDto, ResponseError, TriggerErinnerungVariables, TriggerErinnerungContext>({
    mutationFn: async ({ einsatzId, erinnerungId }) => {
      /**
       * Helper fuer Offline-Trigger (DRY - wird bei initial offline UND network error verwendet)
       */
      const handleOfflineTrigger = (): ErinnerungResponseDto => {
        // Hole Erinnerung aus Cache
        const erinnerungen = queryClient.getQueryData<ErinnerungResponseDto[]>(ERINNERUNG_QUERY_KEYS.list(einsatzId));
        const erinnerung = erinnerungen?.find((e) => e.id === erinnerungId);

        if (!erinnerung) {
          throw new Error(`Erinnerung ${erinnerungId} nicht im Cache gefunden`);
        }

        // Erstelle optimistische Response mit Status AUSGELOEST
        const triggeredErinnerung: ErinnerungResponseDto = {
          ...erinnerung,
          status: 'AUSGELOEST',
          updatedAt: new Date().toISOString(),
        };

        // Queue für Sync bei Reconnect (mit einsatzId fuer API-Aufruf)
        syncService.queueTriggerAction(erinnerungId, einsatzId);

        logger.debug('[useTriggerErinnerung] Triggered offline erinnerung', { erinnerungId, einsatzId });
        return triggeredErinnerung;
      };

      // Story 1.8 AC2: Offline-Modus - lokaler Trigger ohne API-Call
      if (offlineDetectionService.isOffline()) {
        return handleOfflineTrigger();
      }

      // Online-Modus: API-Call mit Network Error Handling
      // Fix Issue #1: Race Condition - Netzwerk kann WAEHREND des API-Calls wegfallen
      try {
        const response = await api.erinnerungen().erinnerungControllerTriggerVAlpha({
          einsatzId,
          id: erinnerungId,
        });
        return response.data;
      } catch (error) {
        // Bei Netzwerkfehler: Fallback zu Offline-Logik
        if (isNetworkError(error)) {
          logger.warn('[useTriggerErinnerung] Network error during API call - falling back to offline mode', { error, erinnerungId });
          offlineDetectionService.markOffline();
          return handleOfflineTrigger();
        }
        throw error;
      }
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

      // Optimistically update status to AUSGELOEST
      if (previousErinnerungen) {
        const updatedErinnerungen = previousErinnerungen.map((e) => {
          if (e.id === erinnerungId) {
            return {
              ...e,
              status: 'AUSGELOEST' as const,
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
      // Bei 409 Conflict kein Rollback - Erinnerung wurde bereits ausgelöst (erwartetes Verhalten)
      const status = error.response?.status;
      if (status === 409) {
        logger.debug('Erinnerung was already triggered (409 Conflict) - this is expected');
        return;
      }

      // Rollback to previous value on other errors
      if (context?.previousErinnerungen !== undefined) {
        queryClient.setQueryData(ERINNERUNG_QUERY_KEYS.list(context.einsatzId), context.previousErinnerungen);
      }

      // Log error but do NOT show toast - alarm trigger hook handles user feedback
      logger.error('Failed to trigger Erinnerung', error);
    },
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
    // Kein Retry für Trigger - 409 ist erwartetes Verhalten bei bereits ausgelösten Erinnerungen
    retry: false,
  });
};

export interface AcknowledgeErinnerungVariables {
  /**
   * Einsatz-ID
   */
  einsatzId: string;

  /**
   * Erinnerungs-ID
   */
  erinnerungId: string;
}

interface AcknowledgeErinnerungContext {
  einsatzId: string;
  erinnerungId: string;
  previousErinnerungen: ErinnerungResponseDto[] | undefined;
}

/**
 * Hook fuer Erinnerungs-Bestaetigung mit Optimistic Updates
 *
 * Bestaetigt eine ausgeloeste Erinnerung (Status AUSGELOEST → ACKNOWLEDGED).
 * Wird aufgerufen wenn ein User auf den "Bestätigen" Button klickt.
 *
 * **Story 1.6 AC1:** "1-Tap Bestätigung über Button"
 * **Story 1.6 AC2:** "Status wechselt zu ACKNOWLEDGED"
 * **Story 1.6 AC3:** "Backend speichert acknowledgedAm und acknowledgedBy"
 *
 * @returns Mutation fuer Erinnerungs-Acknowledge
 *
 * @example
 * ```tsx
 * const acknowledgeErinnerung = useAcknowledgeErinnerung();
 *
 * const handleAcknowledge = (erinnerung: ErinnerungResponseDto) => {
 *   acknowledgeErinnerung.mutate({
 *     einsatzId: erinnerung.einsatzId,
 *     erinnerungId: erinnerung.id,
 *   });
 * };
 * ```
 */
export const useAcknowledgeErinnerung = () => {
  const queryClient = useQueryClient();

  return useMutation<ErinnerungResponseDto, ResponseError, AcknowledgeErinnerungVariables, AcknowledgeErinnerungContext>({
    mutationKey: ['erinnerung', 'acknowledge'],
    mutationFn: async ({ einsatzId, erinnerungId }) => {
      /**
       * Helper fuer Offline-Acknowledge (DRY - wird bei initial offline UND network error verwendet)
       */
      const handleOfflineAcknowledge = (): ErinnerungResponseDto => {
        // Hole Erinnerung aus Cache
        const erinnerungen = queryClient.getQueryData<ErinnerungResponseDto[]>(ERINNERUNG_QUERY_KEYS.list(einsatzId));
        const erinnerung = erinnerungen?.find((e) => e.id === erinnerungId);

        if (!erinnerung) {
          throw new Error(`Erinnerung ${erinnerungId} nicht im Cache gefunden`);
        }

        // Erstelle optimistische Response mit Status ACKNOWLEDGED
        const acknowledgedErinnerung: ErinnerungResponseDto = {
          ...erinnerung,
          status: 'ACKNOWLEDGED',
          updatedAt: new Date().toISOString(),
        };

        // Queue für Sync bei Reconnect (mit einsatzId fuer API-Aufruf)
        syncService.queueAcknowledgeAction(erinnerungId, einsatzId);

        logger.debug('[useAcknowledgeErinnerung] Acknowledged offline erinnerung', { erinnerungId, einsatzId });
        return acknowledgedErinnerung;
      };

      // Story 1.8 AC2: Offline-Modus - lokales Acknowledge ohne API-Call
      if (offlineDetectionService.isOffline()) {
        return handleOfflineAcknowledge();
      }

      // Online-Modus: API-Call mit Network Error Handling
      // Fix Issue #1: Race Condition - Netzwerk kann WAEHREND des API-Calls wegfallen
      try {
        const request: ErinnerungControllerAcknowledgeVAlphaRequest = {
          einsatzId,
          id: erinnerungId,
        };
        const response = await api.erinnerungen().erinnerungControllerAcknowledgeVAlpha(request);
        return response.data;
      } catch (error) {
        // Bei Netzwerkfehler: Fallback zu Offline-Logik
        if (isNetworkError(error)) {
          logger.warn('[useAcknowledgeErinnerung] Network error during API call - falling back to offline mode', { error, erinnerungId });
          offlineDetectionService.markOffline();
          return handleOfflineAcknowledge();
        }
        throw error;
      }
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

      // Optimistically update status to ACKNOWLEDGED
      if (previousErinnerungen) {
        const updatedErinnerungen = previousErinnerungen.map((e) => {
          if (e.id === erinnerungId) {
            return {
              ...e,
              status: 'ACKNOWLEDGED' as const,
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
      // Bei 409 Conflict kein Rollback - Erinnerung wurde bereits bestätigt (erwartetes Verhalten)
      const status = error.response?.status;
      if (status === 409) {
        logger.debug('Erinnerung was already acknowledged (409 Conflict) - this is expected');
        return;
      }

      // Rollback to previous value on other errors
      if (context?.previousErinnerungen !== undefined) {
        queryClient.setQueryData(ERINNERUNG_QUERY_KEYS.list(context.einsatzId), context.previousErinnerungen);
      }

      const message = await getApiErrorMessage(error, 'Die Erinnerung konnte nicht bestätigt werden.', 'acknowledgeErinnerung');
      logger.error('Failed to acknowledge Erinnerung', error);
      toast.error('Fehler', { description: message });
    },
    onSettled: async (_data, error, { einsatzId, erinnerungId }) => {
      // Ensure consistency - invalidate Erinnerungen list and detail for this Einsatz
      await queryClient.invalidateQueries({
        queryKey: ERINNERUNG_QUERY_KEYS.list(einsatzId),
      });
      // Invalidate specific detail query if it exists
      await queryClient.invalidateQueries({
        queryKey: ERINNERUNG_QUERY_KEYS.detail(erinnerungId),
      });

      // H1 Fix: Success-Toast nach erfolgreichem Acknowledge (nur wenn kein Fehler)
      if (!error) {
        toast.success('Erinnerung bestätigt');
      }
    },
    // Kein Retry für Acknowledge - 409 ist erwartetes Verhalten bei bereits bestätigten Erinnerungen
    retry: false,
  });
};

/**
 * Erlaubte Snooze-Zeiten in Minuten (Story 2.1 AC1: Presets 1, 5, 10 Min)
 */
export type SnoozeMinutes = 1 | 5 | 10;

export interface SnoozeErinnerungVariables {
  /**
   * Einsatz-ID
   */
  einsatzId: string;

  /**
   * Erinnerungs-ID
   */
  erinnerungId: string;

  /**
   * Snooze-Dauer in Minuten (1, 5, oder 10)
   */
  snoozeMinutes: SnoozeMinutes;
}

interface SnoozeErinnerungContext {
  einsatzId: string;
  erinnerungId: string;
  previousErinnerungen: ErinnerungResponseDto[] | undefined;
}

/**
 * Hook fuer Erinnerungs-Snooze mit Optimistic Updates
 *
 * Snoozed eine ausgeloeste Erinnerung (Status AUSGELOEST → SNOOZED).
 * Wird aufgerufen wenn ein User auf einen Snooze-Button klickt oder Escape drueckt.
 *
 * **Story 2.1 AC1:** "Snooze-Buttons mit Presets 1, 5, 10 Min + Escape = 5 Min"
 * **Story 2.1 AC2:** "Status wechselt zu SNOOZED, neue Fälligkeit wird berechnet"
 * **Story 2.1 AC3:** "Audio-Alarm wird gestoppt (via WebSocket Event)"
 *
 * @returns Mutation fuer Erinnerungs-Snooze
 *
 * @example
 * ```tsx
 * const snoozeErinnerung = useSnoozeErinnerung();
 *
 * const handleSnooze = (erinnerung: ErinnerungResponseDto, minutes: SnoozeMinutes) => {
 *   snoozeErinnerung.mutate({
 *     einsatzId: erinnerung.einsatzId,
 *     erinnerungId: erinnerung.id,
 *     snoozeMinutes: minutes,
 *   });
 * };
 * ```
 */
export const useSnoozeErinnerung = () => {
  const queryClient = useQueryClient();

  return useMutation<ErinnerungResponseDto, ResponseError, SnoozeErinnerungVariables, SnoozeErinnerungContext>({
    mutationKey: ['erinnerung', 'snooze'],
    mutationFn: async ({ einsatzId, erinnerungId, snoozeMinutes }) => {
      /**
       * Helper fuer Offline-Snooze (DRY - wird bei initial offline UND network error verwendet)
       */
      const handleOfflineSnooze = (): ErinnerungResponseDto => {
        // Hole Erinnerung aus Cache
        const erinnerungen = queryClient.getQueryData<ErinnerungResponseDto[]>(ERINNERUNG_QUERY_KEYS.list(einsatzId));
        const erinnerung = erinnerungen?.find((e) => e.id === erinnerungId);

        if (!erinnerung) {
          throw new Error(`Erinnerung ${erinnerungId} nicht im Cache gefunden`);
        }

        const now = new Date();
        const snoozedUntil = new Date(now.getTime() + snoozeMinutes * 60 * 1000);

        // Erstelle optimistische Response mit Status SNOOZED und neuer Fälligkeit
        const snoozedErinnerung: ErinnerungResponseDto = {
          ...erinnerung,
          status: 'SNOOZED',
          faelligAm: snoozedUntil.toISOString(),
          updatedAt: now.toISOString(),
        };

        // Queue für Sync bei Reconnect (mit einsatzId fuer API-Aufruf)
        syncService.queueSnoozeAction(erinnerungId, einsatzId, snoozeMinutes);

        logger.debug('[useSnoozeErinnerung] Snoozed offline erinnerung', { erinnerungId, einsatzId, snoozeMinutes });
        return snoozedErinnerung;
      };

      // Story 2.1: Offline-Modus - lokales Snooze ohne API-Call
      if (offlineDetectionService.isOffline()) {
        return handleOfflineSnooze();
      }

      // Online-Modus: API-Call mit Network Error Handling
      try {
        const request: ErinnerungControllerSnoozeVAlphaRequest = {
          einsatzId,
          id: erinnerungId,
          snoozeErinnerungDto: { snoozeMinutes },
        };
        const response = await api.erinnerungen().erinnerungControllerSnoozeVAlpha(request);
        return response.data;
      } catch (error) {
        // Bei Netzwerkfehler: Fallback zu Offline-Logik
        if (isNetworkError(error)) {
          logger.warn('[useSnoozeErinnerung] Network error during API call - falling back to offline mode', { error, erinnerungId });
          offlineDetectionService.markOffline();
          return handleOfflineSnooze();
        }
        throw error;
      }
    },
    onMutate: async ({ einsatzId, erinnerungId, snoozeMinutes }) => {
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

      // Optimistically update status to SNOOZED with new faelligAm
      if (previousErinnerungen) {
        const now = new Date();
        const snoozedUntil = new Date(now.getTime() + snoozeMinutes * 60 * 1000);

        const updatedErinnerungen = previousErinnerungen.map((e) => {
          if (e.id === erinnerungId) {
            return {
              ...e,
              status: 'SNOOZED' as const,
              faelligAm: snoozedUntil.toISOString(),
              updatedAt: now.toISOString(),
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
      // Bei 409 Conflict kein Rollback - Erinnerung wurde bereits gesnoozed oder hat falschen Status
      const status = error.response?.status;
      if (status === 409) {
        logger.debug('Erinnerung cannot be snoozed (409 Conflict) - wrong status');
        toast.warning('Snooze nicht möglich', {
          description: 'Die Erinnerung kann nicht gesnoozed werden.',
        });
        return;
      }

      // Rollback to previous value on other errors
      if (context?.previousErinnerungen !== undefined) {
        queryClient.setQueryData(ERINNERUNG_QUERY_KEYS.list(context.einsatzId), context.previousErinnerungen);
      }

      const message = await getApiErrorMessage(error, 'Die Erinnerung konnte nicht gesnoozed werden.', 'snoozeErinnerung');
      logger.error('Failed to snooze Erinnerung', error);
      toast.error('Fehler', { description: message });
    },
    onSettled: async (_data, error, { einsatzId, erinnerungId }) => {
      // F4 Fix: Force Refetch für aktualisierte faelligAm nach Snooze
      // Ensure consistency - invalidate Erinnerungen list and detail for this Einsatz
      await Promise.all([queryClient.invalidateQueries({ queryKey: ERINNERUNG_QUERY_KEYS.list(einsatzId) }), queryClient.invalidateQueries({ queryKey: ERINNERUNG_QUERY_KEYS.detail(erinnerungId) })]);

      // Success-Toast nach erfolgreichem Snooze (nur wenn kein Fehler)
      if (!error) {
        toast.success('Erinnerung gesnoozed');
      }
    },
    // Kein Retry für Snooze - 409 ist erwartetes Verhalten bei falschem Status
    retry: false,
  });
};

export interface MarkErledigtErinnerungVariables {
  /**
   * Einsatz-ID
   */
  einsatzId: string;

  /**
   * Erinnerungs-ID
   */
  erinnerungId: string;

  /**
   * Optionale Notiz zur Erledigung (max 500 Zeichen)
   */
  erledigungsNotiz?: string;
}

interface MarkErledigtErinnerungContext {
  einsatzId: string;
  erinnerungId: string;
  previousErinnerungen: ErinnerungResponseDto[] | undefined;
}

/**
 * Hook fuer Erinnerungs-Erledigung mit Optimistic Updates
 *
 * Markiert eine Erinnerung als erledigt (Status ACKNOWLEDGED/ESKALIERT → ERLEDIGT).
 * Wird aufgerufen wenn ein User auf den "Erledigt" Button klickt und optional eine Notiz hinzufuegt.
 *
 * **Story 2.5 AC1:** "Nur ACKNOWLEDGED oder ESKALIERT Status kann erledigt werden"
 * **Story 2.5 AC2:** "Status wechselt zu ERLEDIGT"
 * **Story 2.5 AC3:** "Backend speichert erledigtAm, erledigtBy und erledigungsNotiz"
 * **Story 2.5 AC4:** "ETB-Eintrag wird automatisch erstellt"
 *
 * @returns Mutation fuer Erinnerungs-Erledigung
 *
 * @example
 * ```tsx
 * const markErledigtErinnerung = useMarkErledigtErinnerung();
 *
 * const handleMarkErledigt = (erinnerung: ErinnerungResponseDto, notiz?: string) => {
 *   markErledigtErinnerung.mutate({
 *     einsatzId: erinnerung.einsatzId,
 *     erinnerungId: erinnerung.id,
 *     erledigungsNotiz: notiz,
 *   });
 * };
 * ```
 */
export const useMarkErledigtErinnerung = () => {
  const queryClient = useQueryClient();

  return useMutation<ErinnerungResponseDto, ResponseError, MarkErledigtErinnerungVariables, MarkErledigtErinnerungContext>({
    mutationKey: ['erinnerung', 'markErledigt'],
    mutationFn: async ({ einsatzId, erinnerungId, erledigungsNotiz }) => {
      /**
       * Helper fuer Offline-Erledigung (DRY - wird bei initial offline UND network error verwendet)
       */
      const handleOfflineMarkErledigt = (): ErinnerungResponseDto => {
        // Hole Erinnerung aus Cache
        const erinnerungen = queryClient.getQueryData<ErinnerungResponseDto[]>(ERINNERUNG_QUERY_KEYS.list(einsatzId));
        const erinnerung = erinnerungen?.find((e) => e.id === erinnerungId);

        if (!erinnerung) {
          throw new Error(`Erinnerung ${erinnerungId} nicht im Cache gefunden`);
        }

        const now = new Date().toISOString();

        // Erstelle optimistische Response mit Status ERLEDIGT
        const erledigteErinnerung: ErinnerungResponseDto = {
          ...erinnerung,
          status: 'ERLEDIGT',
          erledigtAm: now,
          erledigtBy: 'offline', // Placeholder - wird bei Sync ersetzt
          erledigungsNotiz: erledigungsNotiz ?? null,
          updatedAt: now,
        };

        // TODO: Queue für Sync bei Reconnect (wenn Offline-Support für markErledigt benötigt wird)
        // syncService.queueMarkErledigtAction(erinnerungId, einsatzId, erledigungsNotiz);

        logger.debug('[useMarkErledigtErinnerung] Marked offline erinnerung as erledigt', { erinnerungId, einsatzId });
        return erledigteErinnerung;
      };

      // Story 2.5: Offline-Modus - lokale Erledigung ohne API-Call
      if (offlineDetectionService.isOffline()) {
        return handleOfflineMarkErledigt();
      }

      // Online-Modus: API-Call mit Network Error Handling
      try {
        const request: ErinnerungControllerMarkErledigtVAlphaRequest = {
          einsatzId,
          id: erinnerungId,
          markErledigtErinnerungDto: { erledigungsNotiz },
        };
        const response = await api.erinnerungen().erinnerungControllerMarkErledigtVAlpha(request);
        return response.data;
      } catch (error) {
        // Bei Netzwerkfehler: Fallback zu Offline-Logik
        if (isNetworkError(error)) {
          logger.warn('[useMarkErledigtErinnerung] Network error during API call - falling back to offline mode', { error, erinnerungId });
          offlineDetectionService.markOffline();
          return handleOfflineMarkErledigt();
        }
        throw error;
      }
    },
    onMutate: async ({ einsatzId, erinnerungId, erledigungsNotiz }) => {
      // Story 2.5: Cleanup Timer/Audio/Intensification/FloatingPill sofort bei Erledigung
      // Wichtig fuer ESKALIERT Status, wo Audio noch laufen koennte
      soundService.stopAllSounds();
      timerService.resetTriggered(erinnerungId);
      intensificationService.stopTimer(erinnerungId);
      hideFloatingPill(erinnerungId);

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

      // Optimistically update status to ERLEDIGT
      if (previousErinnerungen) {
        const now = new Date().toISOString();

        const updatedErinnerungen = previousErinnerungen.map((e) => {
          if (e.id === erinnerungId) {
            return {
              ...e,
              status: 'ERLEDIGT' as const,
              erledigtAm: now,
              erledigtBy: 'pending', // Placeholder bis Server-Response
              erledigungsNotiz: erledigungsNotiz ?? null,
              updatedAt: now,
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
      // Bei 409 Conflict kein Rollback - Erinnerung hat falschen Status oder ist bereits erledigt
      const status = error.response?.status;
      if (status === 409) {
        logger.debug('Erinnerung cannot be marked as erledigt (409 Conflict) - wrong status');
        toast.warning('Erledigen nicht möglich', {
          description: 'Die Erinnerung kann nicht als erledigt markiert werden.',
        });
        return;
      }

      // Rollback to previous value on other errors
      if (context?.previousErinnerungen !== undefined) {
        queryClient.setQueryData(ERINNERUNG_QUERY_KEYS.list(context.einsatzId), context.previousErinnerungen);
      }

      const message = await getApiErrorMessage(error, 'Die Erinnerung konnte nicht als erledigt markiert werden.', 'markErledigtErinnerung');
      logger.error('Failed to mark Erinnerung as erledigt', error);
      toast.error('Fehler', { description: message });
    },
    onSettled: async (_data, error, { einsatzId, erinnerungId }) => {
      // Ensure consistency - invalidate Erinnerungen list and detail for this Einsatz
      await Promise.all([queryClient.invalidateQueries({ queryKey: ERINNERUNG_QUERY_KEYS.list(einsatzId) }), queryClient.invalidateQueries({ queryKey: ERINNERUNG_QUERY_KEYS.detail(erinnerungId) })]);

      // Success-Toast nach erfolgreichem Erledigen (nur wenn kein Fehler)
      if (!error) {
        toast.success('Erinnerung erledigt');
      }
    },
    // Kein Retry für MarkErledigt - 409 ist erwartetes Verhalten bei falschem Status
    retry: false,
  });
};

export interface AssignErinnerungVariables {
  /**
   * Einsatz-ID
   */
  einsatzId: string;

  /**
   * Erinnerungs-ID
   */
  erinnerungId: string;

  /**
   * Daten für Zuweisung
   */
  data: AssignErinnerungDto;
}

interface AssignErinnerungContext {
  einsatzId: string;
  erinnerungId: string;
  previousErinnerungen: ErinnerungResponseDto[] | undefined;
}

/**
 * Hook fuer Erinnerungs-Zuweisung an anderen Benutzer
 *
 * Weist eine bestehende Erinnerung einem anderen Benutzer zu.
 * Nur Erinnerungen mit aktivem Status (nicht ERLEDIGT/ESKALIERT) koennen zugewiesen werden.
 *
 * **Story 3.4 AC1:** "Bestehende Erinnerung nachtraeglich zuweisen"
 * **Story 3.4 AC1:** "Teilnehmer aus aktiven Einsatz-Teilnehmern auswaehlen"
 * **Story 3.4 AC2:** "Nach Zuweisung verschwindet Erinnerung aus 'Meine Erinnerungen'"
 *
 * @returns Mutation fuer Erinnerungs-Zuweisung
 *
 * @example
 * ```tsx
 * const assignErinnerung = useAssignErinnerung();
 *
 * const handleAssign = (erinnerung: ErinnerungResponseDto, assignedToId: string) => {
 *   assignErinnerung.mutate({
 *     einsatzId: erinnerung.einsatzId,
 *     erinnerungId: erinnerung.id,
 *     data: { assignedToId },
 *   });
 * };
 * ```
 */
export const useAssignErinnerung = () => {
  const queryClient = useQueryClient();

  return useMutation<ErinnerungResponseDto, ResponseError, AssignErinnerungVariables, AssignErinnerungContext>({
    mutationKey: ['erinnerung', 'assign'],
    mutationFn: async ({ einsatzId, erinnerungId, data }) => {
      // Kein Offline-Support fuer Assign - erfordert aktive Teilnehmer-Validierung
      try {
        const request: ErinnerungControllerAssignVAlphaRequest = {
          einsatzId,
          id: erinnerungId,
          assignErinnerungDto: data,
        };
        const response = await api.erinnerungen().erinnerungControllerAssignVAlpha(request);
        return response.data;
      } catch (error) {
        // Bei Netzwerkfehler: Propagiere als spezieller Fehler fuer besseres Error Handling
        if (isNetworkError(error)) {
          logger.warn('[useAssignErinnerung] Network error during API call', { error, erinnerungId });
          offlineDetectionService.markOffline();
          throw new Error('Netzwerkverbindung verloren. Bitte erneut versuchen wenn online.');
        }
        throw error;
      }
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

      // Optimistically update assignedToId
      if (previousErinnerungen) {
        const updatedErinnerungen = previousErinnerungen.map((e) => {
          if (e.id === erinnerungId) {
            return {
              ...e,
              assignedToId: data.assignedToId,
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

      const message = await getApiErrorMessage(error, 'Die Erinnerung konnte nicht zugewiesen werden.', 'assignErinnerung');
      logger.error('Failed to assign Erinnerung', error);
      toast.error('Fehler', { description: message });
    },
    onSettled: async (_data, error, { einsatzId, erinnerungId }) => {
      // Ensure consistency - invalidate Erinnerungen list and detail for this Einsatz
      await Promise.all([queryClient.invalidateQueries({ queryKey: ERINNERUNG_QUERY_KEYS.list(einsatzId) }), queryClient.invalidateQueries({ queryKey: ERINNERUNG_QUERY_KEYS.detail(erinnerungId) })]);

      // Success-Toast nach erfolgreicher Zuweisung (nur wenn kein Fehler)
      if (!error) {
        toast.success('Erinnerung zugewiesen');
      }
    },
    retry: 3,
    retryDelay: calculateRetryDelay,
  });
};
