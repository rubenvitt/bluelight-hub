import { AsyncDebouncer } from '@tanstack/pacer';
import { useCallback, useEffect, useRef, useState } from 'react';

export type AutoSaveStatus = 'idle' | 'dirty' | 'debouncing' | 'local-saved' | 'syncing' | 'synced' | 'offline-queued' | 'conflict' | 'error';
export type AutoSaveSource = 'auto-save' | 'manual-finalize';

interface AutoSaveRequest<TDraft> {
  draft: TDraft;
  draftKey: string;
  revision: number;
  source: AutoSaveSource;
}

export interface UseAutoSaveOptions<TDraft, TResult> {
  readonly entityId: string;
  readonly entityType: string;
  readonly saveFn: (draft: TDraft) => Promise<TResult>;
  readonly debounceMs?: number;
  readonly enabled?: boolean;
  readonly isValid?: (draft: TDraft) => boolean;
  readonly hasChanges?: (draft: TDraft) => boolean;
  readonly getDraftKey?: (draft: TDraft) => string;
  readonly isConflictError?: (error: unknown) => boolean;
  readonly isOfflineError?: (error: unknown) => boolean;
  readonly isOnline?: boolean;
  readonly onSaved?: (result: TResult, draft: TDraft) => void;
  readonly onError?: (error: unknown, draft: TDraft) => void;
  readonly onConflict?: (error: unknown, draft: TDraft) => void;
  readonly onLocalSave?: (draft: TDraft, source: AutoSaveSource) => Promise<void>;
  readonly onOfflineSave?: (draft: TDraft, source: AutoSaveSource) => Promise<void>;
}

export interface UseAutoSaveReturn<TDraft, TResult> {
  readonly status: AutoSaveStatus;
  readonly error: unknown;
  readonly lastResult: TResult | null;
  readonly hasPendingChanges: boolean;
  readonly scheduleSave: (draft: TDraft) => boolean;
  readonly flushNow: (draft?: TDraft) => Promise<TResult | undefined>;
  readonly finalizeNow: (draft?: TDraft) => Promise<TResult | undefined>;
  readonly cancel: () => void;
  readonly resetSynced: (draft?: TDraft) => void;
}

function defaultDraftKey<TDraft>(draft: TDraft): string {
  try {
    return JSON.stringify(draft);
  } catch {
    return String(draft);
  }
}

function getHttpStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null)?.response?.status;
}

function defaultIsConflictError(error: unknown): boolean {
  return (
    getHttpStatus(error) === 409 || (error as { statusCode?: number; name?: string } | null)?.statusCode === 409 || (error as { name?: string } | null)?.name === 'GefaehrdungsbeurteilungConflictError'
  );
}

function defaultIsOfflineError(error: unknown): boolean {
  return getHttpStatus(error) === undefined;
}

