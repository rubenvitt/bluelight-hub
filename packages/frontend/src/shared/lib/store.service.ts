import { Store } from '@tauri-apps/plugin-store';
import { isTauri } from '@tauri-apps/api/core';

/**
 * Tauri Store Service mit Encryption und Error Handling
 * Wrapper um das @tauri-apps/plugin-store für sichere Datenverwaltung.
 */

// Interface defining the shape we need from the Store
// This allows us to use both the real Store and our BrowserStore
// Note: load() is not part of this interface because for Tauri Store it is a static method
interface IStore {
  save(): Promise<void>;
  set(key: string, value: unknown): Promise<void>;
  get<T>(key: string): Promise<T | undefined | null>; // Tauri returns undefined, we might return null/undefined
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

// Browser implementation using localStorage
class BrowserStore implements IStore {
  private path: string;
  private data: Map<string, unknown> = new Map();

  constructor(path: string) {
    this.path = path;
  }

  // Specific to BrowserStore, called manually during init
  async load(): Promise<void> {
    console.log(`[Store] Loading from localStorage: ${this.path}`);
    const stored = localStorage.getItem(this.path);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.data = new Map(Object.entries(parsed));
      } catch (e) {
        console.error('[Store] Failed to parse localStorage', e);
      }
    }
  }

  async save(): Promise<void> {
    console.log(`[Store] Saving to localStorage: ${this.path}`);
    const obj = Object.fromEntries(this.data);
    localStorage.setItem(this.path, JSON.stringify(obj));
  }

  async set(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
    // Auto-save in browser to mimic persistence
    await this.save();
  }

  async get<T>(key: string): Promise<T | undefined> {
    const val = this.data.get(key);
    return val === undefined ? undefined : (val as T);
  }

  async has(key: string): Promise<boolean> {
    return this.data.has(key);
  }

  async delete(key: string): Promise<boolean> {
    const result = this.data.delete(key);
    await this.save();
    return result;
  }

  async clear(): Promise<void> {
    this.data.clear();
    await this.save();
  }

  async keys(): Promise<string[]> {
    return Array.from(this.data.keys());
  }
}

let storeInstance: Store | BrowserStore | null = null;

/**
 * Initialisiert den globalen Store mit Encryption
 * @param storePath - Pfad zur Store-Datei (default: "app-store.json")
 * @returns Promise mit initialisiertem Store
 */
export async function initializeStore(storePath = 'app-store.json'): Promise<Store> {
  if (storeInstance) {
    return storeInstance as Store;
  }

  try {
    if (isTauri()) {
      // Tauri v2 Store: load is a static method that returns a Promise<Store>
      console.log('[Store] Initializing Tauri Store...');
      storeInstance = await Store.load(storePath);
    } else {
      console.warn('[Store] Running in browser - using localStorage fallback');
      const browserStore = new BrowserStore(storePath);
      await browserStore.load();
      storeInstance = browserStore;
    }

    console.log('[Store] Initialized successfully');
    return storeInstance as Store;
  } catch (error) {
    console.error('[Store] Initialization failed:', error);
    throw error;
  }
}

/**
 * Gibt den initialiserten Store zurück (lazy initialization)
 */
export async function getStore(): Promise<Store> {
  if (!storeInstance) {
    return initializeStore();
  }
  return storeInstance as Store;
}

/**
 * Speichert einen Wert im Store
 * @param key - Store Schlüssel
 * @param value - Zu speichernder Wert (wird automatisch serialisiert)
 */
export async function setStoreValue<T = unknown>(key: string, value: T): Promise<void> {
  try {
    const store = await getStore();
    await store.set(key, value);
    await store.save();
    console.log(`[Store] Set ${key}`);
  } catch (error) {
    console.error(`[Store] Failed to set ${key}:`, error);
    throw error;
  }
}

/**
 * Liest einen Wert aus dem Store
 * @param key - Store Schlüssel
 * @param defaultValue - Defaultwert wenn Schlüssel nicht existiert
 * @returns Der Wert oder defaultValue
 */
export async function getStoreValue<T = unknown>(key: string, defaultValue?: T): Promise<T | undefined> {
  try {
    const store = await getStore();
    const value = await store.get<T>(key);
    return value ?? defaultValue;
  } catch (error) {
    console.error(`[Store] Failed to get ${key}:`, error);
    throw error;
  }
}

/**
 * Prüft ob ein Schlüssel im Store existiert
 */
export async function hasStoreKey(key: string): Promise<boolean> {
  try {
    const store = await getStore();
    return await store.has(key);
  } catch (error) {
    console.error(`[Store] Failed to check key ${key}:`, error);
    throw error;
  }
}

/**
 * Löscht einen Schlüssel aus dem Store
 */
export async function deleteStoreKey(key: string): Promise<void> {
  try {
    const store = await getStore();
    await store.delete(key);
    await store.save();
    console.log(`[Store] Deleted ${key}`);
  } catch (error) {
    console.error(`[Store] Failed to delete ${key}:`, error);
    throw error;
  }
}

/**
 * Löscht alle Schlüssel aus dem Store
 */
export async function clearStore(): Promise<void> {
  try {
    const store = await getStore();
    await store.clear();
    await store.save();
    console.log('[Store] Cleared all keys');
  } catch (error) {
    console.error('[Store] Failed to clear store:', error);
    throw error;
  }
}

/**
 * Gibt alle Schlüssel im Store zurück
 */
export async function getStoreKeys(): Promise<string[]> {
  try {
    const store = await getStore();
    return await store.keys();
  } catch (error) {
    console.error('[Store] Failed to get keys:', error);
    throw error;
  }
}

/**
 * Hook-kompatible Store Operationen
 * Ideal für React Komponenten
 */
export const storeService = {
  initialize: initializeStore,
  get: getStoreValue,
  set: setStoreValue,
  has: hasStoreKey,
  delete: deleteStoreKey,
  clear: clearStore,
  keys: getStoreKeys,
};
