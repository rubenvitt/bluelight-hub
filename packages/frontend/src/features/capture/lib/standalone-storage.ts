import { isTauri } from '@tauri-apps/api/core';
import type { CaptureSessionLocal } from '../schemas/capture-session.schema';
import { createTauriCaptureStorage } from './tauri-capture-storage';

/**
 * Storage-Port der Standalone-Capture-Domäne (ADR-017, Story 2.1).
 *
 * Kapselt die Persistenz von `CaptureSessionLocal`-Aggregaten. Konkrete
 * Adapter werden vom Bootstrap (Tauri vs. Browser/IndexedDB) eingehängt.
 */
export interface ICaptureStorage {
  /** Persistiert eine Session vollständig (Upsert). */
  saveSession(session: CaptureSessionLocal): Promise<void>;
  /** Lädt eine Session anhand ihrer `sessionId` oder `null`, falls unbekannt. */
  loadSession(sessionId: string): Promise<CaptureSessionLocal | null>;
  /** Lädt alle persistierten Sessions (für Recovery / Übersicht). */
  loadAllSessions(): Promise<CaptureSessionLocal[]>;
  /** Entfernt eine Session vollständig. */
  deleteSession(sessionId: string): Promise<void>;
  /** Listet nur die `sessionId`s (leichtgewichtige Übersicht). */
  listSessionIds(): Promise<string[]>;
}

let cached: ICaptureStorage | null = null;
let indexedDbFactory: (() => ICaptureStorage) | null = null;

/**
 * Registriert die IndexedDB-Factory für den Browser-Pfad.
 *
 * Wird vom App-Bootstrap der Browser-Variante (Welle 3) aufgerufen, damit
 * dieses Modul keine harte Abhängigkeit auf das IndexedDB-Modul aufbaut.
 * Tauri-Tests bleiben dadurch frei von IndexedDB-Imports.
 *
 * @internal Wird vom IndexedDB-Storage-Modul und vom Bootstrap verdrahtet.
 */
export function __registerIndexedDbCaptureStorageFactory(factory: () => ICaptureStorage): void {
  indexedDbFactory = factory;
}

/**
 * Liefert den plattform-passenden Capture-Storage-Adapter (Singleton).
 *
 * - Tauri-Runtime → `createTauriCaptureStorage()` (siehe `tauri-capture-storage.ts`).
 * - Browser-Runtime → registrierte IndexedDB-Factory (siehe Welle 3).
 *
 * Wirft, wenn im Browser-Modus keine IndexedDB-Factory registriert ist —
 * das ist Absicht, damit ein fehlendes Bootstrap nicht in stille
 * In-Memory-Fakes degradiert.
 */
export function getCaptureStorage(): ICaptureStorage {
  if (cached) return cached;
  if (isTauri()) {
    cached = createTauriCaptureStorage();
  } else {
    if (!indexedDbFactory) {
      throw new Error('[capture] IndexedDB-Capture-Storage nicht registriert. App-Bootstrap aufrufen.');
    }
    cached = indexedDbFactory();
  }
  return cached;
}

/**
 * Setzt den gecachten Adapter zurück (für Tests und Hot-Reload-Szenarien).
 */
export function resetCaptureStorage(): void {
  cached = null;
}
