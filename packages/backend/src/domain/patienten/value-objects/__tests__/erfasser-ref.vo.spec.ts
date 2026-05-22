import { ErfasserRef } from '../erfasser-ref.vo';

describe('ErfasserRef ValueObject', () => {
  describe('user-Modus', () => {
    it('akzeptiert valide userId', () => {
      const result = ErfasserRef.user('user-123');
      expect(result.isSuccess).toBe(true);
      expect(result.value?.type).toBe('user');
      expect(result.value?.data).toEqual({ type: 'user', userId: 'user-123' });
    });

    it('trimmt umgebenden Whitespace', () => {
      const result = ErfasserRef.user('  user-456  ');
      expect(result.value?.data).toEqual({ type: 'user', userId: 'user-456' });
    });

    it('rejected leere userId', () => {
      expect(ErfasserRef.user('').isFailure).toBe(true);
      expect(ErfasserRef.user('   ').isFailure).toBe(true);
    });
  });

  describe('device-Modus', () => {
    it('akzeptiert deviceId allein (captureSessionId-Key wird ausgelassen, nicht auf undefined gesetzt)', () => {
      const result = ErfasserRef.device('device-A');
      expect(result.isSuccess).toBe(true);
      expect(result.value?.type).toBe('device');
      expect(result.value?.data).toEqual({ type: 'device', deviceId: 'device-A' });
      expect('captureSessionId' in (result.value!.data as Record<string, unknown>)).toBe(false);
    });

    it('akzeptiert deviceId + captureSessionId', () => {
      const result = ErfasserRef.device('device-A', 'cs_42');
      expect(result.isSuccess).toBe(true);
      expect(result.value?.data).toEqual({ type: 'device', deviceId: 'device-A', captureSessionId: 'cs_42' });
    });

    it('trimmt deviceId und captureSessionId', () => {
      const result = ErfasserRef.device('  device-X  ', '  cs_99  ');
      expect(result.isSuccess).toBe(true);
      expect(result.value?.data).toEqual({ type: 'device', deviceId: 'device-X', captureSessionId: 'cs_99' });
    });

    it('rejected leere deviceId / captureSessionId', () => {
      expect(ErfasserRef.device('').isFailure).toBe(true);
      expect(ErfasserRef.device('device-A', '').isFailure).toBe(true);
    });
  });

  it('Type-Guards differenzieren user vs device', () => {
    const user = ErfasserRef.user('u1').value!.data;
    const device = ErfasserRef.device('d1').value!.data;
    expect(ErfasserRef.isUserErfasser(user)).toBe(true);
    expect(ErfasserRef.isUserErfasser(device)).toBe(false);
    expect(ErfasserRef.isDeviceErfasser(device)).toBe(true);
    expect(ErfasserRef.isDeviceErfasser(user)).toBe(false);
  });
});
