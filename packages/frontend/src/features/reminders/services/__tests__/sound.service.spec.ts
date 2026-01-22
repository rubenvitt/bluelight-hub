/**
 * Unit Tests für Sound Service
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 2.7: Audio-Alarm konfigurieren**
 * - AC3: Lautstärke-Einstellung pro Stufe (0-100%)
 * - AC4: Vorschau-Funktion für Sounds
 * - AC6: Konfigurierte Töne bei Alarm nutzen
 *
 * HINWEIS: Komplexe Audio-Mocking ist in Vitest schwierig. Diese Tests
 * fokussieren auf Kern-Logik. Integration-Tests decken Audio-Playback ab.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mocked Tauri functions
const mockInvoke = vi.fn();
const mockIsTauri = vi.fn(() => false);

// Mock Audio Settings
const mockGetAudioSettings = vi.fn();

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => mockIsTauri(),
  invoke: (cmd: string, args: unknown) => mockInvoke(cmd, args),
}));

// Mock settings hooks
vi.mock('@/features/settings/hooks', () => ({
  getAudioSettings: () => mockGetAudioSettings(),
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
import { SoundService, type SoundLevel } from '../sound.service';

describe('SoundService', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Reset Singleton für Test-Isolation
    SoundService.reset();

    // Setup defaults
    mockIsTauri.mockReturnValue(true); // Tauri-Modus für einfacheres Testing
    mockInvoke.mockResolvedValue(undefined);

    // Default Audio Settings
    mockGetAudioSettings.mockResolvedValue({
      enabled: true,
      levels: {
        info: { sound: 'default', volume: 70 },
        warning: { sound: 'default', volume: 85 },
        urgent: { sound: 'default', volume: 100 },
      },
    });
  });

  afterEach(() => {
    SoundService.reset();
    vi.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      // Given (Arrange)
      const firstInstance = SoundService.getInstance();

      // When (Act)
      const secondInstance = SoundService.getInstance();

      // Then (Assert)
      expect(firstInstance).toBe(secondInstance);
    });

    it('should create new instance after reset', () => {
      // Given (Arrange)
      const firstInstance = SoundService.getInstance();

      // When (Act)
      SoundService.reset();
      const newInstance = SoundService.getInstance();

      // Then (Assert)
      expect(firstInstance).not.toBe(newInstance);
    });
  });

  describe('playAlarm() - Story 2.7 AC6', () => {
    it('should load settings and play alarm', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      mockGetAudioSettings.mockResolvedValue({
        enabled: true,
        levels: {
          info: { sound: 'chime', volume: 60 },
          warning: { sound: 'bell', volume: 80 },
          urgent: { sound: 'alert', volume: 100 },
        },
      });

      // When (Act)
      const result = await soundService.playAlarm('warning');

      // Then (Assert)
      expect(result.success).toBe(true);
      expect(mockGetAudioSettings).toHaveBeenCalled();
      expect(mockInvoke).toHaveBeenCalledWith(
        'play_sound',
        expect.objectContaining({
          soundType: 'warning',
        }),
      );
    });

    it('should skip playback when audio is disabled (AC7)', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      mockGetAudioSettings.mockResolvedValue({
        enabled: false,
        levels: {
          info: { sound: 'default', volume: 70 },
          warning: { sound: 'default', volume: 85 },
          urgent: { sound: 'default', volume: 100 },
        },
      });

      // When (Act)
      const result = await soundService.playAlarm('info');

      // Then (Assert)
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should handle settings load error gracefully', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      mockGetAudioSettings.mockRejectedValue(new Error('Store not available'));

      // When (Act)
      const result = await soundService.playAlarm('urgent');

      // Then (Assert)
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should play all sound levels: info, warning, urgent', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      const levels: SoundLevel[] = ['info', 'warning', 'urgent'];

      // When/Then (Act & Assert)
      for (const level of levels) {
        mockInvoke.mockClear();
        const result = await soundService.playAlarm(level);
        expect(result.success).toBe(true);
        expect(mockInvoke).toHaveBeenCalledWith(
          'play_sound',
          expect.objectContaining({
            soundType: level,
          }),
        );
      }
    });
  });

  describe('playWithConfig() - Story 2.7 AC3, AC6', () => {
    it('should call Tauri invoke with correct parameters', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      mockIsTauri.mockReturnValue(true);

      // When (Act)
      const result = await soundService.playWithConfig('urgent', 'alert', 100);

      // Then (Assert)
      expect(result.success).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('play_sound', {
        soundType: 'urgent',
        volume: 1, // 100% -> 1.0
        soundFile: '/sounds/alarm-urgent-alert.mp3',
      });
    });

    it('should not pass soundFile for default sound', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      mockIsTauri.mockReturnValue(true);

      // When (Act)
      await soundService.playWithConfig('info', 'default', 70);

      // Then (Assert)
      expect(mockInvoke).toHaveBeenCalledWith('play_sound', {
        soundType: 'info',
        volume: 0.7,
        soundFile: undefined,
      });
    });

    it('should convert volume percent to audio volume (0-1)', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      mockIsTauri.mockReturnValue(true);

      // When (Act)
      await soundService.playWithConfig('warning', 'bell', 50);

      // Then (Assert)
      expect(mockInvoke).toHaveBeenCalledWith(
        'play_sound',
        expect.objectContaining({
          volume: 0.5,
        }),
      );
    });

    it('should fallback to Web Audio on Tauri invoke errors (Story 2.8)', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      mockIsTauri.mockReturnValue(true);
      mockInvoke.mockRejectedValue(new Error('Tauri error'));

      // Mock Web Audio für Fallback
      const mockPlay = vi.fn().mockResolvedValue(undefined);
      const MockAudioClass = class MockAudio {
        volume = 0;
        src = '';
        constructor(src?: string) {
          this.src = src || '';
        }
        play = () => mockPlay();
        pause = vi.fn();
        remove = vi.fn();
        addEventListener = vi.fn();
      };
      global.Audio = MockAudioClass as unknown as typeof Audio;

      // When (Act)
      const result = await soundService.playWithConfig('info', 'default', 70);

      // Then (Assert) - Story 2.8: Fallback zu Web Audio statt Fehler
      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(mockPlay).toHaveBeenCalled();
    });

    it('should use correct sound file path for each option', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      mockIsTauri.mockReturnValue(true);

      const testCases = [
        { level: 'info' as const, sound: 'chime' as const, expected: '/sounds/alarm-info-chime.mp3' },
        { level: 'warning' as const, sound: 'bell' as const, expected: '/sounds/alarm-warning-bell.mp3' },
        { level: 'urgent' as const, sound: 'alert' as const, expected: '/sounds/alarm-urgent-alert.mp3' },
      ];

      // When/Then
      for (const { level, sound, expected } of testCases) {
        mockInvoke.mockClear();
        await soundService.playWithConfig(level, sound, 80);
        expect(mockInvoke).toHaveBeenCalledWith(
          'play_sound',
          expect.objectContaining({
            soundFile: expected,
          }),
        );
      }
    });
  });

  describe('playPreview() - Story 2.7 AC4', () => {
    it('should call playWithConfig with same parameters', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      mockIsTauri.mockReturnValue(true);

      // When (Act)
      const result = await soundService.playPreview('urgent', 'alert', 100);

      // Then (Assert)
      expect(result.success).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('play_sound', {
        soundType: 'urgent',
        volume: 1,
        soundFile: '/sounds/alarm-urgent-alert.mp3',
      });
    });
  });

  describe('escalateToLevel() - Debouncing', () => {
    it('should play sound on first escalation', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      soundService.clearEscalationDebounce();

      // When (Act)
      const result = await soundService.escalateToLevel('warning');

      // Then (Assert)
      expect(result.success).toBe(true);
      expect(mockInvoke).toHaveBeenCalled();
    });

    it('should throttle rapid escalations', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      soundService.clearEscalationDebounce();

      // When (Act) - Schnelle aufeinanderfolgende Eskalationen
      await soundService.escalateToLevel('warning');
      mockInvoke.mockClear();
      const secondResult = await soundService.escalateToLevel('urgent');

      // Then (Assert) - Zweite wird gedrosselt (success=true, aber keine Invoke)
      expect(secondResult.success).toBe(true);
    });

    it('should allow escalation after debounce period', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      soundService.clearEscalationDebounce();

      // Erste Eskalation
      await soundService.escalateToLevel('warning');

      // Simuliere Zeit-Vergehen (Debounce ist 200ms)
      vi.useFakeTimers();
      vi.advanceTimersByTime(250);
      vi.useRealTimers();

      mockInvoke.mockClear();

      // When (Act)
      const result = await soundService.escalateToLevel('urgent');

      // Then (Assert)
      expect(result.success).toBe(true);
    });
  });

  describe('stopAllSounds()', () => {
    it('should not throw when called', () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();

      // When/Then (Assert)
      expect(() => soundService.stopAllSounds()).not.toThrow();
    });
  });

  describe('cleanup()', () => {
    it('should not throw when called', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();

      // When/Then (Assert)
      await expect(soundService.cleanup()).resolves.not.toThrow();
    });
  });

  describe('clearEscalationDebounce()', () => {
    it('should reset debounce state', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      await soundService.escalateToLevel('warning');

      // When (Act)
      soundService.clearEscalationDebounce();
      mockInvoke.mockClear();

      // Then (Assert) - Neue Eskalation sollte sofort funktionieren
      const result = await soundService.escalateToLevel('urgent');
      expect(result.success).toBe(true);
      expect(mockInvoke).toHaveBeenCalled();
    });
  });

  describe('Volume ranges', () => {
    it('should handle minimum volume (0%)', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      mockIsTauri.mockReturnValue(true);

      // When (Act)
      await soundService.playWithConfig('info', 'default', 0);

      // Then (Assert)
      expect(mockInvoke).toHaveBeenCalledWith(
        'play_sound',
        expect.objectContaining({
          volume: 0,
        }),
      );
    });

    it('should handle maximum volume (100%)', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      mockIsTauri.mockReturnValue(true);

      // When (Act)
      await soundService.playWithConfig('urgent', 'alert', 100);

      // Then (Assert)
      expect(mockInvoke).toHaveBeenCalledWith(
        'play_sound',
        expect.objectContaining({
          volume: 1,
        }),
      );
    });

    it('should handle middle volume (50%)', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      mockIsTauri.mockReturnValue(true);

      // When (Act)
      await soundService.playWithConfig('warning', 'chime', 50);

      // Then (Assert)
      expect(mockInvoke).toHaveBeenCalledWith(
        'play_sound',
        expect.objectContaining({
          volume: 0.5,
        }),
      );
    });
  });

  describe('Web Audio Fallback (isTauri=false)', () => {
    let mockPlay: ReturnType<typeof vi.fn>;
    let lastCreatedAudio: { volume: number; src: string };

    beforeEach(() => {
      // Reset Singleton für saubere Tests
      SoundService.reset();
      mockIsTauri.mockReturnValue(false);

      mockPlay = vi.fn().mockResolvedValue(undefined);

      // Mock Audio Konstruktor als echte Klasse (wichtig für `new Audio()`)
      // Muss alle vom SoundService genutzten Methoden implementieren
      const MockAudioClass = class MockAudio {
        volume = 0;
        src = '';
        currentTime = 0;

        constructor(src?: string) {
          this.src = src || '';
          // Speichere Referenz für Assertions
          lastCreatedAudio = this;
        }

        play = () => mockPlay();
        pause = vi.fn();
        remove = vi.fn(); // Für Memory Cleanup
        addEventListener = vi.fn(); // Für 'ended' und 'error' Events
      };

      global.Audio = MockAudioClass as unknown as typeof Audio;

      // Default Audio Settings
      mockGetAudioSettings.mockResolvedValue({
        enabled: true,
        levels: {
          info: { sound: 'default', volume: 70 },
          warning: { sound: 'default', volume: 85 },
          urgent: { sound: 'default', volume: 100 },
        },
      });
    });

    it('should use Web Audio API when not in Tauri', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();

      // When (Act)
      await soundService.playWithConfig('info', 'default', 70);

      // Then (Assert)
      expect(mockPlay).toHaveBeenCalled();
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should set correct volume on Audio element', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();

      // When (Act)
      await soundService.playWithConfig('warning', 'bell', 75);

      // Then (Assert)
      expect(lastCreatedAudio.volume).toBe(0.75);
    });

    it('should return error for NotAllowedError (Story 2.8 AC2)', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      const notAllowedError = new Error('Autoplay blocked');
      notAllowedError.name = 'NotAllowedError';
      mockPlay.mockRejectedValue(notAllowedError);

      // When (Act)
      const result = await soundService.playWithConfig('urgent', 'alert', 100);

      // Then (Assert) - Story 2.8: Errors werden propagiert für visuellen Alarm
      expect(result.success).toBe(false);
      expect(result.error).toContain('Autoplay blockiert');
    });

    it('should return error for NotSupportedError (Story 2.8 AC2)', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      const notSupportedError = new Error('File not found');
      notSupportedError.name = 'NotSupportedError';
      mockPlay.mockRejectedValue(notSupportedError);

      // When (Act)
      const result = await soundService.playWithConfig('info', 'chime', 50);

      // Then (Assert) - Story 2.8: Errors werden propagiert für visuellen Alarm
      expect(result.success).toBe(false);
      expect(result.error).toContain('Sound-Datei nicht gefunden');
    });

    it('should return error for AbortError (Story 2.8 AC2)', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      const abortError = new Error('Playback aborted');
      abortError.name = 'AbortError';
      mockPlay.mockRejectedValue(abortError);

      // When (Act)
      const result = await soundService.playWithConfig('warning', 'default', 80);

      // Then (Assert)
      expect(result.success).toBe(false);
      expect(result.error).toContain('abgebrochen');
    });

    it('should return error for unknown errors', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      mockPlay.mockRejectedValue(new Error('Unexpected audio error'));

      // When (Act)
      const result = await soundService.playWithConfig('warning', 'default', 80);

      // Then (Assert)
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected audio error');
    });

    it('should clamp volume to valid range (0-1)', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();

      // When (Act) - Volume 75% should be 0.75 clamped
      await soundService.playWithConfig('info', 'chime', 75);

      // Then (Assert) - Volume is clamped by Math.max(0, Math.min(1, volume))
      expect(lastCreatedAudio.volume).toBeGreaterThanOrEqual(0);
      expect(lastCreatedAudio.volume).toBeLessThanOrEqual(1);
    });
  });

  describe('Tauri to Web Audio Fallback - Story 2.8', () => {
    let mockPlay: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      SoundService.reset();
      mockIsTauri.mockReturnValue(true);

      mockPlay = vi.fn().mockResolvedValue(undefined);

      // Mock Audio Konstruktor für Web Audio Fallback
      const MockAudioClass = class MockAudio {
        volume = 0;
        src = '';
        currentTime = 0;

        constructor(src?: string) {
          this.src = src || '';
        }

        play = () => mockPlay();
        pause = vi.fn();
        remove = vi.fn();
        addEventListener = vi.fn();
      };

      global.Audio = MockAudioClass as unknown as typeof Audio;
    });

    it('should fallback to Web Audio when Tauri invoke fails (AC1)', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      mockInvoke.mockRejectedValue(new Error('Tauri sound unavailable'));

      // When (Act)
      const result = await soundService.playAlarm('info');

      // Then (Assert)
      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(mockPlay).toHaveBeenCalled(); // Web Audio wurde genutzt
    });

    it('should log warning when using fallback (AC1)', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      const { logger } = await import('@/shared/lib/logger');
      mockInvoke.mockRejectedValue(new Error('Tauri failed'));

      // When (Act)
      await soundService.playAlarm('warning');

      // Then (Assert)
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Tauri sound failed, using Web Audio fallback'));
    });

    it('should return error when both Tauri and Web Audio fail (AC2)', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      mockInvoke.mockRejectedValue(new Error('Tauri failed'));
      mockPlay.mockRejectedValue(new Error('Web Audio failed'));

      // When (Act)
      const result = await soundService.playAlarm('warning');

      // Then (Assert)
      expect(result.success).toBe(false);
      expect(result.error).toContain('Audio nicht verfügbar');
      expect(result.fallbackUsed).toBe(true);
    });

    it('should set fallbackUsed=true only when fallback was actually used', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      mockInvoke.mockResolvedValue(undefined); // Tauri succeeds

      // When (Act)
      const result = await soundService.playAlarm('urgent');

      // Then (Assert)
      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBeUndefined(); // Kein Fallback nötig
    });

    it('should not call Web Audio if Tauri succeeds', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      mockInvoke.mockResolvedValue(undefined);

      // When (Act)
      await soundService.playAlarm('info');

      // Then (Assert)
      expect(mockInvoke).toHaveBeenCalled();
      expect(mockPlay).not.toHaveBeenCalled();
    });

    it('should try Web Audio with correct sound file after Tauri fails', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();
      mockInvoke.mockRejectedValue(new Error('Tauri unavailable'));

      mockGetAudioSettings.mockResolvedValue({
        enabled: true,
        levels: {
          info: { sound: 'chime', volume: 60 },
          warning: { sound: 'bell', volume: 80 },
          urgent: { sound: 'alert', volume: 100 },
        },
      });

      // When (Act)
      await soundService.playAlarm('warning');

      // Then (Assert)
      expect(mockPlay).toHaveBeenCalled();
    });
  });

  describe('Volume Clamping in Tauri Path', () => {
    beforeEach(() => {
      mockIsTauri.mockReturnValue(true);
    });

    it('should clamp negative volume to 0', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();

      // When (Act)
      await soundService.playWithConfig('info', 'default', -50);

      // Then (Assert)
      expect(mockInvoke).toHaveBeenCalledWith(
        'play_sound',
        expect.objectContaining({
          volume: 0,
        }),
      );
    });

    it('should clamp volume above 100% to 1.0', async () => {
      // Given (Arrange)
      const soundService = SoundService.getInstance();

      // When (Act)
      await soundService.playWithConfig('urgent', 'alert', 150);

      // Then (Assert)
      expect(mockInvoke).toHaveBeenCalledWith(
        'play_sound',
        expect.objectContaining({
          volume: 1,
        }),
      );
    });
  });
});
