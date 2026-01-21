/**
 * Countdown Utility-Funktionen für Erinnerungen
 *
 * Bietet Funktionen für:
 * - Berechnung verbleibender Zeit
 * - Formatierung des Countdowns
 * - Ermittlung des Urgency-Levels
 * - Dynamische Update-Intervalle
 *
 * @see Story 1.7 AC3, AC4
 */

// ============================================================================
// Konstanten
// ============================================================================

/** Millisekunden pro Sekunde */
const MS_PER_SECOND = 1_000;

/** Millisekunden pro Minute */
const MS_PER_MINUTE = 60_000;

/** Sekunden pro Stunde */
const SECONDS_PER_HOUR = 3_600;

/** Sekunden pro Minute */
const SECONDS_PER_MINUTE = 60;

/** Schwellwert für "normal" Urgency (> X Minuten) */
const URGENCY_THRESHOLD_NORMAL_MINUTES = 5;

/** Schwellwert für "warning" Urgency (>= X Minuten) */
const URGENCY_THRESHOLD_WARNING_MINUTES = 2;

/** Schwellwert für schnelle Updates (< X Sekunden) */
const FAST_UPDATE_THRESHOLD_SECONDS = 10;

/** Update-Intervall für normale Countdowns (ms) */
const UPDATE_INTERVAL_NORMAL_MS = 30_000;

/** Update-Intervall für urgente Countdowns - zeigt Sekunden (ms) */
const UPDATE_INTERVAL_URGENT_MS = 1_000;

/** Update-Intervall für kritische Countdowns - smooth countdown (ms) */
const UPDATE_INTERVAL_CRITICAL_MS = 250;

// ============================================================================
// Types
// ============================================================================

/**
 * Verbleibende Zeit als strukturiertes Objekt
 */
export interface TimeRemaining {
  /** Verbleibende volle Stunden */
  hours: number;
  /** Verbleibende volle Minuten (nach Stunden) */
  minutes: number;
  /** Verbleibende Sekunden (nach Minuten) */
  seconds: number;
  /** Gesamte verbleibende Zeit in Millisekunden */
  total: number;
}

/**
 * Urgency Level für progressive Farbwechsel
 *
 * - normal: > 5 Minuten
 * - warning: 2-5 Minuten
 * - urgent: < 2 Minuten
 * - critical: überfällig
 */
export type UrgencyLevel = 'normal' | 'warning' | 'urgent' | 'critical';

/**
 * Berechnet die verbleibende Zeit bis zur Fälligkeit
 *
 * @param faelligAm - Fälligkeitszeitpunkt (Date oder ISO-String)
 * @returns Strukturiertes Objekt mit Stunden, Minuten, Sekunden und Gesamt-Ms
 *
 * @example
 * const remaining = calculateTimeRemaining(new Date('2026-01-20T12:00:00'));
 * // { hours: 2, minutes: 30, seconds: 0, total: 9000000 }
 */
export function calculateTimeRemaining(faelligAm: Date | string): TimeRemaining {
  const target = typeof faelligAm === 'string' ? new Date(faelligAm) : faelligAm;

  // Validate date - return "already overdue" state for invalid dates
  if (!target || Number.isNaN(target.getTime())) {
    return { hours: 0, minutes: 0, seconds: 0, total: -1 };
  }

  const now = new Date();
  const diff = target.getTime() - now.getTime();

  // Wenn überfällig, alle Werte auf 0 setzen
  if (diff <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, total: diff };
  }

  const totalSeconds = Math.floor(diff / MS_PER_SECOND);
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;

  return { hours, minutes, seconds, total: diff };
}

/**
 * Formatiert die verbleibende Zeit als lesbare Zeichenkette
 *
 * Formate:
 * - "Xh Ym" für >= 1 Stunde
 * - "Xm" für >= 2 Minuten (ohne Sekunden)
 * - "Xm Ys" für < 2 Minuten (mit Sekunden, wenn showSeconds=true)
 * - "Xs" für < 1 Minute (mit Sekunden, wenn showSeconds=true)
 * - "Jetzt fällig!" wenn total <= 0
 *
 * @param remaining - Berechnete verbleibende Zeit
 * @param showSeconds - Ob Sekunden angezeigt werden sollen (für < 2 Min)
 * @returns Formatierte Zeichenkette
 *
 * @example
 * formatCountdown({ hours: 2, minutes: 15, seconds: 30, total: 8130000 }) // "2h 15m"
 * formatCountdown({ hours: 0, minutes: 1, seconds: 45, total: 105000 }, true) // "1m 45s"
 */
export function formatCountdown(remaining: TimeRemaining, showSeconds = false): string {
  const { hours, minutes, seconds, total } = remaining;

  // Überfällig
  if (total <= 0) {
    return 'Jetzt fällig!';
  }

  // Mit Stunden
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  // Mit Sekunden (wenn aktiviert und < 2 Min)
  if (showSeconds) {
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  // Nur Minuten
  return `${minutes}m`;
}

/**
 * Ermittelt das Urgency-Level basierend auf verbleibender Zeit
 *
 * Schwellwerte (aus AC2):
 * - > 5 Minuten: normal (grün)
 * - 2-5 Minuten: warning (gelb)
 * - < 2 Minuten: urgent (orange)
 * - <= 0: critical (überfällig)
 *
 * @param remainingMs - Verbleibende Zeit in Millisekunden
 * @returns Urgency-Level
 */
export function getUrgencyLevel(remainingMs: number): UrgencyLevel {
  if (remainingMs <= 0) return 'critical';

  const remainingMinutes = remainingMs / MS_PER_MINUTE;

  if (remainingMinutes > URGENCY_THRESHOLD_NORMAL_MINUTES) return 'normal';
  if (remainingMinutes >= URGENCY_THRESHOLD_WARNING_MINUTES) return 'warning';
  return 'urgent';
}

/**
 * Ermittelt das optimale Update-Intervall basierend auf verbleibender Zeit
 *
 * Strategie (aus AC4):
 * - > 2 Minuten: 30s (Performance-optimiert)
 * - <= 2 Minuten, > 10s: 1s (zeigt Sekunden)
 * - <= 10 Sekunden: 250ms (smooth countdown)
 * - <= 0: 0 (keine Updates bei Überfälligkeit)
 *
 * @param remainingMs - Verbleibende Zeit in Millisekunden
 * @returns Intervall in Millisekunden
 */
export function getUpdateInterval(remainingMs: number): number {
  if (remainingMs <= 0) return 0;
  if (remainingMs <= FAST_UPDATE_THRESHOLD_SECONDS * MS_PER_SECOND) return UPDATE_INTERVAL_CRITICAL_MS;
  if (remainingMs <= URGENCY_THRESHOLD_WARNING_MINUTES * MS_PER_MINUTE) return UPDATE_INTERVAL_URGENT_MS;
  return UPDATE_INTERVAL_NORMAL_MS;
}
