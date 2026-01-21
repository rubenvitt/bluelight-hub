/**
 * Unit Tests fuer Tray Service - Story 1.9
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 1.9 AC1, AC2:**
 * - AC1: Tray-Badge bei ausgelösten Erinnerungen (count > 0)
 * - AC2: Neutrales Icon ohne aktive Alarme (count === 0)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Logger first (before importing tray.service)
vi.mock('@/shared/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: vi.fn(() => true),
  invoke: vi.fn().mockResolvedValue(undefined),
}));

import { TrayService, trayService } from '../tray.service';
import { isTauri, invoke } from '@tauri-apps/api/core';

const mockIsTauri = vi.mocked(isTauri);
const mockInvoke = vi.mocked(invoke);

describe('TrayService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockInvoke.mockResolvedValue(undefined);
    // Reset Singleton State
    trayService.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('updateBadge()', () => {
    it('should call invoke with correct count when in Tauri', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(true);

      // When (Act)
      const result = await trayService.updateBadge(3);

      // Then (Assert)
      expect(result.success).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('update_tray_badge', { count: 3 });
    });

    it('should return success without invoke when not in Tauri', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(false);

      // When (Act)
      const result = await trayService.updateBadge(5);

      // Then (Assert)
      expect(result.success).toBe(true);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should not invoke when count is unchanged', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(true);
      await trayService.updateBadge(3); // First call
      vi.clearAllMocks();

      // When (Act)
      const result = await trayService.updateBadge(3); // Same count

      // Then (Assert)
      expect(result.success).toBe(true);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should invoke when count changes', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(true);
      await trayService.updateBadge(3);
      vi.clearAllMocks();

      // When (Act)
      const result = await trayService.updateBadge(5); // Different count

      // Then (Assert)
      expect(result.success).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('update_tray_badge', { count: 5 });
    });

    it('should return error on invoke failure', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(true);
      mockInvoke.mockRejectedValue(new Error('Tray not found'));

      // When (Act)
      const result = await trayService.updateBadge(1);

      // Then (Assert)
      expect(result.success).toBe(false);
      expect(result.error).toBe('Tray not found');
    });
  });

  describe('clearBadge()', () => {
    it('should call updateBadge with 0', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(true);
      await trayService.updateBadge(5); // Set to 5 first
      vi.clearAllMocks();

      // When (Act)
      const result = await trayService.clearBadge();

      // Then (Assert)
      expect(result.success).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('update_tray_badge', { count: 0 });
    });
  });

  describe('getCurrentBadgeCount()', () => {
    it('should return 0 initially', () => {
      // Given (Arrange) - fresh service

      // When (Act)
      const count = trayService.getCurrentBadgeCount();

      // Then (Assert)
      expect(count).toBe(0);
    });

    it('should return last updated count', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(true);

      // When (Act)
      await trayService.updateBadge(7);

      // Then (Assert)
      expect(trayService.getCurrentBadgeCount()).toBe(7);
    });
  });

  describe('reset()', () => {
    it('should reset badge count to 0', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(true);
      await trayService.updateBadge(10);

      // When (Act)
      trayService.reset();

      // Then (Assert)
      expect(trayService.getCurrentBadgeCount()).toBe(0);
    });
  });

  describe('AC1: Badge bei ausgeloesten Erinnerungen', () => {
    it('should update badge when triggered count > 0', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(true);

      // When (Act) - Simuliere 3 ausgeloeste Erinnerungen
      await trayService.updateBadge(3);

      // Then (Assert)
      expect(mockInvoke).toHaveBeenCalledWith('update_tray_badge', { count: 3 });
      expect(trayService.getCurrentBadgeCount()).toBe(3);
    });
  });

  describe('AC2: Neutrales Icon ohne Alarme', () => {
    it('should clear badge when triggered count is 0', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(true);
      await trayService.updateBadge(5); // Start with 5
      vi.clearAllMocks();

      // When (Act) - Alle Erinnerungen acknowledged
      await trayService.updateBadge(0);

      // Then (Assert)
      expect(mockInvoke).toHaveBeenCalledWith('update_tray_badge', { count: 0 });
      expect(trayService.getCurrentBadgeCount()).toBe(0);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      // Given (Arrange)
      const instance1 = TrayService.getInstance();
      const instance2 = TrayService.getInstance();

      // When/Then (Assert)
      expect(instance1).toBe(instance2);
    });
  });
});
