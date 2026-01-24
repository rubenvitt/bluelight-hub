/**
 * Unit Tests fuer useReconnectSync Hook
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 1.8 AC3:**
 * - Sync Queue Processing bei Reconnect
 * - Query-Cache Invalidierung nach erfolgreichem Sync
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { useReconnectSync } from '../use-reconnect-sync';
import { offlineDetectionService } from '../../services/offline-detection.service';
import { syncService } from '../../services/sync.service';

// Mock offline detection service
vi.mock('../../services/offline-detection.service', () => ({
  offlineDetectionService: {
    setOnOnlineCallback: vi.fn(),
  },
}));

// Mock sync service
vi.mock('../../services/sync.service', () => ({
  syncService: {
    hasPendingSync: vi.fn(),
    syncAll: vi.fn(),
  },
}));

// Mock queries to provide ERINNERUNG_QUERY_KEYS
vi.mock('../../api/queries', () => ({
  ERINNERUNG_QUERY_KEYS: {
    all: ['erinnerungen'],
    list: (einsatzId: string) => ['erinnerungen', 'list', einsatzId],
    detail: (id: string) => ['erinnerungen', 'detail', id],
  },
}));

describe('useReconnectSync', () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    return ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('initialization', () => {
    it('should register onOnline callback on mount', () => {
      // When (Act)
      renderHook(() => useReconnectSync(), { wrapper: createWrapper() });

      // Then (Assert)
      expect(offlineDetectionService.setOnOnlineCallback).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should unregister callback on unmount', () => {
      // When (Act)
      const { unmount } = renderHook(() => useReconnectSync(), { wrapper: createWrapper() });
      unmount();

      // Then (Assert)
      expect(offlineDetectionService.setOnOnlineCallback).toHaveBeenLastCalledWith(null);
    });

    it('should return initial state', () => {
      // When (Act)
      const { result } = renderHook(() => useReconnectSync(), { wrapper: createWrapper() });

      // Then (Assert)
      expect(result.current.isSyncing).toBe(false);
      expect(result.current.lastSyncResult).toBeNull();
      expect(typeof result.current.triggerSync).toBe('function');
    });
  });

  describe('triggerSync()', () => {
    it('should not sync when no pending actions', async () => {
      // Given (Arrange)
      vi.mocked(syncService.hasPendingSync).mockReturnValue(false);

      const { result } = renderHook(() => useReconnectSync(), { wrapper: createWrapper() });

      // When (Act)
      let syncResult: { successCount: number; failureCount: number; results: unknown[] } | undefined;
      await act(async () => {
        syncResult = await result.current.triggerSync();
      });

      // Then (Assert)
      expect(syncService.hasPendingSync).toHaveBeenCalled();
      expect(syncService.syncAll).not.toHaveBeenCalled();
      expect(syncResult).toEqual({ successCount: 0, failureCount: 0, results: [] });
    });

    it('should call syncAll when pending actions exist', async () => {
      // Given (Arrange)
      vi.mocked(syncService.hasPendingSync).mockReturnValue(true);
      vi.mocked(syncService.syncAll).mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        results: [
          { actionId: '1', success: true },
          { actionId: '2', success: true },
        ],
      });

      const { result } = renderHook(() => useReconnectSync(), { wrapper: createWrapper() });

      // When (Act)
      await act(async () => {
        await result.current.triggerSync();
      });

      // Then (Assert)
      expect(syncService.syncAll).toHaveBeenCalled();
    });

    it('should set isSyncing to true during sync', async () => {
      // Given (Arrange)
      vi.mocked(syncService.hasPendingSync).mockReturnValue(true);

      let resolveSync: (value: { successCount: number; failureCount: number; results: unknown[] }) => void;
      const syncPromise = new Promise<{ successCount: number; failureCount: number; results: unknown[] }>((resolve) => {
        resolveSync = resolve;
      });
      vi.mocked(syncService.syncAll).mockReturnValue(syncPromise);

      const { result } = renderHook(() => useReconnectSync(), { wrapper: createWrapper() });

      // When (Act) - Start sync
      let syncResultPromise: Promise<{ successCount: number; failureCount: number; results: unknown[] }>;
      act(() => {
        syncResultPromise = result.current.triggerSync();
      });

      // Then (Assert) - isSyncing should be true
      expect(result.current.isSyncing).toBe(true);

      // Cleanup - resolve the promise
      await act(async () => {
        resolveSync?.({ successCount: 0, failureCount: 0, results: [] });
        await syncResultPromise;
      });

      expect(result.current.isSyncing).toBe(false);
    });

    it('should update lastSyncResult after sync', async () => {
      // Given (Arrange)
      const mockResult = {
        successCount: 1,
        failureCount: 1,
        results: [
          { actionId: '1', success: true },
          { actionId: '2', success: false, error: 'Test error' },
        ],
      };
      vi.mocked(syncService.hasPendingSync).mockReturnValue(true);
      vi.mocked(syncService.syncAll).mockResolvedValue(mockResult);

      const { result } = renderHook(() => useReconnectSync(), { wrapper: createWrapper() });

      // When (Act)
      await act(async () => {
        await result.current.triggerSync();
      });

      // Then (Assert)
      expect(result.current.lastSyncResult).toEqual(mockResult);
    });

    it('should handle sync error gracefully', async () => {
      // Given (Arrange)
      vi.mocked(syncService.hasPendingSync).mockReturnValue(true);
      vi.mocked(syncService.syncAll).mockRejectedValue(new Error('Sync failed'));

      const { result } = renderHook(() => useReconnectSync(), { wrapper: createWrapper() });

      // When (Act)
      await act(async () => {
        await result.current.triggerSync();
      });

      // Then (Assert)
      expect(result.current.isSyncing).toBe(false);
      expect(result.current.lastSyncResult).toEqual({
        successCount: 0,
        failureCount: 1,
        results: [
          {
            actionId: 'sync-error',
            success: false,
            error: 'Sync failed',
          },
        ],
      });
    });
  });

  describe('reconnect callback', () => {
    it('should trigger sync on reconnect when pending actions exist', async () => {
      // Given (Arrange)
      vi.mocked(syncService.hasPendingSync).mockReturnValue(true);
      vi.mocked(syncService.syncAll).mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        results: [{ actionId: '1', success: true }],
      });

      let registeredCallback: ((data: { offlineSince: Date; onlineSince: Date }) => void) | null = null;
      vi.mocked(offlineDetectionService.setOnOnlineCallback).mockImplementation((cb) => {
        registeredCallback = cb;
      });

      renderHook(() => useReconnectSync(), { wrapper: createWrapper() });

      // When (Act) - Simulate reconnect
      await act(async () => {
        registeredCallback?.({
          offlineSince: new Date(Date.now() - 60000),
          onlineSince: new Date(),
        });
      });

      // Then (Assert)
      expect(syncService.syncAll).toHaveBeenCalled();
    });

    it('should not trigger sync on reconnect when no pending actions', async () => {
      // Given (Arrange)
      vi.mocked(syncService.hasPendingSync).mockReturnValue(false);

      let registeredCallback: ((data: { offlineSince: Date; onlineSince: Date }) => void) | null = null;
      vi.mocked(offlineDetectionService.setOnOnlineCallback).mockImplementation((cb) => {
        registeredCallback = cb;
      });

      renderHook(() => useReconnectSync(), { wrapper: createWrapper() });

      // When (Act) - Simulate reconnect
      await act(async () => {
        registeredCallback?.({
          offlineSince: new Date(Date.now() - 60000),
          onlineSince: new Date(),
        });
      });

      // Then (Assert)
      expect(syncService.syncAll).not.toHaveBeenCalled();
    });
  });

  describe('query invalidation', () => {
    it('should invalidate specific einsatz queries when einsatzId provided', async () => {
      // Given (Arrange)
      vi.mocked(syncService.hasPendingSync).mockReturnValue(true);
      vi.mocked(syncService.syncAll).mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        results: [{ actionId: '1', success: true }],
      });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useReconnectSync('einsatz-123'), { wrapper: createWrapper() });

      // When (Act)
      await act(async () => {
        await result.current.triggerSync();
      });

      // Then (Assert)
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['erinnerungen', 'list', 'einsatz-123'],
      });
    });

    it('should invalidate all erinnerung queries when no einsatzId provided', async () => {
      // Given (Arrange)
      vi.mocked(syncService.hasPendingSync).mockReturnValue(true);
      vi.mocked(syncService.syncAll).mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        results: [{ actionId: '1', success: true }],
      });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useReconnectSync(), { wrapper: createWrapper() });

      // When (Act)
      await act(async () => {
        await result.current.triggerSync();
      });

      // Then (Assert)
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['erinnerungen'],
      });
    });

    it('should not invalidate queries when sync has no successes', async () => {
      // Given (Arrange)
      vi.mocked(syncService.hasPendingSync).mockReturnValue(true);
      vi.mocked(syncService.syncAll).mockResolvedValue({
        successCount: 0,
        failureCount: 1,
        results: [{ actionId: '1', success: false, error: 'Failed' }],
      });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useReconnectSync(), { wrapper: createWrapper() });

      // When (Act)
      await act(async () => {
        await result.current.triggerSync();
      });

      // Then (Assert)
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });
});
