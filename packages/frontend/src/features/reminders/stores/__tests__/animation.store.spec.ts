/**
 * Unit Tests fuer Animation Store
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 3.2 Task 2.1:**
 * - Animation-Utility fuer Real-time Updates
 * - Trackt welche Erinnerungen gerade animiert werden
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { animationStore, addAnimatedId, removeAnimatedId, clearAllAnimations, resetAnimationStore, isAnimated, getAnimationEntry } from '../animation.store';

describe('animation.store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAnimationStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('addAnimatedId', () => {
    it('should add erinnerung ID to animated list with update type', () => {
      // Given (Arrange)
      const erinnerungId = 'test-id-123';

      // When (Act)
      addAnimatedId(erinnerungId, 'update');

      // Then (Assert)
      expect(isAnimated(erinnerungId)).toBe(true);
      expect(getAnimationEntry(erinnerungId)?.type).toBe('update');
    });

    it('should add erinnerung ID with insert type', () => {
      // Given (Arrange)
      const erinnerungId = 'new-id-456';

      // When (Act)
      addAnimatedId(erinnerungId, 'insert');

      // Then (Assert)
      expect(isAnimated(erinnerungId)).toBe(true);
      expect(getAnimationEntry(erinnerungId)?.type).toBe('insert');
    });

    it('should default to update type when not specified', () => {
      // Given (Arrange)
      const erinnerungId = 'default-id-789';

      // When (Act)
      addAnimatedId(erinnerungId);

      // Then (Assert)
      expect(getAnimationEntry(erinnerungId)?.type).toBe('update');
    });

    it('should include timestamp in animation entry', () => {
      // Given (Arrange)
      const erinnerungId = 'timestamp-id';
      const beforeTimestamp = Date.now();

      // When (Act)
      addAnimatedId(erinnerungId, 'update');

      // Then (Assert)
      const entry = getAnimationEntry(erinnerungId);
      expect(entry?.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
    });

    it('should auto-remove animation after 1500ms', () => {
      // Given (Arrange)
      const erinnerungId = 'auto-remove-id';
      addAnimatedId(erinnerungId, 'update');
      expect(isAnimated(erinnerungId)).toBe(true);

      // When (Act) - Fast-forward 1500ms
      vi.advanceTimersByTime(1500);

      // Then (Assert)
      expect(isAnimated(erinnerungId)).toBe(false);
    });

    it('should NOT remove animation before 1500ms', () => {
      // Given (Arrange)
      const erinnerungId = 'early-check-id';
      addAnimatedId(erinnerungId, 'update');

      // When (Act) - Fast-forward only 1000ms
      vi.advanceTimersByTime(1000);

      // Then (Assert) - Still animated
      expect(isAnimated(erinnerungId)).toBe(true);
    });

    it('should handle multiple animated IDs', () => {
      // Given (Arrange)
      const id1 = 'id-1';
      const id2 = 'id-2';
      const id3 = 'id-3';

      // When (Act)
      addAnimatedId(id1, 'update');
      addAnimatedId(id2, 'insert');
      addAnimatedId(id3, 'update');

      // Then (Assert)
      expect(isAnimated(id1)).toBe(true);
      expect(isAnimated(id2)).toBe(true);
      expect(isAnimated(id3)).toBe(true);
    });
  });

  describe('removeAnimatedId', () => {
    it('should remove erinnerung ID from animated list', () => {
      // Given (Arrange)
      const erinnerungId = 'remove-id';
      addAnimatedId(erinnerungId, 'update');
      expect(isAnimated(erinnerungId)).toBe(true);

      // When (Act)
      removeAnimatedId(erinnerungId);

      // Then (Assert)
      expect(isAnimated(erinnerungId)).toBe(false);
    });

    it('should handle removing non-existent ID gracefully', () => {
      // Given (Arrange)
      const nonExistentId = 'does-not-exist';

      // When (Act) - Should not throw
      removeAnimatedId(nonExistentId);

      // Then (Assert)
      expect(isAnimated(nonExistentId)).toBe(false);
    });
  });

  describe('clearAllAnimations', () => {
    it('should remove all animated IDs', () => {
      // Given (Arrange)
      addAnimatedId('id-1', 'update');
      addAnimatedId('id-2', 'insert');
      addAnimatedId('id-3', 'update');

      // When (Act)
      clearAllAnimations();

      // Then (Assert)
      expect(isAnimated('id-1')).toBe(false);
      expect(isAnimated('id-2')).toBe(false);
      expect(isAnimated('id-3')).toBe(false);
      expect(animationStore.state.animatedIds.size).toBe(0);
    });
  });

  describe('resetAnimationStore', () => {
    it('should reset store to initial state', () => {
      // Given (Arrange)
      addAnimatedId('id-1', 'update');
      addAnimatedId('id-2', 'insert');

      // When (Act)
      resetAnimationStore();

      // Then (Assert)
      expect(animationStore.state.animatedIds.size).toBe(0);
    });
  });

  describe('isAnimated', () => {
    it('should return true for animated ID', () => {
      // Given (Arrange)
      addAnimatedId('animated-id', 'update');

      // When (Act)
      const result = isAnimated('animated-id');

      // Then (Assert)
      expect(result).toBe(true);
    });

    it('should return false for non-animated ID', () => {
      // Given (Arrange) - No animation added

      // When (Act)
      const result = isAnimated('not-animated-id');

      // Then (Assert)
      expect(result).toBe(false);
    });
  });

  describe('getAnimationEntry', () => {
    it('should return animation entry for animated ID', () => {
      // Given (Arrange)
      addAnimatedId('entry-id', 'insert');

      // When (Act)
      const entry = getAnimationEntry('entry-id');

      // Then (Assert)
      expect(entry).toBeDefined();
      expect(entry?.type).toBe('insert');
      expect(entry?.timestamp).toBeGreaterThan(0);
    });

    it('should return undefined for non-animated ID', () => {
      // Given (Arrange) - No animation

      // When (Act)
      const entry = getAnimationEntry('no-entry-id');

      // Then (Assert)
      expect(entry).toBeUndefined();
    });
  });
});
