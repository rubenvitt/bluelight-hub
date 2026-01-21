/**
 * Unit Tests für countdown-utils
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 1.7 AC3, AC4:**
 * - Countdown-Berechnung und Formatierung
 * - Update-Intervall basierend auf verbleibender Zeit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateTimeRemaining, formatCountdown, getUrgencyLevel, getUpdateInterval, type TimeRemaining } from '../countdown-utils';

describe('countdown-utils', () => {
  describe('calculateTimeRemaining', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should calculate correct hours, minutes, seconds for future date', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T12:30:45Z');

      // When (Act)
      const result = calculateTimeRemaining(faelligAm);

      // Then (Assert)
      expect(result.hours).toBe(2);
      expect(result.minutes).toBe(30);
      expect(result.seconds).toBe(45);
      expect(result.total).toBe((2 * 60 * 60 + 30 * 60 + 45) * 1000);
    });

    it('should return zeros for past date', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T12:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:00:00Z');

      // When (Act)
      const result = calculateTimeRemaining(faelligAm);

      // Then (Assert)
      expect(result.hours).toBe(0);
      expect(result.minutes).toBe(0);
      expect(result.seconds).toBe(0);
      expect(result.total).toBeLessThanOrEqual(0);
    });

    it('should handle exactly now (0 remaining)', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T12:00:00Z'));
      const faelligAm = new Date('2026-01-20T12:00:00Z');

      // When (Act)
      const result = calculateTimeRemaining(faelligAm);

      // Then (Assert)
      expect(result.total).toBe(0);
    });

    it('should handle string date input', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = '2026-01-20T10:05:00Z';

      // When (Act)
      const result = calculateTimeRemaining(faelligAm);

      // Then (Assert)
      expect(result.minutes).toBe(5);
      expect(result.seconds).toBe(0);
    });

    it('should calculate remaining time for < 1 minute', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:00:30Z');

      // When (Act)
      const result = calculateTimeRemaining(faelligAm);

      // Then (Assert)
      expect(result.hours).toBe(0);
      expect(result.minutes).toBe(0);
      expect(result.seconds).toBe(30);
    });
  });

  describe('formatCountdown', () => {
    it('should format hours and minutes (e.g., "2h 15m")', () => {
      // Given (Arrange)
      const remaining: TimeRemaining = { hours: 2, minutes: 15, seconds: 30, total: 8130000 };

      // When (Act)
      const result = formatCountdown(remaining);

      // Then (Assert)
      expect(result).toBe('2h 15m');
    });

    it('should format only minutes when hours is 0 (e.g., "45m")', () => {
      // Given (Arrange)
      const remaining: TimeRemaining = { hours: 0, minutes: 45, seconds: 30, total: 2730000 };

      // When (Act)
      const result = formatCountdown(remaining);

      // Then (Assert)
      expect(result).toBe('45m');
    });

    it('should format minutes and seconds when < 2 minutes (e.g., "1m 45s")', () => {
      // Given (Arrange)
      const remaining: TimeRemaining = { hours: 0, minutes: 1, seconds: 45, total: 105000 };

      // When (Act)
      const result = formatCountdown(remaining, true); // showSeconds = true

      // Then (Assert)
      expect(result).toBe('1m 45s');
    });

    it('should format only seconds when < 1 minute (e.g., "30s")', () => {
      // Given (Arrange)
      const remaining: TimeRemaining = { hours: 0, minutes: 0, seconds: 30, total: 30000 };

      // When (Act)
      const result = formatCountdown(remaining, true); // showSeconds = true

      // Then (Assert)
      expect(result).toBe('30s');
    });

    it('should return "Jetzt fällig!" when total <= 0', () => {
      // Given (Arrange)
      const remaining: TimeRemaining = { hours: 0, minutes: 0, seconds: 0, total: 0 };

      // When (Act)
      const result = formatCountdown(remaining);

      // Then (Assert)
      expect(result).toBe('Jetzt fällig!');
    });

    it('should return "Jetzt fällig!" for negative total', () => {
      // Given (Arrange)
      const remaining: TimeRemaining = { hours: 0, minutes: 0, seconds: 0, total: -5000 };

      // When (Act)
      const result = formatCountdown(remaining);

      // Then (Assert)
      expect(result).toBe('Jetzt fällig!');
    });

    it('should not show seconds by default for > 2 minutes', () => {
      // Given (Arrange)
      const remaining: TimeRemaining = { hours: 0, minutes: 5, seconds: 30, total: 330000 };

      // When (Act)
      const result = formatCountdown(remaining); // showSeconds default = false

      // Then (Assert)
      expect(result).toBe('5m');
      expect(result).not.toContain('s');
    });
  });

  describe('getUrgencyLevel', () => {
    it('should return "normal" for > 5 minutes', () => {
      // Given (Arrange)
      const remainingMs = 6 * 60 * 1000; // 6 minutes

      // When (Act)
      const result = getUrgencyLevel(remainingMs);

      // Then (Assert)
      expect(result).toBe('normal');
    });

    it('should return "warning" for 2-5 minutes', () => {
      // Given (Arrange)
      const remainingMs = 3 * 60 * 1000; // 3 minutes

      // When (Act)
      const result = getUrgencyLevel(remainingMs);

      // Then (Assert)
      expect(result).toBe('warning');
    });

    it('should return "warning" for exactly 5 minutes', () => {
      // Given (Arrange) - Boundary test
      const remainingMs = 5 * 60 * 1000; // 5 minutes

      // When (Act)
      const result = getUrgencyLevel(remainingMs);

      // Then (Assert)
      expect(result).toBe('warning');
    });

    it('should return "warning" for exactly 2 minutes', () => {
      // Given (Arrange) - Boundary test
      const remainingMs = 2 * 60 * 1000; // 2 minutes

      // When (Act)
      const result = getUrgencyLevel(remainingMs);

      // Then (Assert)
      expect(result).toBe('warning');
    });

    it('should return "urgent" for < 2 minutes', () => {
      // Given (Arrange)
      const remainingMs = 90 * 1000; // 1.5 minutes

      // When (Act)
      const result = getUrgencyLevel(remainingMs);

      // Then (Assert)
      expect(result).toBe('urgent');
    });

    it('should return "critical" for <= 0', () => {
      // Given (Arrange)
      const remainingMs = 0;

      // When (Act)
      const result = getUrgencyLevel(remainingMs);

      // Then (Assert)
      expect(result).toBe('critical');
    });

    it('should return "critical" for negative values', () => {
      // Given (Arrange)
      const remainingMs = -1000;

      // When (Act)
      const result = getUrgencyLevel(remainingMs);

      // Then (Assert)
      expect(result).toBe('critical');
    });
  });

  describe('getUpdateInterval', () => {
    it('should return 30000ms (30s) for > 2 minutes', () => {
      // Given (Arrange)
      const remainingMs = 5 * 60 * 1000; // 5 minutes

      // When (Act)
      const result = getUpdateInterval(remainingMs);

      // Then (Assert)
      expect(result).toBe(30000);
    });

    it('should return 1000ms (1s) for < 2 minutes and >= 10 seconds', () => {
      // Given (Arrange)
      const remainingMs = 90 * 1000; // 1.5 minutes

      // When (Act)
      const result = getUpdateInterval(remainingMs);

      // Then (Assert)
      expect(result).toBe(1000);
    });

    it('should return 250ms for < 10 seconds (smooth visual without excessive CPU)', () => {
      // Given (Arrange)
      const remainingMs = 5 * 1000; // 5 seconds

      // When (Act)
      const result = getUpdateInterval(remainingMs);

      // Then (Assert)
      expect(result).toBe(250);
    });

    it('should return 0 for <= 0 (no updates needed)', () => {
      // Given (Arrange)
      const remainingMs = 0;

      // When (Act)
      const result = getUpdateInterval(remainingMs);

      // Then (Assert)
      expect(result).toBe(0);
    });

    it('should return 1000ms for exactly 2 minutes', () => {
      // Given (Arrange) - Boundary test
      const remainingMs = 2 * 60 * 1000; // 2 minutes

      // When (Act)
      const result = getUpdateInterval(remainingMs);

      // Then (Assert)
      expect(result).toBe(1000);
    });

    it('should return 250ms for exactly 10 seconds', () => {
      // Given (Arrange) - Boundary test
      const remainingMs = 10 * 1000; // 10 seconds

      // When (Act)
      const result = getUpdateInterval(remainingMs);

      // Then (Assert)
      expect(result).toBe(250);
    });
  });
});
