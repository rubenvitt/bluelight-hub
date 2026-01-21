/**
 * FloatingPill Komponente
 *
 * Zeigt eine dringende Erinnerung als schwebendes Overlay bei Intensivierungs-Stufe 2 (urgent).
 * Fixed positioniert, immer sichtbar, mit Quick-Action Buttons.
 *
 * **Story 2.4 Task 1:**
 * - AC2: FloatingPill wird bei urgent aktiviert
 * - AC3: Rote pulsierende Farbe (animate-pulse-urgent)
 * - AC4: Stoppt bei Acknowledge/Snooze
 * - AC5: Verschwindet bei Status-Wechsel
 *
 * **Accessibility:**
 * - aria-live="assertive" fuer Screen Reader
 * - role="alert" fuer dringende Benachrichtigungen
 * - Keyboard-Support: Enter=Acknowledge, Escape=5min Snooze
 */

import { useCallback, useEffect, useState } from 'react';
import { PiBellRingingFill, PiCheck, PiClock } from 'react-icons/pi';
import { cn } from '@/shared/ui/cn';
import type { SnoozeMinutes } from '../../api';
import { SnoozeButtonGroup } from '../molecules/SnoozeButtonGroup';

export interface FloatingPillProps {
  /** ID der Erinnerung */
  erinnerungId: string;
  /** Titel der Erinnerung (wird truncated) */
  titel: string;
  /** Zeitpunkt der Ausloesung (ISO-String) */
  ausgeloestAm: string;
  /** Callback bei Acknowledge */
  onAcknowledge: () => void;
  /** Callback bei Snooze mit Minutenanzahl */
  onSnooze: (minutes: SnoozeMinutes) => void;
  /** Ob Aktionen deaktiviert sind (z.B. waehrend API Call) */
  disabled?: boolean;
  /** Zusaetzliche CSS-Klassen */
  className?: string;
  /** Ob die Pill gerade entfernt wird (Exit-Animation) */
  isExiting?: boolean;
}

/**
 * Formatiert die Dauer seit Ausloesung
 */
function formatElapsedTime(ausgeloestAm: string): string {
  const elapsed = Date.now() - new Date(ausgeloestAm).getTime();
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes >= 1) {
    return `seit ${minutes} Min`;
  }
  return `seit ${seconds}s`;
}

/**
 * Truncates titel to max length
 */
function truncateTitel(titel: string, maxLength = 30): string {
  if (titel.length <= maxLength) return titel;
  return `${titel.slice(0, maxLength - 3)}...`;
}

/**
 * FloatingPill - Urgente Alarm-Anzeige als schwebendes Overlay
 *
 * Wird aktiviert wenn eine Erinnerung Intensivierungs-Stufe 2 (urgent) erreicht.
 * Schwebt ueber anderen UI-Elementen (z-50) und ist immer sichtbar.
 *
 * @example
 * <FloatingPill
 *   erinnerungId="123"
 *   titel="Lagebesprechung starten"
 *   ausgeloestAm="2025-01-20T10:00:00Z"
 *   onAcknowledge={() => handleAcknowledge('123')}
 *   onSnooze={(min) => handleSnooze('123', min)}
 * />
 */
export function FloatingPill({ erinnerungId, titel, ausgeloestAm, onAcknowledge, onSnooze, disabled = false, className, isExiting = false }: FloatingPillProps) {
  // Elapsed time mit Live-Update
  const [elapsedTime, setElapsedTime] = useState(() => formatElapsedTime(ausgeloestAm));

  // Update elapsed time jede Sekunde (C2 Fix: isMounted Guard gegen Memory Leak)
  useEffect(() => {
    let isMounted = true;

    const interval = setInterval(() => {
      if (isMounted) {
        setElapsedTime(formatElapsedTime(ausgeloestAm));
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [ausgeloestAm]);

  // Keyboard Handler: Enter=Acknowledge, Escape=5min Snooze
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onAcknowledge();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onSnooze(5);
      }
    },
    [disabled, onAcknowledge, onSnooze],
  );

  // H2 Fix: Focus Management entfernt - wird jetzt in FloatingPillPortal koordiniert
  // um Focus-Thrashing bei mehreren Pills zu vermeiden.
  // Der Portal bestimmt welche Pill (die älteste) Fokus erhält.

  return (
    <div
      id={`floating-pill-${erinnerungId}`}
      role="alertdialog"
      aria-live="assertive"
      aria-atomic="true"
      aria-modal="false"
      aria-label={`Dringende Erinnerung: ${titel} - ${elapsedTime} ohne Reaktion`}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: alertdialog requires tabIndex for keyboard navigation (WAI-ARIA)
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn(
        // Base Layout
        'min-w-[280px] max-w-[400px] rounded-xl p-4 shadow-2xl',
        // Colors - Red Theme fuer Urgency
        'bg-gradient-to-br from-red-600 to-red-700 text-white',
        // Animations - Story 2.4 AC3 (sorted alphabetically)
        isExiting ? 'animate-floating-pill-exit' : 'animate-border-glow-urgent animate-floating-pill-entrance animate-pulse-urgent',
        // Border
        'border-2 border-red-400',
        // Focus State
        'focus:outline-none focus:ring-4 focus:ring-red-300 focus:ring-offset-2',
        className,
      )}
    >
      {/* Header mit Icon und Titel */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
          <PiBellRingingFill className="h-6 w-6 animate-bounce text-white" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-lg leading-tight">{truncateTitel(titel)}</h3>
          <div className="mt-0.5 flex items-center gap-1.5 text-red-100 text-sm">
            <PiClock className="h-4 w-4" aria-hidden="true" />
            <span>{elapsedTime}</span>
            <span className="text-red-200">|</span>
            <span className="font-medium text-red-100">URGENT</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2">
        {/* Acknowledge Button - Primary Action */}
        <button
          type="button"
          onClick={onAcknowledge}
          disabled={disabled}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-semibold text-sm transition-all',
            'bg-white text-red-700 hover:bg-red-50',
            'focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-red-600',
            disabled && 'cursor-not-allowed opacity-50',
          )}
          aria-label="Erinnerung bestätigen"
        >
          <PiCheck className="h-5 w-5" aria-hidden="true" />
          Bestätigen
        </button>

        {/* Snooze Buttons */}
        <SnoozeButtonGroup onSnooze={onSnooze} disabled={disabled} size="sm" variant="floating" />
      </div>

      {/* Keyboard Hint */}
      <p className="mt-2 text-center text-red-200 text-xs">Enter: Bestätigen · Esc: 5 Min Snooze</p>
    </div>
  );
}
