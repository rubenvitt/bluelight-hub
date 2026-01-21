import { cn } from '@/shared/ui/cn';
import { PiBellRinging, PiCheck, PiCheckCircle, PiClock, PiMoon } from 'react-icons/pi';

/**
 * Erinnerung Status Typen (API generiert)
 */
type ErinnerungStatus = 'GEPLANT' | 'AUSGELOEST' | 'ACKNOWLEDGED' | 'SNOOZED' | 'ERLEDIGT';

/**
 * Urgency Level für progressive Farbwechsel bei GEPLANT Status
 */
type UrgencyLevel = 'normal' | 'warning' | 'urgent';

/**
 * Intensivierungs-Level für AUSGELOEST Status (Story 2.3)
 */
type IntensityLevel = 'none' | 'warning' | 'urgent';

/**
 * Props für AlarmStateBadge Komponente
 */
interface AlarmStateBadgeProps {
  /** Aktueller Status der Erinnerung */
  status: ErinnerungStatus;
  /** Verbleibende Minuten bis Fälligkeit (nur für GEPLANT relevant) */
  minutesUntilDue?: number;
  /** Größenvariante */
  size?: 'sm' | 'md' | 'lg';
  /** Zusätzliche CSS-Klassen */
  className?: string;
  /**
   * Intensivierungs-Level bei AUSGELOEST Status (Story 2.3)
   *
   * - 'none': Standard-Animation (normales Pulsieren)
   * - 'warning': Schnelleres Pulsieren nach 30s ohne Reaktion
   * - 'urgent': Intensivstes Pulsieren nach 60s (Story 2.4)
   */
  intensityLevel?: IntensityLevel;
}

/**
 * Deutsche Status-Labels
 */
const STATUS_LABELS: Record<ErinnerungStatus, string> = {
  GEPLANT: 'Geplant',
  AUSGELOEST: 'Ausgelöst',
  ACKNOWLEDGED: 'Bestätigt',
  SNOOZED: 'Verschoben',
  ERLEDIGT: 'Erledigt',
};

/**
 * Icon-Mapping für jeden Status
 */
const STATUS_ICONS: Record<ErinnerungStatus, React.ComponentType<{ className?: string }>> = {
  GEPLANT: PiClock,
  AUSGELOEST: PiBellRinging,
  ACKNOWLEDGED: PiCheck,
  SNOOZED: PiMoon,
  ERLEDIGT: PiCheckCircle,
};

/**
 * Farb-Mapping für jeden Status (Light + Dark Mode)
 */
const STATUS_COLORS: Record<ErinnerungStatus, { bg: string; text: string; dark: string }> = {
  GEPLANT: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    dark: 'dark:bg-green-900/40 dark:text-green-300',
  },
  AUSGELOEST: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    dark: 'dark:bg-red-900/40 dark:text-red-300',
  },
  ACKNOWLEDGED: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    dark: 'dark:bg-blue-900/40 dark:text-blue-300',
  },
  SNOOZED: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
    dark: 'dark:bg-yellow-900/40 dark:text-yellow-300',
  },
  ERLEDIGT: {
    bg: 'bg-gray-100',
    text: 'text-gray-500',
    dark: 'dark:bg-gray-800 dark:text-gray-400',
  },
};

/**
 * Progressive Farben für GEPLANT Status basierend auf Urgency Level
 */
const URGENCY_COLORS: Record<UrgencyLevel, { bg: string; text: string; dark: string }> = {
  normal: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    dark: 'dark:bg-green-900/40 dark:text-green-300',
  },
  warning: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
    dark: 'dark:bg-yellow-900/40 dark:text-yellow-300',
  },
  urgent: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    dark: 'dark:bg-orange-900/40 dark:text-orange-300',
  },
};

/**
 * Issue #10 WCAG Fix: Text-Suffixe für Urgency Level (nicht nur Farbe)
 * Stellt sicher, dass Dringlichkeit auch ohne Farbe erkennbar ist.
 */
const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  normal: '',
  warning: ' (bald)',
  urgent: ' (dringend)',
};

/**
 * Größen-Mapping für Badge und Icon
 */
const SIZE_CLASSES = {
  sm: { badge: 'text-xs px-2 py-0.5 gap-1', icon: 'h-3 w-3' },
  md: { badge: 'text-sm px-2.5 py-1 gap-1.5', icon: 'h-4 w-4' },
  lg: { badge: 'text-base px-3 py-1.5 gap-2', icon: 'h-5 w-5' },
};

