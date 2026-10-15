import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CaptureSessionLocal } from '../../schemas/capture-session.schema';
import { __resetIndexedDbCaptureStorageForTests, createIndexedDbCaptureStorage } from '../indexeddb-capture-storage';
import { CAPTURE_DB_NAME, CAPTURE_SESSIONS_STORE, __resetCryptoKeyCache } from '../crypto-key-store';

const isoNow = '2026-05-22T12:00:00.000Z';

function makeSession(overrides: Partial<CaptureSessionLocal> = {}): CaptureSessionLocal {
  return {
    sessionId: 'cs_abcdefghijklmnopqrstuvwx',
    schemaVersion: 1,
    deviceId: 'dev_abcdefghijklmnopqrstuvwx',
    appVersion: '1.0.0',
    platform: 'browser',
    startedAt: isoNow,
    schnellzaehler: { SK_I: 0, SK_II: 0, SK_III: 0, SK_IV: 0, TOT: 0 },
    patients: [],
    pendingEvents: [],
    status: 'open',
    ...overrides,
  };
}

async function deleteCaptureDb(): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(CAPTURE_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

describe('IndexedDbCaptureStorage', () => {
  afterEach(async () => {
    __resetIndexedDbCaptureStorageForTests();
    __resetCryptoKeyCache();
    await deleteCaptureDb();
  });

  it('persistiert eine Session verschlüsselt und lädt sie 1:1 zurück', async () => {
    const storage = createIndexedDbCaptureStorage();
    const session = makeSession();
    await storage.saveSession(session);
    expect(await storage.loadSession(session.sessionId)).toEqual(session);
  });

  it('liefert null für unbekannte Session-ID', async () => {
    const storage = createIndexedDbCaptureStorage();
    expect(await storage.loadSession('cs_unknownunknownunknownx')).toBeNull();
  });

  it('lädt mehrere Sessions in loadAllSessions', async () => {
    const storage = createIndexedDbCaptureStorage();
    const s1 = makeSession({ sessionId: 'cs_aaaaaaaaaaaaaaaaaaaaaaaa' });
    const s2 = makeSession({ sessionId: 'cs_bbbbbbbbbbbbbbbbbbbbbbbb' });
    await storage.saveSession(s1);
    await storage.saveSession(s2);
    const all = await storage.loadAllSessions();
    expect(all.map((s) => s.sessionId).sort()).toEqual([s1.sessionId, s2.sessionId].sort());
  });

  it('listSessionIds gibt alle persistierten Session-IDs zurück', async () => {
    const storage = createIndexedDbCaptureStorage();
    await storage.saveSession(makeSession({ sessionId: 'cs_aaaaaaaaaaaaaaaaaaaaaaaa' }));
    await storage.saveSession(makeSession({ sessionId: 'cs_bbbbbbbbbbbbbbbbbbbbbbbb' }));
    const ids = await storage.listSessionIds();
    expect(ids.sort()).toEqual(['cs_aaaaaaaaaaaaaaaaaaaaaaaa', 'cs_bbbbbbbbbbbbbbbbbbbbbbbb']);
  });

  it('deleteSession entfernt die Session vollständig', async () => {
    const storage = createIndexedDbCaptureStorage();
    const session = makeSession();
    await storage.saveSession(session);
    await storage.deleteSession(session.sessionId);
    expect(await storage.loadSession(session.sessionId)).toBeNull();
  });

  it('liefert null bei manipuliertem Ciphertext (Tampering-Detection)', async () => {
    const storage = createIndexedDbCaptureStorage();
    const session = makeSession();
    await storage.saveSession(session);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Direktzugriff auf IndexedDB: ein Byte im Ciphertext flippen.
    await new Promise<void>((resolve, reject) => {
      const openReq = indexedDB.open(CAPTURE_DB_NAME);
      openReq.onsuccess = () => {
        const db = openReq.result;
        const tx = db.transaction([CAPTURE_SESSIONS_STORE], 'readwrite');
        const store = tx.objectStore(CAPTURE_SESSIONS_STORE);
        const getReq = store.get(session.sessionId);
        getReq.onsuccess = () => {
          const record = getReq.result as {
            sessionId: string;
            schemaVersion: 1;
            iv: Uint8Array;
            ciphertext: ArrayBuffer;
          };
          const tampered = new Uint8Array(record.ciphertext.slice(0));
          tampered[0] = tampered[0] ^ 0xff;
          const putReq = store.put({ ...record, ciphertext: tampered.buffer });
          putReq.onsuccess = () => {
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
          putReq.onerror = () => reject(putReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
      };
      openReq.onerror = () => reject(openReq.error);
    });

    // Cache resetten, damit der Storage nicht über stale Connection liest.
    __resetIndexedDbCaptureStorageForTests();
    const storageAfter = createIndexedDbCaptureStorage();
    expect(await storageAfter.loadSession(session.sessionId)).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('saveSession-Promise ist vor dem nächsten requestAnimationFrame-Callback aufgelöst (AC2-Persist-Timing)', async () => {
    const storage = createIndexedDbCaptureStorage();
    const session = makeSession();

    // AC2: Der Persist muss vor dem nächsten Render-Tick (rAF-Callback) aufgelöst
    // sein. Wir reihen Persist und einen frisch geplanten rAF-Callback ein und
    // prüfen die Reihenfolge ihrer Auflösung statt nur "irgendwann fertig".
    const order: string[] = [];
    const rafDone = new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        order.push('raf');
        resolve();
      });
    });
    const persistDone = storage.saveSession(session).then(() => {
      order.push('persist');
    });

    await Promise.all([persistDone, rafDone]);
    expect(order[0]).toBe('persist');
    expect(await storage.loadSession(session.sessionId)).toEqual(session);
  });
});
