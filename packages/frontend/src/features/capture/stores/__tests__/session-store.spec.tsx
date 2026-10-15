import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  __resetCaptureSessionsStoreForTests,
  appendPatient,
  bootstrapCaptureSessions,
  captureSessionsStore,
  discardSession,
  flushCapturePersist,
  incrementSk,
  markFailureContext,
  selectSession,
  startSession,
  useActiveCaptureSession,
  useCaptureSessions,
  useCaptureSessionsHydrated,
} from '../session-store';
import { saveSession } from '../../lib/session-repository';
import { __resetIndexedDbCaptureStorageForTests, createIndexedDbCaptureStorage } from '../../lib/indexeddb-capture-storage';
import { resetCaptureStorage } from '../../lib/standalone-storage';
import { __resetCryptoKeyCache, CAPTURE_DB_NAME } from '../../lib/crypto-key-store';
import type { CaptureSessionLocal, PatientLocal } from '../../schemas/capture-session.schema';

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

const isoNow = '2026-05-22T12:00:00.000Z';

describe('captureSessionsStore', () => {
  beforeEach(async () => {
    await fullReset();
  });

  afterEach(async () => {
    await fullReset();
  });

  describe('startSession', () => {
    it('legt eine neue Session an, persistiert und setzt sie aktiv', async () => {
      const id = await startSession({
        deviceId: 'dev_abcdefghijklmnopqrstuvwx',
        appVersion: '1.0.0',
        platform: 'browser',
        startedAt: isoNow,
      });
      await flushCapturePersist();
      expect(captureSessionsStore.state.sessions.has(id)).toBe(true);
      expect(captureSessionsStore.state.activeSessionId).toBe(id);
    });
  });

  describe('incrementSk', () => {
    it('aktualisiert Schnellzähler synchron im Store, persistiert im Hintergrund', async () => {
      const id = await startSession({
        deviceId: 'dev_abcdefghijklmnopqrstuvwx',
        appVersion: '1.0.0',
        platform: 'browser',
      });
      await flushCapturePersist();
      void incrementSk(id, 'SK_II', isoNow);
      // Synchron sichtbar:
      const sessionAfter = captureSessionsStore.state.sessions.get(id);
      expect(sessionAfter?.schnellzaehler.SK_II).toBe(1);
      expect(sessionAfter?.pendingEvents).toHaveLength(1);
      await flushCapturePersist();
    });
  });

  describe('bootstrapCaptureSessions', () => {
    it('hydriert offene Sessions, überspringt discarded', async () => {
      const open: CaptureSessionLocal = {
        sessionId: 'cs_aaaaaaaaaaaaaaaaaaaaaaaa',
        schemaVersion: 1,
        deviceId: 'dev_abcdefghijklmnopqrstuvwx',
        appVersion: '1.0.0',
        platform: 'browser',
        startedAt: isoNow,
        schnellzaehler: { SK_I: 0, SK_II: 0, SK_III: 0, SK_IV: 0, TOT: 0 },
        patients: [],
        pendingEvents: [],
        status: 'open',
      };
      const discarded: CaptureSessionLocal = { ...open, sessionId: 'cs_bbbbbbbbbbbbbbbbbbbbbbbb', status: 'discarded' };
      await saveSession(open);
      await saveSession(discarded);
      __resetCaptureSessionsStoreForTests();
      await bootstrapCaptureSessions();
      expect(captureSessionsStore.state.isHydrated).toBe(true);
      expect(captureSessionsStore.state.sessions.has(open.sessionId)).toBe(true);
      expect(captureSessionsStore.state.sessions.has(discarded.sessionId)).toBe(false);
    });
  });

  describe('appendPatient', () => {
    it('hängt einen Patienten an die aktive Session an', async () => {
      const id = await startSession({
        deviceId: 'dev_abcdefghijklmnopqrstuvwx',
        appVersion: '1.0.0',
        platform: 'browser',
      });
      await flushCapturePersist();
      const patient: PatientLocal = {
        patientId: 'pl_abcdefghijklmnopqrstuvwx',
        sk: 'SK_III',
        capturedAt: isoNow,
        pendingEvents: [],
      };
      await appendPatient(id, patient);
      expect(captureSessionsStore.state.sessions.get(id)?.patients).toEqual([patient]);
    });
  });

  describe('selectSession', () => {
    it('mutiert ausschließlich activeSessionId und nichts in Storage', async () => {
      const id = await startSession({
        deviceId: 'dev_abcdefghijklmnopqrstuvwx',
        appVersion: '1.0.0',
        platform: 'browser',
      });
      await flushCapturePersist();
      selectSession(null);
      expect(captureSessionsStore.state.activeSessionId).toBeNull();
      selectSession(id);
      expect(captureSessionsStore.state.activeSessionId).toBe(id);
    });
  });

  describe('markFailureContext', () => {
    it('setzt Status auf failed und persistiert failureContext', async () => {
      const id = await startSession({
        deviceId: 'dev_abcdefghijklmnopqrstuvwx',
        appVersion: '1.0.0',
        platform: 'browser',
      });
      await flushCapturePersist();
      await markFailureContext(id, { errorCode: 'NET_OFFLINE', lastTriedAt: isoNow, retryCount: 2 });
      const stored = captureSessionsStore.state.sessions.get(id);
      expect(stored?.status).toBe('failed');
      expect(stored?.failureContext?.errorCode).toBe('NET_OFFLINE');
    });
  });

  describe('discardSession', () => {
    it('markiert die Session als discarded und entfernt sie aus dem Store', async () => {
      const id = await startSession({
        deviceId: 'dev_abcdefghijklmnopqrstuvwx',
        appVersion: '1.0.0',
        platform: 'browser',
      });
      await flushCapturePersist();
      await discardSession(id);
      expect(captureSessionsStore.state.sessions.has(id)).toBe(false);
    });
  });

  describe('React-Hooks', () => {
    it('useCaptureSessions liefert aktuelle Sessions reaktiv', async () => {
      const { result } = renderHook(() => useCaptureSessions());
      expect(result.current).toHaveLength(0);
      await startSession({
        deviceId: 'dev_abcdefghijklmnopqrstuvwx',
        appVersion: '1.0.0',
        platform: 'browser',
      });
      await flushCapturePersist();
      expect(result.current).toHaveLength(1);
    });

    it('useActiveCaptureSession liefert die aktive Session', async () => {
      const { result } = renderHook(() => useActiveCaptureSession());
      expect(result.current).toBeNull();
      const id = await startSession({
        deviceId: 'dev_abcdefghijklmnopqrstuvwx',
        appVersion: '1.0.0',
        platform: 'browser',
      });
      await flushCapturePersist();
      expect(result.current?.sessionId).toBe(id);
    });

    it('useCaptureSessionsHydrated reflektiert Bootstrap-Status', async () => {
      const { result } = renderHook(() => useCaptureSessionsHydrated());
      expect(result.current).toBe(false);
      await bootstrapCaptureSessions();
      expect(result.current).toBe(true);
    });
  });
});
