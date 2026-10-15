import { afterEach, describe, expect, it } from 'vitest';
import { getStorageAdapter, resetStorageAdapter } from '@/shared/services/storage/storage-adapter.factory';
import { __resetDeviceIdCacheForTests, DEVICE_ID_STORAGE_KEY, getOrCreateDeviceId } from '../device-id';

describe('getOrCreateDeviceId', () => {
  afterEach(() => {
    __resetDeviceIdCacheForTests();
    resetStorageAdapter();
    localStorage.clear();
  });

  it('erzeugt beim ersten Aufruf eine Geräte-ID im dev_-Format und persistiert sie', async () => {
    const deviceId = await getOrCreateDeviceId();
    expect(deviceId).toMatch(/^dev_[a-z0-9]{24,32}$/);

    const persisted = await getStorageAdapter().getItem(DEVICE_ID_STORAGE_KEY);
    expect(persisted).toBe(deviceId);
  });

  it('liefert beim zweiten Aufruf dieselbe ID zurück und generiert nicht neu', async () => {
    const first = await getOrCreateDeviceId();
    const second = await getOrCreateDeviceId();
    expect(second).toBe(first);
  });

  it('respektiert einen bereits vorhandenen Wert im Storage und gibt ihn unverändert zurück', async () => {
    const vorbelegt = 'dev_vorbelegterwert1234567890ab';
    await getStorageAdapter().setItem(DEVICE_ID_STORAGE_KEY, vorbelegt);

    const result = await getOrCreateDeviceId();
    expect(result).toBe(vorbelegt);
  });

  it('dedupliziert konkurrierende Erst-Aufrufe (In-Flight-Guard) und liefert dieselbe ID', async () => {
    const [a, b] = await Promise.all([getOrCreateDeviceId(), getOrCreateDeviceId()]);
    expect(a).toBe(b);
    const persisted = await getStorageAdapter().getItem(DEVICE_ID_STORAGE_KEY);
    expect(persisted).toBe(a);
  });
});
