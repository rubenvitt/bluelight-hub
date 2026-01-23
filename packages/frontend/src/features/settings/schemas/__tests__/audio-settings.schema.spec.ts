/**
 * Unit Tests für Audio Settings Schema
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 2.7: Audio-Alarm konfigurieren (AC5)**
 * - Persistenz: Einstellungen in Tauri Store speichern/laden
 * - Schema-Validierung für Sound-Optionen und Volume
 */

import { describe, expect, it } from 'vitest';
import {
  ALARM_LEVEL_LABELS,
  ALARM_LEVELS,
  DEFAULT_AUDIO_SETTINGS,
  SOUND_FILES,
  SOUND_OPTION_LABELS,
  SOUND_OPTIONS,
  audioLevelConfigSchema,
  audioSettingsSchema,
  isValidAudioSettings,
  toAudioVolume,
  toVolumePercent,
  validateAudioSettings,
} from '../audio-settings.schema';

describe('audioLevelConfigSchema', () => {
  describe('Sound Validation (Story 2.7 AC2)', () => {
    it('should validate config with default sound', () => {
      // Given (Arrange)
      const input = { sound: 'default', volume: 70 };

      // When (Act)
      const result = audioLevelConfigSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sound).toBe('default');
      }
    });

    it('should validate config with chime sound', () => {
      // Given (Arrange)
      const input = { sound: 'chime', volume: 50 };

      // When (Act)
      const result = audioLevelConfigSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sound).toBe('chime');
      }
    });

    it('should validate config with bell sound', () => {
      // Given (Arrange)
      const input = { sound: 'bell', volume: 85 };

      // When (Act)
      const result = audioLevelConfigSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sound).toBe('bell');
      }
    });

    it('should validate config with alert sound', () => {
      // Given (Arrange)
      const input = { sound: 'alert', volume: 100 };

      // When (Act)
      const result = audioLevelConfigSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sound).toBe('alert');
      }
    });

    it('should reject invalid sound option', () => {
      // Given (Arrange)
      const input = { sound: 'invalid', volume: 70 };

      // When (Act)
      const result = audioLevelConfigSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
    });
  });

  describe('Volume Validation (Story 2.7 AC3)', () => {
    it('should validate volume at minimum (0)', () => {
      // Given (Arrange)
      const input = { sound: 'default', volume: 0 };

      // When (Act)
      const result = audioLevelConfigSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.volume).toBe(0);
      }
    });

    it('should validate volume at maximum (100)', () => {
      // Given (Arrange)
      const input = { sound: 'default', volume: 100 };

      // When (Act)
      const result = audioLevelConfigSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.volume).toBe(100);
      }
    });

    it('should validate volume in middle range', () => {
      // Given (Arrange)
      const input = { sound: 'default', volume: 50 };

      // When (Act)
      const result = audioLevelConfigSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.volume).toBe(50);
      }
    });

    it('should reject volume below minimum', () => {
      // Given (Arrange)
      const input = { sound: 'default', volume: -1 };

      // When (Act)
      const result = audioLevelConfigSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
    });

    it('should reject volume above maximum', () => {
      // Given (Arrange)
      const input = { sound: 'default', volume: 101 };

      // When (Act)
      const result = audioLevelConfigSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
    });

    it('should reject non-integer volume', () => {
      // Given (Arrange)
      const input = { sound: 'default', volume: 70.5 };

      // When (Act)
      const result = audioLevelConfigSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
    });
  });
});

