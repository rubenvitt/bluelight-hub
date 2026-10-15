import { describe, expect, it } from 'vitest';
import { createCaptureSessionId, createDeviceId, createPatientLocalId } from '../cuid';

describe('cuid Helper für Capture-Domain', () => {
  describe('createCaptureSessionId', () => {
    it('erzeugt eine ID mit cs_-Prefix im CUID2-Format', () => {
      const id = createCaptureSessionId();
      expect(id).toMatch(/^cs_[a-z0-9]{24,32}$/);
    });

    it('produziert bei 100 Aufrufen 100 eindeutige Werte', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i += 1) {
        ids.add(createCaptureSessionId());
      }
      expect(ids.size).toBe(100);
    });

    it('liefert eine URL-sichere ID', () => {
      const id = createCaptureSessionId();
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('createPatientLocalId', () => {
    it('erzeugt eine ID mit pl_-Prefix im CUID2-Format', () => {
      const id = createPatientLocalId();
      expect(id).toMatch(/^pl_[a-z0-9]{24,32}$/);
    });

    it('liefert eine URL-sichere ID', () => {
      const id = createPatientLocalId();
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('createDeviceId', () => {
    it('erzeugt eine ID mit dev_-Prefix im CUID2-Format', () => {
      const id = createDeviceId();
      expect(id).toMatch(/^dev_[a-z0-9]{24,32}$/);
    });

    it('liefert eine URL-sichere ID', () => {
      const id = createDeviceId();
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });
});
