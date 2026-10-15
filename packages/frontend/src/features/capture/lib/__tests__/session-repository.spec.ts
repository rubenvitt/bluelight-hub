import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createSession,
  deleteSession,
  loadAllSessions,
  loadSession,
  markStatus,
  saveSession,
  withAppendedPatient,
  withAppendedPendingEvent,
  withAttached,
  withFailureContext,
  withIncrementedSk,
} from '../session-repository';
import { __resetIndexedDbCaptureStorageForTests, createIndexedDbCaptureStorage } from '../indexeddb-capture-storage';
import { resetCaptureStorage } from '../standalone-storage';
import { __resetCryptoKeyCache, CAPTURE_DB_NAME } from '../crypto-key-store';
import type { PatientLocal } from '../../schemas/capture-session.schema';

const isoNow = '2026-05-22T12:00:00.000Z';

async function deleteCaptureDb(): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(CAPTURE_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

describe('session-repository', () => {
  beforeEach(() => {
    // Storage-Singleton resetten und IDB-Factory frisch verdrahten, da Tests
    // sich gegenseitig keine stale Connection vererben dürfen.
    resetCaptureStorage();
    __resetIndexedDbCaptureStorageForTests();
    __resetCryptoKeyCache();
    // import triggert side-effect-registry; aber wenn Cache leer, müssen wir
    // explizit erneut den IDB-Pfad registrieren:
    createIndexedDbCaptureStorage();
  });

  afterEach(async () => {
    resetCaptureStorage();
    __resetIndexedDbCaptureStorageForTests();
    __resetCryptoKeyCache();
    await deleteCaptureDb();
  });

  describe('createSession', () => {
    it('erzeugt eine Session mit Default-Schnellzähler und leeren Arrays', () => {
      const session = createSession({
        deviceId: 'dev_abcdefghijklmnopqrstuvwx',
        appVersion: '1.0.0',
        platform: 'browser',
        startedAt: isoNow,
      });
      expect(session.sessionId).toMatch(/^cs_[a-z0-9]{23,31}$/);
      expect(session.schemaVersion).toBe(1);
      expect(session.status).toBe('open');
      expect(session.schnellzaehler).toEqual({ SK_I: 0, SK_II: 0, SK_III: 0, SK_IV: 0, TOT: 0 });
      expect(session.patients).toEqual([]);
      expect(session.pendingEvents).toEqual([]);
      expect(session.startedAt).toBe(isoNow);
    });

    it('setzt startedAt auf aktuellen Zeitpunkt, wenn nicht übergeben', () => {
      const before = Date.now();
      const session = createSession({
        deviceId: 'dev_abcdefghijklmnopqrstuvwx',
        appVersion: '1.0.0',
        platform: 'browser',
      });
      const after = Date.now();
      const ts = new Date(session.startedAt).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });

  describe('CRUD-Roundtrip', () => {
    it('saveSession + loadSession liefern das Aggregat 1:1 zurück', async () => {
      const session = createSession({
        deviceId: 'dev_abcdefghijklmnopqrstuvwx',
        appVersion: '1.0.0',
        platform: 'browser',
        startedAt: isoNow,
      });
      await saveSession(session);
      expect(await loadSession(session.sessionId)).toEqual(session);
    });

    it('loadSession liefert null für unbekannte ID', async () => {
      expect(await loadSession('cs_unknownunknownunknownx')).toBeNull();
    });

    it('loadAllSessions liefert alle persistierten Sessions', async () => {
      const s1 = createSession({
        deviceId: 'dev_abcdefghijklmnopqrstuvwx',
        appVersion: '1.0.0',
        platform: 'browser',
      });
      const s2 = createSession({
        deviceId: 'dev_abcdefghijklmnopqrstuvwx',
        appVersion: '1.0.0',
        platform: 'browser',
      });
      await saveSession(s1);
      await saveSession(s2);
      const all = await loadAllSessions();
      expect(all.map((s) => s.sessionId).sort()).toEqual([s1.sessionId, s2.sessionId].sort());
    });

    it('deleteSession entfernt eine Session vollständig', async () => {
      const session = createSession({
        deviceId: 'dev_abcdefghijklmnopqrstuvwx',
        appVersion: '1.0.0',
        platform: 'browser',
      });
      await saveSession(session);
      await deleteSession(session.sessionId);
      expect(await loadSession(session.sessionId)).toBeNull();
    });

    it('markStatus ändert nur den Status, sonst nichts', async () => {
      const session = createSession({
        deviceId: 'dev_abcdefghijklmnopqrstuvwx',
        appVersion: '1.0.0',
        platform: 'browser',
        startedAt: isoNow,
      });
      await saveSession(session);
      const updated = await markStatus(session.sessionId, 'discarded');
      expect(updated?.status).toBe('discarded');
      const loaded = await loadSession(session.sessionId);
      expect(loaded).toEqual({ ...session, status: 'discarded' });
    });

    it('markStatus liefert null für unbekannte Session', async () => {
      expect(await markStatus('cs_unknownunknownunknownx', 'discarded')).toBeNull();
    });
  });

  describe('Mutations-Helper', () => {
    const base = createSession({
      deviceId: 'dev_abcdefghijklmnopqrstuvwx',
      appVersion: '1.0.0',
      platform: 'browser',
      startedAt: isoNow,
    });

    it('withIncrementedSk erhöht den Counter und fügt sichtung-Event hinzu', () => {
      const next = withIncrementedSk(base, 'SK_I', isoNow);
      expect(next.schnellzaehler.SK_I).toBe(1);
      expect(next.pendingEvents).toHaveLength(1);
      expect(next.pendingEvents[0]).toEqual({ type: 'sichtung', capturedAt: isoNow, sk: 'SK_I' });
    });

    it('withIncrementedSk akkumuliert mehrere Inkremente reihenfolge-erhaltend', () => {
      const after5 = ['SK_I', 'SK_I', 'SK_II', 'SK_I', 'SK_IV'].reduce((acc, sk, i) => withIncrementedSk(acc, sk as 'SK_I' | 'SK_II' | 'SK_IV', `2026-05-22T12:00:0${i}.000Z`), base);
      expect(after5.schnellzaehler).toEqual({ SK_I: 3, SK_II: 1, SK_III: 0, SK_IV: 1, TOT: 0 });
      expect(after5.pendingEvents).toHaveLength(5);
      expect(after5.pendingEvents.map((e) => e.capturedAt)).toEqual([
        '2026-05-22T12:00:00.000Z',
        '2026-05-22T12:00:01.000Z',
        '2026-05-22T12:00:02.000Z',
        '2026-05-22T12:00:03.000Z',
        '2026-05-22T12:00:04.000Z',
      ]);
    });

    it('withAppendedPatient hängt einen Patient an', () => {
      const patient: PatientLocal = {
        patientId: 'pl_abcdefghijklmnopqrstuvwx',
        sk: 'SK_II',
        capturedAt: isoNow,
        pendingEvents: [],
      };
      const next = withAppendedPatient(base, patient);
      expect(next.patients).toEqual([patient]);
    });

    it('withAppendedPendingEvent berührt andere Patienten in der Session nicht', () => {
      const patientA: PatientLocal = {
        patientId: 'pl_aaaaaaaaaaaaaaaaaaaaaaaa',
        sk: 'SK_I',
        capturedAt: isoNow,
        pendingEvents: [],
      };
      const patientB: PatientLocal = {
        patientId: 'pl_bbbbbbbbbbbbbbbbbbbbbbbb',
        sk: 'SK_II',
        capturedAt: isoNow,
        pendingEvents: [],
      };
      const seeded = withAppendedPatient(withAppendedPatient(base, patientA), patientB);
      const next = withAppendedPendingEvent(seeded, patientA.patientId, {
        type: 'observation',
        capturedAt: isoNow,
        data: { hr: 60 },
      });
      expect(next.patients[0]?.pendingEvents).toHaveLength(1);
      expect(next.patients[1]?.pendingEvents).toHaveLength(0);
    });

    it('withAppendedPendingEvent hängt ein Event an den Patienten an', () => {
      const patient: PatientLocal = {
        patientId: 'pl_abcdefghijklmnopqrstuvwx',
        sk: 'SK_II',
        capturedAt: isoNow,
        pendingEvents: [],
      };
      const sessionWithPatient = withAppendedPatient(base, patient);
      const next = withAppendedPendingEvent(sessionWithPatient, patient.patientId, {
        type: 'observation',
        capturedAt: isoNow,
        data: { hr: 80 },
      });
      expect(next.patients[0]?.pendingEvents).toHaveLength(1);
    });

    it('withAppendedPendingEvent wirft bei unbekannter patientId statt das Event still zu verwerfen', () => {
      expect(() =>
        withAppendedPendingEvent(base, 'pl_unbekanntunbekanntunbe', {
          type: 'observation',
          capturedAt: isoNow,
          data: { hr: 90 },
        }),
      ).toThrow(/unbekannt/);
    });

    it('withAttached setzt Status und attachedTo', () => {
      const next = withAttached(base, {
        einsatzId: 'einsatz-123',
        attachedAt: isoNow,
        attachedByUserId: 'user-1',
        backendPatientIds: {},
      });
      expect(next.status).toBe('attached');
      expect(next.attachedTo?.einsatzId).toBe('einsatz-123');
    });

    it('withFailureContext setzt Status auf failed', () => {
      const next = withFailureContext(base, {
        errorCode: 'NETWORK',
        lastTriedAt: isoNow,
        retryCount: 1,
      });
      expect(next.status).toBe('failed');
      expect(next.failureContext?.errorCode).toBe('NETWORK');
    });
  });
});