describe('audioSettingsSchema', () => {
  describe('Enabled Toggle (Story 2.7 AC7)', () => {
    it('should validate settings with enabled=true', () => {
      // Given (Arrange)
      const input = {
        enabled: true,
        levels: {
          info: { sound: 'default', volume: 70 },
          warning: { sound: 'default', volume: 85 },
          urgent: { sound: 'default', volume: 100 },
        },
      };

      // When (Act)
      const result = audioSettingsSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(true);
      }
    });

    it('should validate settings with enabled=false', () => {
      // Given (Arrange)
      const input = {
        enabled: false,
        levels: {
          info: { sound: 'default', volume: 70 },
          warning: { sound: 'default', volume: 85 },
          urgent: { sound: 'default', volume: 100 },
        },
      };

      // When (Act)
      const result = audioSettingsSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(false);
      }
    });
  });

  describe('Level Configuration (Story 2.7 AC2,3)', () => {
    it('should validate settings with all three levels', () => {
      // Given (Arrange)
      const input = {
        enabled: true,
        levels: {
          info: { sound: 'chime', volume: 50 },
          warning: { sound: 'bell', volume: 75 },
          urgent: { sound: 'alert', volume: 100 },
        },
      };

      // When (Act)
      const result = audioSettingsSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.levels.info.sound).toBe('chime');
        expect(result.data.levels.warning.sound).toBe('bell');
        expect(result.data.levels.urgent.sound).toBe('alert');
      }
    });

    it('should reject settings missing info level', () => {
      // Given (Arrange)
      const input = {
        enabled: true,
        levels: {
          warning: { sound: 'default', volume: 85 },
          urgent: { sound: 'default', volume: 100 },
        },
      };

      // When (Act)
      const result = audioSettingsSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
    });

    it('should reject settings missing warning level', () => {
      // Given (Arrange)
      const input = {
        enabled: true,
        levels: {
          info: { sound: 'default', volume: 70 },
          urgent: { sound: 'default', volume: 100 },
        },
      };

      // When (Act)
      const result = audioSettingsSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
    });

    it('should reject settings missing urgent level', () => {
      // Given (Arrange)
      const input = {
        enabled: true,
        levels: {
          info: { sound: 'default', volume: 70 },
          warning: { sound: 'default', volume: 85 },
        },
      };

      // When (Act)
      const result = audioSettingsSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
    });
  });

  describe('Missing Fields', () => {
    it('should reject settings without enabled field', () => {
      // Given (Arrange)
      const input = {
        levels: {
          info: { sound: 'default', volume: 70 },
          warning: { sound: 'default', volume: 85 },
          urgent: { sound: 'default', volume: 100 },
        },
      };

      // When (Act)
      const result = audioSettingsSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
    });

    it('should reject settings without levels field', () => {
      // Given (Arrange)
      const input = {
        enabled: true,
      };

      // When (Act)
      const result = audioSettingsSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
    });
  });
});

describe('DEFAULT_AUDIO_SETTINGS', () => {
  it('should have enabled=true by default', () => {
    // Given (Arrange) - DEFAULT_AUDIO_SETTINGS constant

    // When/Then (Assert)
    expect(DEFAULT_AUDIO_SETTINGS.enabled).toBe(true);
  });

  it('should have default sound for all levels', () => {
    // Given/When/Then
    expect(DEFAULT_AUDIO_SETTINGS.levels.info.sound).toBe('default');
    expect(DEFAULT_AUDIO_SETTINGS.levels.warning.sound).toBe('default');
    expect(DEFAULT_AUDIO_SETTINGS.levels.urgent.sound).toBe('default');
  });

  it('should have increasing volume per level', () => {
    // Given/When/Then
    const infoVolume = DEFAULT_AUDIO_SETTINGS.levels.info.volume;
    const warningVolume = DEFAULT_AUDIO_SETTINGS.levels.warning.volume;
    const urgentVolume = DEFAULT_AUDIO_SETTINGS.levels.urgent.volume;

    expect(infoVolume).toBeLessThan(warningVolume);
    expect(warningVolume).toBeLessThan(urgentVolume);
  });

  it('should be valid according to schema', () => {
    // Given (Arrange)
    const settings = DEFAULT_AUDIO_SETTINGS;

    // When (Act)
    const result = audioSettingsSchema.safeParse(settings);

    // Then (Assert)
    expect(result.success).toBe(true);
  });
});

describe('validateAudioSettings', () => {
  it('should return valid settings unchanged', () => {
    // Given (Arrange)
    const validSettings = {
      enabled: true,
      levels: {
        info: { sound: 'chime' as const, volume: 60 },
        warning: { sound: 'bell' as const, volume: 80 },
        urgent: { sound: 'alert' as const, volume: 100 },
      },
    };

    // When (Act)
    const result = validateAudioSettings(validSettings);

    // Then (Assert)
    expect(result).toEqual(validSettings);
  });

  it('should throw ZodError for null input', () => {
    // Given (Arrange)
    const input = null;

    // When/Then (Assert)
    expect(() => validateAudioSettings(input)).toThrow();
  });

  it('should throw ZodError for undefined input', () => {
    // Given (Arrange)
    const input = undefined;

    // When/Then (Assert)
    expect(() => validateAudioSettings(input)).toThrow();
  });

  it('should throw ZodError for invalid input', () => {
    // Given (Arrange)
    const invalidInput = {
      enabled: 'yes', // should be boolean
      levels: {},
    };

    // When/Then (Assert)
    expect(() => validateAudioSettings(invalidInput)).toThrow();
  });
});

describe('isValidAudioSettings', () => {
  it('should return true for valid settings', () => {
    // Given (Arrange)
    const validSettings = DEFAULT_AUDIO_SETTINGS;

    // When (Act)
    const result = isValidAudioSettings(validSettings);

    // Then (Assert)
    expect(result).toBe(true);
  });

  it('should return false for null', () => {
    // Given (Arrange)
    const input = null;

    // When (Act)
    const result = isValidAudioSettings(input);

    // Then (Assert)
    expect(result).toBe(false);
  });

  it('should return false for invalid structure', () => {
    // Given (Arrange)
    const invalidInput = { enabled: true };

    // When (Act)
    const result = isValidAudioSettings(invalidInput);

    // Then (Assert)
    expect(result).toBe(false);
  });
});

