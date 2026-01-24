import { useState, useEffect, useCallback, useRef } from 'react';
import { calculateTimeRemaining, formatCountdown, getUrgencyLevel, getUpdateInterval, type UrgencyLevel } from '../utils/countdown-utils';

/**
 * State-Objekt für Countdown
 */
export interface CountdownState {
  /** Verbleibende Zeit in Millisekunden */
  remaining: number;
  /** Formatierte Anzeige (z.B. "5m", "1m 30s", "Jetzt fällig!") */
  formatted: string;
  /** Ob die Erinnerung überfällig ist */
  isOverdue: boolean;
  /** Urgency Level für Styling */
  urgencyLevel: UrgencyLevel;
}

/**
 * Hook für Countdown-Berechnung und dynamische Updates
 *
 * Features:
 * - Automatische Berechnung der verbleibenden Zeit
 * - Dynamische Update-Intervalle (30s → 1s → 100ms)
 * - Proper Cleanup bei Unmount
 * - Formatierte Ausgabe basierend auf Urgency Level
 *
 * @param faelligAm - Fälligkeitszeitpunkt (Date oder ISO-String)
 * @returns CountdownState mit remaining, formatted, isOverdue, urgencyLevel
 *
 * @example
 * const { formatted, urgencyLevel, isOverdue } = useCountdown(erinnerung.faelligAm);
 *
 * @see Story 1.7 AC3, AC4
 */
export function useCountdown(faelligAm: Date | string): CountdownState {
  // Berechnung des initialen und aktuellen Zustands
  const calculateState = useCallback((): CountdownState => {
    const timeRemaining = calculateTimeRemaining(faelligAm);
    const remaining = timeRemaining.total;
    const urgencyLevel = getUrgencyLevel(remaining);
    const isOverdue = remaining <= 0;

    // Sekunden nur anzeigen wenn < 2 Minuten
    const showSeconds = remaining <= 120_000 && remaining > 0;
    const formatted = formatCountdown(timeRemaining, showSeconds);

    return {
      remaining,
      formatted,
      isOverdue,
      urgencyLevel,
    };
  }, [faelligAm]);

  const [state, setState] = useState<CountdownState>(calculateState);
  const intervalRef = useRef<number | null>(null);
  // Ref um aktuelles Interval zu tracken (vermeidet stale closure)
  const currentIntervalRef = useRef<number>(0);

  useEffect(() => {
    // Cleanup vorheriges Interval
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Initialen State setzen
    const initialState = calculateState();
    setState(initialState);
    currentIntervalRef.current = getUpdateInterval(initialState.remaining);

    // Kein Update nötig wenn bereits überfällig
    if (initialState.isOverdue) {
      return;
    }

    // Update-Funktion
    const updateCountdown = () => {
      const newState = calculateState();
      setState(newState);

      // Intervall anpassen wenn sich das Level ändert
      const newInterval = getUpdateInterval(newState.remaining);
      const previousInterval = currentIntervalRef.current;

      // Wenn Intervall sich ändert oder überfällig wird, Interval neu setzen
      if (newInterval !== previousInterval || newState.isOverdue) {
        currentIntervalRef.current = newInterval;

        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        if (!newState.isOverdue && newInterval > 0) {
          intervalRef.current = window.setInterval(updateCountdown, newInterval);
        }
      }
    };

    // Initiales Interval setzen
    const interval = getUpdateInterval(initialState.remaining);
    if (interval > 0) {
      intervalRef.current = window.setInterval(updateCountdown, interval);
    }

    // Cleanup bei Unmount oder faelligAm-Änderung
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [calculateState]);

  return state;
}
