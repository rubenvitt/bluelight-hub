import { describe, expect, it, vi } from 'vitest';
import { decryptJson } from '../aes-gcm';

describe('decryptJson Edge-Cases', () => {
  it('liefert null, wenn der entschlüsselte Klartext kein gültiges JSON ist', async () => {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    // Plaintext, der valider UTF-8 ist, aber kein JSON.
    const plaintext = new TextEncoder().encode('{ kein-valides-json');
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await decryptJson<unknown>(key, iv, ciphertext);

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
