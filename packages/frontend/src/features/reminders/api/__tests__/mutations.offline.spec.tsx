/**
 * Unit Tests fuer Offline Mutation Funktionalitaet
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 1.8 AC1:** Offline Create mit lokaler Speicherung
 * **Story 1.8 AC2:** Offline Trigger mit lokaler Queue
 * **Story 1.8 AC2:** Offline Acknowledge mit lokaler Queue
 * **Story 2.1 AC1/AC2:** Offline Snooze mit lokaler Queue
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { useCreateErinnerung, useTriggerErinnerung, useAcknowledgeErinnerung, useSnoozeErinnerung } from '../mutations';
import { offlineDetectionService } from '../../services/offline-detection.service';
import { syncService } from '../../services/sync.service';
import { offlineStore, resetOfflineStore } from '../../stores/offline.store';

// Mock the API
vi.mock('@/shared', () => ({
  api: {
    erinnerungen: () => ({
      erinnerungControllerCreateVAlpha: vi.fn(),
      erinnerungControllerTriggerVAlpha: vi.fn(),
      erinnerungControllerAcknowledgeVAlpha: vi.fn(),
      erinnerungControllerSnoozeVAlpha: vi.fn(),
    }),
  },
}));

// Mock offline detection service
vi.mock('../../services/offline-detection.service', () => ({
  offlineDetectionService: {
    isOffline: vi.fn(),
    getState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

// Mock sync service
vi.mock('../../services/sync.service', () => ({
  syncService: {
    generateTempId: vi.fn(),
    queueCreateAction: vi.fn(),
    queueTriggerAction: vi.fn(),
    queueAcknowledgeAction: vi.fn(),
    queueSnoozeAction: vi.fn(),
  },
}));

// Mock timer service
vi.mock('../../services/timer.service', () => ({
  timerService: {
    addTimer: vi.fn(),
    updateTimerStatus: vi.fn(),
  },
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('Offline Mutations', () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    return ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetOfflineStore();
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

  describe('useCreateErinnerung - Offline Mode', () => {
    it('should create erinnerung locally when offline (AC1)', async () => {
      // Given (Arrange)
      const mockTempId = 'temp_123-456';
      vi.mocked(offlineDetectionService.isOffline).mockReturnValue(true);
      vi.mocked(syncService.generateTempId).mockReturnValue(mockTempId);

      const { result } = renderHook(() => useCreateErinnerung(), {
        wrapper: createWrapper(),
      });

      // When (Act)
      result.current.mutate({
        einsatzId: 'einsatz-1',
        data: {
          titel: 'Test Offline Erinnerung',
          faelligAm: new Date(Date.now() + 60000).toISOString(),
          beschreibung: 'Test Beschreibung',
        },
      });

      // Then (Assert)
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(syncService.generateTempId).toHaveBeenCalled();
      expect(syncService.queueCreateAction).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockTempId,
          einsatzId: 'einsatz-1',
          titel: 'Test Offline Erinnerung',
        }),
      );
    });

    it('should return optimistic result with temp ID when offline', async () => {
      // Given (Arrange)
      const mockTempId = 'temp_abc-def';
      vi.mocked(offlineDetectionService.isOffline).mockReturnValue(true);
      vi.mocked(syncService.generateTempId).mockReturnValue(mockTempId);

      const { result } = renderHook(() => useCreateErinnerung(), {
        wrapper: createWrapper(),
      });

      // When (Act)
      result.current.mutate({
        einsatzId: 'einsatz-1',
        data: {
          titel: 'Test',
          faelligAm: new Date(Date.now() + 60000).toISOString(),
        },
      });

      // Then (Assert)
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.id).toBe(mockTempId);
      expect(result.current.data?.status).toBe('GEPLANT');
    });

    it('should add erinnerung to pendingErinnerungen store when offline', async () => {
      // Given (Arrange)
      const mockTempId = 'temp_store-test';
      vi.mocked(offlineDetectionService.isOffline).mockReturnValue(true);
      vi.mocked(syncService.generateTempId).mockReturnValue(mockTempId);

      const { result } = renderHook(() => useCreateErinnerung(), {
        wrapper: createWrapper(),
      });

      // When (Act)
      result.current.mutate({
        einsatzId: 'einsatz-1',
        data: {
          titel: 'Pending Test',
          faelligAm: new Date(Date.now() + 60000).toISOString(),
        },
      });

      // Then (Assert)
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // pendingErinnerungen should be updated via syncService.queueCreateAction
      expect(syncService.queueCreateAction).toHaveBeenCalled();
    });

    it('should NOT call API when offline', async () => {
      // Given (Arrange)
      const mockApi = vi.fn();
      vi.mocked(offlineDetectionService.isOffline).mockReturnValue(true);
      vi.mocked(syncService.generateTempId).mockReturnValue('temp_no-api');

      const { result } = renderHook(() => useCreateErinnerung(), {
        wrapper: createWrapper(),
      });

      // When (Act)
      result.current.mutate({
        einsatzId: 'einsatz-1',
        data: {
          titel: 'No API Call',
          faelligAm: new Date(Date.now() + 60000).toISOString(),
        },
      });

      // Then (Assert)
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // API should NOT have been called
      const { api } = await import('@/shared');
      expect(api.erinnerungen().erinnerungControllerCreateVAlpha).not.toHaveBeenCalled();
    });
  });

  describe('useTriggerErinnerung - Offline Mode', () => {
    it('should queue trigger action when offline (AC2)', async () => {
      // Given (Arrange)
      vi.mocked(offlineDetectionService.isOffline).mockReturnValue(true);

      // Pre-populate cache with an erinnerung
      queryClient.setQueryData(
        ['erinnerungen', 'list', 'einsatz-1'],
        [
          {
            id: 'erin-1',
            einsatzId: 'einsatz-1',
            titel: 'Test',
            status: 'GEPLANT',
            faelligAm: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      );

      const { result } = renderHook(() => useTriggerErinnerung(), {
        wrapper: createWrapper(),
      });

      // When (Act)
      result.current.mutate({
        einsatzId: 'einsatz-1',
        erinnerungId: 'erin-1',
      });

      // Then (Assert)
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(syncService.queueTriggerAction).toHaveBeenCalledWith('erin-1', 'einsatz-1');
    });

    it('should update local cache status to AUSGELOEST when offline', async () => {
      // Given (Arrange)
      vi.mocked(offlineDetectionService.isOffline).mockReturnValue(true);

      queryClient.setQueryData(
        ['erinnerungen', 'list', 'einsatz-1'],
        [
          {
            id: 'erin-1',
            einsatzId: 'einsatz-1',
            titel: 'Test',
            status: 'GEPLANT',
            faelligAm: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      );

      const { result } = renderHook(() => useTriggerErinnerung(), {
        wrapper: createWrapper(),
      });

      // When (Act)
      result.current.mutate({
        einsatzId: 'einsatz-1',
        erinnerungId: 'erin-1',
      });

      // Then (Assert)
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.status).toBe('AUSGELOEST');
    });

    it('should NOT call API when offline', async () => {
      // Given (Arrange)
      vi.mocked(offlineDetectionService.isOffline).mockReturnValue(true);

      queryClient.setQueryData(
        ['erinnerungen', 'list', 'einsatz-1'],
        [
          {
            id: 'erin-1',
            einsatzId: 'einsatz-1',
            titel: 'Test',
            status: 'GEPLANT',
            faelligAm: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      );

      const { result } = renderHook(() => useTriggerErinnerung(), {
        wrapper: createWrapper(),
      });

      // When (Act)
      result.current.mutate({
        einsatzId: 'einsatz-1',
        erinnerungId: 'erin-1',
      });

      // Then (Assert)
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const { api } = await import('@/shared');
      expect(api.erinnerungen().erinnerungControllerTriggerVAlpha).not.toHaveBeenCalled();
    });
  });

  describe('useAcknowledgeErinnerung - Offline Mode', () => {
    it('should queue acknowledge action when offline (AC2)', async () => {
      // Given (Arrange)
      vi.mocked(offlineDetectionService.isOffline).mockReturnValue(true);

      queryClient.setQueryData(
        ['erinnerungen', 'list', 'einsatz-1'],
        [
          {
            id: 'erin-1',
            einsatzId: 'einsatz-1',
            titel: 'Test',
            status: 'AUSGELOEST',
            faelligAm: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      );

      const { result } = renderHook(() => useAcknowledgeErinnerung(), {
        wrapper: createWrapper(),
      });

      // When (Act)
      result.current.mutate({
        einsatzId: 'einsatz-1',
        erinnerungId: 'erin-1',
      });

      // Then (Assert)
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(syncService.queueAcknowledgeAction).toHaveBeenCalledWith('erin-1', 'einsatz-1');
    });

    it('should update local cache status to ACKNOWLEDGED when offline', async () => {
      // Given (Arrange)
      vi.mocked(offlineDetectionService.isOffline).mockReturnValue(true);

      queryClient.setQueryData(
        ['erinnerungen', 'list', 'einsatz-1'],
        [
          {
            id: 'erin-1',
            einsatzId: 'einsatz-1',
            titel: 'Test',
            status: 'AUSGELOEST',
            faelligAm: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      );

      const { result } = renderHook(() => useAcknowledgeErinnerung(), {
        wrapper: createWrapper(),
      });

      // When (Act)
      result.current.mutate({
        einsatzId: 'einsatz-1',
        erinnerungId: 'erin-1',
      });

      // Then (Assert)
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.status).toBe('ACKNOWLEDGED');
    });

    it('should NOT call API when offline', async () => {
      // Given (Arrange)
      vi.mocked(offlineDetectionService.isOffline).mockReturnValue(true);

      queryClient.setQueryData(
        ['erinnerungen', 'list', 'einsatz-1'],
        [
          {
            id: 'erin-1',
            einsatzId: 'einsatz-1',
            titel: 'Test',
            status: 'AUSGELOEST',
            faelligAm: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      );

      const { result } = renderHook(() => useAcknowledgeErinnerung(), {
        wrapper: createWrapper(),
      });

      // When (Act)
      result.current.mutate({
        einsatzId: 'einsatz-1',
        erinnerungId: 'erin-1',
      });

      // Then (Assert)
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const { api } = await import('@/shared');
      expect(api.erinnerungen().erinnerungControllerAcknowledgeVAlpha).not.toHaveBeenCalled();
    });
  });

  describe('useSnoozeErinnerung - Offline Mode', () => {
    it('should queue snooze action when offline (Story 2.1 AC1)', async () => {
      // Given (Arrange)
      vi.mocked(offlineDetectionService.isOffline).mockReturnValue(true);

      queryClient.setQueryData(
        ['erinnerungen', 'list', 'einsatz-1'],
        [
          {
            id: 'erin-1',
            einsatzId: 'einsatz-1',
            titel: 'Test',
            status: 'AUSGELOEST',
            faelligAm: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            snoozeCount: 0,
          },
        ],
      );

      const { result } = renderHook(() => useSnoozeErinnerung(), {
        wrapper: createWrapper(),
      });

      // When (Act)
      result.current.mutate({
        einsatzId: 'einsatz-1',
        erinnerungId: 'erin-1',
        snoozeMinutes: 5,
      });

      // Then (Assert)
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(syncService.queueSnoozeAction).toHaveBeenCalledWith('erin-1', 'einsatz-1', 5);
    });

    it('should update local cache status to SNOOZED when offline (Story 2.1 AC2)', async () => {
      // Given (Arrange)
      vi.mocked(offlineDetectionService.isOffline).mockReturnValue(true);

      const originalFaelligAm = new Date().toISOString();
      queryClient.setQueryData(
        ['erinnerungen', 'list', 'einsatz-1'],
        [
          {
            id: 'erin-1',
            einsatzId: 'einsatz-1',
            titel: 'Test',
            status: 'AUSGELOEST',
            faelligAm: originalFaelligAm,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            snoozeCount: 0,
          },
        ],
      );

      const { result } = renderHook(() => useSnoozeErinnerung(), {
        wrapper: createWrapper(),
      });

      // When (Act)
      result.current.mutate({
        einsatzId: 'einsatz-1',
        erinnerungId: 'erin-1',
        snoozeMinutes: 5,
      });

      // Then (Assert)
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.status).toBe('SNOOZED');
      // faelligAm should be updated (snoozeMinutes in the future)
      const newFaelligAm = new Date(result.current.data!.faelligAm);
      const originalDate = new Date(originalFaelligAm);
      expect(newFaelligAm.getTime()).toBeGreaterThan(originalDate.getTime());
    });

    it('should NOT call API when offline', async () => {
      // Given (Arrange)
      vi.mocked(offlineDetectionService.isOffline).mockReturnValue(true);

      queryClient.setQueryData(
        ['erinnerungen', 'list', 'einsatz-1'],
        [
          {
            id: 'erin-1',
            einsatzId: 'einsatz-1',
            titel: 'Test',
            status: 'AUSGELOEST',
            faelligAm: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            snoozeCount: 0,
          },
        ],
      );

      const { result } = renderHook(() => useSnoozeErinnerung(), {
        wrapper: createWrapper(),
      });

      // When (Act)
      result.current.mutate({
        einsatzId: 'einsatz-1',
        erinnerungId: 'erin-1',
        snoozeMinutes: 10,
      });

      // Then (Assert)
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const { api } = await import('@/shared');
      expect(api.erinnerungen().erinnerungControllerSnoozeVAlpha).not.toHaveBeenCalled();
    });

    it('should increment snoozeCount when offline', async () => {
      // Given (Arrange)
      vi.mocked(offlineDetectionService.isOffline).mockReturnValue(true);

      queryClient.setQueryData(
        ['erinnerungen', 'list', 'einsatz-1'],
        [
          {
            id: 'erin-1',
            einsatzId: 'einsatz-1',
            titel: 'Test',
            status: 'AUSGELOEST',
            faelligAm: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            snoozeCount: 2, // Already snoozed twice
          },
        ],
      );

      const { result } = renderHook(() => useSnoozeErinnerung(), {
        wrapper: createWrapper(),
      });

      // When (Act)
      result.current.mutate({
        einsatzId: 'einsatz-1',
        erinnerungId: 'erin-1',
        snoozeMinutes: 1,
      });

      // Then (Assert)
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.snoozeCount).toBe(3);
    });

    it('should support all three snooze presets (1, 5, 10 min)', async () => {
      // Given (Arrange)
      vi.mocked(offlineDetectionService.isOffline).mockReturnValue(true);

      const snoozePresets = [1, 5, 10] as const;

      for (const minutes of snoozePresets) {
        vi.clearAllMocks();
        queryClient.clear();

        queryClient.setQueryData(
          ['erinnerungen', 'list', 'einsatz-1'],
          [
            {
              id: `erin-${minutes}`,
              einsatzId: 'einsatz-1',
              titel: 'Test',
              status: 'AUSGELOEST',
              faelligAm: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              snoozeCount: 0,
            },
          ],
        );

        const { result } = renderHook(() => useSnoozeErinnerung(), {
          wrapper: createWrapper(),
        });

        // When (Act)
        result.current.mutate({
          einsatzId: 'einsatz-1',
          erinnerungId: `erin-${minutes}`,
          snoozeMinutes: minutes,
        });

        // Then (Assert)
        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true);
        });

        expect(syncService.queueSnoozeAction).toHaveBeenCalledWith(`erin-${minutes}`, 'einsatz-1', minutes);
      }
    });
  });

  // Note: Online-Mode Tests sind ausgelagert - die Online-Funktionalität
  // wird bereits durch bestehende Integration Tests abgedeckt.
  // Diese Test-Datei fokussiert sich auf Story 1.8 Offline-Funktionalität.
});
