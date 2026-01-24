/**
 * Unit Tests fuer Offline Detection Service
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 1.8 AC1, AC3:**
 * - Offline Detection via navigator.onLine + window events
 * - State: { isOffline: boolean, offlineSince: Date | null }
 * - Event Callbacks fuer online/offline Wechsel
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OfflineDetectionService, offlineDetectionService } from '../offline-detection.service';

describe('OfflineDetectionService', () => {
  let service: OfflineDetectionService;
  let originalNavigatorOnline: boolean;
  let onlineListeners: Array<(event: Event) => void>;
  let offlineListeners: Array<(event: Event) => void>;

  beforeEach(() => {
    // Store original navigator.onLine value
    originalNavigatorOnline = navigator.onLine;

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: vi.fn(() => true),
    });

    // Track event listeners
    onlineListeners = [];
    offlineListeners = [];

    // Mock window.addEventListener
    vi.spyOn(window, 'addEventListener').mockImplementation((type, listener) => {
      if (type === 'online' && typeof listener === 'function') {
        onlineListeners.push(listener);
      }
      if (type === 'offline' && typeof listener === 'function') {
        offlineListeners.push(listener);
      }
    });

    vi.spyOn(window, 'removeEventListener').mockImplementation((type, listener) => {
      if (type === 'online' && typeof listener === 'function') {
        onlineListeners = onlineListeners.filter((l) => l !== listener);
      }
      if (type === 'offline' && typeof listener === 'function') {
        offlineListeners = offlineListeners.filter((l) => l !== listener);
      }
    });

    service = new OfflineDetectionService();
  });

  afterEach(() => {
    service.destroy();

    // Restore original navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => originalNavigatorOnline,
    });

    vi.restoreAllMocks();
  });

  // Helper to simulate going offline
  function goOffline(): void {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false,
    });
    for (const listener of offlineListeners) {
      listener(new Event('offline'));
    }
  }

  // Helper to simulate going online
  function goOnline(): void {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });
    for (const listener of onlineListeners) {
      listener(new Event('online'));
    }
  }

  describe('getState()', () => {
    it('should return online state when navigator.onLine is true', () => {
      // Given (Arrange)
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: () => true,
      });

      // When (Act)
      const state = service.getState();

      // Then (Assert)
      expect(state.isOffline).toBe(false);
      expect(state.offlineSince).toBeNull();
    });

    it('should return offline state when navigator.onLine is false', () => {
      // Given (Arrange)
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: () => false,
      });

      // Re-create service to pick up initial offline state
      service.destroy();
      service = new OfflineDetectionService();

      // When (Act)
      const state = service.getState();

      // Then (Assert)
      expect(state.isOffline).toBe(true);
      expect(state.offlineSince).toBeInstanceOf(Date);
    });
  });

  describe('isOffline()', () => {
    it('should return false when online', () => {
      // Given (Arrange)
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: () => true,
      });

      // When (Act) & Then (Assert)
      expect(service.isOffline()).toBe(false);
    });

    it('should return true when offline', () => {
      // Given (Arrange)
      goOffline();

      // When (Act) & Then (Assert)
      expect(service.isOffline()).toBe(true);
    });
  });

  describe('event listeners', () => {
    it('should register online/offline event listeners on construction', () => {
      // Given (Arrange) - Service created in beforeEach

      // Then (Assert)
      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should remove event listeners on destroy', () => {
      // Given (Arrange) - Service created in beforeEach

      // When (Act)
      service.destroy();

      // Then (Assert)
      expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('offline event handling', () => {
    it('should update state when going offline (AC1)', () => {
      // Given (Arrange)
      expect(service.isOffline()).toBe(false);

      // When (Act)
      goOffline();

      // Then (Assert)
      expect(service.isOffline()).toBe(true);
      const state = service.getState();
      expect(state.offlineSince).toBeInstanceOf(Date);
    });

    it('should set offlineSince timestamp when going offline', () => {
      // Given (Arrange)
      const beforeOffline = new Date();

      // When (Act)
      goOffline();

      // Then (Assert)
      const state = service.getState();
      expect(state.offlineSince).not.toBeNull();
      expect(state.offlineSince?.getTime()).toBeGreaterThanOrEqual(beforeOffline.getTime());
    });
  });

  describe('online event handling', () => {
    it('should update state when going online (AC3)', () => {
      // Given (Arrange)
      goOffline();
      expect(service.isOffline()).toBe(true);

      // When (Act)
      goOnline();

      // Then (Assert)
      expect(service.isOffline()).toBe(false);
    });

    it('should clear offlineSince when going online', () => {
      // Given (Arrange)
      goOffline();
      expect(service.getState().offlineSince).not.toBeNull();

      // When (Act)
      goOnline();

      // Then (Assert)
      expect(service.getState().offlineSince).toBeNull();
    });
  });

  describe('onOnline callback', () => {
    it('should call onOnline callback when going online (AC3)', () => {
      // Given (Arrange)
      const onOnline = vi.fn();
      service.setOnOnlineCallback(onOnline);
      goOffline();

      // When (Act)
      goOnline();

      // Then (Assert)
      expect(onOnline).toHaveBeenCalledTimes(1);
    });

    it('should pass offline duration to onOnline callback', () => {
      // Given (Arrange)
      const onOnline = vi.fn();
      service.setOnOnlineCallback(onOnline);
      goOffline();

      // Simulate some time passing
      // biome-ignore lint/style/noNonNullAssertion: Test-Assertion - offlineSince ist hier garantiert gesetzt
      const offlineSince = service.getState().offlineSince!;

      // When (Act)
      goOnline();

      // Then (Assert)
      expect(onOnline).toHaveBeenCalledWith(
        expect.objectContaining({
          offlineSince: offlineSince,
          onlineSince: expect.any(Date),
        }),
      );
    });

    it('should NOT call onOnline callback when already online', () => {
      // Given (Arrange)
      const onOnline = vi.fn();
      service.setOnOnlineCallback(onOnline);
      expect(service.isOffline()).toBe(false);

      // When (Act) - Simulate online event while already online
      goOnline();

      // Then (Assert) - Callback not called since state didn't change
      expect(onOnline).not.toHaveBeenCalled();
    });
  });

  describe('onOffline callback', () => {
    it('should call onOffline callback when going offline', () => {
      // Given (Arrange)
      const onOffline = vi.fn();
      service.setOnOfflineCallback(onOffline);

      // When (Act)
      goOffline();

      // Then (Assert)
      expect(onOffline).toHaveBeenCalledTimes(1);
    });

    it('should NOT call onOffline callback when already offline', () => {
      // Given (Arrange)
      goOffline();
      const onOffline = vi.fn();
      service.setOnOfflineCallback(onOffline);

      // When (Act) - Simulate offline event while already offline
      goOffline();

      // Then (Assert) - Callback not called since state didn't change
      expect(onOffline).not.toHaveBeenCalled();
    });
  });

  describe('subscribe()', () => {
    it('should notify subscribers on state change', () => {
      // Given (Arrange)
      const subscriber = vi.fn();
      service.subscribe(subscriber);

      // When (Act)
      goOffline();

      // Then (Assert)
      expect(subscriber).toHaveBeenCalledWith({
        isOffline: true,
        offlineSince: expect.any(Date),
      });
    });

    it('should notify multiple subscribers', () => {
      // Given (Arrange)
      const subscriber1 = vi.fn();
      const subscriber2 = vi.fn();
      service.subscribe(subscriber1);
      service.subscribe(subscriber2);

      // When (Act)
      goOffline();

      // Then (Assert)
      expect(subscriber1).toHaveBeenCalled();
      expect(subscriber2).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      // Given (Arrange)
      const subscriber = vi.fn();
      const unsubscribe = service.subscribe(subscriber);

      // When (Act)
      unsubscribe();
      goOffline();

      // Then (Assert)
      expect(subscriber).not.toHaveBeenCalled();
    });
  });

  describe('singleton pattern', () => {
    it('should export singleton instance', () => {
      // Then (Assert)
      expect(offlineDetectionService).toBeInstanceOf(OfflineDetectionService);
    });
  });

  describe('destroy()', () => {
    it('should clear all callbacks on destroy', () => {
      // Given (Arrange)
      const onOnline = vi.fn();
      const onOffline = vi.fn();
      const subscriber = vi.fn();
      service.setOnOnlineCallback(onOnline);
      service.setOnOfflineCallback(onOffline);
      service.subscribe(subscriber);

      // When (Act)
      service.destroy();
      goOffline();
      goOnline();

      // Then (Assert) - No callbacks should be called after destroy
      expect(onOnline).not.toHaveBeenCalled();
      expect(onOffline).not.toHaveBeenCalled();
      expect(subscriber).not.toHaveBeenCalled();
    });

    it('should be safe to call multiple times', () => {
      // When (Act) & Then (Assert) - No errors
      service.destroy();
      service.destroy();
      service.destroy();
    });
  });

  describe('edge cases', () => {
    it('should handle rapid online/offline transitions', () => {
      // Given (Arrange)
      const subscriber = vi.fn();
      service.subscribe(subscriber);

      // When (Act)
      goOffline();
      goOnline();
      goOffline();
      goOnline();

      // Then (Assert)
      expect(subscriber).toHaveBeenCalledTimes(4);
      expect(service.isOffline()).toBe(false);
    });

    it('should handle callback errors gracefully', () => {
      // Given (Arrange)
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();
      service.subscribe(errorCallback);
      service.subscribe(normalCallback);

      // When (Act) & Then (Assert) - Should not throw, normal callback still called
      expect(() => goOffline()).not.toThrow();
      expect(normalCallback).toHaveBeenCalled();
    });
  });
});
