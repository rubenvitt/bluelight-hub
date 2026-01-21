/**
 * Unit Tests fuer useTrayBadge Hook - Story 1.9
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 1.9 AC1, AC2:**
 * - AC1: Badge wird aktualisiert wenn triggered count > 0
 * - AC2: Badge wird gecleart wenn triggered count === 0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ErinnerungResponseDto } from '@bluelight-hub/shared/client';

// Mock Logger first (before importing hooks/services)
vi.mock('@/shared/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock trayService
vi.mock('../../services', () => ({
  trayService: {
    updateBadge: vi.fn().mockResolvedValue({ success: true }),
  },
}));

import { useTrayBadge } from '../use-tray-badge';
import { timerStore, markTimerAsTriggered, startTimerForErinnerung, resetTimerStore } from '../../stores/timer.store';
import { trayService } from '../../services';

const mockUpdateBadge = vi.mocked(trayService.updateBadge);

/**
 * Factory fuer Test-Erinnerungen
 */
function createTestErinnerung(overrides: Partial<ErinnerungResponseDto> = {}): ErinnerungResponseDto {
  return {
    id: 'test-id-1',
    einsatzId: 'einsatz-1',
    titel: 'Test Erinnerung',
    beschreibung: null,
    faelligAm: new Date().toISOString(),
    status: 'GEPLANT',
    erstelltVon: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('useTrayBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTimerStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetTimerStore();
  });

  it('should update badge when triggered count changes', async () => {
    // Given (Arrange)
    const erinnerung = createTestErinnerung({ id: 'test-1' });
    startTimerForErinnerung(erinnerung);

    // When (Act)
    renderHook(() => useTrayBadge());

    // Initially 0 triggered
    await waitFor(() => {
      expect(mockUpdateBadge).toHaveBeenCalledWith(0);
    });

    // Mark as triggered
    vi.clearAllMocks();
    act(() => {
      markTimerAsTriggered('test-1');
    });

    // Then (Assert)
    await waitFor(() => {
      expect(mockUpdateBadge).toHaveBeenCalledWith(1);
    });
  });

  it('should not update badge when count stays the same', async () => {
    // Given (Arrange)
    renderHook(() => useTrayBadge());

    // Wait for initial call
    await waitFor(() => {
      expect(mockUpdateBadge).toHaveBeenCalledWith(0);
    });

    // Clear mocks after initial call
    vi.clearAllMocks();

    // When (Act) - No change in triggered count
    // Force a re-render without changing triggered count
    act(() => {
      timerStore.setState((state) => ({ ...state, lastCheck: new Date().toISOString() }));
    });

    // Then (Assert) - Should not call updateBadge again
    // Give some time for potential calls
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockUpdateBadge).not.toHaveBeenCalled();
  });

  it('should handle multiple triggered erinnerungen', async () => {
    // Given (Arrange)
    const erinnerung1 = createTestErinnerung({ id: 'test-1' });
    const erinnerung2 = createTestErinnerung({ id: 'test-2' });
    startTimerForErinnerung(erinnerung1);
    startTimerForErinnerung(erinnerung2);

    // When (Act)
    renderHook(() => useTrayBadge());

    // Wait for initial call
    await waitFor(() => {
      expect(mockUpdateBadge).toHaveBeenCalledWith(0);
    });

    vi.clearAllMocks();

    // Mark first as triggered
    act(() => {
      markTimerAsTriggered('test-1');
    });

    await waitFor(() => {
      expect(mockUpdateBadge).toHaveBeenCalledWith(1);
    });

    vi.clearAllMocks();

    // Mark second as triggered
    act(() => {
      markTimerAsTriggered('test-2');
    });

    // Then (Assert)
    await waitFor(() => {
      expect(mockUpdateBadge).toHaveBeenCalledWith(2);
    });
  });
});
