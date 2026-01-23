import { useId } from 'react';
import { PiSpeakerHigh, PiSpeakerSlash } from 'react-icons/pi';
import { Switch } from '@/shared/ui/atoms/switch.atom';
import { cn } from '@/shared/ui/cn';

/**
 * Props für AudioToggle Komponente
 */
export interface AudioToggleProps {
  /** Ob Audio aktiviert ist */
  enabled: boolean;
  /** Callback wenn Zustand geändert wird */
  onChange: (enabled: boolean) => void;
  /** Zusätzliche CSS-Klassen */
  className?: string;
}

/**
 * AudioToggle - Globaler Audio-Aktivierungsschalter
 *
 * Ermöglicht das Ein-/Ausschalten aller Alarm-Töne.
 * Bei Deaktivierung erscheinen weiterhin visuelle Benachrichtigungen.
 *
 * **Story 2.7 AC7:** Globale Stummschaltung
 */
export function AudioToggle({ enabled, onChange, className }: AudioToggleProps) {
  const labelId = useId();
  const descriptionId = useId();

  return (
    <div className={cn('flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800', className)}>
      <div className="flex items-center gap-3">
        {enabled ? (
          <PiSpeakerHigh className="h-6 w-6 text-green-500 dark:text-green-400" aria-hidden="true" />
        ) : (
          <PiSpeakerSlash className="h-6 w-6 text-gray-400 dark:text-gray-500" aria-hidden="true" />
        )}
        <div>
          <span id={labelId} className="block font-medium text-gray-900 dark:text-white">
            Alarm-Töne aktivieren
          </span>
          <span id={descriptionId} className="text-gray-500 text-sm dark:text-gray-400">
            {enabled ? 'Töne werden bei Erinnerungen abgespielt' : 'Nur visuelle Benachrichtigungen'}
          </span>
        </div>
      </div>

      <Switch checked={enabled} onChange={onChange} labelledBy={labelId} description={descriptionId} />
    </div>
  );
}
