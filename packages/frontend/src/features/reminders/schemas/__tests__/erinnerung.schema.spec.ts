/**
 * Unit Tests für Erinnerung Schema
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 1.1 & 1.2:**
 * - AC1: Zeit-Presets (5, 10, 15, 30, 60 Min) als Chips
 * - AC2: Benutzerdefiniert-Option im Quick-Create Formular
 * - AC5: Validierung bei Benutzerdefiniert
 */

import { describe, it, expect } from 'vitest';
import { createErinnerungSchema, TIME_PRESETS } from '../erinnerung.schema';

describe('createErinnerungSchema', () => {
  describe('Preset Mode (Story 1.1)', () => {
    it('should validate preset mode with valid minuten', () => {
      // Given (Arrange)
      const input = {
        titel: 'Lagebesprechung',
        timeMode: 'preset' as const,
        minuten: 30,
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeMode).toBe('preset');
        expect(result.data.minuten).toBe(30);
      }
    });

    it('should validate preset mode with beschreibung', () => {
      // Given (Arrange)
      const input = {
        titel: 'Funkrunde',
        timeMode: 'preset' as const,
        minuten: 15,
        beschreibung: 'Alle Einheiten melden',
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.beschreibung).toBe('Alle Einheiten melden');
      }
    });

    it('should reject preset mode without minuten', () => {
      // Given (Arrange)
      const input = {
        titel: 'Lagebesprechung',
        timeMode: 'preset' as const,
        // minuten fehlt
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
    });

    it('should set error path to "minuten" when preset mode validation fails (Story 1.2 Error Path Fix)', () => {
      // Given (Arrange)
      const input = {
        titel: 'Lagebesprechung',
        timeMode: 'preset' as const,
        // minuten fehlt - Fehler sollte bei 'minuten' angezeigt werden
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
      if (!result.success) {
        const zeitIssue = result.error.issues.find((issue) => issue.message === 'Zeit ist erforderlich');
        expect(zeitIssue).toBeDefined();
        expect(zeitIssue?.path).toEqual(['minuten']);
      }
    });

    it('should reject preset mode with minuten less than 1', () => {
      // Given (Arrange)
      const input = {
        titel: 'Test',
        timeMode: 'preset' as const,
        minuten: 0,
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
    });

    it('should reject preset mode with minuten greater than 1440', () => {
      // Given (Arrange)
      const input = {
        titel: 'Test',
        timeMode: 'preset' as const,
        minuten: 1441, // > 24h
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
    });
  });

  describe('Custom Mode (Story 1.2 AC2, AC5)', () => {
    it('should validate custom mode with valid customTime', () => {
      // Given (Arrange)
      const input = {
        titel: 'Lagebesprechung',
        timeMode: 'custom' as const,
        customTime: { hours: 14, minutes: 45 },
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeMode).toBe('custom');
        expect(result.data.customTime).toEqual({ hours: 14, minutes: 45 });
      }
    });

    it('should validate custom mode with hours 0-23 (AC: hours 0-23)', () => {
      // Given (Arrange)
      const input1 = {
        titel: 'Mitternacht',
        timeMode: 'custom' as const,
        customTime: { hours: 0, minutes: 0 },
      };
      const input2 = {
        titel: 'Spät',
        timeMode: 'custom' as const,
        customTime: { hours: 23, minutes: 59 },
      };

      // When (Act)
      const result1 = createErinnerungSchema.safeParse(input1);
      const result2 = createErinnerungSchema.safeParse(input2);

      // Then (Assert)
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should reject custom mode with hours > 23', () => {
      // Given (Arrange)
      const input = {
        titel: 'Test',
        timeMode: 'custom' as const,
        customTime: { hours: 24, minutes: 0 },
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
    });

    it('should reject custom mode with minutes > 59', () => {
      // Given (Arrange)
      const input = {
        titel: 'Test',
        timeMode: 'custom' as const,
        customTime: { hours: 14, minutes: 60 },
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
    });

    it('should reject custom mode with negative hours', () => {
      // Given (Arrange)
      const input = {
        titel: 'Test',
        timeMode: 'custom' as const,
        customTime: { hours: -1, minutes: 30 },
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
    });

    it('should reject custom mode with negative minutes', () => {
      // Given (Arrange)
      const input = {
        titel: 'Test',
        timeMode: 'custom' as const,
        customTime: { hours: 14, minutes: -1 },
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
    });

    it('should reject custom mode without customTime (AC5)', () => {
      // Given (Arrange)
      const input = {
        titel: 'Test',
        timeMode: 'custom' as const,
        // customTime fehlt
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
    });

    it('should set error path to "customTime" when custom mode validation fails (Story 1.2 Error Path Fix)', () => {
      // Given (Arrange)
      const input = {
        titel: 'Test',
        timeMode: 'custom' as const,
        // customTime fehlt - Fehler sollte bei 'customTime' angezeigt werden
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
      if (!result.success) {
        const zeitIssue = result.error.issues.find((issue) => issue.message === 'Zeit ist erforderlich');
        expect(zeitIssue).toBeDefined();
        expect(zeitIssue?.path).toEqual(['customTime']);
      }
    });

    it('should validate custom mode with beschreibung', () => {
      // Given (Arrange)
      const input = {
        titel: 'Meeting',
        timeMode: 'custom' as const,
        customTime: { hours: 15, minutes: 0 },
        beschreibung: 'Besprechung mit allen Teams',
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.beschreibung).toBe('Besprechung mit allen Teams');
      }
    });
  });

  describe('Title Validation', () => {
    it('should reject empty title', () => {
      // Given (Arrange)
      const input = {
        titel: '',
        timeMode: 'preset' as const,
        minuten: 30,
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Titel');
      }
    });

    it('should reject title longer than 100 characters', () => {
      // Given (Arrange)
      const longTitle = 'A'.repeat(101);
      const input = {
        titel: longTitle,
        timeMode: 'preset' as const,
        minuten: 30,
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('100');
      }
    });
  });

  describe('Beschreibung Validation', () => {
    it('should accept optional beschreibung', () => {
      // Given (Arrange)
      const input = {
        titel: 'Test',
        timeMode: 'preset' as const,
        minuten: 30,
        // beschreibung nicht angegeben
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(true);
    });

    it('should reject beschreibung longer than 500 characters', () => {
      // Given (Arrange)
      const longDesc = 'B'.repeat(501);
      const input = {
        titel: 'Test',
        timeMode: 'preset' as const,
        minuten: 30,
        beschreibung: longDesc,
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('500');
      }
    });
  });
});

describe('TIME_PRESETS', () => {
  it('should contain 5 presets with correct values (Story 1.1 AC1)', () => {
    // Given (Arrange) - TIME_PRESETS from schema

    // When (Act) - inspect presets

    // Then (Assert)
    expect(TIME_PRESETS).toHaveLength(5);
    expect(TIME_PRESETS.map((p) => p.value)).toEqual([5, 10, 15, 30, 60]);
  });

  it('should have label and value for each preset', () => {
    // Given (Arrange)
    // TIME_PRESETS from schema

    // When/Then (Assert)
    for (const preset of TIME_PRESETS) {
      expect(preset).toHaveProperty('label');
      expect(preset).toHaveProperty('value');
      expect(typeof preset.label).toBe('string');
      expect(typeof preset.value).toBe('number');
    }
  });
});

/**
 * Story 2.6: Pflicht-Notiz bei Erledigung
 */
describe('createErinnerungSchema - requiresNote (Story 2.6)', () => {
  describe('requiresNote Validation', () => {
    it('should accept requiresNote=true', () => {
      // Given (Arrange)
      const input = {
        titel: 'Wichtige Dokumentation',
        timeMode: 'preset' as const,
        minuten: 30,
        requiresNote: true,
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requiresNote).toBe(true);
      }
    });

    it('should accept requiresNote=false', () => {
      // Given (Arrange)
      const input = {
        titel: 'Normale Erinnerung',
        timeMode: 'preset' as const,
        minuten: 15,
        requiresNote: false,
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requiresNote).toBe(false);
      }
    });

    it('should accept missing requiresNote (optional)', () => {
      // Given (Arrange)
      const input = {
        titel: 'Einfache Erinnerung',
        timeMode: 'preset' as const,
        minuten: 5,
        // requiresNote nicht angegeben
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requiresNote).toBeUndefined();
      }
    });

    it('should work with custom timeMode and requiresNote=true', () => {
      // Given (Arrange)
      const input = {
        titel: 'Dokumentierte Aufgabe',
        timeMode: 'custom' as const,
        customTime: { hours: 16, minutes: 30 },
        requiresNote: true,
        beschreibung: 'Bei Erledigung dokumentieren',
      };

      // When (Act)
      const result = createErinnerungSchema.safeParse(input);

      // Then (Assert)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requiresNote).toBe(true);
        expect(result.data.timeMode).toBe('custom');
        expect(result.data.customTime).toEqual({ hours: 16, minutes: 30 });
      }
    });
  });
});
