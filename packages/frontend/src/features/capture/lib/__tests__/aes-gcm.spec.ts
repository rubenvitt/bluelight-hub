import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptJson, encryptJson } from '../aes-gcm';

describe('aes-gcm', () => {
  let key: CryptoKey;

  beforeEach(async () => {
    key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  });

  it('macht einen Roundtrip mit leerem Objekt', async () => {
    const { iv, ciphertext } = await encryptJson(key, {});
    const result = await decryptJson<Record<string, unknown>>(key, iv, ciphertext);
    expect(result).toEqual({});
  });

  it('erhält verschachtelte Strukturen inklusive Umlauten unverändert', async () => {
    const value = { a: { b: [1, 2, 3] }, s: 'hällö' };
    const { iv, ciphertext } = await encryptJson(key, value);
    const result = await decryptJson<typeof value>(key, iv, ciphertext);
    expect(result).toEqual(value);
  });

  it('liefert null und warnt, wenn der IV manipuliert wurde', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { iv, ciphertext } = await encryptJson(key, { secret: 42 });
    const tamperedIv = new Uint8Array(iv);
    tamperedIv[0] ^= 0xff;

    const result = await decryptJson(key, tamperedIv, ciphertext);

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('[capture:aes-gcm]');
    warnSpy.mockRestore();
  });

  it('liefert null und warnt, wenn der Ciphertext manipuliert wurde', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { iv, ciphertext } = await encryptJson(key, { secret: 42 });
    const tampered = new Uint8Array(ciphertext);
    tampered[0] ^= 0xff;

    const result = await decryptJson(key, iv, tampered.buffer);

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('[capture:aes-gcm]');
    warnSpy.mockRestore();
  });

  it('erzeugt bei 5 Encrypt-Aufrufen 5 unterschiedliche IVs (kein Reuse)', async () => {
    const ivs = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const { iv } = await encryptJson(key, { i });
      ivs.add(Array.from(iv).join(','));
    }
    expect(ivs.size).toBe(5);
  });

  it('wirft einen klaren Fehler, wenn crypto.subtle nicht verfügbar ist (Secure-Context-Guard)', async () => {
    const realCrypto = globalThis.crypto;
    // Secure-Context-Verlust simulieren: crypto ohne subtle.
    vi.stubGlobal('crypto', { getRandomValues: realCrypto.getRandomValues.bind(realCrypto) });
    try {
      await expect(encryptJson(key, { x: 1 })).rejects.toThrow(/crypto\.subtle|Secure Context/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
