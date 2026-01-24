/**
 * Unit Tests fuer Seen Assignments Store
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 3.7 AC3:** "Neu" Markierung in der Liste
 * **Story 3.7 AC4:** "Neu" Markierung entfernen bei Interaktion
 * **Story 3.7 Task 1.3:** Unit Tests fuer Store
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  seenAssignmentsStore,
  markAsSeen,
  clearSeenAssignment,
  clearSeenAssignmentsBatch,
  resetSeenAssignmentsStore,
  isUnseen,
  getSeenTimestamp,
  initSeenAssignmentsStore,
} from '../seen-assignments.store';

// Mock Tauri LazyStore als Klasse
vi.mock('@tauri-apps/plugin-store', () => {
  return {
    LazyStore: class MockLazyStore {
      private store: Map<string, unknown> = new Map();
      async get<T>(key: string): Promise<T | null> {
        return (this.store.get(key) as T) ?? null;
      }
      async set(key: string, value: unknown): Promise<void> {
        this.store.set(key, value);
      }
    },
  };
});

describe('SeenAssignmentsStore', () => {
  beforeEach(async () => {
    // Reset store to initial state before each test
    await resetSeenAssignmentsStore();
  });

  describe('initial state', () => {
    it('should have empty seenMap on initialization', async () => {
      // Given (Arrange)
      await resetSeenAssignmentsStore();

      // When (Act)
      const state = seenAssignmentsStore.state;

      // Then (Assert)
      expect(state.seenMap.size).toBe(0);
    });

    it('should have isInitialized = true after reset (store is usable)', async () => {
      // Given (Arrange)
      await resetSeenAssignmentsStore();

      // When (Act)
      const state = seenAssignmentsStore.state;

      // Then (Assert)
      expect(state.isInitialized).toBe(true);
    });
  });

  describe('markAsSeen() (AC4)', () => {
    it('should mark erinnerung as seen with current timestamp', async () => {
      // Given (Arrange)
      const erinnerungId = 'test-erinnerung-123';
      const beforeTimestamp = Date.now();

      // When (Act)
      await markAsSeen(erinnerungId);

      // Then (Assert)
      const state = seenAssignmentsStore.state;
      expect(state.seenMap.has(erinnerungId)).toBe(true);

      const timestamp = state.seenMap.get(erinnerungId);
      expect(timestamp).toBeDefined();
      expect(timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should not update timestamp if already seen (idempotent)', async () => {
      // Given (Arrange)
      const erinnerungId = 'test-erinnerung-456';
      await markAsSeen(erinnerungId);
      const firstTimestamp = seenAssignmentsStore.state.seenMap.get(erinnerungId);

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      // When (Act) - Mark again
      await markAsSeen(erinnerungId);

      // Then (Assert) - Timestamp should be unchanged
      const secondTimestamp = seenAssignmentsStore.state.seenMap.get(erinnerungId);
      expect(secondTimestamp).toBe(firstTimestamp);
    });

    it('should handle multiple different erinnerungen', async () => {
      // Given (Arrange)
      const ids = ['erinnerung-1', 'erinnerung-2', 'erinnerung-3'];

      // When (Act)
      await Promise.all(ids.map((id) => markAsSeen(id)));

      // Then (Assert)
      const state = seenAssignmentsStore.state;
      expect(state.seenMap.size).toBe(3);
      for (const id of ids) {
        expect(state.seenMap.has(id)).toBe(true);
      }
    });
  });

  describe('clearSeenAssignment()', () => {
    it('should remove erinnerung from seen list', async () => {
      // Given (Arrange)
      const erinnerungId = 'test-erinnerung-789';
      await markAsSeen(erinnerungId);
      expect(seenAssignmentsStore.state.seenMap.has(erinnerungId)).toBe(true);

      // When (Act)
      await clearSeenAssignment(erinnerungId);

      // Then (Assert)
      expect(seenAssignmentsStore.state.seenMap.has(erinnerungId)).toBe(false);
    });

    it('should handle clearing non-existent erinnerung gracefully', async () => {
      // Given (Arrange)
      const nonExistentId = 'non-existent-id';

      // When (Act) - Should not throw
      await clearSeenAssignment(nonExistentId);

      // Then (Assert)
      expect(seenAssignmentsStore.state.seenMap.has(nonExistentId)).toBe(false);
    });
  });

  describe('clearSeenAssignmentsBatch()', () => {
    it('should remove multiple erinnerungen in one operation', async () => {
      // Given (Arrange)
      const ids = ['batch-1', 'batch-2', 'batch-3', 'batch-4'];
      const idsToRemove = ['batch-1', 'batch-3'];
      await Promise.all(ids.map((id) => markAsSeen(id)));

      // When (Act)
      await clearSeenAssignmentsBatch(idsToRemove);

      // Then (Assert)
      const state = seenAssignmentsStore.state;
      expect(state.seenMap.size).toBe(2);
      expect(state.seenMap.has('batch-1')).toBe(false);
      expect(state.seenMap.has('batch-2')).toBe(true);
      expect(state.seenMap.has('batch-3')).toBe(false);
      expect(state.seenMap.has('batch-4')).toBe(true);
    });

    it('should handle empty array gracefully', async () => {
      // Given (Arrange)
      await markAsSeen('existing-id');

      // When (Act)
      await clearSeenAssignmentsBatch([]);

      // Then (Assert) - No change
      expect(seenAssignmentsStore.state.seenMap.size).toBe(1);
    });
  });

  describe('resetSeenAssignmentsStore()', () => {
    it('should clear all seen assignments', async () => {
      // Given (Arrange)
      await markAsSeen('id-1');
      await markAsSeen('id-2');
      await markAsSeen('id-3');
      expect(seenAssignmentsStore.state.seenMap.size).toBe(3);

      // When (Act)
      await resetSeenAssignmentsStore();

      // Then (Assert)
      expect(seenAssignmentsStore.state.seenMap.size).toBe(0);
      expect(seenAssignmentsStore.state.isInitialized).toBe(true);
    });
  });

  describe('isUnseen() selector (AC3)', () => {
    it('should return true for unseen erinnerung', async () => {
      // Given (Arrange)
      const unseenId = 'unseen-erinnerung';

      // When (Act)
      const result = isUnseen(unseenId);

      // Then (Assert)
      expect(result).toBe(true);
    });

    it('should return false for seen erinnerung', async () => {
      // Given (Arrange)
      const seenId = 'seen-erinnerung';
      await markAsSeen(seenId);

      // When (Act)
      const result = isUnseen(seenId);

      // Then (Assert)
      expect(result).toBe(false);
    });
  });

  describe('getSeenTimestamp() selector', () => {
    it('should return timestamp for seen erinnerung', async () => {
      // Given (Arrange)
      const erinnerungId = 'timestamp-test';
      const beforeMark = Date.now();
      await markAsSeen(erinnerungId);

      // When (Act)
      const timestamp = getSeenTimestamp(erinnerungId);

      // Then (Assert)
      expect(timestamp).toBeDefined();
      expect(timestamp).toBeGreaterThanOrEqual(beforeMark);
    });

    it('should return undefined for unseen erinnerung', () => {
      // Given (Arrange)
      const unseenId = 'never-seen';

      // When (Act)
      const timestamp = getSeenTimestamp(unseenId);

      // Then (Assert)
      expect(timestamp).toBeUndefined();
    });
  });

  describe('initSeenAssignmentsStore()', () => {
    it('should set isInitialized to true after init', async () => {
      // Given (Arrange) - Store is mocked to return null (empty state)
      seenAssignmentsStore.setState(() => ({
        seenMap: new Map(),
        isInitialized: false,
      }));

      // When (Act)
      await initSeenAssignmentsStore();

      // Then (Assert)
      expect(seenAssignmentsStore.state.isInitialized).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in erinnerung IDs', async () => {
      // Given (Arrange)
      const specialId = 'erinnerung-with-special-chars-äöü-123_456';

      // When (Act)
      await markAsSeen(specialId);

      // Then (Assert)
      expect(seenAssignmentsStore.state.seenMap.has(specialId)).toBe(true);
      expect(isUnseen(specialId)).toBe(false);
    });

    it('should handle UUID format IDs', async () => {
      // Given (Arrange)
      const uuidId = '550e8400-e29b-41d4-a716-446655440000';

      // When (Act)
      await markAsSeen(uuidId);

      // Then (Assert)
      expect(seenAssignmentsStore.state.seenMap.has(uuidId)).toBe(true);
    });

    it('should maintain state consistency after rapid operations', async () => {
      // Given (Arrange)
      const ids = Array.from({ length: 100 }, (_, i) => `rapid-${i}`);

      // When (Act) - Rapid fire markAsSeen
      await Promise.all(ids.map((id) => markAsSeen(id)));

      // Then (Assert)
      expect(seenAssignmentsStore.state.seenMap.size).toBe(100);
    });
  });
});
