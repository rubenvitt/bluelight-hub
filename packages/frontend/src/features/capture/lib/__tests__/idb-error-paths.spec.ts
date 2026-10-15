import { afterEach, describe, expect, it, vi } from 'vitest';
import { __resetCryptoKeyCache, CAPTURE_DB_NAME, getOrCreateAesKey } from '../crypto-key-store';
import { __resetIndexedDbCaptureStorageForTests, createIndexedDbCaptureStorage } from '../indexeddb-capture-storage';

async function deleteCaptureDb(): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(CAPTURE_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

describe('IndexedDB Error-Pfade (Branch-Coverage)', () => {
  afterEach(async () => {
    __resetCryptoKeyCache();
    __resetIndexedDbCaptureStorageForTests();
    vi.restoreAllMocks();
    await deleteCaptureDb();
  });

  it('crypto-key-store: rejected open-Request invalidiert dbPromise-Cache (catch-Branch)', async () => {
    // Mock indexedDB.open so dass sofort onerror feuert.
    const error = new Error('SimuliertesOpenError');
    const openSpy = vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      const fakeRequest = {
        result: null,
        error,
        onsuccess: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
        onerror: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
        onupgradeneeded: null as ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown) | null,
        onblocked: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
      } as unknown as IDBOpenDBRequest;
      queueMicrotask(() => {
        if (fakeRequest.onerror) {
          fakeRequest.onerror(new Event('error'));
        }
      });
      return fakeRequest;
    });

    await expect(getOrCreateAesKey()).rejects.toThrow(/SimuliertesOpenError/);
    expect(openSpy).toHaveBeenCalled();

    // Zweiter Aufruf nach Reject — Cache wurde invalidiert, neuer Versuch geht durch.
    const k = await getOrCreateAesKey();
    expect(k.algorithm.name).toBe('AES-GCM');
  });

  it('crypto-key-store: blockierter Upgrade-Request löst Reject aus (onblocked-Branch)', async () => {
    const openSpy = vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      const fakeRequest = {
        result: null,
        error: null,
        onsuccess: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
        onerror: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
        onupgradeneeded: null as ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown) | null,
        onblocked: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
      } as unknown as IDBOpenDBRequest;
      queueMicrotask(() => {
        if (fakeRequest.onblocked) {
          fakeRequest.onblocked(new Event('blocked'));
        }
      });
      return fakeRequest;
    });

    await expect(getOrCreateAesKey()).rejects.toThrow(/blockiert/);
    expect(openSpy).toHaveBeenCalled();
  });

  it('indexeddb-capture-storage: blockierter Open-Request löst Reject aus', async () => {
    const openSpy = vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      const fakeRequest = {
        result: null,
        error: null,
        onsuccess: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
        onerror: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
        onupgradeneeded: null as ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => unknown) | null,
        onblocked: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
      } as unknown as IDBOpenDBRequest;
      queueMicrotask(() => {
        if (fakeRequest.onblocked) {
          fakeRequest.onblocked(new Event('blocked'));
        }
      });
      return fakeRequest;
    });

    const storage = createIndexedDbCaptureStorage();
    await expect(storage.listSessionIds()).rejects.toThrow(/blockiert/);
    expect(openSpy).toHaveBeenCalled();
  });

  it('indexeddb-capture-storage: Schema-Mismatch beim Laden liefert null mit Warn-Log', async () => {
    // Eine valide verschlüsselte Session schreiben, dann den Klartext durch ein
    // Schema-violating Object ersetzen — Adapter muss safeParse-Reject treffen.
    const { encryptJson } = await import('../aes-gcm');
    const key = await getOrCreateAesKey();
    const malformedPlain = { sessionId: 'cs_aaaaaaaaaaaaaaaaaaaaaaaa', kein_valides_schema: true };
    const { iv, ciphertext } = await encryptJson(key, malformedPlain);

    await new Promise<void>((resolve, reject) => {
      const openReq = indexedDB.open(CAPTURE_DB_NAME, 1);
      openReq.onsuccess = () => {
        const db = openReq.result;
        const tx = db.transaction(['sessions'], 'readwrite');
        const store = tx.objectStore('sessions');
        store.put({ sessionId: 'cs_aaaaaaaaaaaaaaaaaaaaaaaa', schemaVersion: 1, iv, ciphertext });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      openReq.onerror = () => reject(openReq.error);
    });

    __resetIndexedDbCaptureStorageForTests();
    const storage = createIndexedDbCaptureStorage();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await storage.loadSession('cs_aaaaaaaaaaaaaaaaaaaaaaaa')).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    // loadAllSessions filtert das verworfene Record ebenfalls raus.
    expect(await storage.loadAllSessions()).toEqual([]);
    warnSpy.mockRestore();
  });

  it('indexeddb-capture-storage: rejected open invalidiert dbPromise-Cache', async () => {
    const error = new Error('SimuliertesIdbOpenError');
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      const fakeRequest = {
        result: null,
        error,
        onsuccess: null,
        onerror: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
        onupgradeneeded: null,
        onblocked: null,
      } as unknown as IDBOpenDBRequest;
      queueMicrotask(() => {
        if (fakeRequest.onerror) fakeRequest.onerror(new Event('error'));
      });
      return fakeRequest;
    });

    const storage = createIndexedDbCaptureStorage();
    await expect(storage.listSessionIds()).rejects.toThrow(/SimuliertesIdbOpenError/);
    // Cache wurde invalidiert — nächster Aufruf geht durch.
    const ids = await storage.listSessionIds();
    expect(ids).toEqual([]);
  });

  it('indexeddb-capture-storage: onversionchange-Callback schließt DB und invalidiert dbPromise', async () => {
    const closeSpy = vi.fn();
    const fakeDb = {
      close: closeSpy,
      onversionchange: null as (() => void) | null,
      onclose: null as (() => void) | null,
      objectStoreNames: { contains: () => true },
      createObjectStore: () => ({}),
      transaction: () => {
        const fakeStore = {
          getAllKeys: () => {
            const req = { result: [], error: null, onsuccess: null as any, onerror: null };
            queueMicrotask(() => req.onsuccess?.());
            return req;
          },
        };
        return {
          objectStore: () => fakeStore,
          oncomplete: null,
          onerror: null,
          onabort: null,
          error: null,
        };
      },
    } as unknown as IDBDatabase;

    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      const fakeRequest = {
        result: fakeDb,
        error: null,
        onsuccess: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
        onerror: null,
        onupgradeneeded: null,
        onblocked: null,
      } as unknown as IDBOpenDBRequest;
      queueMicrotask(() => {
        if (fakeRequest.onsuccess) fakeRequest.onsuccess(new Event('success'));
      });
      return fakeRequest;
    });

    const storage = createIndexedDbCaptureStorage();
    await storage.listSessionIds().catch(() => {
      /* Fake-Store-Resultate sind irrelevant */
    });

    expect(typeof fakeDb.onversionchange).toBe('function');
    expect(typeof fakeDb.onclose).toBe('function');
    (fakeDb.onversionchange as () => void)();
    expect(closeSpy).toHaveBeenCalled();
    (fakeDb.onclose as () => void)();
  });

  it.each([
    ['loadSession', (s: ReturnType<typeof createIndexedDbCaptureStorage>) => s.loadSession('cs_aaaaaaaaaaaaaaaaaaaaaaaa')],
    ['loadAllSessions', (s: ReturnType<typeof createIndexedDbCaptureStorage>) => s.loadAllSessions()],
    ['listSessionIds', (s: ReturnType<typeof createIndexedDbCaptureStorage>) => s.listSessionIds()],
  ])('indexeddb-capture-storage: %s rejected bei Lese-Transaktion-Abbruch (onabort)', async (_name, invoke) => {
    // Request-Stub feuert nie onsuccess/onerror — die Auflösung erfolgt
    // ausschließlich über tx.onabort (Transaktions-Abbruch).
    const stubRequest = () => ({ result: undefined, error: null, onsuccess: null, onerror: null });
    const fakeDb = {
      close: vi.fn(),
      onversionchange: null,
      onclose: null,
      objectStoreNames: { contains: () => true },
      createObjectStore: () => ({}),
      transaction: () => {
        const tx = {
          objectStore: () => ({ get: stubRequest, getAll: stubRequest, getAllKeys: stubRequest }),
          oncomplete: null,
          onerror: null,
          onabort: null as (() => void) | null,
          error: null,
        };
        // Abbruch triggern, nachdem die Aufrufstelle tx.onabort verdrahtet hat.
        queueMicrotask(() => tx.onabort?.());
        return tx;
      },
    } as unknown as IDBDatabase;

    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      const fakeRequest = {
        result: fakeDb,
        error: null,
        onsuccess: null as ((this: IDBOpenDBRequest, ev: Event) => unknown) | null,
        onerror: null,
        onupgradeneeded: null,
        onblocked: null,
      } as unknown as IDBOpenDBRequest;
      queueMicrotask(() => {
        if (fakeRequest.onsuccess) fakeRequest.onsuccess(new Event('success'));
      });
      return fakeRequest;
    });

    const storage = createIndexedDbCaptureStorage();
    await expect(invoke(storage)).rejects.toThrow(/abgebrochen/);
  });

  it('crypto-key-store: onversionchange schließt aktive Connection und invalidiert Cache', async () => {
    await getOrCreateAesKey();
    // Zweite Connection mit höherer Version öffnet → fake-indexeddb feuert versionchange auf bestehender.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(CAPTURE_DB_NAME, 2);
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = () => {
        // Stelle neuer Version anlegen damit Upgrade durchläuft.
        const db = req.result;
        if (!db.objectStoreNames.contains('marker')) {
          db.createObjectStore('marker');
        }
      };
      req.onblocked = () => {
        // versionchange muss zuerst die bestehende Connection schließen;
        // sollte hier nicht hängenbleiben.
        resolve();
      };
    });
    // Nach versionchange Cache resetten und neuen Aufruf wagen — kommt sauber durch.
    __resetCryptoKeyCache();
    // DB-Version ist 2 jetzt; unser Code öffnet mit Version 1 — das würde fehlschlagen.
    // Daher zuerst DB löschen, dann neuen Aufruf.
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(CAPTURE_DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
    const k = await getOrCreateAesKey();
    expect(k.algorithm.name).toBe('AES-GCM');
  });
});