describe('toAudioVolume', () => {
  it('should convert 0% to 0.0', () => {
    // Given/When/Then
    expect(toAudioVolume(0)).toBe(0);
  });

  it('should convert 100% to 1.0', () => {
    // Given/When/Then
    expect(toAudioVolume(100)).toBe(1);
  });

  it('should convert 50% to 0.5', () => {
    // Given/When/Then
    expect(toAudioVolume(50)).toBe(0.5);
  });

  it('should convert 70% to 0.7', () => {
    // Given/When/Then
    expect(toAudioVolume(70)).toBe(0.7);
  });

  describe('Edge Cases', () => {
    it('should clamp negative values to 0', () => {
      // Given/When/Then
      expect(toAudioVolume(-50)).toBe(0);
    });

    it('should clamp values above 100 to 1.0', () => {
      // Given/When/Then
      expect(toAudioVolume(150)).toBe(1);
    });

    it('should handle NaN by returning 0', () => {
      // Given/When/Then
      expect(toAudioVolume(Number.NaN)).toBe(0);
    });

    it('should handle Infinity by returning 0', () => {
      // Given/When/Then
      expect(toAudioVolume(Number.POSITIVE_INFINITY)).toBe(0);
    });
  });
});

describe('toVolumePercent', () => {
  it('should convert 0.0 to 0%', () => {
    // Given/When/Then
    expect(toVolumePercent(0)).toBe(0);
  });

  it('should convert 1.0 to 100%', () => {
    // Given/When/Then
    expect(toVolumePercent(1)).toBe(100);
  });

  it('should convert 0.5 to 50%', () => {
    // Given/When/Then
    expect(toVolumePercent(0.5)).toBe(50);
  });

  it('should convert 0.7 to 70%', () => {
    // Given/When/Then
    expect(toVolumePercent(0.7)).toBe(70);
  });

  describe('Rounding Behavior', () => {
    it('should round 0.674 down to 67%', () => {
      // Given/When/Then
      expect(toVolumePercent(0.674)).toBe(67);
    });

    it('should round 0.675 up to 68%', () => {
      // Given/When/Then
      expect(toVolumePercent(0.675)).toBe(68);
    });

    it('should handle NaN by returning 0', () => {
      // Given/When/Then
      expect(toVolumePercent(Number.NaN)).toBe(0);
    });
  });
});

describe('SOUND_OPTIONS', () => {
  it('should have 4 sound options (Story 2.7 AC2)', () => {
    // Given/When/Then
    expect(SOUND_OPTIONS).toHaveLength(4);
  });

  it('should contain expected options', () => {
    // Given/When/Then
    expect(SOUND_OPTIONS).toContain('default');
    expect(SOUND_OPTIONS).toContain('chime');
    expect(SOUND_OPTIONS).toContain('bell');
    expect(SOUND_OPTIONS).toContain('alert');
  });
});

describe('ALARM_LEVELS', () => {
  it('should have 3 alarm levels', () => {
    // Given/When/Then
    expect(ALARM_LEVELS).toHaveLength(3);
  });

  it('should contain expected levels', () => {
    // Given/When/Then
    expect(ALARM_LEVELS).toContain('info');
    expect(ALARM_LEVELS).toContain('warning');
    expect(ALARM_LEVELS).toContain('urgent');
  });
});

describe('SOUND_FILES', () => {
  it('should have file paths for all alarm levels', () => {
    // Given/When/Then
    for (const level of ALARM_LEVELS) {
      expect(SOUND_FILES[level]).toBeDefined();
      expect(typeof SOUND_FILES[level]).toBe('object');
    }
  });

  it('should have file paths for all sound options per level', () => {
    // Given/When/Then
    for (const level of ALARM_LEVELS) {
      for (const option of SOUND_OPTIONS) {
        expect(SOUND_FILES[level][option]).toBeDefined();
        expect(typeof SOUND_FILES[level][option]).toBe('string');
        expect(SOUND_FILES[level][option]).toMatch(/\.mp3$/);
      }
    }
  });
});

describe('SOUND_OPTION_LABELS', () => {
  it('should have labels for all sound options', () => {
    // Given/When/Then
    for (const option of SOUND_OPTIONS) {
      expect(SOUND_OPTION_LABELS[option]).toBeDefined();
      expect(SOUND_OPTION_LABELS[option].length).toBeGreaterThan(0);
    }
  });
});

describe('ALARM_LEVEL_LABELS', () => {
  it('should have labels for all alarm levels', () => {
    // Given/When/Then
    for (const level of ALARM_LEVELS) {
      expect(ALARM_LEVEL_LABELS[level]).toBeDefined();
      expect(ALARM_LEVEL_LABELS[level].length).toBeGreaterThan(0);
    }
  });
});
