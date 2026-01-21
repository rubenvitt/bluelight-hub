/**
 * Unit Tests fuer Intensification Service
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 2.3:**
 * - AC1: Sound-Eskalation nach 30 Sekunden (info → warning)
 * - AC4: Intensivierung stoppt bei Reaktion
 * - AC5: Nur fuer AUSGELOEST Status
 *
 * **Story 2.4 (zukuenftig):**
 * - urgent Level nach 60 Sekunden
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IntensificationService } from '../intensification.service';

// Mock fuer intensification.store
vi.mock('../../stores/intensification.store', () => ({
  setIntensityLevel: vi.fn(),
  startIntensificationTracking: vi.fn(),
  clearIntensity: vi.fn(),
  clearAllIntensifications: vi.fn(),
  getIntensityLevel: vi.fn().mockReturnValue('none'),
}));

// Mock fuer logger
vi.mock('@/shared/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('IntensificationService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set current time to 2026-01-19 12:00:00
    vi.setSystemTime(new Date(2026, 0, 19, 12, 0, 0));
    IntensificationService.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    IntensificationService.reset();
    vi.useRealTimers();
  });

  describe('getInstance()', () => {
    it('should return singleton instance', () => {
      // Given (Arrange)
      const instance1 = IntensificationService.getInstance();

      // When (Act)
      const instance2 = IntensificationService.getInstance();

      // Then (Assert)
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      // Given (Arrange)
      const instance1 = IntensificationService.getInstance();

      // When (Act)
      IntensificationService.reset();
      const instance2 = IntensificationService.getInstance();

      // Then (Assert)
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('startTimer()', () => {
    it('should start a new timer for an erinnerung', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      const callback = vi.fn();
      const erinnerungId = 'test-id-1';
      const ausgeloestAm = Date.now();

      // When (Act)
      service.startTimer(erinnerungId, ausgeloestAm, callback);

      // Then (Assert)
      expect(service.hasActiveTimer(erinnerungId)).toBe(true);
      expect(service.getActiveTimerCount()).toBe(1);
      expect(service.getCurrentLevel(erinnerungId)).toBe('none');
    });

    it('should restart timer if already active', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const erinnerungId = 'test-id-1';

      service.startTimer(erinnerungId, Date.now(), callback1);

      // When (Act)
      service.startTimer(erinnerungId, Date.now(), callback2);

      // Then (Assert)
      expect(service.hasActiveTimer(erinnerungId)).toBe(true);
      expect(service.getActiveTimerCount()).toBe(1);

      // Verify new callback is used after escalation
      vi.advanceTimersByTime(31_000); // 31 seconds
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledWith(erinnerungId, 'warning');
    });

    it('should start multiple timers for different erinnerungen', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      const callback = vi.fn();

      // When (Act)
      service.startTimer('test-id-1', Date.now(), callback);
      service.startTimer('test-id-2', Date.now(), callback);
      service.startTimer('test-id-3', Date.now(), callback);

      // Then (Assert)
      expect(service.getActiveTimerCount()).toBe(3);
      expect(service.hasActiveTimer('test-id-1')).toBe(true);
      expect(service.hasActiveTimer('test-id-2')).toBe(true);
      expect(service.hasActiveTimer('test-id-3')).toBe(true);
    });
  });

  describe('stopTimer()', () => {
    it('should stop an active timer', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      const callback = vi.fn();
      const erinnerungId = 'test-id-1';
      service.startTimer(erinnerungId, Date.now(), callback);

      // When (Act)
      service.stopTimer(erinnerungId);

      // Then (Assert)
      expect(service.hasActiveTimer(erinnerungId)).toBe(false);
      expect(service.getActiveTimerCount()).toBe(0);
    });

    it('should do nothing if timer not active', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      const erinnerungId = 'non-existent-id';

      // When (Act) & Then (Assert) - No errors
      expect(() => service.stopTimer(erinnerungId)).not.toThrow();
      expect(service.hasActiveTimer(erinnerungId)).toBe(false);
    });

    it('should not trigger callback after timer is stopped', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      const callback = vi.fn();
      const erinnerungId = 'test-id-1';
      service.startTimer(erinnerungId, Date.now(), callback);

      // When (Act)
      service.stopTimer(erinnerungId);
      vi.advanceTimersByTime(60_000); // 60 seconds - past all thresholds

      // Then (Assert)
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('stopAllTimers()', () => {
    it('should stop all active timers', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      const callback = vi.fn();
      service.startTimer('test-id-1', Date.now(), callback);
      service.startTimer('test-id-2', Date.now(), callback);
      service.startTimer('test-id-3', Date.now(), callback);

      // When (Act)
      service.stopAllTimers();

      // Then (Assert)
      expect(service.getActiveTimerCount()).toBe(0);
      expect(service.hasActiveTimer('test-id-1')).toBe(false);
      expect(service.hasActiveTimer('test-id-2')).toBe(false);
      expect(service.hasActiveTimer('test-id-3')).toBe(false);
    });

    it('should not trigger callbacks after stopAllTimers', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      const callback = vi.fn();
      service.startTimer('test-id-1', Date.now(), callback);
      service.startTimer('test-id-2', Date.now(), callback);

      // When (Act)
      service.stopAllTimers();
      vi.advanceTimersByTime(60_000);

      // Then (Assert)
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('level escalation - Story 2.3', () => {
    it('should escalate to warning after 30 seconds (AC1)', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      const callback = vi.fn();
      const erinnerungId = 'test-id-1';

      service.startTimer(erinnerungId, Date.now(), callback);

      // When (Act)
      vi.advanceTimersByTime(30_000); // Exactly 30 seconds

      // Then (Assert)
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(erinnerungId, 'warning');
      expect(service.getCurrentLevel(erinnerungId)).toBe('warning');
    });

    it('should escalate to urgent after 60 seconds (Story 2.4)', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      const callback = vi.fn();
      const erinnerungId = 'test-id-1';

      service.startTimer(erinnerungId, Date.now(), callback);

      // When (Act)
      vi.advanceTimersByTime(60_000); // 60 seconds

      // Then (Assert)
      expect(callback).toHaveBeenCalledTimes(2); // warning + urgent
      expect(callback).toHaveBeenNthCalledWith(1, erinnerungId, 'warning');
      expect(callback).toHaveBeenNthCalledWith(2, erinnerungId, 'urgent');
      expect(service.getCurrentLevel(erinnerungId)).toBe('urgent');
    });

    it('should not escalate before 30 seconds', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      const callback = vi.fn();
      const erinnerungId = 'test-id-1';

      service.startTimer(erinnerungId, Date.now(), callback);

      // When (Act)
      vi.advanceTimersByTime(29_000); // 29 seconds - just before threshold

      // Then (Assert)
      expect(callback).not.toHaveBeenCalled();
      expect(service.getCurrentLevel(erinnerungId)).toBe('none');
    });

    it('should calculate elapsed time from ausgeloestAm', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      const callback = vi.fn();
      const erinnerungId = 'test-id-1';
      // Erinnerung wurde vor 20 Sekunden ausgeloest
      const ausgeloestAm = Date.now() - 20_000;

      service.startTimer(erinnerungId, ausgeloestAm, callback);

      // When (Act) - Nach 10 weiteren Sekunden (gesamt 30s)
      vi.advanceTimersByTime(10_000);

      // Then (Assert)
      expect(callback).toHaveBeenCalledWith(erinnerungId, 'warning');
    });

    it('should immediately escalate if already past threshold', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      const callback = vi.fn();
      const erinnerungId = 'test-id-1';
      // Erinnerung wurde vor 35 Sekunden ausgeloest (past warning threshold)
      const ausgeloestAm = Date.now() - 35_000;

      // When (Act) - sofortiger Check bei Start
      service.startTimer(erinnerungId, ausgeloestAm, callback);

      // Then (Assert) - Callback wird sofort bei Start aufgerufen
      expect(callback).toHaveBeenCalledWith(erinnerungId, 'warning');
    });
  });

  describe('multiple erinnerungen escalation', () => {
    it('should escalate multiple erinnerungen independently', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      const callback = vi.fn();
      const now = Date.now();

      service.startTimer('test-id-1', now, callback);
      // test-id-2 started 15 seconds later
      vi.advanceTimersByTime(15_000);
      service.startTimer('test-id-2', now + 15_000, callback);

      // When (Act) - Advance another 15 seconds (test-id-1 at 30s, test-id-2 at 15s)
      vi.advanceTimersByTime(15_000);

      // Then (Assert)
      expect(callback).toHaveBeenCalledWith('test-id-1', 'warning');
      expect(callback).not.toHaveBeenCalledWith('test-id-2', 'warning');

      // Advance another 15 seconds (test-id-1 at 45s, test-id-2 at 30s)
      vi.advanceTimersByTime(15_000);
      expect(callback).toHaveBeenCalledWith('test-id-2', 'warning');
    });
  });

  describe('callback error handling', () => {
    it('should catch callback errors and continue running', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const erinnerungId = 'test-id-1';

      service.startTimer(erinnerungId, Date.now(), errorCallback);

      // When (Act) - Should not throw
      expect(() => vi.advanceTimersByTime(30_000)).not.toThrow();

      // Then (Assert)
      expect(errorCallback).toHaveBeenCalled();
      // Service sollte weiter laufen
      expect(service.hasActiveTimer(erinnerungId)).toBe(true);
    });
  });

  describe('scheduling behavior (PERF-1 optimized)', () => {
    it('should schedule check precisely at next threshold', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      const callback = vi.fn();

      // Timer startet kurz nach 29 Sekunden (500ms bis warning)
      service.startTimer('test-id-1', Date.now() - 29_500, callback);

      // When (Act) - Warte genau bis zum Threshold
      vi.advanceTimersByTime(500);

      // Then (Assert) - Warning sollte bei 30s Elapsed getriggert werden
      expect(callback).toHaveBeenCalledWith('test-id-1', 'warning');
    });

    it('should stop scheduling when no active timers', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      const callback = vi.fn();
      service.startTimer('test-id-1', Date.now(), callback);

      // When (Act)
      service.stopTimer('test-id-1');

      // Then (Assert) - No active timers means scheduling should stop
      expect(service.getActiveTimerCount()).toBe(0);

      // Advance time - nothing should happen
      vi.advanceTimersByTime(60_000);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle immediately past thresholds', () => {
      // Given (Arrange) - Timer 35s in der Vergangenheit gestartet
      const service = IntensificationService.getInstance();
      const callback = vi.fn();

      // When (Act) - Timer mit bereits vergangenem Threshold starten
      service.startTimer('test-id-1', Date.now() - 35_000, callback);

      // Then (Assert) - Warning wird sofort bei Start getriggert
      expect(callback).toHaveBeenCalledWith('test-id-1', 'warning');
    });
  });

  describe('getCurrentLevel()', () => {
    it('should return none for non-existent erinnerung', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();

      // When (Act)
      const level = service.getCurrentLevel('non-existent');

      // Then (Assert)
      expect(level).toBe('none');
    });

    it('should return current level for active timer', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      service.startTimer('test-id-1', Date.now(), vi.fn());

      // When (Act)
      vi.advanceTimersByTime(30_000);

      // Then (Assert)
      expect(service.getCurrentLevel('test-id-1')).toBe('warning');
    });
  });

  describe('hasActiveTimer()', () => {
    it('should return true for active timer', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      service.startTimer('test-id-1', Date.now(), vi.fn());

      // When (Act) & Then (Assert)
      expect(service.hasActiveTimer('test-id-1')).toBe(true);
    });

    it('should return false for stopped timer', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      service.startTimer('test-id-1', Date.now(), vi.fn());
      service.stopTimer('test-id-1');

      // When (Act) & Then (Assert)
      expect(service.hasActiveTimer('test-id-1')).toBe(false);
    });
  });

  describe('race conditions', () => {
    it('should handle rapid start/stop cycles', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      const callback = vi.fn();

      // When (Act) - Rapid cycles
      for (let i = 0; i < 10; i++) {
        service.startTimer('test-id-1', Date.now(), callback);
        service.stopTimer('test-id-1');
      }

      // Then (Assert)
      expect(service.hasActiveTimer('test-id-1')).toBe(false);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle concurrent timer operations', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      const callbacks: Array<vi.Mock> = [];

      // When (Act)
      for (let i = 0; i < 100; i++) {
        const cb = vi.fn();
        callbacks.push(cb);
        service.startTimer(`test-id-${i}`, Date.now(), cb);
      }

      vi.advanceTimersByTime(30_000);

      // Then (Assert) - Alle 100 Timer sollten eskaliert sein
      for (const cb of callbacks) {
        expect(cb).toHaveBeenCalledTimes(1);
      }
      expect(service.getActiveTimerCount()).toBe(100);
    });
  });

  describe('static reset()', () => {
    it('should clean up singleton instance', () => {
      // Given (Arrange)
      const service = IntensificationService.getInstance();
      service.startTimer('test-id-1', Date.now(), vi.fn());
      expect(service.getActiveTimerCount()).toBe(1);

      // When (Act)
      IntensificationService.reset();

      // Then (Assert)
      const newService = IntensificationService.getInstance();
      expect(newService.getActiveTimerCount()).toBe(0);
    });

    it('should be safe to call multiple times', () => {
      // Given (Arrange)
      IntensificationService.getInstance();

      // When (Act) & Then (Assert) - No errors
      IntensificationService.reset();
      IntensificationService.reset();
      IntensificationService.reset();
    });
  });
});
