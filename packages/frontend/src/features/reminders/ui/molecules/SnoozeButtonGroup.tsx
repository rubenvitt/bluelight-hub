/**
 * Snooze Button Group
 *
 * Gruppierte Snooze-Buttons mit Preset-Zeiten (1, 5, 10 Min).
 *
 * **Story 2.1 AC1:**
 * - Preset-Zeiten: 1, 5, 10 Minuten
 * - Visuelles Gruppierungs-Pattern mit Icon
 *
 * **Extracted from:** ErinnerungCard.tsx (Line 290-315)
 */

import { Button } from '@/shared/ui/atoms/button.atom';
import { cn } from '@/shared/ui/cn';
import { PiClockCountdown } from 'react-icons/pi';

/**
 * Erlaubte Snooze-Zeiten in Minuten
 */
export type SnoozeMinutes = 1 | 5 | 10;

interface SnoozeButtonGroupProps {
  /**
   * Callback wenn ein Snooze-Button geklickt wird
   */
  onSnooze: (minutes: SnoozeMinutes) => void;

  /**
   * Deaktiviert alle Buttons (z.B. waehrend API-Call)
   */
  disabled?: boolean;

  /**
   * Zusaetzliche CSS-Klassen
   */
  className?: string;
}

/**
 * Snooze-Preset Konfiguration
 */
const SNOOZE_PRESETS: { minutes: SnoozeMinutes; label: string }[] = [
  { minutes: 1, label: '1m' },
  { minutes: 5, label: '5m' },
  { minutes: 10, label: '10m' },
];

/**
 * Snooze Button Group Komponente
 *
 * Zeigt 3 Preset-Buttons (1, 5, 10 Min) in einer visuell gruppierten Box.
 * Inklusive Clock-Icon fuer eindeutige Snooze-Semantik.
 *
 * @example
 * ```tsx
 * <SnoozeButtonGroup
 *   onSnooze={(minutes) => handleSnooze(minutes)}
 *   disabled={isPending}
 * />
 * ```
 */
export function SnoozeButtonGroup({ onSnooze, disabled = false, className }: SnoozeButtonGroupProps) {
  return (
    <div className={cn('flex items-center gap-0.5 rounded-lg bg-blue-50 p-0.5 dark:bg-blue-900/30', className)}>
      <PiClockCountdown className="ml-1.5 h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
      {SNOOZE_PRESETS.map(({ minutes, label }) => (
        <Button
          key={minutes}
          appearance="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation(); // Verhindert Card-Click (Acknowledge)
            onSnooze(minutes);
          }}
          disabled={disabled}
          aria-label={`${minutes} Minute${minutes > 1 ? 'n' : ''} snoozen`}
          title={`${minutes} Min snoozen${minutes === 5 ? ' (Esc)' : ''}`}
          className={cn(
            'h-10 min-w-[2.5rem] px-2 font-medium text-blue-600 text-xs hover:bg-blue-100 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-800/50 dark:hover:text-blue-300',
            disabled && 'cursor-wait opacity-50',
          )}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
