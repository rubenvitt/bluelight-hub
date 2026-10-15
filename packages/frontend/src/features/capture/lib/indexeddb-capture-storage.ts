import { captureSessionLocalSchemaV1, type CaptureSessionLocal } from '../schemas/capture-session.schema';
import { decryptJson, encryptJson, type EncryptedPayload } from './aes-gcm';
import { CAPTURE_CRYPTO_KEY_STORE, CAPTURE_DB_NAME, CAPTURE_DB_VERSION, CAPTURE_SESSIONS_STORE, getOrCreateAesKey } from './crypto-key-store';
import { __registerIndexedDbCaptureStorageFactory, type ICaptureStorage } from './standalone-storage';

/**
 * IndexedDB-Pfad des Capture-Storage (Browser/PWA). Sessions werden
 * AES-256-GCM-verschlüsselt persistiert; IV liegt neben dem Ciphertext im
 * Record. Schema-Mismatch beim Lesen wird mit Warn-Log verworfen, ohne
 * Exception nach oben zu propagieren (graceful degrade).
 */

interface SessionRecord {
  readonly sessionId: string;
  readonly schemaVersion: 1;
  readonly iv: Uint8Array;
  readonly ciphertext: ArrayBuffer;
}

const LOG_PREFIX = '[capture:indexeddb-storage]';

let dbPromise: Promise<IDBDatabase> | null = null;

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

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
        dbPromise = null;
      };
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error(`${LOG_PREFIX} IndexedDB-Öffnung blockiert`));
  });

  dbPromise.catch(() => {
    dbPromise = null;
  });

  return dbPromise;
}

async function readRecord(sessionId: string): Promise<SessionRecord | undefined> {
  const db = await getDb();
  return new Promise<SessionRecord | undefined>((resolve, reject) => {
    const tx = db.transaction([CAPTURE_SESSIONS_STORE], 'readonly');
    tx.onabort = () => reject(tx.error ?? new Error(`${LOG_PREFIX} Lese-Transaktion abgebrochen`));
    const store = tx.objectStore(CAPTURE_SESSIONS_STORE);
    const request = store.get(sessionId) as IDBRequest<SessionRecord | undefined>;
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readAllRecords(): Promise<SessionRecord[]> {
  const db = await getDb();
  return new Promise<SessionRecord[]>((resolve, reject) => {
    const tx = db.transaction([CAPTURE_SESSIONS_STORE], 'readonly');
    tx.onabort = () => reject(tx.error ?? new Error(`${LOG_PREFIX} Lese-Transaktion abgebrochen`));
    const store = tx.objectStore(CAPTURE_SESSIONS_STORE);
    const request = store.getAll() as IDBRequest<SessionRecord[]>;
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

async function writeRecord(record: SessionRecord): Promise<void> {
  const db = await getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([CAPTURE_SESSIONS_STORE], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error(`${LOG_PREFIX} Transaktion abgebrochen`));
    const store = tx.objectStore(CAPTURE_SESSIONS_STORE);
    promisifyRequest(store.put(record)).catch(reject);
  });
}

async function deleteRecord(sessionId: string): Promise<void> {
  const db = await getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([CAPTURE_SESSIONS_STORE], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error(`${LOG_PREFIX} Transaktion abgebrochen`));
    const store = tx.objectStore(CAPTURE_SESSIONS_STORE);
    promisifyRequest(store.delete(sessionId)).catch(reject);
  });
}

async function listKeys(): Promise<string[]> {
  const db = await getDb();
  return new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction([CAPTURE_SESSIONS_STORE], 'readonly');
    tx.onabort = () => reject(tx.error ?? new Error(`${LOG_PREFIX} Lese-Transaktion abgebrochen`));
    const store = tx.objectStore(CAPTURE_SESSIONS_STORE);
    const request = store.getAllKeys() as IDBRequest<IDBValidKey[]>;
    request.onsuccess = () => resolve(request.result.map((k) => String(k)));
    request.onerror = () => reject(request.error);
  });
}

async function decryptAndValidate(record: SessionRecord): Promise<CaptureSessionLocal | null> {
  const key = await getOrCreateAesKey();
  const decrypted = await decryptJson<unknown>(key, record.iv, record.ciphertext);
  if (decrypted == null) return null;
  const result = captureSessionLocalSchemaV1.safeParse(decrypted);
  if (!result.success) {
    console.warn(`${LOG_PREFIX} Session-Payload verworfen — Schema-Mismatch`, {
      sessionId: record.sessionId,
      errors: result.error.issues,
    });
    return null;
  }
  return result.data;
}

export function createIndexedDbCaptureStorage(): ICaptureStorage {
  return {
    async saveSession(session) {
      const validated = captureSessionLocalSchemaV1.parse(session);
      const key = await getOrCreateAesKey();
      const { iv, ciphertext }: EncryptedPayload = await encryptJson(key, validated);
      await writeRecord({
        sessionId: validated.sessionId,
        schemaVersion: 1,
        iv,
        ciphertext,
      });
    },
    async loadSession(sessionId) {
      const record = await readRecord(sessionId);
      if (!record) return null;
      return decryptAndValidate(record);
    },
    async loadAllSessions() {
      const records = await readAllRecords();
      const sessions: CaptureSessionLocal[] = [];
      for (const record of records) {
        const session = await decryptAndValidate(record);
        if (session) sessions.push(session);
      }
      return sessions;
    },
    async deleteSession(sessionId) {
      await deleteRecord(sessionId);
    },
    async listSessionIds() {
      return listKeys();
    },
  };
}

/**
 * Test-Helper: Schließt die gecachte DB-Connection und resettet den Modul-State.
 * Aufrufer ist dafür verantwortlich, IndexedDB selbst zu löschen, falls nötig.
 */
export function __resetIndexedDbCaptureStorageForTests(): void {
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

__registerIndexedDbCaptureStorageFactory(createIndexedDbCaptureStorage);
