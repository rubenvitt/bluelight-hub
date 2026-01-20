/**
 * Erinnerung Card
 *
 * Zeigt eine einzelne Erinnerung mit Countdown und Aktionen.
 *
 * **Story 1.3 AC1/AC3:**
 * - Bearbeiten-Button nur bei Status GEPLANT sichtbar
 * - Tooltip wenn nicht editierbar
 *
 * **Story 1.4 AC1/AC2:**
 * - Loeschen-Button bei Status GEPLANT oder AUSGELOEST
 * - Loeschen oeffnet Bestaetigungs-Dialog
 */

import type { ErinnerungResponseDto } from '@/shared';
import { Button } from '@/shared/ui/atoms/button.atom';
import { cn } from '@/shared/ui/cn';
import { useCallback, useEffect, useState } from 'react';
import { PiAlarm, PiCheck, PiPencil, PiTrash } from 'react-icons/pi';
import { openDeleteDialog, openEditDialog } from '../../stores';

/** Countdown-Update-Interval in ms (30 Sekunden) */
const COUNTDOWN_UPDATE_INTERVAL_MS = 30_000;

interface ErinnerungCardProps {
  /** Die anzuzeigende Erinnerung */
  erinnerung: ErinnerungResponseDto;
  /** Die Einsatz-ID (fuer den Edit Dialog) */
  einsatzId: string;
  /** Zusaetzliche CSS-Klassen */
  className?: string;
}

/**
 * Formatiert verbleibende Zeit in lesbare Form.
 */
function formatCountdown(targetDate: Date): string {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) {
    return 'Fällig!';
  }

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Karte fuer eine einzelne Erinnerung mit Countdown und Bearbeiten-Button.
 *
 * **Story 1.3 AC1:** Bearbeiten-Button oeffnet Edit Dialog
 * **Story 1.3 AC3:** Nur GEPLANT Status ist editierbar
 */
export function ErinnerungCard({ erinnerung, einsatzId, className }: ErinnerungCardProps) {
  const [countdown, setCountdown] = useState(() => formatCountdown(new Date(erinnerung.faelligAm)));

  // Countdown alle 30 Sekunden aktualisieren
  useEffect(() => {
    const updateCountdown = () => {
      setCountdown(formatCountdown(new Date(erinnerung.faelligAm)));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, COUNTDOWN_UPDATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [erinnerung.faelligAm]);

  const isEditable = erinnerung.status === 'GEPLANT';
  const isTriggered = erinnerung.status === 'AUSGELOEST';
  const isExpired = new Date(erinnerung.faelligAm) <= new Date();
  // Story 1.4 AC1: Nur GEPLANT oder AUSGELOEST Status loeschbar
  const isDeletable = erinnerung.status === 'GEPLANT' || erinnerung.status === 'AUSGELOEST';

  const handleEdit = useCallback(() => {
    if (isEditable) {
      openEditDialog(erinnerung, einsatzId);
    }
  }, [erinnerung, einsatzId, isEditable]);

  // Story 1.4 AC2: Loeschen oeffnet Bestaetigungs-Dialog
  const handleDelete = useCallback(() => {
    if (isDeletable) {
      openDeleteDialog(erinnerung, einsatzId);
    }
  }, [erinnerung, einsatzId, isDeletable]);

  return (
    <div
      className={cn(
        'rounded-lg border bg-white p-4 shadow-sm transition-all dark:bg-gray-800',
        isTriggered ? 'border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/20' : 'border-gray-200 dark:border-gray-700',
        isExpired && !isTriggered && 'border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-900/20',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Icon und Inhalt */}
        <div className="flex items-start gap-3">
          <div className={cn('rounded-full p-2', isTriggered ? 'bg-amber-100 dark:bg-amber-900/40' : isExpired ? 'bg-red-100 dark:bg-red-900/40' : 'bg-blue-100 dark:bg-blue-900/40')}>
            {isTriggered ? (
              <PiCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            ) : (
              <PiAlarm className={cn('h-5 w-5', isExpired ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400')} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="font-medium text-gray-900 text-sm dark:text-white">{erinnerung.titel}</h4>
            {erinnerung.beschreibung && <p className="mt-0.5 text-gray-500 text-xs dark:text-gray-400">{erinnerung.beschreibung}</p>}

            {/* Countdown */}
            <div className="mt-2 flex items-center gap-2">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 font-medium text-xs',
                  isTriggered
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    : isExpired
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                )}
              >
                {isTriggered ? 'Ausgelöst' : countdown}
              </span>
              <span className="text-gray-400 text-xs">
                {new Date(erinnerung.faelligAm).toLocaleTimeString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Aktionen */}
        <div className="flex flex-shrink-0 gap-1">
          {/* Bearbeiten-Button (Story 1.3) */}
          {isEditable ? (
            <Button appearance="ghost" size="sm" onClick={handleEdit} title="Erinnerung bearbeiten" className="h-8 w-8 p-0">
              <PiPencil className="h-4 w-4" />
            </Button>
          ) : (
            <Button appearance="ghost" size="sm" disabled title="Nur geplante Erinnerungen können bearbeitet werden" className="h-8 w-8 cursor-not-allowed p-0 opacity-50">
              <PiPencil className="h-4 w-4" />
            </Button>
          )}

          {/* Loeschen-Button (Story 1.4 AC1/AC2) */}
          {isDeletable ? (
            <Button
              appearance="ghost"
              size="sm"
              onClick={handleDelete}
              title="Erinnerung löschen"
              className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"
            >
              <PiTrash className="h-4 w-4" />
            </Button>
          ) : (
            <Button appearance="ghost" size="sm" disabled title="Diese Erinnerung kann nicht gelöscht werden" className="h-8 w-8 cursor-not-allowed p-0 opacity-50">
              <PiTrash className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
