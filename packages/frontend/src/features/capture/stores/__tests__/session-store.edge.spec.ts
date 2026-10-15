import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetCaptureSessionsStoreForTests, appendPatient, appendPendingEventForPatient, captureSessionsStore, flushCapturePersist, incrementSk, startSession } from '../session-store';
import { __resetIndexedDbCaptureStorageForTests, createIndexedDbCaptureStorage } from '../../lib/indexeddb-capture-storage';
import { resetCaptureStorage } from '../../lib/standalone-storage';
import { __resetCryptoKeyCache, CAPTURE_DB_NAME } from '../../lib/crypto-key-store';
import type { PatientLocal } from '../../schemas/capture-session.schema';

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

describe('session-store Edge-Cases', () => {
  beforeEach(async () => {
    await fullReset();
  });

  afterEach(async () => {
    await fullReset();
  });

  it('appendPendingEventForPatient fügt Event an den richtigen Patienten an', async () => {
    const id = await startSession({
      deviceId: 'dev_abcdefghijklmnopqrstuvwx',
      appVersion: '1.0.0',
      platform: 'browser',
    });
    await flushCapturePersist();
    const patient: PatientLocal = {
      patientId: 'pl_abcdefghijklmnopqrstuvwx',
      sk: 'SK_I',
      capturedAt: isoNow,
      pendingEvents: [],
    };
    await appendPatient(id, patient);
    await appendPendingEventForPatient(id, patient.patientId, {
      type: 'observation',
      capturedAt: isoNow,
      data: { hr: 72 },
    });
    const session = captureSessionsStore.state.sessions.get(id);
    expect(session?.patients[0]?.pendingEvents).toHaveLength(1);
  });

  it('incrementSk wirft, wenn die Session unbekannt ist', () => {
    expect(() => incrementSk('cs_unknownunknownunknownx', 'SK_I', isoNow)).toThrow(/unbekannt/);
  });

  it('appendPatient wirft, wenn die Session unbekannt ist', () => {
    const patient: PatientLocal = {
      patientId: 'pl_abcdefghijklmnopqrstuvwx',
      sk: 'SK_I',
      capturedAt: isoNow,
      pendingEvents: [],
    };
    expect(() => appendPatient('cs_unknownunknownunknownx', patient)).toThrow(/unbekannt/);
  });

  it('incrementSk nutzt Default-Timestamp, wenn keiner übergeben wird', async () => {
    const id = await startSession({
      deviceId: 'dev_abcdefghijklmnopqrstuvwx',
      appVersion: '1.0.0',
      platform: 'browser',
    });
    await flushCapturePersist();
    const before = Date.now();
    await incrementSk(id, 'SK_III');
    const after = Date.now();
    const event = captureSessionsStore.state.sessions.get(id)?.pendingEvents[0];
    expect(event?.type).toBe('sichtung');
    const ts = new Date(event!.capturedAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after + 100);
  });
});