/**
 * Berechnet Urgency Level basierend auf verbleibenden Minuten
 *
 * - > 5 Minuten: normal (grün)
 * - 2-5 Minuten: warning (gelb)
 * - < 2 Minuten: urgent (orange)
 */
function getUrgencyLevel(minutesUntilDue: number | undefined): UrgencyLevel {
  if (minutesUntilDue === undefined) return 'normal';
  if (minutesUntilDue > 5) return 'normal';
  if (minutesUntilDue >= 2) return 'warning';
  return 'urgent';
}

/**
 * Holt die Farben basierend auf Status und Urgency Level
 */
function getColors(status: ErinnerungStatus, minutesUntilDue?: number): { bg: string; text: string; dark: string } {
  // Nur GEPLANT bekommt progressive Farbwechsel
  if (status === 'GEPLANT') {
    const urgencyLevel = getUrgencyLevel(minutesUntilDue);
    return URGENCY_COLORS[urgencyLevel];
  }
  return STATUS_COLORS[status];
}

/**
 * Holt die Animations-Klasse basierend auf Status und Intensivierungs-Level (Story 2.3)
 *
 * @param status - Aktueller Erinnerungs-Status
 * @param intensityLevel - Aktuelles Intensivierungs-Level
 * @returns Animations-Klassen für Badge und Icon
 */
function getAnimationClasses(status: ErinnerungStatus, intensityLevel: IntensityLevel): { badge: string; icon: string } {
  // Nur AUSGELOEST bekommt Animationen
  if (status !== 'AUSGELOEST') {
    return { badge: '', icon: '' };
  }

  // Story 2.3: Intensivierte Animationen
  if (intensityLevel === 'urgent') {
    // Stufe 2 (Story 2.4): Schnellstes Pulsieren
    return { badge: 'animate-pulse-fast', icon: 'animate-bounce' };
  }

  if (intensityLevel === 'warning') {
    // Stufe 1 (Story 2.3): Schnelleres Pulsieren
    return { badge: 'animate-pulse-fast', icon: 'animate-bounce' };
  }

  // Standard: Normales Pulsieren
  return { badge: 'animate-pulse', icon: 'animate-bounce' };
}

/**
 * AlarmStateBadge - Visuelles Status-Badge für Erinnerungen
 *
 * Zeigt den aktuellen Status einer Erinnerung mit:
 * - Status-spezifischer Farbe
 * - Passendem Icon
 * - Deutschem Status-Text
 * - Progressive Farbwechsel bei GEPLANT (basierend auf verbleibender Zeit)
 * - Pulse-Animation bei AUSGELOEST
 * - Intensivierte Animation bei Nicht-Reaktion (Story 2.3)
 *
 * @example
 * <AlarmStateBadge status="GEPLANT" minutesUntilDue={3} />
 * <AlarmStateBadge status="AUSGELOEST" />
 * <AlarmStateBadge status="AUSGELOEST" intensityLevel="warning" />
 */
export function AlarmStateBadge({ status, minutesUntilDue, size = 'md', className, intensityLevel = 'none' }: AlarmStateBadgeProps) {
  const Icon = STATUS_ICONS[status];
  const label = STATUS_LABELS[status];
  const colors = getColors(status, minutesUntilDue);
  const sizeClasses = SIZE_CLASSES[size];
  const animationClasses = getAnimationClasses(status, intensityLevel);

  // Issue #10 WCAG Fix: Text-Indikation der Urgency (nicht nur Farbe)
  const urgencyLevel = status === 'GEPLANT' ? getUrgencyLevel(minutesUntilDue) : 'normal';
  const urgencySuffix = status === 'GEPLANT' ? URGENCY_LABELS[urgencyLevel] : '';

  // Story 2.3: Intensivierungs-Suffix für Screen Reader
  const intensitySuffix = status === 'AUSGELOEST' && intensityLevel !== 'none' ? ' (Intensiviert)' : '';
  const displayLabel = `${label}${urgencySuffix}${intensitySuffix}`;

  return (
    <output
      aria-label={`Status: ${displayLabel}`}
      className={cn(
        // Base styles
        'inline-flex items-center rounded-full font-medium',
        // Size
        sizeClasses.badge,
        // Colors
        colors.bg,
        colors.text,
        colors.dark,
        // Animation (Story 2.3: intensitätsabhängig)
        animationClasses.badge,
        // Custom classes
        className,
      )}
    >
      <Icon className={cn(sizeClasses.icon, animationClasses.icon)} aria-hidden="true" />
      {/* Story 2.3: Visuellen Suffix nur bei Intensivierung anzeigen */}
      {label}
      {urgencySuffix}
    </output>
  );
}
