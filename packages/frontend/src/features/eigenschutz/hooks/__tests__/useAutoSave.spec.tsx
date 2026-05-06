import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GefaehrdungsbeurteilungConflictError } from '../../api/queries';
import { useAutoSave } from '../useAutoSave';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useAutoSave (Story 2.5)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('debounced drei Änderungen innerhalb von 2 Sekunden zu genau einem Save mit letztem Draft', async () => {
    const saveFn = vi.fn().mockResolvedValue({ version: 2 });
    const { result } = renderHook(() =>
      useAutoSave({
        entityId: 'gb-1',
        entityType: 'gefaehrdungsbeurteilung',
        saveFn,
        debounceMs: 2000,
      }),
    );

    act(() => {
      result.current.scheduleSave({ title: 'A' });
      result.current.scheduleSave({ title: 'AB' });
      result.current.scheduleSave({ title: 'ABC' });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999);
    });
    expect(saveFn).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(saveFn).toHaveBeenCalledWith({ title: 'ABC' });
    expect(result.current.status).toBe('synced');
  });

  it('finalizeNow beendet offenen Debounce sofort und erzeugt keinen zweiten identischen Save', async () => {
    const saveFn = vi.fn().mockResolvedValue({ version: 2 });
    const { result } = renderHook(() =>
      useAutoSave({
        entityId: 'gb-1',
        entityType: 'gefaehrdungsbeurteilung',
        saveFn,
        debounceMs: 2000,
      }),
    );

    await act(async () => {
      result.current.scheduleSave({ title: 'A' });
      await result.current.finalizeNow();
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(saveFn).toHaveBeenCalledWith({ title: 'A' });
    expect(result.current.status).toBe('synced');
  });

  it('blockiert Server-Save bei invalidem Draft, signalisiert aber `dirty` als UX-Hinweis (AC7)', () => {
    const saveFn = vi.fn().mockResolvedValue({ version: 2 });
    const { result } = renderHook(() =>
      useAutoSave({
        entityId: 'gb-1',
        entityType: 'gefaehrdungsbeurteilung',
        saveFn,
        debounceMs: 2000,
        isValid: (draft: { title: string }) => draft.title.trim().length > 0,
      }),
    );

    act(() => {
      result.current.scheduleSave({ title: '   ' });
    });

    // Spec-Wechsel Story 4.2 / AC7: Statt stumm bei `idle` zu bleiben, geht
    // der Hook bei der einzigen Ablehnungs-Ursache `isValid=false` jetzt
    // in `dirty` — das Badge muss „Nicht gespeichert" anzeigen, damit der
    // User den Validierungs-Fehler sieht.
    expect(saveFn).not.toHaveBeenCalled();
    expect(result.current.status).toBe('dirty');
    expect(result.current.hasPendingChanges).toBe(true);
  });

  it('ignoriert ältere Serverantworten für onSaved, wenn während in-flight ein neuer Draft entsteht', async () => {
    const first = deferred<{ version: number }>();
    const saveFn = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce({ version: 3 });
    const onSaved = vi.fn();
    const { result } = renderHook(() =>
      useAutoSave({
        entityId: 'gb-1',
        entityType: 'gefaehrdungsbeurteilung',
        saveFn,
        debounceMs: 2000,
        onSaved,
      }),
    );

    let firstFlush: Promise<unknown> | undefined;
    act(() => {
      result.current.scheduleSave({ title: 'alt' });
      firstFlush = result.current.flushNow();
    });
    expect(saveFn).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.scheduleSave({ title: 'neu' });
    });
    first.resolve({ version: 2 });

    await act(async () => {
      await firstFlush;
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(saveFn).toHaveBeenCalledTimes(2);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith({ version: 3 }, { title: 'neu' });
  });

  it('setzt Konfliktstatus und pausiert weitere Auto-Saves nach 409', async () => {
    const conflict = new GefaehrdungsbeurteilungConflictError(4, 3, {
      response: { status: 409 },
    });
    const saveFn = vi.fn().mockRejectedValue(conflict);
    const { result } = renderHook(() =>
      useAutoSave({
        entityId: 'gb-1',
        entityType: 'gefaehrdungsbeurteilung',
        saveFn,
        debounceMs: 2000,
      }),
    );

    await act(async () => {
      result.current.scheduleSave({ title: 'A' });
      await result.current.flushNow();
    });

    expect(result.current.status).toBe('conflict');

    act(() => {
      result.current.scheduleSave({ title: 'B' });
    });
    expect(saveFn).toHaveBeenCalledTimes(1);
  });

  it('lässt einen späten lokalen Snapshot keinen abgeschlossenen Server-Save überschreiben', async () => {
    const localSave = deferred<void>();
    const saveFn = vi.fn().mockResolvedValue({ version: 2 });
    const onLocalSave = vi.fn().mockReturnValue(localSave.promise);
    const { result } = renderHook(() =>
      useAutoSave({
        entityId: 'gb-1',
        entityType: 'gefaehrdungsbeurteilung',
        saveFn,
        debounceMs: 2000,
        onLocalSave,
      }),
    );

    await act(async () => {
      result.current.scheduleSave({ title: 'A' });
      await result.current.flushNow();
    });
    expect(result.current.status).toBe('synced');

    await act(async () => {
      localSave.resolve();
      await localSave.promise;
    });

    expect(result.current.status).toBe('synced');
  });

  it('hält offline gequeueute Drafts im offline-queued Status statt auf synced zu kippen', async () => {
    const saveFn = vi.fn().mockResolvedValue({ version: 2 });
    const onOfflineSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useAutoSave({
        entityId: 'gb-1',
        entityType: 'gefaehrdungsbeurteilung',
        saveFn,
        debounceMs: 2000,
        isOnline: false,
        onOfflineSave,
      }),
    );

    await act(async () => {
      result.current.scheduleSave({ title: 'offline' });
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(saveFn).not.toHaveBeenCalled();
    expect(onOfflineSave).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('offline-queued');

    act(() => {
      result.current.scheduleSave({ title: 'offline' });
    });

    expect(result.current.status).toBe('offline-queued');
    expect(onOfflineSave).toHaveBeenCalledTimes(1);
  });

  it('setzt Offline-Persistenzfehler sauber auf error ohne erneuten Offline-Save', async () => {
    const storageError = new Error('quota exceeded');
    const saveFn = vi.fn().mockResolvedValue({ version: 2 });
    const onError = vi.fn();
    const onOfflineSave = vi.fn().mockRejectedValue(storageError);
    const draft = { title: 'offline' };
    const { result } = renderHook(() =>
      useAutoSave({
        entityId: 'gb-1',
        entityType: 'gefaehrdungsbeurteilung',
        saveFn,
        debounceMs: 2000,
        isOnline: false,
        onError,
        onOfflineSave,
      }),
    );

    await act(async () => {
      result.current.scheduleSave(draft);
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(onOfflineSave).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(storageError);
    expect(result.current.hasPendingChanges).toBe(true);
    expect(onError).toHaveBeenCalledWith(storageError, draft);
  });

  it('persistiert einen geplanten Debounce-Draft lokal, bevor der Timer feuert', async () => {
    const saveFn = vi.fn().mockResolvedValue({ version: 2 });
    const onLocalSave = vi.fn().mockResolvedValue(undefined);
    const draft = { title: 'lokal' };
    const { result, unmount } = renderHook(() =>
      useAutoSave({
        entityId: 'gb-1',
        entityType: 'gefaehrdungsbeurteilung',
        saveFn,
        debounceMs: 2000,
        onLocalSave,
      }),
    );

    await act(async () => {
      result.current.scheduleSave(draft);
    });
    unmount();

    expect(onLocalSave).toHaveBeenCalledWith(draft, 'auto-save');
    expect(saveFn).not.toHaveBeenCalled();
  });
});
