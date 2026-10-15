/**
 * AES-GCM-Wrapper für die Capture-Domäne (IndexedDB-Pfad, Story 2.1).
 *
 * Verschlüsselt JSON-serialisierbare Werte symmetrisch mit AES-256-GCM. Der IV
 * ist gemäß NIST SP 800-38D 12 Byte (96 Bit) lang — das ist der von der GCM-
 * Spezifikation empfohlene Standard und vermeidet die Performance-Einbußen
 * eines internen GHASH-Schritts bei abweichenden IV-Längen. Pro `encryptJson`-
 * Aufruf wird ein frischer IV via `crypto.getRandomValues` erzeugt; IV-Reuse
 * mit demselben Schlüssel würde die GCM-Sicherheit brechen.
 */

/**
 * Verschlüsseltes Payload-Format. `iv` und `ciphertext` werden gemeinsam in
 * IndexedDB persistiert und beim Entschlüsseln paarweise zurückgereicht.
 */
export interface EncryptedPayload {
  readonly iv: Uint8Array;
  readonly ciphertext: ArrayBuffer;
}

const IV_LENGTH_BYTES = 12;
const LOG_PREFIX = '[capture:aes-gcm]';

/**
 * Serialisiert `value` zu JSON, kodiert UTF-8 und verschlüsselt mit AES-GCM.
 *
 * Der zufällige 12-Byte-IV wird im Rückgabewert mitgeliefert, damit Aufrufer
 * IV und Ciphertext atomar persistieren können. Der `key` muss die Usages
 * `encrypt` enthalten — sonst wirft `subtle.encrypt`.
 */
export async function encryptJson(key: CryptoKey, value: unknown): Promise<EncryptedPayload> {
  // WebCrypto ist nur in Secure Contexts verfügbar (`crypto.subtle` ist sonst
  // `undefined`). Ohne diesen Guard würde der Zugriff mit einem kryptischen
  // TypeError fehlschlagen; ein expliziter Fehler macht die Fehlkonfiguration
  // (z. B. App über plain HTTP statt HTTPS) eindeutig diagnostizierbar.
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error(`${LOG_PREFIX} WebCrypto (crypto.subtle) nicht verfügbar — Secure Context (HTTPS) erforderlich`);
  }
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { iv, ciphertext };
}

/**
 * Entschlüsselt eine `EncryptedPayload` und deserialisiert das Ergebnis als
 * JSON.
 *
 * Tampering, IV-Mismatch oder korruption führen bewusst nicht zu einem Throw
 * — stattdessen wird `null` zurückgegeben und ein Warn-Log abgesetzt. So
 * degradiert die Capture-Domäne im Offline-Pfad sanft (z. B. wenn ein
 * Session-Eintrag korrupt ist, wird die Session als nicht-wiederherstellbar
 * markiert statt den gesamten App-Start zu blockieren), ohne dabei stillen
 * Datenverlust zu verbergen.
 */
export async function decryptJson<T>(key: CryptoKey, iv: Uint8Array, ciphertext: ArrayBuffer): Promise<T | null> {
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  } catch (error) {
    console.warn(`${LOG_PREFIX} Entschlüsselung fehlgeschlagen (Tampering, korrupte IV oder defekter Ciphertext)`, error);
    return null;
  }

  try {
    const json = new TextDecoder().decode(plaintext);
    return JSON.parse(json) as T;
  } catch (error) {
    console.warn(`${LOG_PREFIX} Klartext ist kein gültiges JSON — Eintrag wird verworfen`, error);
    return null;
  }
}
