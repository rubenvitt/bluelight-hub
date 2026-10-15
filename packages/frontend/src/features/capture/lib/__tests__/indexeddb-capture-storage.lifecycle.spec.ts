import { afterEach, describe, expect, it } from 'vitest';
import { __resetIndexedDbCaptureStorageForTests, createIndexedDbCaptureStorage } from '../indexeddb-capture-storage';
import { __resetCryptoKeyCache, CAPTURE_DB_NAME, getOrCreateAesKey } from '../crypto-key-store';

async function deleteCaptureDb(): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(CAPTURE_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

describe('IndexedDbCaptureStorage Lifecycle', () => {
  afterEach(async () => {
    __resetIndexedDbCaptureStorageForTests();
    __resetCryptoKeyCache();
    await deleteCaptureDb();
  });

  it('__resetIndexedDbCaptureStorageForTests ist idempotent bei leerem Cache', () => {
    expect(() => __resetIndexedDbCaptureStorageForTests()).not.toThrow();
    expect(() => __resetIndexedDbCaptureStorageForTests()).not.toThrow();
  });

  it('listSessionIds liefert leeres Array, wenn keine Sessions gespeichert sind', async () => {
    const storage = createIndexedDbCaptureStorage();
    expect(await storage.listSessionIds()).toEqual([]);
  });

  it('loadAllSessions liefert leeres Array, wenn keine Sessions gespeichert sind', async () => {
    const storage = createIndexedDbCaptureStorage();
    expect(await storage.loadAllSessions()).toEqual([]);
  });

  it('__resetCryptoKeyCache ist idempotent bei leerem Cache', () => {
    expect(() => __resetCryptoKeyCache()).not.toThrow();
  });

  it('getOrCreateAesKey ist idempotent bei zweitem Aufruf (Modul-Cache)', async () => {
    const k1 = await getOrCreateAesKey();
    const k2 = await getOrCreateAesKey();
    expect(k1).toBe(k2);
  });
});
