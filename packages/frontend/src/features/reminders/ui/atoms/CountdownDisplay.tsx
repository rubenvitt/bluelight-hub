import { useEffect, useRef } from 'react';
import { cn } from '@/shared/ui/cn';
import { useCountdown } from '../../hooks/use-countdown';
import type { UrgencyLevel } from '../../utils/countdown-utils';

/**
 * Props für CountdownDisplay Komponente
 */
interface CountdownDisplayProps {
  /** Fälligkeitszeitpunkt */
  faelligAm: Date | string;
  /** Zusätzliche CSS-Klassen */
  className?: string;
}

/**
 * Farb-Mapping für Urgency Levels
 */
const URGENCY_COLORS: Record<UrgencyLevel, { text: string; dark: string }> = {
  normal: {
    text: 'text-green-600',
    dark: 'dark:text-green-400',
  },
  warning: {
    text: 'text-yellow-600',
    dark: 'dark:text-yellow-400',
  },
  urgent: {
    text: 'text-orange-600',
    dark: 'dark:text-orange-400',
  },
  critical: {
    text: 'text-red-600',
    dark: 'dark:text-red-400',
  },
};

/**
 * CountdownDisplay - Zeigt verbleibende Zeit bis zur Fälligkeit
 *
 * Features:
 * - Automatische Updates (30s → 1s → 100ms)
 * - Dynamisches Format basierend auf verbleibender Zeit
 * - Farbwechsel basierend auf Urgency Level
 * - Accessibility mit aria-live und role="timer"
 *
 * Formate:
 * - "Xh Ym" für >= 1 Stunde
 * - "Xm" für >= 2 Minuten
 * - "Xm Ys" für < 2 Minuten
 * - "Xs" für < 1 Minute
 * - "Jetzt fällig!" für überfällig
 *
 * @example
 * <CountdownDisplay faelligAm={erinnerung.faelligAm} />
 *
 * @see Story 1.7 AC3, AC4
 */
export function CountdownDisplay({ faelligAm, className }: CountdownDisplayProps) {
  const { formatted, urgencyLevel } = useCountdown(faelligAm);
  const colors = URGENCY_COLORS[urgencyLevel];

  // Track previous urgency level to only announce on change
  const prevUrgencyRef = useRef(urgencyLevel);

  // Only announce when urgency level changes (prevents screen reader spam)
  const shouldAnnounce = prevUrgencyRef.current !== urgencyLevel;

  useEffect(() => {
    prevUrgencyRef.current = urgencyLevel;
  }, [urgencyLevel]);

  return (
    <span
      role="timer"
      aria-live={shouldAnnounce ? 'polite' : 'off'}
      aria-atomic="true"
      className={cn(
        // Base styles
        'font-medium tabular-nums',
        // Color based on urgency
        colors.text,
        colors.dark,
        // Custom classes
        className,
      )}
    >
      {formatted}
    </span>
  );
}
