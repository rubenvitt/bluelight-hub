import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetCaptureSessionsStoreForTests, bootstrapCaptureSessions, captureSessionsStore, flushCapturePersist, incrementSk, startSession } from '../stores/session-store';
import { loadSession } from '../lib/session-repository';
import { __resetIndexedDbCaptureStorageForTests, createIndexedDbCaptureStorage } from '../lib/indexeddb-capture-storage';
import { resetCaptureStorage } from '../lib/standalone-storage';
import { __resetCryptoKeyCache, CAPTURE_DB_NAME } from '../lib/crypto-key-store';

const PERSIST_BUDGET_MS = 200; // UX-DR23-Stress

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
  createIndexedDbCaptureStorage();
}

describe('Counter-Stress (AC5, UX-DR23)', () => {
  beforeEach(async () => {
    await fullReset();
  });

  afterEach(async () => {
    await fullReset();
  });

  it('5 Inkremente in 5 s landen vollständig in pendingEvents (Store + Storage)', async () => {
    const id = await startSession({
      deviceId: 'dev_abcdefghijklmnopqrstuvwx',
      appVersion: '1.0.0',
      platform: 'browser',
    });
    await flushCapturePersist();

    const timestamps = ['2026-05-22T12:00:00.000Z', '2026-05-22T12:00:01.000Z', '2026-05-22T12:00:02.000Z', '2026-05-22T12:00:03.000Z', '2026-05-22T12:00:04.000Z'];

    // 5 Inkremente synchron ohne await (Race-Simulation).
    const persistPromises: Promise<void>[] = [];
    const perTapDurations: number[] = [];
    for (const ts of timestamps) {
      const start = performance.now();
      persistPromises.push(incrementSk(id, 'SK_I', ts));
      const elapsed = performance.now() - start;
      perTapDurations.push(elapsed);
    }

    // Render-Pfad muss synchron sein (NFR-P3 ≤ 100 ms). Tap-Schreibvorgang ist Memory-only.
    for (const duration of perTapDurations) {
      expect(duration).toBeLessThan(100);
    }

    // Store enthält alle 5 Events synchron.
    const storeSession = captureSessionsStore.state.sessions.get(id);
    expect(storeSession?.pendingEvents).toHaveLength(5);
    expect(storeSession?.schnellzaehler.SK_I).toBe(5);

    // Persist innerhalb des UX-DR23-Budgets (≤ 200 ms).
    const persistStart = performance.now();
    await Promise.all(persistPromises);
    await flushCapturePersist();
    const persistElapsed = performance.now() - persistStart;
    expect(persistElapsed).toBeLessThan(PERSIST_BUDGET_MS);

    // Storage enthält ebenfalls alle 5 Events.
    const persisted = await loadSession(id);
    expect(persisted?.pendingEvents).toHaveLength(5);
    expect(persisted?.schnellzaehler.SK_I).toBe(5);
    expect(persisted?.pendingEvents.map((e) => e.capturedAt)).toEqual(timestamps);
  });
});

describe('Crash-Recovery (AC7)', () => {
  beforeEach(async () => {
    await fullReset();
  });

  afterEach(async () => {
    await fullReset();
  });

  it('Increment → Adapter-Reset (Crash-Simulation) → Bootstrap → Store enthält das Increment', async () => {
    const id = await startSession({
      deviceId: 'dev_abcdefghijklmnopqrstuvwx',
      appVersion: '1.0.0',
      platform: 'browser',
    });
    await incrementSk(id, 'SK_II', '2026-05-22T12:00:00.000Z');
    await flushCapturePersist();

    // Crash-Simulation: Store + Adapter-Singleton resetten — Krypto-Cache und DB-Connection bleiben (Disk-Persistenz übersteht das).
    __resetCaptureSessionsStoreForTests();
    resetCaptureStorage();
    __resetIndexedDbCaptureStorageForTests();
    __resetCryptoKeyCache();
    createIndexedDbCaptureStorage();

    await bootstrapCaptureSessions();

    const recovered = captureSessionsStore.state.sessions.get(id);
    expect(recovered).toBeDefined();
    expect(recovered?.schnellzaehler.SK_II).toBe(1);
    expect(recovered?.pendingEvents).toHaveLength(1);
    expect(recovered?.pendingEvents[0]).toMatchObject({ type: 'sichtung', sk: 'SK_II' });
  });
});
