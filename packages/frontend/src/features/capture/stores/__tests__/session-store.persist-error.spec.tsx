import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  __resetCaptureSessionsStoreForTests,
  bootstrapCaptureSessions,
  captureSessionsStore,
  discardSession,
  flushCapturePersist,
  incrementSk,
  startSession,
  useCapturePersistError,
} from '../session-store';
import { __registerIndexedDbCaptureStorageFactory, resetCaptureStorage, type ICaptureStorage } from '../../lib/standalone-storage';
import { __resetIndexedDbCaptureStorageForTests, createIndexedDbCaptureStorage } from '../../lib/indexeddb-capture-storage';
import { __resetCryptoKeyCache, CAPTURE_DB_NAME } from '../../lib/crypto-key-store';
import type { CaptureSessionLocal } from '../../schemas/capture-session.schema';

const isoNow = '2026-05-22T12:00:00.000Z';
const DEVICE_ID = 'dev_abcdefghijklmnopqrstuvwx';

async function deleteCaptureDb(): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(CAPTURE_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

async function fullReset(): Promise<void> {
  __resetCaptureSessionsStoreForTests();
  resetCaptureStorage();
  __resetIndexedDbCaptureStorageForTests();
  __resetCryptoKeyCache();
  await deleteCaptureDb();
  // Standardpfad wiederherstellen, damit andere Suites unbeeinflusst bleiben.
  createIndexedDbCaptureStorage();
}

/**
 * Hängt einen vollständig kontrollierbaren Storage-Adapter ein. `resetCaptureStorage`
 * verwirft den gecachten Adapter, sodass `getCaptureStorage()` die hier
 * registrierte Factory nutzt.
 */
function installStorage(overrides: Partial<ICaptureStorage>): void {
  const storage: ICaptureStorage = {
    saveSession: async () => {},
    loadSession: async () => null,
    loadAllSessions: async () => [],
    deleteSession: async () => {},
    listSessionIds: async () => [],
    ...overrides,
  };
  __registerIndexedDbCaptureStorageFactory(() => storage);
  resetCaptureStorage();
}

describe('session-store Persist-Fehler-Surfacing (D1/D2/AC7)', () => {
  beforeEach(async () => {
    await fullReset();
  });

  afterEach(async () => {
    await fullReset();
  });

  it('setzt persistErrors bei fehlgeschlagenem saveSession und löscht sie bei erfolgreichem Re-Persist', async () => {
    let shouldFail = true;
    installStorage({
      saveSession: async () => {
        if (shouldFail) throw new Error('disk full');
      },
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const id = await startSession({ deviceId: DEVICE_ID, appVersion: '1.0.0', platform: 'browser' });
    await flushCapturePersist();

    // Session bleibt im Memory, aber der Fehler ist beobachtbar (nicht verschluckt).
    expect(captureSessionsStore.state.sessions.has(id)).toBe(true);
    expect(captureSessionsStore.state.persistErrors.get(id)).toMatch(/disk full/);

    // Erfolgreicher Re-Persist löscht den Fehler wieder.
    shouldFail = false;
    await incrementSk(id, 'SK_I', isoNow);
    await flushCapturePersist();
    expect(captureSessionsStore.state.persistErrors.has(id)).toBe(false);

    errSpy.mockRestore();
  });

  it('discardSession behält die Session im Memory, wenn der discarded-Persist fehlschlägt', async () => {
    installStorage({
      saveSession: async (session: CaptureSessionLocal) => {
        if (session.status === 'discarded') throw new Error('discard persist failed');
      },
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const id = await startSession({ deviceId: DEVICE_ID, appVersion: '1.0.0', platform: 'browser' });
    await flushCapturePersist();
    expect(captureSessionsStore.state.sessions.has(id)).toBe(true);

    await discardSession(id);
    // Persist des `discarded`-Status schlug fehl → Session NICHT aus Memory
    // entfernen (sonst Wiederauferstehung beim nächsten Bootstrap).
    expect(captureSessionsStore.state.sessions.has(id)).toBe(true);
    expect(captureSessionsStore.state.persistErrors.has(id)).toBe(true);

    errSpy.mockRestore();
  });

  it('discardSession entfernt die Session bei erfolgreichem Persist', async () => {
    installStorage({});
    const id = await startSession({ deviceId: DEVICE_ID, appVersion: '1.0.0', platform: 'browser' });
    await flushCapturePersist();

    await discardSession(id);
    expect(captureSessionsStore.state.sessions.has(id)).toBe(false);
    expect(captureSessionsStore.state.persistErrors.has(id)).toBe(false);
  });
});

describe('bootstrapCaptureSessions Guard + Recovery (P5)', () => {
  beforeEach(async () => {
    await fullReset();
  });

  afterEach(async () => {
    await fullReset();
  });

  it('dedupliziert konkurrierende Bootstrap-Aufrufe (lädt nur einmal)', async () => {
    let loadCount = 0;
    installStorage({
      loadAllSessions: async () => {
        loadCount += 1;
        return [];
      },
    });
    __resetCaptureSessionsStoreForTests();

    await Promise.all([bootstrapCaptureSessions(), bootstrapCaptureSessions()]);

    expect(loadCount).toBe(1);
    expect(captureSessionsStore.state.isHydrated).toBe(true);
  });

  it('lässt isHydrated false bei Hydrations-Fehler und erlaubt einen Retry', async () => {
    let failNext = true;
    installStorage({
      loadAllSessions: async () => {
        if (failNext) {
          failNext = false;
          throw new Error('db blocked');
        }
        return [];
      },
    });
    __resetCaptureSessionsStoreForTests();

    await expect(bootstrapCaptureSessions()).rejects.toThrow(/db blocked/);
    expect(captureSessionsStore.state.isHydrated).toBe(false);

    // In-Flight-Cache wurde nach dem Fehler geleert → Retry möglich.
    await bootstrapCaptureSessions();
    expect(captureSessionsStore.state.isHydrated).toBe(true);
  });
});

describe('useCapturePersistError', () => {
  beforeEach(async () => {
    await fullReset();
  });

  afterEach(async () => {
    await fullReset();
  });

  it('liefert null ohne Fehler und die Meldung, sobald ein Persist fehlschlägt', async () => {
    installStorage({
      saveSession: async () => {
        throw new Error('quota exceeded');
      },
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const id = await startSession({ deviceId: DEVICE_ID, appVersion: '1.0.0', platform: 'browser' });
    const { result } = renderHook(() => useCapturePersistError(id));
    await flushCapturePersist();

    expect(result.current).toMatch(/quota exceeded/);

    errSpy.mockRestore();
  });
});
