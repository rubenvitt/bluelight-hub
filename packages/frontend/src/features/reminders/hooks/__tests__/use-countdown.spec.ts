/**
 * Unit Tests für useCountdown Hook
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 1.7 AC3, AC4:**
 * - Hook gibt korrekten CountdownState zurück
 * - Dynamische Update-Intervalle basierend auf verbleibender Zeit
 * - Proper Cleanup bei Unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountdown } from '../use-countdown';

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should return correct initial state for future date', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:05:00Z'); // 5 minutes ahead

      // When (Act)
      const { result } = renderHook(() => useCountdown(faelligAm));

      // Then (Assert)
      expect(result.current.remaining).toBe(5 * 60 * 1000); // 5 min in ms
      expect(result.current.formatted).toBe('5m');
      expect(result.current.isOverdue).toBe(false);
      expect(result.current.urgencyLevel).toBe('warning'); // 5 min = warning
    });

    it('should return overdue state for past date', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T09:55:00Z'); // 5 minutes past

      // When (Act)
      const { result } = renderHook(() => useCountdown(faelligAm));

      // Then (Assert)
      expect(result.current.remaining).toBeLessThanOrEqual(0);
      expect(result.current.formatted).toBe('Jetzt fällig!');
      expect(result.current.isOverdue).toBe(true);
      expect(result.current.urgencyLevel).toBe('critical');
    });

    it('should handle string date input', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = '2026-01-20T10:10:00Z'; // 10 minutes ahead

      // When (Act)
      const { result } = renderHook(() => useCountdown(faelligAm));

      // Then (Assert)
      expect(result.current.remaining).toBe(10 * 60 * 1000);
      expect(result.current.urgencyLevel).toBe('normal'); // > 5 min
    });
  });

  describe('Urgency Levels', () => {
    it('should return "normal" for > 5 minutes', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:10:00Z'); // 10 minutes

      // When (Act)
      const { result } = renderHook(() => useCountdown(faelligAm));

      // Then (Assert)
      expect(result.current.urgencyLevel).toBe('normal');
    });

    it('should return "warning" for 2-5 minutes', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:03:00Z'); // 3 minutes

      // When (Act)
      const { result } = renderHook(() => useCountdown(faelligAm));

      // Then (Assert)
      expect(result.current.urgencyLevel).toBe('warning');
    });

    it('should return "urgent" for < 2 minutes', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:01:00Z'); // 1 minute

      // When (Act)
      const { result } = renderHook(() => useCountdown(faelligAm));

      // Then (Assert)
      expect(result.current.urgencyLevel).toBe('urgent');
    });
  });

  describe('Formatted Output', () => {
    it('should show hours and minutes for > 1 hour', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T12:30:00Z'); // 2h 30m

      // When (Act)
      const { result } = renderHook(() => useCountdown(faelligAm));

      // Then (Assert)
      expect(result.current.formatted).toBe('2h 30m');
    });

    it('should show only minutes for > 2 minutes', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:15:00Z'); // 15 minutes

      // When (Act)
      const { result } = renderHook(() => useCountdown(faelligAm));

      // Then (Assert)
      expect(result.current.formatted).toBe('15m');
    });

    it('should show minutes and seconds for < 2 minutes', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:01:30Z'); // 1m 30s

      // When (Act)
      const { result } = renderHook(() => useCountdown(faelligAm));

      // Then (Assert)
      expect(result.current.formatted).toBe('1m 30s');
    });

    it('should show only seconds for < 1 minute', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:00:30Z'); // 30 seconds

      // When (Act)
      const { result } = renderHook(() => useCountdown(faelligAm));

      // Then (Assert)
      expect(result.current.formatted).toBe('30s');
    });
  });

  describe('Dynamic Updates', () => {
    it('should update countdown after interval (30s for > 2 min)', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:10:00Z'); // 10 minutes

      // When (Act)
      const { result } = renderHook(() => useCountdown(faelligAm));

      // Initial state
      expect(result.current.formatted).toBe('10m');

      // Advance time by 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      // Then (Assert) - Should update
      expect(result.current.remaining).toBeLessThan(10 * 60 * 1000);
    });

    it('should update every 1 second when < 2 minutes', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:01:30Z'); // 1m 30s

      // When (Act)
      const { result } = renderHook(() => useCountdown(faelligAm));

      // Initial state
      expect(result.current.formatted).toBe('1m 30s');

      // Advance time by 1 second
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Then (Assert) - Should update to 1m 29s
      expect(result.current.formatted).toBe('1m 29s');
    });

    it('should update very frequently when < 10 seconds', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:00:05Z'); // 5 seconds

      // When (Act)
      const { result } = renderHook(() => useCountdown(faelligAm));

      // Initial state
      expect(result.current.formatted).toBe('5s');

      // Advance time by 100ms
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Then (Assert) - Should still be around 5s (but may have updated)
      expect(result.current.remaining).toBeLessThanOrEqual(5000);
    });
  });

  describe('Interval Changes', () => {
    it('should switch to faster interval when crossing 2 minute threshold', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:02:30Z'); // 2m 30s

      // When (Act)
      const { result } = renderHook(() => useCountdown(faelligAm));

      // Initially > 2 min, should use 30s interval (or 1s since borderline)
      expect(result.current.urgencyLevel).toBe('warning');

      // Advance to < 2 min
      act(() => {
        vi.advanceTimersByTime(35000); // Now at ~1m 55s
      });

      // Then (Assert) - Should now be urgent
      expect(result.current.urgencyLevel).toBe('urgent');
      expect(result.current.formatted).toMatch(/s$/); // Should show seconds
    });
  });

  describe('Cleanup', () => {
    it('should clear interval on unmount', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:05:00Z');
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      // When (Act)
      const { unmount } = renderHook(() => useCountdown(faelligAm));
      unmount();

      // Then (Assert)
      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
    });

    it('should stop updates after becoming overdue', () => {
      // Given (Arrange)
      vi.setSystemTime(new Date('2026-01-20T10:00:00Z'));
      const faelligAm = new Date('2026-01-20T10:00:02Z'); // 2 seconds

      // When (Act)
      const { result } = renderHook(() => useCountdown(faelligAm));

      // Advance past due time
      act(() => {
        vi.advanceTimersByTime(5000); // 5 seconds
      });

      // Then (Assert) - Should be overdue and show "Jetzt fällig!"
      expect(result.current.isOverdue).toBe(true);
      expect(result.current.formatted).toBe('Jetzt fällig!');
    });
  });
});
