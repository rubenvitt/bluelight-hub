import { afterEach, describe, expect, it, vi } from 'vitest';
import { decryptJson, encryptJson } from '../aes-gcm';
import { CAPTURE_DB_NAME, __resetCryptoKeyCache, getOrCreateAesKey } from '../crypto-key-store';

async function deleteCaptureDb(): Promise<void> {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(CAPTURE_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

describe('crypto-key-store', () => {
  afterEach(async () => {
    __resetCryptoKeyCache();
    await deleteCaptureDb();
  });

  it('erzeugt beim ersten Aufruf einen AES-256-GCM-Schlüssel, der non-extractable ist', async () => {
    const key = await getOrCreateAesKey();
    const algorithm = key.algorithm as AesKeyAlgorithm;

    expect(algorithm.name).toBe('AES-GCM');
    expect(algorithm.length).toBe(256);
    expect(key.extractable).toBe(false);
    expect(key.usages).toEqual(expect.arrayContaining(['encrypt', 'decrypt']));
  });

  it('liefert nach Cache-Reset (ohne DB-Reset) denselben persistierten Schlüssel zurück', async () => {
    const first = await getOrCreateAesKey();
    const payload = await encryptJson(first, { ping: 'pong' });

    __resetCryptoKeyCache();

    const second = await getOrCreateAesKey();
    const decrypted = await decryptJson<{ ping: string }>(second, payload.iv, payload.ciphertext);

    expect(decrypted).toEqual({ ping: 'pong' });
  });

  it('dedupliziert konkurrierende Erst-Aufrufe (In-Flight-Guard) und liefert denselben Schlüssel', async () => {
    const [a, b] = await Promise.all([getOrCreateAesKey(), getOrCreateAesKey()]);
    expect(a).toBe(b);
  });

  it('liefert bei wiederholtem Aufruf den gecachten Schlüssel ohne Neugenerierung', async () => {
    const first = await getOrCreateAesKey();
    const second = await getOrCreateAesKey();
    expect(second).toBe(first);
  });

  it('wirft, wenn ein Schlüssel-Record ohne `key`-Feld existiert (kein stilles Überschreiben)', async () => {
    // Defekten Record (id ohne `key`) direkt einschleusen.
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open(CAPTURE_DB_NAME, 1);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('crypto-key')) db.createObjectStore('crypto-key', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'sessionId' });
      };
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction(['crypto-key'], 'readwrite');
        tx.objectStore('crypto-key').put({ id: 'capture-aes-key-v1' });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
    __resetCryptoKeyCache();

    await expect(getOrCreateAesKey()).rejects.toThrow(/key.*Feld|Datenverlust/);
  });

  it('erzeugt nach DB-Delete + Cache-Reset einen neuen Schlüssel (alter Ciphertext nicht mehr entschlüsselbar)', async () => {
    const first = await getOrCreateAesKey();
    const payload = await encryptJson(first, { ping: 'pong' });

    __resetCryptoKeyCache();
    await deleteCaptureDb();

    const second = await getOrCreateAesKey();

    expect(second).not.toBe(first);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const decrypted = await decryptJson(second, payload.iv, payload.ciphertext);
    expect(decrypted).toBeNull();
    warnSpy.mockRestore();
  });
});
