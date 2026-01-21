/**
 * Unit Tests fuer Intensification Store
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 2.3 Task 6:**
 * - State: { [erinnerungId]: { level, startedAt, lastEscalatedAt } }
 * - Selectors: getIntensityLevel, isIntensified
 * - Helper Functions: setIntensityLevel, clearIntensity, clearAllIntensifications
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  intensificationStore,
  setIntensityLevel,
  startIntensificationTracking,
  clearIntensity,
  clearAllIntensifications,
  getIntensityLevel,
  isIntensified,
  resetIntensificationStore,
  type IntensityLevel,
} from '../intensification.store';

describe('IntensificationStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    resetIntensificationStore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-19T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should have empty entries on initialization', () => {
      // Given (Arrange)
      resetIntensificationStore();

      // When (Act)
      const state = intensificationStore.state;

      // Then (Assert)
      expect(state.entries).toEqual({});
    });
  });

  describe('setIntensityLevel()', () => {
    it('should set intensity level for an erinnerung', () => {
      // Given (Arrange)
      const erinnerungId = 'test-id-1';
      const level: IntensityLevel = 'warning';

      // When (Act)
      setIntensityLevel(erinnerungId, level);

      // Then (Assert)
      const state = intensificationStore.state;
      expect(state.entries[erinnerungId]).toBeDefined();
      expect(state.entries[erinnerungId].level).toBe('warning');
    });

    it('should update existing entry level', () => {
      // Given (Arrange)
      const erinnerungId = 'test-id-1';
      setIntensityLevel(erinnerungId, 'warning');

      // When (Act)
      setIntensityLevel(erinnerungId, 'urgent');

      // Then (Assert)
      const state = intensificationStore.state;
      expect(state.entries[erinnerungId].level).toBe('urgent');
    });

    it('should set startedAt on first non-none level', () => {
      // Given (Arrange)
      const erinnerungId = 'test-id-1';

      // When (Act)
      setIntensityLevel(erinnerungId, 'warning');

      // Then (Assert)
      const state = intensificationStore.state;
      expect(state.entries[erinnerungId].startedAt).toBe('2026-01-19T12:00:00.000Z');
    });

    it('should preserve startedAt when updating level', () => {
      // Given (Arrange)
      const erinnerungId = 'test-id-1';
      setIntensityLevel(erinnerungId, 'warning');
      const originalStartedAt = intensificationStore.state.entries[erinnerungId].startedAt;

      // Advance time
      vi.advanceTimersByTime(30_000);
      vi.setSystemTime(new Date('2026-01-19T12:00:30.000Z'));

      // When (Act)
      setIntensityLevel(erinnerungId, 'urgent');

      // Then (Assert)
      const state = intensificationStore.state;
      expect(state.entries[erinnerungId].startedAt).toBe(originalStartedAt);
    });

    it('should update lastEscalatedAt on level change', () => {
      // Given (Arrange)
      const erinnerungId = 'test-id-1';
      setIntensityLevel(erinnerungId, 'warning');

      // Advance time
      vi.setSystemTime(new Date('2026-01-19T12:00:30.000Z'));

      // When (Act)
      setIntensityLevel(erinnerungId, 'urgent');

      // Then (Assert)
      const state = intensificationStore.state;
      expect(state.entries[erinnerungId].lastEscalatedAt).toBe('2026-01-19T12:00:30.000Z');
    });

    it('should set startedAt to null when level is none and no prior entry', () => {
      // Given (Arrange)
      const erinnerungId = 'test-id-1';

      // When (Act)
      setIntensityLevel(erinnerungId, 'none');

      // Then (Assert)
      const state = intensificationStore.state;
      expect(state.entries[erinnerungId].startedAt).toBeNull();
      expect(state.entries[erinnerungId].lastEscalatedAt).toBeNull();
    });
  });

  describe('startIntensificationTracking()', () => {
    it('should initialize tracking with level none', () => {
      // Given (Arrange)
      const erinnerungId = 'test-id-1';

      // When (Act)
      startIntensificationTracking(erinnerungId);

      // Then (Assert)
      const state = intensificationStore.state;
      expect(state.entries[erinnerungId].level).toBe('none');
    });

    it('should set startedAt to current time', () => {
      // Given (Arrange)
      const erinnerungId = 'test-id-1';

      // When (Act)
      startIntensificationTracking(erinnerungId);

      // Then (Assert)
      const state = intensificationStore.state;
      expect(state.entries[erinnerungId].startedAt).toBe('2026-01-19T12:00:00.000Z');
    });

    it('should set lastEscalatedAt to null', () => {
      // Given (Arrange)
      const erinnerungId = 'test-id-1';

      // When (Act)
      startIntensificationTracking(erinnerungId);

      // Then (Assert)
      const state = intensificationStore.state;
      expect(state.entries[erinnerungId].lastEscalatedAt).toBeNull();
    });

    it('should overwrite existing entry', () => {
      // Given (Arrange)
      const erinnerungId = 'test-id-1';
      setIntensityLevel(erinnerungId, 'warning');

      // When (Act)
      startIntensificationTracking(erinnerungId);

      // Then (Assert)
      const state = intensificationStore.state;
      expect(state.entries[erinnerungId].level).toBe('none');
    });
  });

  describe('clearIntensity()', () => {
    it('should remove entry from store', () => {
      // Given (Arrange)
      const erinnerungId = 'test-id-1';
      setIntensityLevel(erinnerungId, 'warning');
      expect(intensificationStore.state.entries[erinnerungId]).toBeDefined();

      // When (Act)
      clearIntensity(erinnerungId);

      // Then (Assert)
      const state = intensificationStore.state;
      expect(state.entries[erinnerungId]).toBeUndefined();
    });

    it('should not affect other entries', () => {
      // Given (Arrange)
      setIntensityLevel('test-id-1', 'warning');
      setIntensityLevel('test-id-2', 'urgent');

      // When (Act)
      clearIntensity('test-id-1');

      // Then (Assert)
      const state = intensificationStore.state;
      expect(state.entries['test-id-1']).toBeUndefined();
      expect(state.entries['test-id-2']).toBeDefined();
      expect(state.entries['test-id-2'].level).toBe('urgent');
    });

    it('should be safe to call for non-existent entry', () => {
      // Given (Arrange)
      // No entries

      // When (Act) & Then (Assert) - No errors
      expect(() => clearIntensity('non-existent')).not.toThrow();
    });
  });

  describe('clearAllIntensifications()', () => {
    it('should remove all entries from store', () => {
      // Given (Arrange)
      setIntensityLevel('test-id-1', 'warning');
      setIntensityLevel('test-id-2', 'urgent');
      setIntensityLevel('test-id-3', 'warning');

      // When (Act)
      clearAllIntensifications();

      // Then (Assert)
      const state = intensificationStore.state;
      expect(state.entries).toEqual({});
    });

    it('should be safe to call when already empty', () => {
      // Given (Arrange)
      // No entries

      // When (Act) & Then (Assert) - No errors
      expect(() => clearAllIntensifications()).not.toThrow();
    });
  });

  describe('resetIntensificationStore()', () => {
    it('should reset store to initial state', () => {
      // Given (Arrange)
      setIntensityLevel('test-id-1', 'warning');
      setIntensityLevel('test-id-2', 'urgent');

      // When (Act)
      resetIntensificationStore();

      // Then (Assert)
      const state = intensificationStore.state;
      expect(state.entries).toEqual({});
    });
  });

  describe('selectors', () => {
    describe('getIntensityLevel()', () => {
      it('should return none for unknown id', () => {
        // Given (Arrange)
        // No entries

        // When (Act)
        const level = getIntensityLevel('unknown-id');

        // Then (Assert)
        expect(level).toBe('none');
      });

      it('should return correct level for known id', () => {
        // Given (Arrange)
        setIntensityLevel('test-id-1', 'warning');
        setIntensityLevel('test-id-2', 'urgent');

        // When (Act) & Then (Assert)
        expect(getIntensityLevel('test-id-1')).toBe('warning');
        expect(getIntensityLevel('test-id-2')).toBe('urgent');
      });

      it('should return none after clearIntensity', () => {
        // Given (Arrange)
        setIntensityLevel('test-id-1', 'warning');
        clearIntensity('test-id-1');

        // When (Act)
        const level = getIntensityLevel('test-id-1');

        // Then (Assert)
        expect(level).toBe('none');
      });
    });

    describe('isIntensified()', () => {
      it('should return false for unknown id', () => {
        // Given (Arrange)
        // No entries

        // When (Act)
        const result = isIntensified('unknown-id');

        // Then (Assert)
        expect(result).toBe(false);
      });

      it('should return false for level none', () => {
        // Given (Arrange)
        startIntensificationTracking('test-id-1'); // Sets level to 'none'

        // When (Act)
        const result = isIntensified('test-id-1');

        // Then (Assert)
        expect(result).toBe(false);
      });

      it('should return true for warning level', () => {
        // Given (Arrange)
        setIntensityLevel('test-id-1', 'warning');

        // When (Act)
        const result = isIntensified('test-id-1');

        // Then (Assert)
        expect(result).toBe(true);
      });

      it('should return true for urgent level', () => {
        // Given (Arrange)
        setIntensityLevel('test-id-1', 'urgent');

        // When (Act)
        const result = isIntensified('test-id-1');

        // Then (Assert)
        expect(result).toBe(true);
      });
    });
  });

  describe('multiple entries management', () => {
    it('should handle multiple entries independently', () => {
      // Given (Arrange)
      const entries = [
        { id: 'test-1', level: 'none' as IntensityLevel },
        { id: 'test-2', level: 'warning' as IntensityLevel },
        { id: 'test-3', level: 'urgent' as IntensityLevel },
      ];

      // When (Act)
      for (const entry of entries) {
        setIntensityLevel(entry.id, entry.level);
      }

      // Then (Assert)
      expect(getIntensityLevel('test-1')).toBe('none');
      expect(getIntensityLevel('test-2')).toBe('warning');
      expect(getIntensityLevel('test-3')).toBe('urgent');
    });

    it('should count intensified entries correctly', () => {
      // Given (Arrange)
      startIntensificationTracking('test-1'); // none
      setIntensityLevel('test-2', 'warning');
      setIntensityLevel('test-3', 'urgent');
      setIntensityLevel('test-4', 'none');

      // When (Act)
      const state = intensificationStore.state;
      const intensifiedCount = Object.values(state.entries).filter((e) => e.level !== 'none').length;

      // Then (Assert)
      expect(intensifiedCount).toBe(2);
    });
  });

  describe('state immutability', () => {
    it('should create new state objects on updates', () => {
      // Given (Arrange)
      const stateBefore = intensificationStore.state;

      // When (Act)
      setIntensityLevel('test-id-1', 'warning');
      const stateAfter = intensificationStore.state;

      // Then (Assert)
      expect(stateBefore).not.toBe(stateAfter);
      expect(stateBefore.entries).not.toBe(stateAfter.entries);
    });
  });
});
