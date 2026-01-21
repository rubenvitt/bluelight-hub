/**
 * Unit Tests fuer Notification Service
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 1.5 AC3:**
 * - Native OS-Notification mit Titel und "Jetzt fällig"
 * - Notification erscheint auch wenn App minimiert/im Hintergrund
 * - Tauri Native Notification API mit Web Fallback
 *
 * HINWEIS: Web Notification Constructor Tests sind ausgelassen, da das Mocking
 * von `new Notification()` in Vitest problematisch ist. Die Tauri-Integration
 * wird stattdessen ueber Integration-Tests abgedeckt.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocked Tauri functions - auf Module-Level fuer konsistentes Mocking
const mockIsPermissionGranted = vi.fn();
const mockRequestPermission = vi.fn();
const mockTauriSendNotification = vi.fn();
const mockIsTauri = vi.fn(() => false);

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => mockIsTauri(),
}));

// Mock @tauri-apps/plugin-notification
vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: () => mockIsPermissionGranted(),
  requestPermission: () => mockRequestPermission(),
  sendNotification: (opts: unknown) => mockTauriSendNotification(opts),
}));

// Mock notification-setup.service (für Channel + ActionType Constants)
vi.mock('../notification-setup.service', () => ({
  ERINNERUNG_CHANNEL_ID: 'erinnerungen',
  ERINNERUNG_ACTION_TYPE_ID: 'erinnerung-action',
}));

// Mock logger
vi.mock('@/shared/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import nach Mock-Definition
import { NotificationService } from '../notification.service';

describe('NotificationService', () => {
  // Speichere Original-Notification Konstruktor
  const OriginalNotification = globalThis.Notification;
  let notificationService: InstanceType<typeof NotificationService>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset isTauri zu false (Browser-Modus)
    mockIsTauri.mockReturnValue(false);

    // Setup Web Notification Mock mit statischen Properties
    const NotificationMock = Object.assign(function MockNotification() {}, {
      permission: 'default' as NotificationPermission,
      requestPermission: vi.fn().mockResolvedValue('granted' as NotificationPermission),
    });

    // @ts-expect-error - Absichtliches Override fuer Test
    globalThis.Notification = NotificationMock;

    // Neue Service-Instanz fuer jeden Test
    notificationService = new NotificationService();
  });

  afterEach(() => {
    // Restore Original Notification
    globalThis.Notification = OriginalNotification;
    vi.restoreAllMocks();
  });

  describe('isSupported()', () => {
    it('should return true when Web Notification API is available', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(false);
      // Notification Mock ist bereits gesetzt

      // When (Act)
      const supported = await notificationService.isSupported();

      // Then (Assert)
      expect(supported).toBe(true);
    });

    it('should return true when Tauri notification plugin is available', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(true);

      // When (Act)
      const supported = await notificationService.isSupported();

      // Then (Assert)
      expect(supported).toBe(true);
    });
  });

  describe('checkPermission()', () => {
    it('should return granted when Web Notification permission is granted', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(false);
      Object.defineProperty(globalThis.Notification, 'permission', {
        value: 'granted',
        writable: true,
        configurable: true,
      });

      // When (Act)
      const status = await notificationService.checkPermission();

      // Then (Assert)
      expect(status).toBe('granted');
    });

    it('should return denied when Web Notification permission is denied', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(false);
      Object.defineProperty(globalThis.Notification, 'permission', {
        value: 'denied',
        writable: true,
        configurable: true,
      });

      // When (Act)
      const status = await notificationService.checkPermission();

      // Then (Assert)
      expect(status).toBe('denied');
    });

    it('should return unknown for default Web Notification permission', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(false);
      Object.defineProperty(globalThis.Notification, 'permission', {
        value: 'default',
        writable: true,
        configurable: true,
      });

      // When (Act)
      const status = await notificationService.checkPermission();

      // Then (Assert)
      expect(status).toBe('unknown');
    });

    it('should check Tauri permission when in Tauri environment', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(true);
      mockIsPermissionGranted.mockResolvedValue(true);

      // When (Act)
      const status = await notificationService.checkPermission();

      // Then (Assert)
      expect(mockIsPermissionGranted).toHaveBeenCalled();
      expect(status).toBe('granted');
    });

    it('should return unknown when Tauri permission is not granted', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(true);
      mockIsPermissionGranted.mockResolvedValue(false);

      // When (Act)
      const status = await notificationService.checkPermission();

      // Then (Assert)
      expect(status).toBe('unknown');
    });
  });

  describe('requestPermission()', () => {
    it('should request Web Notification permission and return granted', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(false);
      const mockRequestPerm = vi.fn().mockResolvedValue('granted');
      Object.defineProperty(globalThis.Notification, 'requestPermission', {
        value: mockRequestPerm,
        writable: true,
        configurable: true,
      });

      // When (Act)
      const status = await notificationService.requestPermission();

      // Then (Assert)
      expect(mockRequestPerm).toHaveBeenCalled();
      expect(status).toBe('granted');
    });

    it('should request Tauri permission when in Tauri environment and not already granted', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(true);
      mockIsPermissionGranted.mockResolvedValue(false);
      mockRequestPermission.mockResolvedValue('granted');

      // When (Act)
      const status = await notificationService.requestPermission();

      // Then (Assert)
      expect(mockRequestPermission).toHaveBeenCalled();
      expect(status).toBe('granted');
    });

    it('should return granted without requesting if Tauri permission already granted', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(true);
      mockIsPermissionGranted.mockResolvedValue(true);

      // When (Act)
      const status = await notificationService.requestPermission();

      // Then (Assert)
      expect(mockRequestPermission).not.toHaveBeenCalled();
      expect(status).toBe('granted');
    });

    it('should return denied when Tauri permission request is denied', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(true);
      mockIsPermissionGranted.mockResolvedValue(false);
      mockRequestPermission.mockResolvedValue('denied');

      // When (Act)
      const status = await notificationService.requestPermission();

      // Then (Assert)
      expect(status).toBe('denied');
    });
  });

  describe('send()', () => {
    it('should return error when no permission granted', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(false);
      Object.defineProperty(globalThis.Notification, 'permission', {
        value: 'denied',
        writable: true,
        configurable: true,
      });
      await notificationService.checkPermission();

      // When (Act)
      const result = await notificationService.send({ title: 'Test' });

      // Then (Assert)
      expect(result.success).toBe(false);
      expect(result.error).toContain('denied');
    });

    it('should send Tauri notification when in Tauri environment with granted permission', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(true);
      mockIsPermissionGranted.mockResolvedValue(true);
      mockTauriSendNotification.mockResolvedValue(undefined);
      await notificationService.checkPermission();

      // When (Act)
      const result = await notificationService.send({ title: 'Tauri Test' });

      // Then (Assert)
      expect(result.success).toBe(true);
      expect(mockTauriSendNotification).toHaveBeenCalledWith({
        title: 'Tauri Test',
        body: 'Jetzt fällig',
        channelId: 'erinnerungen',
        actionTypeId: 'erinnerung-action',
        extra: undefined,
        autoCancel: true,
      });
    });

    it('should use "Jetzt fällig" as default body text', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(true);
      mockIsPermissionGranted.mockResolvedValue(true);
      mockTauriSendNotification.mockResolvedValue(undefined);
      await notificationService.checkPermission();

      // When (Act)
      await notificationService.send({ title: 'Test' });

      // Then (Assert)
      expect(mockTauriSendNotification).toHaveBeenCalledWith(expect.objectContaining({ body: 'Jetzt fällig' }));
    });

    it('should use custom body when provided', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(true);
      mockIsPermissionGranted.mockResolvedValue(true);
      mockTauriSendNotification.mockResolvedValue(undefined);
      await notificationService.checkPermission();

      // When (Act)
      await notificationService.send({ title: 'Test', body: 'Custom Body' });

      // Then (Assert)
      expect(mockTauriSendNotification).toHaveBeenCalledWith({
        title: 'Test',
        body: 'Custom Body',
        channelId: 'erinnerungen',
        actionTypeId: 'erinnerung-action',
        extra: undefined,
        autoCancel: true,
      });
    });
  });

  describe('sendErinnerungNotification()', () => {
    it('should format title with "Erinnerung:" prefix', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(true);
      mockIsPermissionGranted.mockResolvedValue(true);
      mockTauriSendNotification.mockResolvedValue(undefined);
      await notificationService.checkPermission();

      // When (Act)
      await notificationService.sendErinnerungNotification('Funkgeraet pruefen');

      // Then (Assert)
      expect(mockTauriSendNotification).toHaveBeenCalledWith({
        title: 'Erinnerung: Funkgeraet pruefen',
        body: 'Jetzt fällig',
        channelId: 'erinnerungen',
        actionTypeId: 'erinnerung-action',
        extra: undefined,
        autoCancel: true,
      });
    });

    it('should include extra data when erinnerungId and einsatzId provided', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(true);
      mockIsPermissionGranted.mockResolvedValue(true);
      mockTauriSendNotification.mockResolvedValue(undefined);
      await notificationService.checkPermission();

      // When (Act)
      await notificationService.sendErinnerungNotification('Test Erinnerung', 'erin-123', 'eins-456');

      // Then (Assert)
      expect(mockTauriSendNotification).toHaveBeenCalledWith({
        title: 'Erinnerung: Test Erinnerung',
        body: 'Jetzt fällig',
        channelId: 'erinnerungen',
        actionTypeId: 'erinnerung-action',
        extra: { erinnerungId: 'erin-123', einsatzId: 'eins-456' },
        autoCancel: true,
      });
    });
  });

  describe('Graceful Degradation', () => {
    it('should not throw when sending notification without permission', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(false);
      Object.defineProperty(globalThis.Notification, 'permission', {
        value: 'denied',
        writable: true,
        configurable: true,
      });

      // When (Act) & Then (Assert)
      await expect(notificationService.send({ title: 'Test' })).resolves.not.toThrow();
    });

    it('should return failure result gracefully when Tauri notification fails', async () => {
      // Given (Arrange)
      mockIsTauri.mockReturnValue(true);
      mockIsPermissionGranted.mockResolvedValue(true);
      mockTauriSendNotification.mockRejectedValue(new Error('Plugin Error'));
      await notificationService.checkPermission();

      // When (Act)
      const result = await notificationService.send({ title: 'Test' });

      // Then (Assert)
      expect(result.success).toBe(false);
      expect(result.error).toContain('Plugin Error');
    });

    it('should handle Tauri permission check error gracefully by falling back to Web API', async () => {
      // Given (Arrange)
      // Tauri plugin check fails, so service falls back to Web Notification API
      mockIsTauri.mockReturnValue(true);
      mockIsPermissionGranted.mockRejectedValue(new Error('Permission check failed'));
      Object.defineProperty(globalThis.Notification, 'permission', {
        value: 'default',
        writable: true,
        configurable: true,
      });

      // When (Act)
      const status = await notificationService.checkPermission();

      // Then (Assert)
      // Falls back to Web API which returns 'unknown' for 'default' permission
      expect(status).toBe('unknown');
    });
  });
});
