/**
 * Snooze Button Group
 *
 * Gruppierte Snooze-Buttons mit Preset-Zeiten (1, 5, 10 Min).
 *
 * **Story 2.1 AC1:**
 * - Preset-Zeiten: 1, 5, 10 Minuten
 * - Visuelles Gruppierungs-Pattern mit Icon
 *
 * **Story 2.4 Task 1:**
 * - `variant="floating"` fuer FloatingPill mit weissem Hintergrund
 * - `size="sm"` fuer kompaktere Darstellung
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

/**
 * Variant fuer unterschiedliche Darstellungen
 */
type SnoozeButtonGroupVariant = 'default' | 'floating';

/**
 * Size fuer unterschiedliche Groessen
 */
type SnoozeButtonGroupSize = 'sm' | 'md';

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
   * Visuelle Variante
   * - default: Blaue Buttons auf blauem Hintergrund (Standard)
   * - floating: Weisse Buttons fuer FloatingPill Kontext
   */
  variant?: SnoozeButtonGroupVariant;

  /**
   * Groesse der Buttons
   * - sm: Kompakter (fuer FloatingPill)
   * - md: Standard
   */
  size?: SnoozeButtonGroupSize;

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
 * Style Mappings fuer Varianten
 */
const VARIANT_STYLES: Record<SnoozeButtonGroupVariant, { container: string; icon: string; button: string }> = {
  default: {
    container: 'bg-blue-50 dark:bg-blue-900/30',
    icon: 'text-blue-600 dark:text-blue-400',
    button: 'text-blue-600 hover:bg-blue-100 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-800/50 dark:hover:text-blue-300',
  },
  floating: {
    container: 'bg-white/20',
    icon: 'text-white',
    button: 'text-white hover:bg-white/30 hover:text-white',
  },
};

/**
 * Style Mappings fuer Groessen
 */
const SIZE_STYLES: Record<SnoozeButtonGroupSize, { button: string; icon: string }> = {
  sm: {
    button: 'h-8 min-w-[2rem] px-1.5 text-xs',
    icon: 'h-3.5 w-3.5 ml-1',
  },
  md: {
    button: 'h-10 min-w-[2.5rem] px-2 text-xs',
    icon: 'h-4 w-4 ml-1.5',
  },
};

/**
 * Snooze Button Group Komponente
 *
 * Zeigt 3 Preset-Buttons (1, 5, 10 Min) in einer visuell gruppierten Box.
 * Inklusive Clock-Icon fuer eindeutige Snooze-Semantik.
 *
 * @example
 * ```tsx
 * // Standard (in ErinnerungCard)
 * <SnoozeButtonGroup
 *   onSnooze={(minutes) => handleSnooze(minutes)}
 *   disabled={isPending}
 * />
 *
 * // Floating (in FloatingPill)
 * <SnoozeButtonGroup
 *   onSnooze={(minutes) => handleSnooze(minutes)}
 *   variant="floating"
 *   size="sm"
 * />
 * ```
 */
export function SnoozeButtonGroup({ onSnooze, disabled = false, variant = 'default', size = 'md', className }: SnoozeButtonGroupProps) {
  const variantStyles = VARIANT_STYLES[variant];
  const sizeStyles = SIZE_STYLES[size];

  return (
    <div className={cn('flex items-center gap-0.5 rounded-lg p-0.5', variantStyles.container, className)}>
      <PiClockCountdown className={cn(sizeStyles.icon, variantStyles.icon)} aria-hidden="true" />
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
          className={cn('font-medium', sizeStyles.button, variantStyles.button, disabled && 'cursor-wait opacity-50')}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
