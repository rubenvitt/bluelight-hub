import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests für den Tauri-Pfad des Capture-Storage-Adapters (ADR-017, Story 2.1).
 *
 * Mockt `@tauri-apps/plugin-store` mit einer in-memory `FakeLazyStore`, die
 * jede konstruierte Instanz in `__capturedInstances` ablegt. Damit kann der
 * Test direkt auf den vom Adapter erzeugten Singleton-Store zugreifen und
 * gezielt korrupte Payloads injizieren, ohne die Adapter-Validierung zu
 * durchlaufen.
 */

interface FakeLazyStoreLike {
  set(key: string, value: unknown): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  keys(): Promise<string[]>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  save(): Promise<void>;
  __forcePut(key: string, value: unknown): void;
}

const capturedInstances: FakeLazyStoreLike[] = [];

vi.mock('@tauri-apps/plugin-store', () => {
  class FakeLazyStore implements FakeLazyStoreLike {
    private readonly data = new Map<string, unknown>();

    constructor(_filename: string, _options?: unknown) {
      void _filename;
      void _options;
      capturedInstances.push(this);
    }

    async set(key: string, value: unknown): Promise<void> {
      this.data.set(key, value);
    }

    async get<T>(key: string): Promise<T | null> {
      return (this.data.get(key) as T | undefined) ?? null;
    }

    async keys(): Promise<string[]> {
      return Array.from(this.data.keys());
    }

    async delete(key: string): Promise<void> {
      this.data.delete(key);
    }

    async clear(): Promise<void> {
      this.data.clear();
    }

    async save(): Promise<void> {
      // No-Op: In-Memory-Fake; der echte LazyStore flusht hier auf Platte.
    }

    __forcePut(key: string, value: unknown): void {
      this.data.set(key, value);
    }
  }
  return { LazyStore: FakeLazyStore };
});

import { __resetTauriCaptureStorageForTests, createTauriCaptureStorage } from '../tauri-capture-storage';
import type { CaptureSessionLocal } from '../../schemas/capture-session.schema';

const isoNow = '2026-05-22T12:00:00.000Z';

function makeSession(sessionId = 'cs_abcdefghijklmnopqrstuvwx'): CaptureSessionLocal {
  return {
    sessionId,
    schemaVersion: 1,
    deviceId: 'dev_abcdefghijklmnopqrstuvwx',
    appVersion: '1.0.0',
    platform: 'tauri',
    startedAt: isoNow,
    schnellzaehler: { SK_I: 0, SK_II: 0, SK_III: 0, SK_IV: 0, TOT: 0 },
    patients: [],
    pendingEvents: [],
    status: 'open',
  };
}

describe('TauriCaptureStorage', () => {
  beforeEach(() => {
    __resetTauriCaptureStorageForTests();
    capturedInstances.length = 0;
  });

  it('persistiert eine Session und lädt sie 1:1 zurück', async () => {
    const storage = createTauriCaptureStorage();
    const session = makeSession();
    await storage.saveSession(session);
    expect(await storage.loadSession(session.sessionId)).toEqual(session);
  });

  it('liefert null für unbekannte Session-ID', async () => {
    const storage = createTauriCaptureStorage();
    expect(await storage.loadSession('cs_unknownunknownunknownxy')).toBeNull();
  });

  it('listet mehrere Sessions auf', async () => {
    const storage = createTauriCaptureStorage();
    const s1 = makeSession('cs_aaaaaaaaaaaaaaaaaaaaaaaa');
    const s2 = makeSession('cs_bbbbbbbbbbbbbbbbbbbbbbbb');
    await storage.saveSession(s1);
    await storage.saveSession(s2);
    const all = await storage.loadAllSessions();
    expect(all).toHaveLength(2);
    expect(all.map((s) => s.sessionId).sort()).toEqual([s1.sessionId, s2.sessionId].sort());
  });

  it('listSessionIds gibt nur Session-Keys zurück', async () => {
    const storage = createTauriCaptureStorage();
    await storage.saveSession(makeSession());
    expect(await storage.listSessionIds()).toEqual(['cs_abcdefghijklmnopqrstuvwx']);
  });

  it('deleteSession entfernt die Session vollständig', async () => {
    const storage = createTauriCaptureStorage();
    const session = makeSession();
    await storage.saveSession(session);
    await storage.deleteSession(session.sessionId);
    expect(await storage.loadSession(session.sessionId)).toBeNull();
  });

  it('ignoriert Nicht-Session-Keys in loadAllSessions und listSessionIds', async () => {
    const storage = createTauriCaptureStorage();
    const session = makeSession();
    await storage.saveSession(session);
    // erzwinge Singleton-Erzeugung — Mock-Instanz steht jetzt in capturedInstances
    const singleton = capturedInstances[0];
    expect(singleton).toBeDefined();
    singleton?.__forcePut('meta:lastSyncedAt', '2026-05-22T11:00:00.000Z');

    expect(await storage.listSessionIds()).toEqual([session.sessionId]);
    const all = await storage.loadAllSessions();
    expect(all).toHaveLength(1);
    expect(all[0]?.sessionId).toBe(session.sessionId);
  });

  it('verwirft korrupte Payloads (Schema-Mismatch) mit Warn-Log und liefert null', async () => {
    const storage = createTauriCaptureStorage();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Singleton-Erzeugung anstoßen, dann direkt korrupten Eintrag injizieren.
    await storage.listSessionIds();
    const singleton = capturedInstances[0];
    expect(singleton).toBeDefined();
    singleton?.__forcePut('session:cs_corruptcorruptcorruptcor', {
      sessionId: 'broken',
      schemaVersion: 1,
      // Pflichtfelder fehlen → Schema-Mismatch
    });

    const loaded = await storage.loadSession('cs_corruptcorruptcorruptcor');
    expect(loaded).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('[capture:tauri-storage] Session-Payload verworfen — Schema-Mismatch', expect.objectContaining({ sessionId: 'cs_corruptcorruptcorruptcor' }));

    // Zweite gültige Session daneben — loadAllSessions liefert nur die gültige.
    const valid = makeSession('cs_validvalidvalidvalidvali');
    await storage.saveSession(valid);
    warnSpy.mockClear();
    const all = await storage.loadAllSessions();
    expect(all).toHaveLength(1);
    expect(all[0]?.sessionId).toBe(valid.sessionId);
    expect(warnSpy).toHaveBeenCalledWith('[capture:tauri-storage] Session-Payload verworfen — Schema-Mismatch', expect.objectContaining({ key: 'session:cs_corruptcorruptcorruptcor' }));

    warnSpy.mockRestore();
  });
});
