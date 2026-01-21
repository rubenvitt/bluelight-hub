/**
 * Unit Tests fuer FloatingPill Store
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 2.4 Task 7:**
 * - State: { activeFloatingPills: Record<erinnerungId, FloatingPillEntry> }
 * - Actions: showFloatingPill, hideFloatingPill, hideAllFloatingPills
 * - Selectors: useActiveFloatingPills, useIsFloating
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { floatingPillStore, showFloatingPill, hideFloatingPill, hideAllFloatingPills, resetFloatingPillStore, isFloating, getActiveFloatingPills, getFloatingPillCount } from '../floating-pill.store';

describe('FloatingPillStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    resetFloatingPillStore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-21T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should have empty activeFloatingPills on initialization', () => {
      // Given (Arrange)
      resetFloatingPillStore();

      // When (Act)
      const state = floatingPillStore.state;

      // Then (Assert)
      expect(state.activeFloatingPills).toEqual({});
    });
  });

  describe('showFloatingPill()', () => {
    it('should add a FloatingPill entry for an erinnerung', () => {
      // Given (Arrange)
      const erinnerungId = 'test-id-1';
      const data = {
        titel: 'Test Erinnerung',
        ausgeloestAm: '2026-01-21T11:59:00.000Z',
      };

      // When (Act)
      showFloatingPill(erinnerungId, data);

      // Then (Assert)
      const state = floatingPillStore.state;
      expect(state.activeFloatingPills[erinnerungId]).toBeDefined();
      expect(state.activeFloatingPills[erinnerungId].erinnerungId).toBe(erinnerungId);
      expect(state.activeFloatingPills[erinnerungId].titel).toBe('Test Erinnerung');
      expect(state.activeFloatingPills[erinnerungId].ausgeloestAm).toBe('2026-01-21T11:59:00.000Z');
      expect(state.activeFloatingPills[erinnerungId].activatedAt).toBe('2026-01-21T12:00:00.000Z');
    });

    it('should update existing FloatingPill entry if called again', () => {
      // Given (Arrange)
      const erinnerungId = 'test-id-1';
      showFloatingPill(erinnerungId, {
        titel: 'Original Titel',
        ausgeloestAm: '2026-01-21T11:58:00.000Z',
      });

      // Advance time
      vi.advanceTimersByTime(5_000);
      vi.setSystemTime(new Date('2026-01-21T12:00:05.000Z'));

      // When (Act)
      showFloatingPill(erinnerungId, {
        titel: 'Updated Titel',
        ausgeloestAm: '2026-01-21T11:59:00.000Z',
      });

      // Then (Assert)
      const state = floatingPillStore.state;
      expect(state.activeFloatingPills[erinnerungId].titel).toBe('Updated Titel');
      expect(state.activeFloatingPills[erinnerungId].activatedAt).toBe('2026-01-21T12:00:05.000Z');
    });

    it('should support multiple FloatingPills simultaneously', () => {
      // Given (Arrange)
      const ids = ['id-1', 'id-2', 'id-3'];

      // When (Act)
      for (const id of ids) {
        showFloatingPill(id, { titel: `Erinnerung ${id}`, ausgeloestAm: '2026-01-21T11:59:00.000Z' });
      }

      // Then (Assert)
      const state = floatingPillStore.state;
      expect(Object.keys(state.activeFloatingPills)).toHaveLength(3);
      expect(state.activeFloatingPills['id-1']).toBeDefined();
      expect(state.activeFloatingPills['id-2']).toBeDefined();
      expect(state.activeFloatingPills['id-3']).toBeDefined();
    });

    it('should ignore invalid erinnerungId', () => {
      // Given (Arrange)
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // When (Act)
      showFloatingPill('', { titel: 'Test', ausgeloestAm: '2026-01-21T11:59:00.000Z' });
      // @ts-expect-error Testing invalid input
      showFloatingPill(null, { titel: 'Test', ausgeloestAm: '2026-01-21T11:59:00.000Z' });

      // Then (Assert)
      const state = floatingPillStore.state;
      expect(Object.keys(state.activeFloatingPills)).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('hideFloatingPill()', () => {
    it('should remove a FloatingPill entry', () => {
      // Given (Arrange)
      const erinnerungId = 'test-id-1';
      showFloatingPill(erinnerungId, { titel: 'Test', ausgeloestAm: '2026-01-21T11:59:00.000Z' });
      expect(floatingPillStore.state.activeFloatingPills[erinnerungId]).toBeDefined();

      // When (Act)
      hideFloatingPill(erinnerungId);

      // Then (Assert)
      const state = floatingPillStore.state;
      expect(state.activeFloatingPills[erinnerungId]).toBeUndefined();
    });

    it('should not affect other FloatingPills when hiding one', () => {
      // Given (Arrange)
      showFloatingPill('id-1', { titel: 'Erinnerung 1', ausgeloestAm: '2026-01-21T11:59:00.000Z' });
      showFloatingPill('id-2', { titel: 'Erinnerung 2', ausgeloestAm: '2026-01-21T11:59:00.000Z' });
      showFloatingPill('id-3', { titel: 'Erinnerung 3', ausgeloestAm: '2026-01-21T11:59:00.000Z' });

      // When (Act)
      hideFloatingPill('id-2');

      // Then (Assert)
      const state = floatingPillStore.state;
      expect(Object.keys(state.activeFloatingPills)).toHaveLength(2);
      expect(state.activeFloatingPills['id-1']).toBeDefined();
      expect(state.activeFloatingPills['id-2']).toBeUndefined();
      expect(state.activeFloatingPills['id-3']).toBeDefined();
    });

    it('should be idempotent (hiding non-existent id does nothing)', () => {
      // Given (Arrange)
      showFloatingPill('id-1', { titel: 'Erinnerung 1', ausgeloestAm: '2026-01-21T11:59:00.000Z' });

      // When (Act)
      hideFloatingPill('non-existent-id');

      // Then (Assert)
      const state = floatingPillStore.state;
      expect(Object.keys(state.activeFloatingPills)).toHaveLength(1);
      expect(state.activeFloatingPills['id-1']).toBeDefined();
    });
  });

  describe('hideAllFloatingPills()', () => {
    it('should remove all FloatingPill entries', () => {
      // Given (Arrange)
      showFloatingPill('id-1', { titel: 'Erinnerung 1', ausgeloestAm: '2026-01-21T11:59:00.000Z' });
      showFloatingPill('id-2', { titel: 'Erinnerung 2', ausgeloestAm: '2026-01-21T11:59:00.000Z' });
      showFloatingPill('id-3', { titel: 'Erinnerung 3', ausgeloestAm: '2026-01-21T11:59:00.000Z' });
      expect(Object.keys(floatingPillStore.state.activeFloatingPills)).toHaveLength(3);

      // When (Act)
      hideAllFloatingPills();

      // Then (Assert)
      const state = floatingPillStore.state;
      expect(state.activeFloatingPills).toEqual({});
    });

    it('should be safe to call on empty store', () => {
      // Given (Arrange)
      resetFloatingPillStore();

      // When (Act)
      hideAllFloatingPills();

      // Then (Assert)
      const state = floatingPillStore.state;
      expect(state.activeFloatingPills).toEqual({});
    });
  });

  describe('isFloating() selector', () => {
    it('should return true for active FloatingPill', () => {
      // Given (Arrange)
      const erinnerungId = 'test-id-1';
      showFloatingPill(erinnerungId, { titel: 'Test', ausgeloestAm: '2026-01-21T11:59:00.000Z' });

      // When (Act)
      const result = isFloating(erinnerungId);

      // Then (Assert)
      expect(result).toBe(true);
    });

    it('should return false for non-existent FloatingPill', () => {
      // Given (Arrange)
      // Empty store

      // When (Act)
      const result = isFloating('non-existent-id');

      // Then (Assert)
      expect(result).toBe(false);
    });

    it('should return false after FloatingPill is hidden', () => {
      // Given (Arrange)
      const erinnerungId = 'test-id-1';
      showFloatingPill(erinnerungId, { titel: 'Test', ausgeloestAm: '2026-01-21T11:59:00.000Z' });
      expect(isFloating(erinnerungId)).toBe(true);

      // When (Act)
      hideFloatingPill(erinnerungId);

      // Then (Assert)
      expect(isFloating(erinnerungId)).toBe(false);
    });
  });

  describe('getActiveFloatingPills() selector', () => {
    it('should return empty array when no FloatingPills', () => {
      // Given (Arrange)
      resetFloatingPillStore();

      // When (Act)
      const result = getActiveFloatingPills();

      // Then (Assert)
      expect(result).toEqual([]);
    });

    it('should return all active FloatingPill entries as array', () => {
      // Given (Arrange)
      showFloatingPill('id-1', { titel: 'Erinnerung 1', ausgeloestAm: '2026-01-21T11:59:00.000Z' });
      showFloatingPill('id-2', { titel: 'Erinnerung 2', ausgeloestAm: '2026-01-21T11:58:00.000Z' });

      // When (Act)
      const result = getActiveFloatingPills();

      // Then (Assert)
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.erinnerungId).sort()).toEqual(['id-1', 'id-2']);
    });
  });

  describe('getFloatingPillCount() selector', () => {
    it('should return 0 when no FloatingPills', () => {
      // Given (Arrange)
      resetFloatingPillStore();

      // When (Act)
      const result = getFloatingPillCount();

      // Then (Assert)
      expect(result).toBe(0);
    });

    it('should return correct count of active FloatingPills', () => {
      // Given (Arrange)
      showFloatingPill('id-1', { titel: 'Erinnerung 1', ausgeloestAm: '2026-01-21T11:59:00.000Z' });
      showFloatingPill('id-2', { titel: 'Erinnerung 2', ausgeloestAm: '2026-01-21T11:58:00.000Z' });
      showFloatingPill('id-3', { titel: 'Erinnerung 3', ausgeloestAm: '2026-01-21T11:57:00.000Z' });

      // When (Act)
      const result = getFloatingPillCount();

      // Then (Assert)
      expect(result).toBe(3);
    });

    it('should update count when FloatingPills are hidden', () => {
      // Given (Arrange)
      showFloatingPill('id-1', { titel: 'Erinnerung 1', ausgeloestAm: '2026-01-21T11:59:00.000Z' });
      showFloatingPill('id-2', { titel: 'Erinnerung 2', ausgeloestAm: '2026-01-21T11:58:00.000Z' });
      expect(getFloatingPillCount()).toBe(2);

      // When (Act)
      hideFloatingPill('id-1');

      // Then (Assert)
      expect(getFloatingPillCount()).toBe(1);
    });
  });

  describe('resetFloatingPillStore()', () => {
    it('should reset store to initial state', () => {
      // Given (Arrange)
      showFloatingPill('id-1', { titel: 'Erinnerung 1', ausgeloestAm: '2026-01-21T11:59:00.000Z' });
      showFloatingPill('id-2', { titel: 'Erinnerung 2', ausgeloestAm: '2026-01-21T11:58:00.000Z' });
      expect(Object.keys(floatingPillStore.state.activeFloatingPills)).toHaveLength(2);

      // When (Act)
      resetFloatingPillStore();

      // Then (Assert)
      const state = floatingPillStore.state;
      expect(state.activeFloatingPills).toEqual({});
    });
  });
});