export function useAutoSave<TDraft, TResult>(options: UseAutoSaveOptions<TDraft, TResult>): UseAutoSaveReturn<TDraft, TResult> {
  const debounceMs = options.debounceMs ?? 2000;
  const enabled = options.enabled ?? true;
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [error, setError] = useState<unknown>(null);
  const [lastResult, setLastResult] = useState<TResult | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const statusRef = useRef(status);

  const saveFnRef = useRef(options.saveFn);
  const isValidRef = useRef(options.isValid);
  const hasChangesRef = useRef(options.hasChanges);
  const getDraftKeyRef = useRef(options.getDraftKey ?? defaultDraftKey<TDraft>);
  const isConflictErrorRef = useRef(options.isConflictError ?? defaultIsConflictError);
  const isOfflineErrorRef = useRef(options.isOfflineError ?? defaultIsOfflineError);
  const onSavedRef = useRef(options.onSaved);
  const onErrorRef = useRef(options.onError);
  const onConflictRef = useRef(options.onConflict);
  const onLocalSaveRef = useRef(options.onLocalSave);
  const onOfflineSaveRef = useRef(options.onOfflineSave);
  const isOnlineRef = useRef(options.isOnline ?? true);
  const enabledRef = useRef(enabled);

  saveFnRef.current = options.saveFn;
  isValidRef.current = options.isValid;
  hasChangesRef.current = options.hasChanges;
  getDraftKeyRef.current = options.getDraftKey ?? defaultDraftKey<TDraft>;
  isConflictErrorRef.current = options.isConflictError ?? defaultIsConflictError;
  isOfflineErrorRef.current = options.isOfflineError ?? defaultIsOfflineError;
  onSavedRef.current = options.onSaved;
  onErrorRef.current = options.onError;
  onConflictRef.current = options.onConflict;
  onLocalSaveRef.current = options.onLocalSave;
  onOfflineSaveRef.current = options.onOfflineSave;
  isOnlineRef.current = options.isOnline ?? true;
  enabledRef.current = enabled;
  statusRef.current = status;

  const latestDraftRef = useRef<TDraft | undefined>(undefined);
  const latestDraftKeyRef = useRef<string | null>(null);
  const latestRequestRef = useRef<AutoSaveRequest<TDraft> | null>(null);
  const lastSavedDraftKeyRef = useRef<string | null>(null);
  const lastLocalDraftKeyRef = useRef<string | null>(null);
  const lastOfflineDraftKeyRef = useRef<string | null>(null);
  const latestRevisionRef = useRef(0);
  const inFlightRef = useRef(false);
  const inFlightDraftKeyRef = useRef<string | null>(null);
  const queuedRequestRef = useRef<AutoSaveRequest<TDraft> | null>(null);
  const conflictPausedRef = useRef(false);

  const isSaveable = useCallback((draft: TDraft, draftKey: string): boolean => {
    if (!enabledRef.current || conflictPausedRef.current) return false;
    if (isValidRef.current && !isValidRef.current(draft)) return false;
    if (hasChangesRef.current && !hasChangesRef.current(draft)) return false;
    return draftKey !== lastSavedDraftKeyRef.current && draftKey !== lastOfflineDraftKeyRef.current;
  }, []);

  const persistDraft = useCallback(
    async (
      request: AutoSaveRequest<TDraft>,
      saveDraft: ((draft: TDraft, source: AutoSaveSource) => Promise<void>) | undefined,
      options: {
        readonly status: Extract<AutoSaveStatus, 'local-saved' | 'offline-queued'>;
        readonly markOffline: boolean;
        readonly updateState: boolean;
      },
    ): Promise<boolean> => {
      if (!saveDraft) return false;

      try {
        await saveDraft(request.draft, request.source);
        if (options.status === 'local-saved') {
          lastLocalDraftKeyRef.current = request.draftKey;
        }
        if (options.markOffline) {
          lastOfflineDraftKeyRef.current = request.draftKey;
        }
        if (options.updateState) {
          const localSaveWouldDowngradeServerState =
            options.status === 'local-saved' &&
            (inFlightDraftKeyRef.current === request.draftKey || lastSavedDraftKeyRef.current === request.draftKey || lastOfflineDraftKeyRef.current === request.draftKey);
          if (localSaveWouldDowngradeServerState) {
            return true;
          }
          setError(null);
          setStatus(options.status);
          setHasPendingChanges(options.status === 'local-saved');
        }
        return true;
      } catch (storageError) {
        if (options.updateState) {
          setError(storageError);
          setStatus('error');
          setHasPendingChanges(true);
        }
        onErrorRef.current?.(storageError, request.draft);
        return false;
      }
    },
    [],
  );

  const persistLocalDraft = useCallback(
    (request: AutoSaveRequest<TDraft>, updateState: boolean): Promise<boolean> => {
      return persistDraft(request, onLocalSaveRef.current, {
        status: 'local-saved',
        markOffline: false,
        updateState,
      });
    },
    [persistDraft],
  );

  const persistOfflineDraft = useCallback(
    (request: AutoSaveRequest<TDraft>): Promise<boolean> => {
      const saveDraft = onOfflineSaveRef.current ?? onLocalSaveRef.current;
      return persistDraft(request, saveDraft, {
        status: 'offline-queued',
        markOffline: true,
        updateState: true,
      });
    },
    [persistDraft],
  );

  const executeRequest = useCallback(
    async (request: AutoSaveRequest<TDraft>): Promise<TResult | undefined> => {
      if (!isSaveable(request.draft, request.draftKey)) {
        return undefined;
      }

      if (inFlightRef.current) {
        if (inFlightDraftKeyRef.current !== request.draftKey) {
          queuedRequestRef.current = request;
          setStatus('dirty');
          setHasPendingChanges(true);
        }
        return undefined;
      }

      inFlightRef.current = true;
      inFlightDraftKeyRef.current = request.draftKey;
      setStatus('syncing');
      setError(null);

      try {
        if (!isOnlineRef.current && (onOfflineSaveRef.current || onLocalSaveRef.current)) {
          await persistOfflineDraft(request);
          return undefined;
        }

        const result = await saveFnRef.current(request.draft);
        lastSavedDraftKeyRef.current = request.draftKey;
        if (lastLocalDraftKeyRef.current === request.draftKey) {
          lastLocalDraftKeyRef.current = null;
        }
        if (lastOfflineDraftKeyRef.current === request.draftKey) {
          lastOfflineDraftKeyRef.current = null;
        }

        if (request.revision === latestRevisionRef.current && request.draftKey === latestDraftKeyRef.current) {
          setLastResult(result);
          setStatus('synced');
          setHasPendingChanges(false);
          onSavedRef.current?.(result, request.draft);
        } else {
          setStatus('dirty');
          setHasPendingChanges(true);
        }

        return result;
      } catch (caughtError) {
        if (isConflictErrorRef.current(caughtError)) {
          conflictPausedRef.current = true;
          setError(caughtError);
          setStatus('conflict');
          setHasPendingChanges(false);
          onConflictRef.current?.(caughtError, request.draft);
          return undefined;
        }

        if ((isOfflineErrorRef.current(caughtError) || !isOnlineRef.current) && (onOfflineSaveRef.current || onLocalSaveRef.current)) {
          await persistOfflineDraft(request);
          return undefined;
        }

        setError(caughtError);
        setStatus('error');
        setHasPendingChanges(false);
        onErrorRef.current?.(caughtError, request.draft);
        return undefined;
      } finally {
        inFlightRef.current = false;
        inFlightDraftKeyRef.current = null;
        const queued = queuedRequestRef.current;
        queuedRequestRef.current = null;
        if (queued && !conflictPausedRef.current) {
          void executeRequest(queued);
        }
      }
    },
    [isSaveable, persistOfflineDraft],
  );

  const debouncerRef = useRef<AsyncDebouncer<(request: AutoSaveRequest<TDraft>) => Promise<TResult | undefined>> | null>(null);
  if (!debouncerRef.current) {
    debouncerRef.current = new AsyncDebouncer(executeRequest, {
      wait: debounceMs,
      throwOnError: false,
    });
  }

  useEffect(() => {
    debouncerRef.current?.setOptions({ wait: debounceMs, enabled });
  }, [debounceMs, enabled]);

  useEffect(() => {
    return () => {
      const pendingRequest = queuedRequestRef.current ?? latestRequestRef.current;
      if (
        pendingRequest &&
        pendingRequest.draftKey !== lastSavedDraftKeyRef.current &&
        pendingRequest.draftKey !== lastLocalDraftKeyRef.current &&
        pendingRequest.draftKey !== lastOfflineDraftKeyRef.current
      ) {
        void persistLocalDraft(pendingRequest, false);
      }
      debouncerRef.current?.cancel();
    };
  }, [persistLocalDraft]);

  const buildRequest = useCallback(
    (draft: TDraft, source: AutoSaveSource): AutoSaveRequest<TDraft> | null => {
      const draftKey = getDraftKeyRef.current(draft);
      if (!isSaveable(draft, draftKey)) {
        if (!conflictPausedRef.current && statusRef.current !== 'idle') {
          setStatus(lastSavedDraftKeyRef.current === draftKey ? 'synced' : lastOfflineDraftKeyRef.current === draftKey ? 'offline-queued' : 'idle');
        }
        return null;
      }
      latestDraftRef.current = draft;
      latestDraftKeyRef.current = draftKey;
      latestRevisionRef.current += 1;
      const request = {
        draft,
        draftKey,
        revision: latestRevisionRef.current,
        source,
      };
      latestRequestRef.current = request;
      return request;
    },
    [isSaveable],
  );

  const scheduleSave = useCallback(
    (draft: TDraft): boolean => {
      const request = buildRequest(draft, 'auto-save');
      if (!request) {
        // `isSaveable` lehnt aus mehreren Gründen ab. Wenn der einzige Grund die
        // gescheiterte `isValid`-Prüfung bei vorhandener Änderung ist, soll der
        // Hook trotzdem in den `dirty`-Status gehen (UX-Signal „Nicht
        // gespeichert"). Andere Ablehnungs-Gründe (disabled, conflict-paused,
        // unverändert) lassen den vorhandenen Status unangetastet.
        if (enabledRef.current && !conflictPausedRef.current && isValidRef.current && !isValidRef.current(draft) && (!hasChangesRef.current || hasChangesRef.current(draft))) {
          setStatus('dirty');
          setHasPendingChanges(true);
        }
        return false;
      }
      setStatus('debouncing');
      setHasPendingChanges(true);
      void persistLocalDraft(request, true);
      void debouncerRef.current?.maybeExecute(request);
      return true;
    },
    [buildRequest, persistLocalDraft],
  );

  const flushNow = useCallback(
    async (draft?: TDraft): Promise<TResult | undefined> => {
      const targetDraft = draft ?? latestDraftRef.current;
      if (targetDraft === undefined) return undefined;
      const request = buildRequest(targetDraft, 'manual-finalize');
      if (!request) return undefined;
      debouncerRef.current?.cancel();
      return executeRequest(request);
    },
    [buildRequest, executeRequest],
  );

  const cancel = useCallback(() => {
    debouncerRef.current?.cancel();
    queuedRequestRef.current = null;
    setHasPendingChanges(false);
    setStatus(lastOfflineDraftKeyRef.current ? 'offline-queued' : lastSavedDraftKeyRef.current ? 'synced' : 'idle');
  }, []);

  const resetSynced = useCallback((draft?: TDraft) => {
    const targetDraft = draft ?? latestDraftRef.current;
    lastSavedDraftKeyRef.current = targetDraft === undefined ? null : getDraftKeyRef.current(targetDraft);
    lastLocalDraftKeyRef.current = null;
    lastOfflineDraftKeyRef.current = null;
    conflictPausedRef.current = false;
    setError(null);
    setHasPendingChanges(false);
    setStatus(targetDraft === undefined ? 'idle' : 'synced');
  }, []);

  return {
    status,
    error,
    lastResult,
    hasPendingChanges,
    scheduleSave,
    flushNow,
    finalizeNow: flushNow,
    cancel,
    resetSynced,
  };
}
