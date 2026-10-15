/**
 * IndexedDB-gestützter Schlüsselspeicher für die Capture-Domäne (Story 2.1).
 *
 * Hält genau einen AES-GCM-Schlüssel pro Browser/Profil. Der Schlüssel wird
 * als `CryptoKey` (nicht als Roh-Bytes!) in IndexedDB abgelegt — strukturiertes
 * Klonen erhält die Non-Extractable-Eigenschaft, sodass selbst kompromittierter
 * Page-Context den Schlüssel nicht exfiltrieren kann. `exportKey` ist bewusst
 * verboten.
 *
 * Die `sessions`-Object-Store-Definition gehört konzeptionell zum gleichen
 * DB-Schema und wird hier idempotent mitangelegt, damit Verbraucher (Capture-
 * Sessions-Persistenz, Welle 3) keine separate Migration koordinieren müssen.
 */

export const CAPTURE_DB_NAME = 'bluelight-patient-capture';
export const CAPTURE_DB_VERSION = 1;
export const CAPTURE_SESSIONS_STORE = 'sessions';
export const CAPTURE_CRYPTO_KEY_STORE = 'crypto-key';
const AES_KEY_ID = 'capture-aes-key-v1';

interface CryptoKeyRecord {
  readonly id: string;
  readonly key: CryptoKey;
}

let cachedKey: CryptoKey | null = null;
let keyPromise: Promise<CryptoKey> | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Wandelt einen `IDBRequest` in ein Promise. IndexedDB ist event-basiert,
 * dieser Wrapper macht die Aufrufstellen wartbar.
 */
function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Öffnet die Capture-DB als Singleton-Connection. Bei `versionchange` oder
 * `close` wird der Cache invalidiert, damit nachfolgende Aufrufe eine frische
 * Connection beziehen.
 */
function getDb(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(CAPTURE_DB_NAME, CAPTURE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CAPTURE_SESSIONS_STORE)) {
        db.createObjectStore(CAPTURE_SESSIONS_STORE, { keyPath: 'sessionId' });
      }
      if (!db.objectStoreNames.contains(CAPTURE_CRYPTO_KEY_STORE)) {
        db.createObjectStore(CAPTURE_CRYPTO_KEY_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        if (dbPromise) {
          dbPromise = null;
        }
      };
      db.onclose = () => {
        if (dbPromise) {
          dbPromise = null;
        }
      };
      resolve(db);
    };

    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('[capture:crypto-key-store] IndexedDB-Öffnung blockiert'));
  });

  dbPromise.catch(() => {
    dbPromise = null;
  });

  return dbPromise;
}

/**
 * Liefert den AES-GCM-Schlüssel für das aktuelle Profil. Beim erstmaligen
 * Aufruf wird ein 256-Bit-Schlüssel non-extractable generiert und in
 * IndexedDB persistiert; folgende Aufrufe nutzen den Modul-Cache bzw. lesen
 * den Schlüssel aus IndexedDB nach.
 */
export function getOrCreateAesKey(): Promise<CryptoKey> {
  if (cachedKey) {
    return Promise.resolve(cachedKey);
  }
  // In-Flight-Guard: konkurrierende Erst-Aufrufer teilen sich dieselbe
  // Generierung. Ohne diesen Guard würden zwei parallele Caller je einen Key
  // generieren+persistieren (Last-Writer-Wins) — mit dem verworfenen Key
  // verschlüsselte Sessions wären danach permanent unentschlüsselbar.
  if (keyPromise) {
    return keyPromise;
  }

  keyPromise = (async () => {
    const db = await getDb();

    const existing = await new Promise<CryptoKeyRecord | undefined>((resolve, reject) => {
      const tx = db.transaction([CAPTURE_CRYPTO_KEY_STORE], 'readonly');
      tx.onabort = () => reject(tx.error ?? new Error('[capture:crypto-key-store] Lese-Transaktion abgebrochen'));
      const store = tx.objectStore(CAPTURE_CRYPTO_KEY_STORE);
      const request = store.get(AES_KEY_ID) as IDBRequest<CryptoKeyRecord | undefined>;
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (existing?.key) {
      cachedKey = existing.key;
      return cachedKey;
    }

    // Existiert ein Record OHNE `key`-Feld (partieller Vorgänger-Write, fehl-
    // geschlagenes Structured-Clone), würde ein blindes Überschreiben jeden mit
    // dem Original-Key verschlüsselten Datensatz unbrauchbar machen. Konservativ:
    // werfen statt still überschreiben — der Aufrufer entscheidet über Recovery.
    if (existing) {
      throw new Error('[capture:crypto-key-store] Vorhandener Schlüssel-Record ohne `key`-Feld — Überschreiben würde Datenverlust riskieren');
    }

    const generatedKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([CAPTURE_CRYPTO_KEY_STORE], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('[capture:crypto-key-store] Transaktion abgebrochen'));
      const store = tx.objectStore(CAPTURE_CRYPTO_KEY_STORE);
      const record: CryptoKeyRecord = { id: AES_KEY_ID, key: generatedKey };
      promisifyRequest(store.put(record)).catch(reject);
    });

    cachedKey = generatedKey;
    return cachedKey;
  })();

  // Bei Fehler den In-Flight-Cache leeren, damit ein erneuter Aufruf neu
  // versuchen kann statt dauerhaft am rejected Promise zu hängen.
  keyPromise.catch(() => {
    keyPromise = null;
  });

  return keyPromise;
}

/**
 * Reset-Helper ausschließlich für Tests. Setzt den Modul-Schlüssel-Cache zurück
 * und schließt die gecachte DB-Connection, damit Test-Isolation gewährleistet
 * ist (insbesondere nach `deleteDatabase`).
 */
export function __resetCryptoKeyCache(): void {
  cachedKey = null;
  keyPromise = null;
  if (dbPromise) {
    const localPromise = dbPromise;
    dbPromise = null;
    localPromise
      .then((db) => {
        db.close();
      })
      .catch(() => {
        /* Fehler ignorieren — Cache ist bereits geleert */
      });
  }
}
