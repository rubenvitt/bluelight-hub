import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: vi.fn(() => false),
}));

vi.mock('@tauri-apps/plugin-store', () => {
  class FakeLazyStore {
    private readonly data = new Map<string, unknown>();
    constructor(_filename: string, _options?: unknown) {}
    async set(key: string, value: unknown): Promise<void> {
      this.data.set(key, value);
    }
    async get<T>(key: string): Promise<T | null> {
      return (this.data.get(key) as T) ?? null;
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
  }
  return { LazyStore: FakeLazyStore };
});

import { isTauri } from '@tauri-apps/api/core';
import { __registerIndexedDbCaptureStorageFactory, getCaptureStorage, resetCaptureStorage, type ICaptureStorage } from '../standalone-storage';

const stub: ICaptureStorage = {
  async saveSession() {},
  async loadSession() {
    return null;
  },
  async loadAllSessions() {
    return [];
  },
  async deleteSession() {},
  async listSessionIds() {
    return [];
  },
};

describe('getCaptureStorage Routing', () => {
  beforeEach(() => {
    resetCaptureStorage();
  });

  afterEach(() => {
    resetCaptureStorage();
    vi.mocked(isTauri).mockReturnValue(false);
  });

  it('wirft, wenn im Browser-Modus keine IndexedDB-Factory registriert ist', () => {
    __registerIndexedDbCaptureStorageFactory(null as unknown as () => ICaptureStorage);
    vi.mocked(isTauri).mockReturnValue(false);
    expect(() => getCaptureStorage()).toThrow(/IndexedDB-Capture-Storage nicht registriert/);
  });

  it('verwendet die registrierte IndexedDB-Factory im Browser-Modus', () => {
    __registerIndexedDbCaptureStorageFactory(() => stub);
    vi.mocked(isTauri).mockReturnValue(false);
    expect(getCaptureStorage()).toBe(stub);
  });

  it('verwendet den Tauri-Pfad, wenn isTauri true ist', () => {
    vi.mocked(isTauri).mockReturnValue(true);
    const adapter = getCaptureStorage();
    expect(adapter).toBeDefined();
    expect(adapter.saveSession).toBeTypeOf('function');
  });

  it('liefert beim zweiten Aufruf den gecachten Adapter', () => {
    __registerIndexedDbCaptureStorageFactory(() => stub);
    vi.mocked(isTauri).mockReturnValue(false);
    const first = getCaptureStorage();
    const second = getCaptureStorage();
    expect(second).toBe(first);
  });
});
