/**
 * Unit Tests für Zeit-Berechnung Helper
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 1.2 AC3:**
 * - Wenn Zeit < jetzt, dann morgen (nächster Tag)
 * - Absolute Zeit speichern
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateCustomFaelligAm, getDefaultCustomTime, formatTimeForToast } from '../time-calculation';

describe('calculateCustomFaelligAm', () => {
  beforeEach(() => {
    // Mock current time: 2026-01-19 12:00:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 19, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return same day when time is in the future (AC3)', () => {
    // Given (Arrange)
    const hours = 14; // 14:45 - still in the future
    const minutes = 45;

    // When (Act)
    const result = calculateCustomFaelligAm(hours, minutes);

    // Then (Assert)
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0); // January
    expect(result.getDate()).toBe(19); // Same day
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(45);
  });

  it('should return next day when time has already passed (AC3)', () => {
    // Given (Arrange)
    const hours = 10; // 10:30 - already passed (current is 12:00)
    const minutes = 30;

    // When (Act)
    const result = calculateCustomFaelligAm(hours, minutes);

    // Then (Assert)
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0); // January
    expect(result.getDate()).toBe(20); // Next day
    expect(result.getHours()).toBe(10);
    expect(result.getMinutes()).toBe(30);
  });

  it('should return same day when time is exactly now (AC3: equal time is NOT past)', () => {
    // Given (Arrange)
    // AC3: "wenn 14:45 bereits vorbei ist" - exakt gleiche Zeit ist NICHT vorbei
    const hours = 12; // Exactly current time
    const minutes = 0;

    // When (Act)
    const result = calculateCustomFaelligAm(hours, minutes);

    // Then (Assert)
    // Exakt gleiche Zeit sollte heute bleiben, da sie technisch nicht "vorbei" ist
    expect(result.getDate()).toBe(19); // Same day
    expect(result.getHours()).toBe(12);
    expect(result.getMinutes()).toBe(0);
  });

  it('should return next day when time is just 1 millisecond in the past', () => {
    // Given (Arrange)
    // Edge Case: Zeit ist minimal vorbei
    vi.setSystemTime(new Date(2026, 0, 19, 12, 0, 1)); // 12:00:01
    const hours = 12;
    const minutes = 0; // 12:00:00 ist jetzt in der Vergangenheit

    // When (Act)
    const result = calculateCustomFaelligAm(hours, minutes);

    // Then (Assert)
    expect(result.getDate()).toBe(20); // Should be tomorrow
    expect(result.getHours()).toBe(12);
    expect(result.getMinutes()).toBe(0);
  });

  it('should handle midnight (00:00) correctly', () => {
    // Given (Arrange) - Midnight is always in the future for today (at 12:00 now)
    // Actually at 12:00, midnight would be tomorrow
    const hours = 0;
    const minutes = 0;

    // When (Act)
    const result = calculateCustomFaelligAm(hours, minutes);

    // Then (Assert) - Midnight is tomorrow since current time is 12:00
    expect(result.getDate()).toBe(20);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it('should handle end of day (23:59) correctly', () => {
    // Given (Arrange)
    const hours = 23;
    const minutes = 59;

    // When (Act)
    const result = calculateCustomFaelligAm(hours, minutes);

    // Then (Assert) - 23:59 is still in the future at 12:00
    expect(result.getDate()).toBe(19); // Same day
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
  });
});

describe('getDefaultCustomTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return current time + 30 minutes rounded to 5 minutes', () => {
    // Given (Arrange) - 12:07 → 12:07 + 30 = 12:37 → rounded to 12:40
    vi.setSystemTime(new Date(2026, 0, 19, 12, 7, 0));

    // When (Act)
    const result = getDefaultCustomTime();

    // Then (Assert)
    expect(result.hours).toBe(12);
    expect(result.minutes).toBe(40); // 12:37 rounded up to 12:40
  });

  it('should handle hour rollover when adding 30 minutes', () => {
    // Given (Arrange) - 23:45 + 30 = 00:15 → rounded to 00:15
    vi.setSystemTime(new Date(2026, 0, 19, 23, 45, 0));

    // When (Act)
    const result = getDefaultCustomTime();

    // Then (Assert)
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(15);
  });

  it('should round minutes to nearest 5', () => {
    // Given (Arrange) - 10:12 + 30 = 10:42 → rounded to 10:45
    vi.setSystemTime(new Date(2026, 0, 19, 10, 12, 0));

    // When (Act)
    const result = getDefaultCustomTime();

    // Then (Assert)
    expect(result.minutes % 5).toBe(0);
    expect(result.minutes).toBe(45);
  });
});

describe('formatTimeForToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 19, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should format time without "morgen" when same day', () => {
    // Given (Arrange)
    const date = new Date(2026, 0, 19, 14, 45, 0); // Same day

    // When (Act)
    const result = formatTimeForToast(date);

    // Then (Assert)
    expect(result).toBe('14:45 Uhr');
    expect(result).not.toContain('morgen');
  });

  it('should format time with "morgen" when next day', () => {
    // Given (Arrange)
    const date = new Date(2026, 0, 20, 10, 30, 0); // Tomorrow

    // When (Act)
    const result = formatTimeForToast(date);

    // Then (Assert)
    expect(result).toBe('morgen 10:30 Uhr');
  });

  it('should pad single-digit hours and minutes', () => {
    // Given (Arrange)
    const date = new Date(2026, 0, 19, 9, 5, 0);

    // When (Act)
    const result = formatTimeForToast(date);

    // Then (Assert)
    expect(result).toBe('09:05 Uhr');
  });
});
