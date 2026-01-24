/**
 * Unit Tests fuer Team-Filter Store
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 3.6 Task 1:**
 * - State: { selectedFilter, availableTeilnehmer }
 * - Actions: setTeamFilter, setAvailableTeilnehmer, resetTeamFilterStore
 * - Hooks: useTeamFilter, useAvailableTeilnehmer
 *
 * **Story 3.6 Task 5.1:** Store Tests
 * **Story 3.6 Issue #1 Fix:** Tagged Union Type fuer Type Safety
 * **Story 3.6 Issue #7 Fix:** resetTeamFilter() entfernt (redundant)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  teamFilterStore,
  setTeamFilter,
  setAvailableTeilnehmer,
  resetTeamFilterStore,
  getTeamFilter,
  getAvailableTeilnehmer,
  isUserFilter,
  createTeamFilter,
  teamFilterToValue,
  type TeamFilterType,
  type Teilnehmer,
} from '../team-filter.store';

describe('TeamFilterStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    resetTeamFilterStore();
  });

  describe('initial state', () => {
    it('should have { type: "all" } as default filter', () => {
      // Given (Arrange)
      resetTeamFilterStore();

      // When (Act)
      const state = teamFilterStore.state;

      // Then (Assert)
      expect(state.selectedFilter).toEqual({ type: 'all' });
    });

    it('should have empty teilnehmer array on initialization', () => {
      // Given (Arrange)
      resetTeamFilterStore();

      // When (Act)
      const state = teamFilterStore.state;

      // Then (Assert)
      expect(state.availableTeilnehmer).toEqual([]);
    });
  });

  describe('setTeamFilter() with Tagged Union (Issue #1 Fix)', () => {
    it('should set filter to { type: "mine" } (AC3)', () => {
      // Given (Arrange)
      const filter: TeamFilterType = { type: 'mine' };

      // When (Act)
      setTeamFilter(filter);

      // Then (Assert)
      const state = teamFilterStore.state;
      expect(state.selectedFilter).toEqual({ type: 'mine' });
    });

    it('should set filter to { type: "unassigned" } (AC4)', () => {
      // Given (Arrange)
      const filter: TeamFilterType = { type: 'unassigned' };

      // When (Act)
      setTeamFilter(filter);

      // Then (Assert)
      const state = teamFilterStore.state;
      expect(state.selectedFilter).toEqual({ type: 'unassigned' });
    });

    it('should set filter to { type: "user", userId } (AC2)', () => {
      // Given (Arrange)
      const userId = 'user-thomas-123';
      const filter: TeamFilterType = { type: 'user', userId };

      // When (Act)
      setTeamFilter(filter);

      // Then (Assert)
      const state = teamFilterStore.state;
      expect(state.selectedFilter).toEqual({ type: 'user', userId: 'user-thomas-123' });
    });

    it('should reset filter to { type: "all" } via setTeamFilter (AC5, Issue #7 Fix)', () => {
      // Given (Arrange) - Start with different filter
      setTeamFilter({ type: 'mine' });
      expect(teamFilterStore.state.selectedFilter).toEqual({ type: 'mine' });

      // When (Act) - Use setTeamFilter instead of removed resetTeamFilter
      setTeamFilter({ type: 'all' });

      // Then (Assert)
      const state = teamFilterStore.state;
      expect(state.selectedFilter).toEqual({ type: 'all' });
    });
  });

  describe('setAvailableTeilnehmer()', () => {
    it('should set teilnehmer array (AC1)', () => {
      // Given (Arrange)
      const teilnehmer: Teilnehmer[] = [
        { id: 'user-1', name: 'Thomas Mueller' },
        { id: 'user-2', name: 'Markus Weber' },
      ];

      // When (Act)
      setAvailableTeilnehmer(teilnehmer);

      // Then (Assert)
      const state = teamFilterStore.state;
      expect(state.availableTeilnehmer).toHaveLength(2);
      expect(state.availableTeilnehmer[0]).toEqual({ id: 'user-1', name: 'Thomas Mueller' });
      expect(state.availableTeilnehmer[1]).toEqual({ id: 'user-2', name: 'Markus Weber' });
    });

    it('should replace existing teilnehmer', () => {
      // Given (Arrange)
      setAvailableTeilnehmer([{ id: 'user-1', name: 'Old User' }]);

      // When (Act)
      setAvailableTeilnehmer([{ id: 'user-2', name: 'New User' }]);

      // Then (Assert)
      const state = teamFilterStore.state;
      expect(state.availableTeilnehmer).toHaveLength(1);
      expect(state.availableTeilnehmer[0].name).toBe('New User');
    });

    it('should handle empty array', () => {
      // Given (Arrange)
      setAvailableTeilnehmer([{ id: 'user-1', name: 'Test' }]);

      // When (Act)
      setAvailableTeilnehmer([]);

      // Then (Assert)
      const state = teamFilterStore.state;
      expect(state.availableTeilnehmer).toEqual([]);
    });
  });

  describe('resetTeamFilterStore()', () => {
    it('should reset entire store to initial state', () => {
      // Given (Arrange)
      setTeamFilter({ type: 'unassigned' });
      setAvailableTeilnehmer([{ id: 'user-1', name: 'Test' }]);

      // When (Act)
      resetTeamFilterStore();

      // Then (Assert)
      const state = teamFilterStore.state;
      expect(state.selectedFilter).toEqual({ type: 'all' });
      expect(state.availableTeilnehmer).toEqual([]);
    });

    it('should reset user filter with userId to initial state', () => {
      // Given (Arrange)
      setTeamFilter({ type: 'user', userId: 'specific-user-123' });
      setAvailableTeilnehmer([{ id: 'user-1', name: 'Test' }]);

      // When (Act)
      resetTeamFilterStore();

      // Then (Assert)
      const state = teamFilterStore.state;
      expect(state.selectedFilter).toEqual({ type: 'all' });
      expect(state.availableTeilnehmer).toEqual([]);
    });
  });

  describe('getTeamFilter() selector', () => {
    it('should return current filter value with Tagged Union', () => {
      // Given (Arrange)
      setTeamFilter({ type: 'unassigned' });

      // When (Act)
      const filter = getTeamFilter();

      // Then (Assert)
      expect(filter).toEqual({ type: 'unassigned' });
    });

    it('should return user filter with userId', () => {
      // Given (Arrange)
      setTeamFilter({ type: 'user', userId: 'test-user-456' });

      // When (Act)
      const filter = getTeamFilter();

      // Then (Assert)
      expect(filter).toEqual({ type: 'user', userId: 'test-user-456' });
    });
  });

  describe('getAvailableTeilnehmer() selector', () => {
    it('should return current teilnehmer array', () => {
      // Given (Arrange)
      const teilnehmer: Teilnehmer[] = [{ id: 'user-1', name: 'Test' }];
      setAvailableTeilnehmer(teilnehmer);

      // When (Act)
      const result = getAvailableTeilnehmer();

      // Then (Assert)
      expect(result).toEqual(teilnehmer);
    });
  });

  describe('Helper Functions (Tagged Union)', () => {
    describe('isUserFilter()', () => {
      it('should return true for user filter', () => {
        // Given (Arrange)
        const filter: TeamFilterType = { type: 'user', userId: 'test-123' };

        // When (Act)
        const result = isUserFilter(filter);

        // Then (Assert)
        expect(result).toBe(true);
      });

      it('should return false for all filter', () => {
        // Given (Arrange)
        const filter: TeamFilterType = { type: 'all' };

        // When (Act)
        const result = isUserFilter(filter);

        // Then (Assert)
        expect(result).toBe(false);
      });

      it('should return false for mine filter', () => {
        // Given (Arrange)
        const filter: TeamFilterType = { type: 'mine' };

        // When (Act)
        const result = isUserFilter(filter);

        // Then (Assert)
        expect(result).toBe(false);
      });

      it('should return false for unassigned filter', () => {
        // Given (Arrange)
        const filter: TeamFilterType = { type: 'unassigned' };

        // When (Act)
        const result = isUserFilter(filter);

        // Then (Assert)
        expect(result).toBe(false);
      });
    });

    describe('createTeamFilter()', () => {
      it('should create all filter from "all"', () => {
        // When (Act)
        const result = createTeamFilter('all');

        // Then (Assert)
        expect(result).toEqual({ type: 'all' });
      });

      it('should create mine filter from "mine"', () => {
        // When (Act)
        const result = createTeamFilter('mine');

        // Then (Assert)
        expect(result).toEqual({ type: 'mine' });
      });

      it('should create unassigned filter from "unassigned"', () => {
        // When (Act)
        const result = createTeamFilter('unassigned');

        // Then (Assert)
        expect(result).toEqual({ type: 'unassigned' });
      });

      it('should create user filter from userId string', () => {
        // When (Act)
        const result = createTeamFilter('user-thomas-123');

        // Then (Assert)
        expect(result).toEqual({ type: 'user', userId: 'user-thomas-123' });
      });
    });

    describe('teamFilterToValue()', () => {
      it('should return "all" for all filter', () => {
        // Given (Arrange)
        const filter: TeamFilterType = { type: 'all' };

        // When (Act)
        const result = teamFilterToValue(filter);

        // Then (Assert)
        expect(result).toBe('all');
      });

      it('should return "mine" for mine filter', () => {
        // Given (Arrange)
        const filter: TeamFilterType = { type: 'mine' };

        // When (Act)
        const result = teamFilterToValue(filter);

        // Then (Assert)
        expect(result).toBe('mine');
      });

      it('should return "unassigned" for unassigned filter', () => {
        // Given (Arrange)
        const filter: TeamFilterType = { type: 'unassigned' };

        // When (Act)
        const result = teamFilterToValue(filter);

        // Then (Assert)
        expect(result).toBe('unassigned');
      });

      it('should return userId for user filter', () => {
        // Given (Arrange)
        const filter: TeamFilterType = { type: 'user', userId: 'user-thomas-123' };

        // When (Act)
        const result = teamFilterToValue(filter);

        // Then (Assert)
        expect(result).toBe('user-thomas-123');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle filter change with many teilnehmer', () => {
      // Given (Arrange)
      const manyTeilnehmer: Teilnehmer[] = Array.from({ length: 20 }, (_, i) => ({
        id: `user-${i}`,
        name: `User ${i}`,
      }));
      setAvailableTeilnehmer(manyTeilnehmer);

      // When (Act)
      setTeamFilter({ type: 'user', userId: 'user-15' });

      // Then (Assert)
      const state = teamFilterStore.state;
      expect(state.selectedFilter).toEqual({ type: 'user', userId: 'user-15' });
      expect(state.availableTeilnehmer).toHaveLength(20);
    });

    it('should handle filter to non-existent userId (robustness)', () => {
      // Given (Arrange)
      setAvailableTeilnehmer([{ id: 'user-1', name: 'Test' }]);

      // When (Act) - filter to ID not in teilnehmer list
      setTeamFilter({ type: 'user', userId: 'non-existent-user' });

      // Then (Assert) - store accepts it (validation happens in UI)
      expect(teamFilterStore.state.selectedFilter).toEqual({ type: 'user', userId: 'non-existent-user' });
    });

    it('should preserve type safety with Tagged Union', () => {
      // Given (Arrange)
      const filter: TeamFilterType = { type: 'user', userId: 'test-id' };
      setTeamFilter(filter);

      // When (Act)
      const currentFilter = getTeamFilter();

      // Then (Assert) - TypeScript should narrow the type correctly
      if (currentFilter.type === 'user') {
        // This should compile without error
        expect(currentFilter.userId).toBe('test-id');
      }
    });
  });
});
