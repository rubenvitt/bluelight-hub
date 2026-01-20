/**
 * Unit Tests fuer Timer Service
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 1.5 AC1, AC6:**
 * - Polling-Interval: 500ms (<1s Latenz Garantie)
 * - Trigger-Logik: faelligAm <= Date.now() UND status === 'GEPLANT'
 * - Deduplizierung: Keine Mehrfach-Ausloesung
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ErinnerungResponseDto } from '@bluelight-hub/shared/client';
import { TimerService } from '../timer.service';

/**
 * Factory fuer Test-Erinnerungen
 */
function createTestErinnerung(overrides: Partial<ErinnerungResponseDto> = {}): ErinnerungResponseDto {
  return {
    id: 'test-id-1',
    einsatzId: 'einsatz-1',
    titel: 'Test Erinnerung',
    beschreibung: null,
    faelligAm: new Date(2026, 0, 19, 12, 30, 0).toISOString(),
    status: 'GEPLANT',
    erstelltVon: 'user-1',
    createdAt: new Date(2026, 0, 19, 12, 0, 0).toISOString(),
    updatedAt: new Date(2026, 0, 19, 12, 0, 0).toISOString(),
    ...overrides,
  };
}

describe('TimerService', () => {
  let timerService: TimerService;

  beforeEach(() => {
    vi.useFakeTimers();
    // Set current time to 2026-01-19 12:00:00
    vi.setSystemTime(new Date(2026, 0, 19, 12, 0, 0));
    timerService = new TimerService();
  });

  afterEach(() => {
    timerService.stop();
    vi.useRealTimers();
  });

  describe('start()', () => {
    it('should set isRunning to true when started', () => {
      // Given (Arrange)
      const erinnerungen: ErinnerungResponseDto[] = [];
      const onTrigger = vi.fn();

      // When (Act)
      timerService.start(erinnerungen, 'test-einsatz-1', onTrigger);

      // Then (Assert)
      expect(timerService.isRunning()).toBe(true);
    });

    it('should stop previous timer before starting new one', () => {
      // Given (Arrange)
      const erinnerungen: ErinnerungResponseDto[] = [];
      const onTrigger1 = vi.fn();
      const onTrigger2 = vi.fn();
      timerService.start(erinnerungen, 'test-einsatz-1', onTrigger1);

      // When (Act)
      timerService.start(erinnerungen, 'test-einsatz-1', onTrigger2);

      // Then (Assert)
      expect(timerService.isRunning()).toBe(true);
      // After 500ms, only onTrigger2 should be used
      vi.advanceTimersByTime(500);
      // No erinnerungen, so no trigger calls
      expect(onTrigger1).not.toHaveBeenCalled();
      expect(onTrigger2).not.toHaveBeenCalled();
    });

    it('should perform immediate check on start (AC1)', () => {
      // Given (Arrange) - Erinnerung bereits faellig
      const erinnerung = createTestErinnerung({
        faelligAm: new Date(2026, 0, 19, 11, 59, 0).toISOString(), // 1 min in the past
        status: 'GEPLANT',
      });
      const onTrigger = vi.fn();

      // When (Act)
      timerService.start([erinnerung], 'test-einsatz-1', onTrigger);

      // Then (Assert) - Sofortiger Trigger ohne Timer-Wartezeit
      expect(onTrigger).toHaveBeenCalledTimes(1);
      expect(onTrigger).toHaveBeenCalledWith(erinnerung);
    });
  });

  describe('stop()', () => {
    it('should set isRunning to false when stopped', () => {
      // Given (Arrange)
      const erinnerungen: ErinnerungResponseDto[] = [];
      timerService.start(erinnerungen, 'test-einsatz-1', vi.fn());

      // When (Act)
      timerService.stop();

      // Then (Assert)
      expect(timerService.isRunning()).toBe(false);
    });

    it('should not trigger after stop', () => {
      // Given (Arrange) - Erinnerung wird in 500ms faellig
      const erinnerung = createTestErinnerung({
        faelligAm: new Date(2026, 0, 19, 12, 0, 1).toISOString(), // 1 sec in future
        status: 'GEPLANT',
      });
      const onTrigger = vi.fn();
      timerService.start([erinnerung], 'test-einsatz-1', onTrigger);

      // When (Act)
      timerService.stop();
      vi.advanceTimersByTime(5000); // Advance well past the due time

      // Then (Assert)
      expect(onTrigger).not.toHaveBeenCalled();
    });

    it('should clear triggered IDs on stop', () => {
      // Given (Arrange)
      const erinnerung = createTestErinnerung({
        faelligAm: new Date(2026, 0, 19, 11, 59, 0).toISOString(),
        status: 'GEPLANT',
      });
      timerService.start([erinnerung], 'test-einsatz-1', vi.fn());
      expect(timerService.getTriggeredCount()).toBe(1);

      // When (Act)
      timerService.stop();

      // Then (Assert)
      expect(timerService.getTriggeredCount()).toBe(0);
    });

    it('should be safe to call multiple times', () => {
      // Given (Arrange)
      timerService.start([], 'test-einsatz-1', vi.fn());

      // When (Act) & Then (Assert) - No errors
      timerService.stop();
      timerService.stop();
      timerService.stop();
      expect(timerService.isRunning()).toBe(false);
    });
  });

  describe('start() deduplication preservation', () => {
    it('should PRESERVE triggeredIds when restarting with same einsatzId (fixes race condition)', () => {
      // Given (Arrange) - Erinnerung triggered
      const erinnerung = createTestErinnerung({
        faelligAm: new Date(2026, 0, 19, 11, 59, 0).toISOString(),
        status: 'GEPLANT',
      });
      const onTrigger = vi.fn();
      timerService.start([erinnerung], 'test-einsatz-1', onTrigger);
      expect(onTrigger).toHaveBeenCalledTimes(1);
      expect(timerService.getTriggeredCount()).toBe(1);

      // When (Act) - Restart with same einsatzId (simulates Query refetch)
      timerService.start([erinnerung], 'test-einsatz-1', onTrigger);
      vi.advanceTimersByTime(500);

      // Then (Assert) - Still only triggered once (triggeredIds preserved)
      expect(onTrigger).toHaveBeenCalledTimes(1);
      expect(timerService.getTriggeredCount()).toBe(1);
    });

    it('should CLEAR triggeredIds when restarting with different einsatzId', () => {
      // Given (Arrange) - Erinnerung triggered for einsatz-1
      const erinnerung1 = createTestErinnerung({
        id: 'erin-1',
        faelligAm: new Date(2026, 0, 19, 11, 59, 0).toISOString(),
        status: 'GEPLANT',
      });
      const onTrigger = vi.fn();
      timerService.start([erinnerung1], 'test-einsatz-1', onTrigger);
      expect(onTrigger).toHaveBeenCalledTimes(1);
      expect(timerService.getTriggeredCount()).toBe(1);

      // When (Act) - Start with different einsatzId
      const erinnerung2 = createTestErinnerung({
        id: 'erin-2',
        faelligAm: new Date(2026, 0, 19, 11, 59, 0).toISOString(),
        status: 'GEPLANT',
      });
      timerService.start([erinnerung2], 'test-einsatz-2', onTrigger);

      // Then (Assert) - New erinnerung triggered, triggeredIds cleared
      expect(onTrigger).toHaveBeenCalledTimes(2);
      expect(timerService.getTriggeredCount()).toBe(1); // Only erin-2 now
    });
  });

  describe('trigger logic (AC1, AC6)', () => {
    it('should trigger when faelligAm <= now (AC1)', () => {
      // Given (Arrange) - Erinnerung genau jetzt faellig
      const erinnerung = createTestErinnerung({
        faelligAm: new Date(2026, 0, 19, 12, 0, 0).toISOString(), // Exactly now
        status: 'GEPLANT',
      });
      const onTrigger = vi.fn();

      // When (Act)
      timerService.start([erinnerung], 'test-einsatz-1', onTrigger);

      // Then (Assert) - Trigger bei faelligAm === now
      expect(onTrigger).toHaveBeenCalledTimes(1);
      expect(onTrigger).toHaveBeenCalledWith(erinnerung);
    });

    it('should trigger when faelligAm is in the past (AC1)', () => {
      // Given (Arrange)
      const erinnerung = createTestErinnerung({
        faelligAm: new Date(2026, 0, 19, 11, 0, 0).toISOString(), // 1 hour ago
        status: 'GEPLANT',
      });
      const onTrigger = vi.fn();

      // When (Act)
      timerService.start([erinnerung], 'test-einsatz-1', onTrigger);

      // Then (Assert)
      expect(onTrigger).toHaveBeenCalledTimes(1);
    });

    it('should NOT trigger when faelligAm is in the future (AC1)', () => {
      // Given (Arrange)
      const erinnerung = createTestErinnerung({
        faelligAm: new Date(2026, 0, 19, 13, 0, 0).toISOString(), // 1 hour in future
        status: 'GEPLANT',
      });
      const onTrigger = vi.fn();

      // When (Act)
      timerService.start([erinnerung], 'test-einsatz-1', onTrigger);

      // Then (Assert)
      expect(onTrigger).not.toHaveBeenCalled();
    });

    it('should trigger after 500ms when erinnerung becomes due (NFR1: <1s latency)', () => {
      // Given (Arrange) - Erinnerung wird in 250ms faellig
      const erinnerung = createTestErinnerung({
        faelligAm: new Date(2026, 0, 19, 12, 0, 0, 250).toISOString(),
        status: 'GEPLANT',
      });
      const onTrigger = vi.fn();
      timerService.start([erinnerung], 'test-einsatz-1', onTrigger);
      expect(onTrigger).not.toHaveBeenCalled(); // Not yet

      // When (Act) - Advance time by 500ms (check interval)
      vi.advanceTimersByTime(500);

      // Then (Assert) - Triggered within 500ms of becoming due
      expect(onTrigger).toHaveBeenCalledTimes(1);
    });

    it('should only trigger erinnerungen with status GEPLANT (AC6)', () => {
      // Given (Arrange) - Various statuses
      const geplant = createTestErinnerung({
        id: 'geplant-1',
        faelligAm: new Date(2026, 0, 19, 11, 59, 0).toISOString(),
        status: 'GEPLANT',
      });
      const ausgeloest = createTestErinnerung({
        id: 'ausgeloest-1',
        faelligAm: new Date(2026, 0, 19, 11, 59, 0).toISOString(),
        status: 'AUSGELOEST',
      });
      const acknowledged = createTestErinnerung({
        id: 'ack-1',
        faelligAm: new Date(2026, 0, 19, 11, 59, 0).toISOString(),
        status: 'ACKNOWLEDGED',
      });
      const erledigt = createTestErinnerung({
        id: 'erledigt-1',
        faelligAm: new Date(2026, 0, 19, 11, 59, 0).toISOString(),
        status: 'ERLEDIGT',
      });
      const onTrigger = vi.fn();

      // When (Act)
      timerService.start([geplant, ausgeloest, acknowledged, erledigt], 'test-einsatz-1', onTrigger);

      // Then (Assert) - Nur GEPLANT wird getriggert
      expect(onTrigger).toHaveBeenCalledTimes(1);
      expect(onTrigger).toHaveBeenCalledWith(geplant);
    });
  });

  describe('deduplication', () => {
    it('should NOT trigger same erinnerung twice (deduplication)', () => {
      // Given (Arrange)
      const erinnerung = createTestErinnerung({
        faelligAm: new Date(2026, 0, 19, 11, 59, 0).toISOString(),
        status: 'GEPLANT',
      });
      const onTrigger = vi.fn();
      timerService.start([erinnerung], 'test-einsatz-1', onTrigger);
      expect(onTrigger).toHaveBeenCalledTimes(1);

      // When (Act) - Wait for multiple check cycles
      vi.advanceTimersByTime(2500); // 5 check cycles

      // Then (Assert) - Still only triggered once
      expect(onTrigger).toHaveBeenCalledTimes(1);
    });

    it('should allow re-trigger after resetTriggered()', () => {
      // Given (Arrange)
      const erinnerung = createTestErinnerung({
        faelligAm: new Date(2026, 0, 19, 11, 59, 0).toISOString(),
        status: 'GEPLANT',
      });
      const onTrigger = vi.fn();
      timerService.start([erinnerung], 'test-einsatz-1', onTrigger);
      expect(onTrigger).toHaveBeenCalledTimes(1);

      // When (Act)
      timerService.resetTriggered(erinnerung.id);
      vi.advanceTimersByTime(500);

      // Then (Assert) - Triggered again after reset
      expect(onTrigger).toHaveBeenCalledTimes(2);
    });

    it('should track triggered count correctly', () => {
      // Given (Arrange)
      const erinnerung1 = createTestErinnerung({
        id: 'test-1',
        faelligAm: new Date(2026, 0, 19, 11, 59, 0).toISOString(),
      });
      const erinnerung2 = createTestErinnerung({
        id: 'test-2',
        faelligAm: new Date(2026, 0, 19, 11, 58, 0).toISOString(),
      });
      const onTrigger = vi.fn();

      // When (Act)
      timerService.start([erinnerung1, erinnerung2], 'test-einsatz-1', onTrigger);

      // Then (Assert)
      expect(timerService.getTriggeredCount()).toBe(2);
    });
  });

  describe('updateErinnerungen()', () => {
    it('should update watched erinnerungen without restarting timer', () => {
      // Given (Arrange)
      const erinnerung1 = createTestErinnerung({
        id: 'test-1',
        faelligAm: new Date(2026, 0, 19, 13, 0, 0).toISOString(), // Future
      });
      const onTrigger = vi.fn();
      timerService.start([erinnerung1], 'test-einsatz-1', onTrigger);

      // When (Act) - Add a new erinnerung that's already due
      const erinnerung2 = createTestErinnerung({
        id: 'test-2',
        faelligAm: new Date(2026, 0, 19, 11, 59, 0).toISOString(), // Past
      });
      timerService.updateErinnerungen([erinnerung1, erinnerung2], 'test-einsatz-1');
      vi.advanceTimersByTime(500);

      // Then (Assert) - New erinnerung triggers
      expect(onTrigger).toHaveBeenCalledTimes(1);
      expect(onTrigger).toHaveBeenCalledWith(erinnerung2);
    });

    it('should preserve triggered IDs when updating', () => {
      // Given (Arrange)
      const erinnerung = createTestErinnerung({
        faelligAm: new Date(2026, 0, 19, 11, 59, 0).toISOString(),
      });
      const onTrigger = vi.fn();
      timerService.start([erinnerung], 'test-einsatz-1', onTrigger);
      expect(timerService.getTriggeredCount()).toBe(1);

      // When (Act) - Update with same erinnerung
      timerService.updateErinnerungen([erinnerung], 'test-einsatz-1');
      vi.advanceTimersByTime(500);

      // Then (Assert) - Not triggered again
      expect(onTrigger).toHaveBeenCalledTimes(1);
    });

    it('C5 Fix: should ignore updates from wrong einsatzId context', () => {
      // Given (Arrange) - Start timer with einsatz-1
      const erinnerung1 = createTestErinnerung({
        id: 'test-1',
        einsatzId: 'einsatz-1',
        faelligAm: new Date(2026, 0, 19, 13, 0, 0).toISOString(), // Future
      });
      const onTrigger = vi.fn();
      timerService.start([erinnerung1], 'test-einsatz-1', onTrigger);

      // When (Act) - Attempt update with wrong einsatzId
      const erinnerung2 = createTestErinnerung({
        id: 'test-2',
        einsatzId: 'einsatz-2',
        faelligAm: new Date(2026, 0, 19, 11, 59, 0).toISOString(), // Past (should trigger)
      });
      timerService.updateErinnerungen([erinnerung2], 'test-einsatz-2'); // Wrong context!
      vi.advanceTimersByTime(500);

      // Then (Assert) - Update ignored, original erinnerung1 still watched, erinnerung2 not triggered
      expect(onTrigger).not.toHaveBeenCalled(); // erinnerung1 not due yet
    });
  });

  describe('multiple erinnerungen', () => {
    it('should trigger multiple erinnerungen when all are due', () => {
      // Given (Arrange)
      const erinnerung1 = createTestErinnerung({
        id: 'test-1',
        faelligAm: new Date(2026, 0, 19, 11, 59, 0).toISOString(),
      });
      const erinnerung2 = createTestErinnerung({
        id: 'test-2',
        faelligAm: new Date(2026, 0, 19, 11, 58, 0).toISOString(),
      });
      const erinnerung3 = createTestErinnerung({
        id: 'test-3',
        faelligAm: new Date(2026, 0, 19, 11, 57, 0).toISOString(),
      });
      const onTrigger = vi.fn();

      // When (Act)
      timerService.start([erinnerung1, erinnerung2, erinnerung3], 'test-einsatz-1', onTrigger);

      // Then (Assert)
      expect(onTrigger).toHaveBeenCalledTimes(3);
      expect(onTrigger).toHaveBeenCalledWith(erinnerung1);
      expect(onTrigger).toHaveBeenCalledWith(erinnerung2);
      expect(onTrigger).toHaveBeenCalledWith(erinnerung3);
    });

    it('should trigger erinnerungen in sequence as they become due', () => {
      // Given (Arrange) - current time: 12:00:00
      const erinnerung1 = createTestErinnerung({
        id: 'test-1',
        faelligAm: new Date(2026, 0, 19, 12, 0, 0, 300).toISOString(), // +300ms
      });
      const erinnerung2 = createTestErinnerung({
        id: 'test-2',
        faelligAm: new Date(2026, 0, 19, 12, 0, 1).toISOString(), // +1s
      });
      const triggeredOrder: string[] = [];
      const onTrigger = vi.fn((e: ErinnerungResponseDto) => {
        triggeredOrder.push(e.id);
      });

      timerService.start([erinnerung1, erinnerung2], 'test-einsatz-1', onTrigger);
      expect(onTrigger).not.toHaveBeenCalled();

      // When (Act) - First becomes due after 500ms
      vi.advanceTimersByTime(500);

      // Then (Assert)
      expect(triggeredOrder).toEqual(['test-1']);

      // When (Act) - Second becomes due after another 500ms
      vi.advanceTimersByTime(500);

      // Then (Assert)
      expect(triggeredOrder).toEqual(['test-1', 'test-2']);
    });
  });

  describe('edge cases', () => {
    it('should handle empty erinnerungen array', () => {
      // Given (Arrange)
      const onTrigger = vi.fn();

      // When (Act)
      timerService.start([], 'test-einsatz-1', onTrigger);
      vi.advanceTimersByTime(5000);

      // Then (Assert) - No errors, no triggers
      expect(onTrigger).not.toHaveBeenCalled();
      expect(timerService.isRunning()).toBe(true);
    });

    it('should handle null/undefined beschreibung', () => {
      // Given (Arrange)
      const erinnerung = createTestErinnerung({
        beschreibung: null,
        faelligAm: new Date(2026, 0, 19, 11, 59, 0).toISOString(),
      });
      const onTrigger = vi.fn();

      // When (Act)
      timerService.start([erinnerung], 'test-einsatz-1', onTrigger);

      // Then (Assert)
      expect(onTrigger).toHaveBeenCalledTimes(1);
    });

    it('should handle ISO date strings correctly', () => {
      // Given (Arrange)
      // Setze System-Zeit auf einen bekannten UTC-Zeitpunkt
      vi.setSystemTime(new Date('2026-01-19T12:00:00.000Z'));
      const isoDatePast = '2026-01-19T11:59:00.000Z'; // 1 min in der Vergangenheit (UTC)
      const erinnerung = createTestErinnerung({
        faelligAm: isoDatePast,
      });
      const onTrigger = vi.fn();

      // When (Act)
      timerService.start([erinnerung], 'test-einsatz-1', onTrigger);

      // Then (Assert)
      expect(onTrigger).toHaveBeenCalledTimes(1);
    });
  });
});
