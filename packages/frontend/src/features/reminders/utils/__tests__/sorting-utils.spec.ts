import { describe, it, expect } from 'vitest';
import type { ErinnerungResponseDto } from '@/shared';
import { compareErinnerungen, getSortPriority } from '../sorting-utils';

/**
 * Mock Reminder Helper
 */
function createMockErinnerung(overrides: Partial<ErinnerungResponseDto>): ErinnerungResponseDto {
  return {
    id: 'test-id',
    titel: 'Test Erinnerung',
    status: 'GEPLANT',
    faelligAm: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    erstelltVon: 'user-1',
    einsatzId: 'einsatz-1',
    verlauf: [],
    ...overrides,
  } as ErinnerungResponseDto;
}

describe('sorting-utils', () => {
  describe('getSortPriority', () => {
    it('should prioritize AUSGELOEST (0)', () => {
      const e = createMockErinnerung({ status: 'AUSGELOEST' });
      expect(getSortPriority(e)).toBe(0);
    });

    it('should prioritize GEPLANT critical (1)', () => {
      // 0 seconds remaining = critical
      const faelligAm = new Date(Date.now()).toISOString();
      const e = createMockErinnerung({ status: 'GEPLANT', faelligAm });
      expect(getSortPriority(e)).toBe(1);
    });

    it('should prioritize GEPLANT urgent (2)', () => {
      // 1 minute remaining = urgent (< 2 min)
      const faelligAm = new Date(Date.now() + 60 * 1000).toISOString();
      const e = createMockErinnerung({ status: 'GEPLANT', faelligAm });
      expect(getSortPriority(e)).toBe(2);
    });

    it('should prioritize GEPLANT warning (3)', () => {
      // 3 minutes remaining = warning (2-5 min)
      const faelligAm = new Date(Date.now() + 3 * 60 * 1000).toISOString();
      const e = createMockErinnerung({ status: 'GEPLANT', faelligAm });
      expect(getSortPriority(e)).toBe(3);
    });

    it('should prioritize GEPLANT normal (4)', () => {
      // 10 minutes remaining = normal (> 5 min)
      const faelligAm = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const e = createMockErinnerung({ status: 'GEPLANT', faelligAm });
      expect(getSortPriority(e)).toBe(4);
    });
    it('should prioritize ACKNOWLEDGED (5)', () => {
      const e = createMockErinnerung({ status: 'ACKNOWLEDGED' });
      expect(getSortPriority(e)).toBe(5);
    });

    it('should prioritize SNOOZED (6)', () => {
      const e = createMockErinnerung({ status: 'SNOOZED' });
      expect(getSortPriority(e)).toBe(6);
    });

    it('should prioritize ERLEDIGT (7)', () => {
      const e = createMockErinnerung({ status: 'ERLEDIGT' });
      expect(getSortPriority(e)).toBe(7);
    });
  });

  describe('compareErinnerungen', () => {
    const e1 = createMockErinnerung({ id: '1', createdAt: '2023-01-01T10:00:00Z', faelligAm: '2023-01-02T10:00:00Z', status: 'GEPLANT' });
    const e2 = createMockErinnerung({ id: '2', createdAt: '2023-01-01T11:00:00Z', faelligAm: '2023-01-02T11:00:00Z', status: 'GEPLANT' });

    describe('sort by created', () => {
      it('should sort newest first', () => {
        expect(compareErinnerungen(e1, e2, 'erstellt')).toBeGreaterThan(0); // e2 is newer, so e1 > e2 (should be after) -> wait, sort(a,b) return > 0 means a after b.
        // Logic: b.date - a.date. e2(new) - e1(old) > 0. So positive.
        // So compare(e1, e2) > 0 means e2 comes first. Correct.
      });
    });

    describe('sort by faelligkeit', () => {
      it('should sort urgency first', () => {
        const urgent = createMockErinnerung({ status: 'AUSGELOEST' });
        const normal = createMockErinnerung({ status: 'GEPLANT', faelligAm: new Date(Date.now() + 100000).toISOString() });
        expect(compareErinnerungen(urgent, normal, 'faelligkeit')).toBeLessThan(0); // urgent < normal
      });

      it('should sort by date if priorities equal', () => {
        expect(compareErinnerungen(e1, e2, 'faelligkeit')).toBeLessThan(0); // e1 is due earlier
      });
    });

    describe('sort by status', () => {
      it('should sort by predefined status order', () => {
        const ack = createMockErinnerung({ status: 'ACKNOWLEDGED' });
        const snoozed = createMockErinnerung({ status: 'SNOOZED' });
        // ACK (3) < SNOOZED (4)
        expect(compareErinnerungen(ack, snoozed, 'status')).toBeLessThan(0);
      });

      it('should fallback to due date if status equal', () => {
        expect(compareErinnerungen(e1, e2, 'status')).toBeLessThan(0);
      });
    });
  });
});
