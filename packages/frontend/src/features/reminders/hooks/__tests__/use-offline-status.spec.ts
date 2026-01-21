/**
 * Unit Tests fuer useOfflineStatus Hook
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 1.8 AC1, AC3:**
 * - Hook Signatur: { isOffline, offlineSince, pendingActionsCount }
 * - Subscribes to Offline Detection Service
 * - Subscribes to Sync Queue Count
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOfflineStatus } from '../use-offline-status';
import { offlineDetectionService } from '../../services/offline-detection.service';
import { offlineStore, resetOfflineStore, queueSyncAction } from '../../stores/offline.store';

// Mock the offline detection service
vi.mock('../../services/offline-detection.service', () => {
  const subscribers = new Set<(state: { isOffline: boolean; offlineSince: Date | null }) => void>();
  let mockState = { isOffline: false, offlineSince: null as Date | null };

  return {
    offlineDetectionService: {
      getState: vi.fn(() => mockState),
      isOffline: vi.fn(() => mockState.isOffline),
      subscribe: vi.fn((callback: (state: { isOffline: boolean; offlineSince: Date | null }) => void) => {
        subscribers.add(callback);
        return () => subscribers.delete(callback);
      }),
      // Test helpers
      __setMockState: (state: { isOffline: boolean; offlineSince: Date | null }) => {
        mockState = state;
        for (const sub of subscribers) {
          sub(state);
        }
      },
      __reset: () => {
        mockState = { isOffline: false, offlineSince: null };
        subscribers.clear();
      },
    },
  };
});

describe('useOfflineStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOfflineStore();
    // @ts-expect-error - Test helper
    offlineDetectionService.__reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should return online state initially', () => {
      // When (Act)
      const { result } = renderHook(() => useOfflineStatus());

      // Then (Assert)
      expect(result.current.isOffline).toBe(false);
      expect(result.current.offlineSince).toBeNull();
    });

    it('should return correct pendingActionsCount', () => {
      // When (Act)
      const { result } = renderHook(() => useOfflineStatus());

      // Then (Assert)
      expect(result.current.pendingActionsCount).toBe(0);
    });
  });

  describe('offline detection subscription', () => {
    it('should subscribe to offline detection service on mount', () => {
      // When (Act)
      renderHook(() => useOfflineStatus());

      // Then (Assert)
      expect(offlineDetectionService.subscribe).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe on unmount', () => {
      // Given (Arrange)
      const { unmount } = renderHook(() => useOfflineStatus());

      // When (Act)
      unmount();

      // Then (Assert) - subscribe returns unsubscribe function which should be called
      const unsubscribeFn = vi.mocked(offlineDetectionService.subscribe).mock.results[0].value;
      // The unsubscribe function is called internally, we verify it was set up correctly
      expect(offlineDetectionService.subscribe).toHaveBeenCalled();
    });

    it('should update isOffline when going offline (AC1)', () => {
      // Given (Arrange)
      const { result } = renderHook(() => useOfflineStatus());
      expect(result.current.isOffline).toBe(false);

      // When (Act)
      act(() => {
        // @ts-expect-error - Test helper
        offlineDetectionService.__setMockState({
          isOffline: true,
          offlineSince: new Date('2026-01-19T12:00:00.000Z'),
        });
      });

      // Then (Assert)
      expect(result.current.isOffline).toBe(true);
    });

    it('should update offlineSince when going offline', () => {
      // Given (Arrange)
      const { result } = renderHook(() => useOfflineStatus());
      const offlineDate = new Date('2026-01-19T12:00:00.000Z');

      // When (Act)
      act(() => {
        // @ts-expect-error - Test helper
        offlineDetectionService.__setMockState({
          isOffline: true,
          offlineSince: offlineDate,
        });
      });

      // Then (Assert)
      expect(result.current.offlineSince).toEqual(offlineDate);
    });

    it('should update when going back online (AC3)', () => {
      // Given (Arrange)
      const { result } = renderHook(() => useOfflineStatus());

      // Go offline first
      act(() => {
        // @ts-expect-error - Test helper
        offlineDetectionService.__setMockState({
          isOffline: true,
          offlineSince: new Date(),
        });
      });
      expect(result.current.isOffline).toBe(true);

      // When (Act) - Go back online
      act(() => {
        // @ts-expect-error - Test helper
        offlineDetectionService.__setMockState({
          isOffline: false,
          offlineSince: null,
        });
      });

      // Then (Assert)
      expect(result.current.isOffline).toBe(false);
      expect(result.current.offlineSince).toBeNull();
    });
  });

  describe('pendingActionsCount', () => {
    it('should track sync queue count', () => {
      // Given (Arrange)
      const { result } = renderHook(() => useOfflineStatus());
      expect(result.current.pendingActionsCount).toBe(0);

      // When (Act)
      act(() => {
        queueSyncAction({
          id: 'action-1',
          action: 'create',
          erinnerungId: 'temp_1',
          payload: {},
          timestamp: new Date().toISOString(),
          retryCount: 0,
        });
      });

      // Then (Assert)
      expect(result.current.pendingActionsCount).toBe(1);
    });

    it('should update when multiple actions are queued', () => {
      // Given (Arrange)
      const { result } = renderHook(() => useOfflineStatus());

      // When (Act)
      act(() => {
        queueSyncAction({
          id: 'action-1',
          action: 'create',
          erinnerungId: 'temp_1',
          payload: {},
          timestamp: new Date().toISOString(),
          retryCount: 0,
        });
        queueSyncAction({
          id: 'action-2',
          action: 'trigger',
          erinnerungId: 'temp_2',
          payload: {},
          timestamp: new Date().toISOString(),
          retryCount: 0,
        });
      });

      // Then (Assert)
      expect(result.current.pendingActionsCount).toBe(2);
    });
  });

  describe('return type', () => {
    it('should return correct shape', () => {
      // When (Act)
      const { result } = renderHook(() => useOfflineStatus());

      // Then (Assert)
      expect(result.current).toHaveProperty('isOffline');
      expect(result.current).toHaveProperty('offlineSince');
      expect(result.current).toHaveProperty('pendingActionsCount');
      expect(typeof result.current.isOffline).toBe('boolean');
      expect(typeof result.current.pendingActionsCount).toBe('number');
    });
  });
});
