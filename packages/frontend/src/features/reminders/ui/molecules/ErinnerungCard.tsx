/**
 * Erinnerung Card
 *
 * Zeigt eine einzelne Erinnerung mit Status-Badge, Countdown und Aktionen.
 *
 * **Story 1.3 AC1/AC3:**
 * - Bearbeiten-Button nur bei Status GEPLANT sichtbar
 * - Tooltip wenn nicht editierbar
 *
 * **Story 1.4 AC1/AC2:**
 * - Loeschen-Button bei Status GEPLANT oder AUSGELOEST
 * - Loeschen oeffnet Bestaetigungs-Dialog
 *
 * **Story 1.6 AC1:**
 * - Acknowledge-Button bei Status AUSGELOEST
 * - 1-Tap Bestaetigung ruft API auf
 * - Optimistic Update fuer schnelles Feedback
 *
 * **Story 1.7 (Visuell):**
 * - AlarmStateBadge mit Status-Farben und Icons
 * - CountdownDisplay mit dynamischen Updates
 * - Progressive Card-Border-Farben basierend auf Urgency
 *
 * **Story 1.8 AC1:**
 * - Offline-Badge fuer offline erstellte Erinnerungen (temp_ ID)
 *
 * **Story 2.1 AC1/AC2 (Snooze):**
 * - Snooze-Buttons mit Presets (1, 5, 10 Min) bei Status AUSGELOEST
 * - Escape-Taste aktiviert Standard-Snooze (5 Min)
 * - Audio wird bei Snooze gestoppt
 * - Optimistic Update fuer Status → SNOOZED
 *
 * **Story 2.2 AC2 (Re-Trigger Badge):**
 * - Bei snoozeCount > 0 und Status AUSGELOEST: Badge "X. Auslösung"
 * - Zeigt dem User optisch, dass es ein Re-Trigger nach Snooze ist
 *
 * **Story 2.3 (Alarm-Intensivierung):**
 * - Bei intensityLevel !== 'none': Schnelleres Pulsieren (AlarmStateBadge)
 * - Bei intensityLevel !== 'none': Intensivere Border-Animation (border-glow)
 * - Intensification Timer wird bei Acknowledge/Snooze gestoppt
 *
 * **UX-Verbesserungen (Keyboard Support):**
 * - Bei AUSGELOEST Status: Gesamte Card mit Enter bestaetigbar
 * - Escape-Taste: 5 Min Snooze (Standard)
 * - Card bekommt tabIndex={0} fuer Keyboard-Navigation
 * - Visueller Fokus-Indikator (grüner Ring) bei Fokus
 * - Hinweistext "Enter: Bestätigen · Esc: 5 Min Snooze" bei Fokus
 * - Accessibility: role="button" und aria-label fuer Screen Reader
 */

import type { ErinnerungResponseDto } from '@/shared';
import { Button } from '@/shared/ui/atoms/button.atom';
import { cn } from '@/shared/ui/cn';
import { useCallback, useMemo, useState } from 'react';
import { PiCheckCircle, PiCheckSquareOffset, PiCloudSlash, PiNotepad, PiPencil, PiTrash } from 'react-icons/pi';
import { useAcknowledgeErinnerung, useSnoozeErinnerung, type SnoozeMinutes } from '../../api';
import { soundService, timerService, intensificationService } from '../../services';
import { useCountdown } from '../../hooks/use-countdown';
import { syncService } from '../../services/sync.service';
import { openDeleteDialog, openEditDialog, openMarkErledigtDialog, useIntensityLevel } from '../../stores';
import { AlarmStateBadge } from '../atoms/AlarmStateBadge';
import { CountdownDisplay } from '../atoms/CountdownDisplay';
import { SnoozeButtonGroup } from './SnoozeButtonGroup';

interface ErinnerungCardProps {
  /** Die anzuzeigende Erinnerung */
  erinnerung: ErinnerungResponseDto;
  /** Die Einsatz-ID (fuer den Edit Dialog) */
  einsatzId: string;
  /** Zusaetzliche CSS-Klassen */
  className?: string;
}

/**
 * Karte fuer eine einzelne Erinnerung mit Status-Badge, Countdown und Bearbeiten-Button.
 *
 * **Story 1.3 AC1:** Bearbeiten-Button oeffnet Edit Dialog
 * **Story 1.3 AC3:** Nur GEPLANT Status ist editierbar
 * **Story 1.7:** Visuelle Status-Anzeige mit AlarmStateBadge und CountdownDisplay
 */
export function ErinnerungCard({ erinnerung, einsatzId, className }: ErinnerungCardProps) {
  // Story 1.7: Countdown Hook für dynamische Updates und Urgency Level
  const { urgencyLevel, remaining } = useCountdown(erinnerung.faelligAm);

  // Berechne minutesUntilDue für AlarmStateBadge progressive Farben
  const minutesUntilDue = useMemo(() => {
    return Math.max(0, Math.floor(remaining / 60000));
  }, [remaining]);

  // Story 2.3: Intensivierungs-Level aus Store
  const intensityLevel = useIntensityLevel(erinnerung.id);

  // Story 1.6: Acknowledge Mutation Hook
  const acknowledgeErinnerung = useAcknowledgeErinnerung();

  // Story 2.1: Snooze Mutation Hook
  const snoozeErinnerung = useSnoozeErinnerung();

  const isEditable = erinnerung.status === 'GEPLANT';
  const isTriggered = erinnerung.status === 'AUSGELOEST';
  const isAcknowledged = erinnerung.status === 'ACKNOWLEDGED';
  const isErledigt = erinnerung.status === 'ERLEDIGT';
  // Story 1.4 AC1: Nur GEPLANT oder AUSGELOEST Status loeschbar
  const isDeletable = erinnerung.status === 'GEPLANT' || erinnerung.status === 'AUSGELOEST';
  // Story 1.5 Task 14.4: Nur AUSGELOEST Status kann bestätigt werden
  const isAcknowledgeable = erinnerung.status === 'AUSGELOEST';
  // Story 2.1 AC1: Nur AUSGELOEST Status kann gesnoozed werden
  const isSnoozeable = erinnerung.status === 'AUSGELOEST';
  // Story 2.5 AC1: Nur ACKNOWLEDGED oder ESKALIERT Status kann erledigt werden
  const isMarkErledigtable = erinnerung.status === 'ACKNOWLEDGED' || erinnerung.status === 'ESKALIERT';
  // Story 1.8 AC1: Offline erstellte Erinnerung (temp_ ID)
  const isOfflineCreated = syncService.isTempId(erinnerung.id);
  // Story 2.2 AC2: Re-Trigger Badge anzeigen wenn snoozeCount > 0 und AUSGELOEST
  const isRetrigger = isTriggered && (erinnerung.snoozeCount ?? 0) > 0;
  const retriggerNumber = (erinnerung.snoozeCount ?? 0) + 1; // 1. Auslösung = 0 Snoozes + 1

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

  // Story 2.5: Als Erledigt markieren oeffnet Dialog
  const handleMarkErledigt = useCallback(() => {
    if (isMarkErledigtable) {
      openMarkErledigtDialog(erinnerung, einsatzId);
    }
  }, [erinnerung, einsatzId, isMarkErledigtable]);

  // Story 1.6 AC1: Acknowledge-Handler mit API Call
  // Story 2.3 AC4: Intensification Timer wird bei Acknowledge gestoppt
  const handleAcknowledge = useCallback(() => {
    if (isAcknowledgeable && !acknowledgeErinnerung.isPending) {
      // Story 2.3 AC4: Intensification Timer stoppen
      intensificationService.stopTimer(erinnerung.id);

      acknowledgeErinnerung.mutate({
        einsatzId,
        erinnerungId: erinnerung.id,
      });
    }
  }, [isAcknowledgeable, acknowledgeErinnerung, einsatzId, erinnerung.id]);

  /**
   * Story 2.1 AC1/AC2: Snooze-Handler mit Audio-Stop und Timer-Reset
   * Story 2.3 AC4: Intensification Timer wird bei Snooze gestoppt
   *
   * Stoppt Audio, resettet Timer-Trigger-State, dann snoozed die Erinnerung fuer die gewaehlte Dauer.
   * Status wechselt zu SNOOZED, neue faelligAm wird berechnet.
   */
  const handleSnooze = useCallback(
    (minutes: SnoozeMinutes) => {
      if (isSnoozeable && !snoozeErinnerung.isPending) {
        // Story 2.1 AC2: Audio bei Snooze stoppen
        // TODO(Story 2.x): Ersetze durch erinnerungs-spezifisches stopAlarm(id) wenn Sound Service erweitert wird
        soundService.stopAllSounds();

        // F3 Fix: Timer-Trigger-State zuruecksetzen um erneutes Triggern nach Snooze zu ermoeglichen
        timerService.resetTriggered(erinnerung.id);

        // Story 2.3 AC4: Intensification Timer stoppen
        intensificationService.stopTimer(erinnerung.id);

        snoozeErinnerung.mutate({
          einsatzId,
          erinnerungId: erinnerung.id,
          snoozeMinutes: minutes,
        });
      }
    },
    [isSnoozeable, snoozeErinnerung, einsatzId, erinnerung.id],
  );

  // H2 Fix: Enter-Key Support für AC1 Requirement + Story 2.1 AC1: Escape-Key für 5 Min Snooze
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Enter: Acknowledge
      if (e.key === 'Enter' && isAcknowledgeable && !acknowledgeErinnerung.isPending) {
        e.preventDefault();
        handleAcknowledge();
      }
      // Story 2.1 AC1: Escape aktiviert Standard-Snooze (5 Min)
      if (e.key === 'Escape' && isSnoozeable && !snoozeErinnerung.isPending) {
        e.preventDefault();
        handleSnooze(5);
      }
    },
    [isAcknowledgeable, acknowledgeErinnerung.isPending, handleAcknowledge, isSnoozeable, snoozeErinnerung.isPending, handleSnooze],
  );

  // Focus-State für visuellen Indikator tracken
  const [isFocused, setIsFocused] = useState(false);

  // Story 1.7 AC5: Card-Border-Farben basierend auf Status und Urgency Level
  // Story 2.3 AC2: Intensivierte Border-Animation bei Nicht-Reaktion
  const getBorderClasses = () => {
    // AUSGELOEST: Roter Border mit Animation
    if (isTriggered) {
      // Story 2.3 AC2: Bei Intensivierung animate-border-glow hinzufuegen
      if (intensityLevel !== 'none') {
        return 'border-red-500 dark:border-red-400 ring-2 ring-red-300 dark:ring-red-800 animate-border-glow';
      }
      return 'border-red-500 dark:border-red-400 ring-2 ring-red-200 dark:ring-red-900/50';
    }
    // ACKNOWLEDGED/ERLEDIGT: Gedämpfte Farben
    if (isAcknowledged || isErledigt) {
      return 'border-gray-200 dark:border-gray-700 opacity-75';
    }
    // GEPLANT: Progressive Border basierend auf Urgency
    if (erinnerung.status === 'GEPLANT') {
      switch (urgencyLevel) {
        case 'urgent':
          return 'border-orange-400 dark:border-orange-500';
        case 'warning':
          return 'border-yellow-300 dark:border-yellow-500';
        case 'critical':
          return 'border-red-500 dark:border-red-400';
        default:
          return 'border-gray-200 dark:border-gray-700';
      }
    }
    return 'border-gray-200 dark:border-gray-700';
  };

  // Gemeinsame CSS-Klassen für Card-Container
  const cardBaseClasses = cn(
    'rounded-lg border bg-white p-4 shadow-sm transition-all dark:bg-gray-800',
    getBorderClasses(),
    // Background für AUSGELOEST
    isTriggered && 'bg-red-50 dark:bg-red-900/20',
    className,
  );

  // Card-Inhalt als JSX (wird in beiden Varianten wiederverwendet)
  const cardContent = (
    <div className="flex items-start justify-between gap-3">
      {/* Status-Badge und Inhalt */}
      <div className="flex items-start gap-3">
        {/* Story 1.7 AC1/AC6: AlarmStateBadge statt inline Icon */}
        {/* Story 2.3 AC2: intensityLevel fuer schnelleres Pulsieren */}
        <AlarmStateBadge status={erinnerung.status} minutesUntilDue={minutesUntilDue} size="md" intensityLevel={intensityLevel} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900 text-sm dark:text-white">{erinnerung.titel}</h4>
            {/* Story 1.8 AC1: Offline-Badge fuer temp_ IDs */}
            {isOfflineCreated && (
              // biome-ignore lint/a11y/useSemanticElements: span mit role="status" ist hier korrekt fuer inline Status-Badge
              <span
                role="status"
                aria-label="Offline erstellt - wird bei Verbindung synchronisiert"
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700 text-xs dark:bg-amber-900/40 dark:text-amber-300"
                title="Offline erstellt - wird bei Verbindung synchronisiert"
              >
                <PiCloudSlash className="h-3 w-3" aria-hidden="true" />
                Offline
              </span>
            )}
            {/* Story 2.2 AC2: Re-Trigger Badge bei Snooze-Wiederholung */}
            {isRetrigger && (
              // biome-ignore lint/a11y/useSemanticElements: span mit role="status" ist hier korrekt fuer inline Status-Badge
              <span
                role="status"
                aria-label={`${retriggerNumber}. Auslösung nach Snooze`}
                className="inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 font-medium text-red-700 text-xs dark:bg-red-900/40 dark:text-red-300"
                title={`${retriggerNumber}. Auslösung - wurde ${retriggerNumber - 1}x gesnoozed`}
              >
                {retriggerNumber}. Auslösung
              </span>
            )}
            {/* Story 2.6: Pflicht-Notiz Badge wenn requiresNote=true */}
            {erinnerung.requiresNote && (
              // biome-ignore lint/a11y/useSemanticElements: span mit role="status" ist hier korrekt fuer inline Status-Badge
              <span
                role="status"
                aria-label="Pflicht-Notiz erforderlich"
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700 text-xs dark:bg-amber-900/40 dark:text-amber-300"
                title="Bei Erledigung ist eine Notiz erforderlich"
              >
                <PiNotepad className="h-3 w-3" aria-hidden="true" />
                Notiz
              </span>
            )}
          </div>
          {erinnerung.beschreibung && <p className="mt-0.5 text-gray-500 text-xs dark:text-gray-400">{erinnerung.beschreibung}</p>}

          {/* Story 1.7 AC3/AC4: CountdownDisplay mit dynamischen Updates */}
          <div className="mt-2 flex items-center gap-2">
            {/* Zeige Countdown nur für GEPLANT Status */}
            {erinnerung.status === 'GEPLANT' && <CountdownDisplay faelligAm={erinnerung.faelligAm} className="text-sm" />}

            <span className="text-gray-400 text-xs">
              {new Date(erinnerung.faelligAm).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {/* Visueller Hinweis bei Fokus - Story 2.1 AC1: Auch Escape-Hint */}
            {isFocused && isAcknowledgeable && <span className="animate-pulse font-medium text-green-600 text-xs dark:text-green-400">Enter: Bestätigen · Esc: 5 Min Snooze</span>}
          </div>
        </div>
      </div>

      {/* Aktionen - H4 Fix: Button Size mindestens 48x48px für WCAG 2.5.5 Touch Target */}
      {/* Issue #8/#9: Render nur aktive Buttons (keine disabled Buttons) */}
      <div className="flex flex-shrink-0 gap-1">
        {/* Bearbeiten-Button (Story 1.3) - nur bei GEPLANT Status */}
        {isEditable && (
          <Button appearance="ghost" size="sm" onClick={handleEdit} aria-label="Erinnerung bearbeiten" title="Erinnerung bearbeiten" className="h-12 w-12 p-0">
            <PiPencil className="h-5 w-5" />
          </Button>
        )}

        {/* Loeschen-Button (Story 1.4 AC1/AC2) - nur bei GEPLANT oder AUSGELOEST Status */}
        {isDeletable && (
          <Button
            appearance="ghost"
            size="sm"
            onClick={handleDelete}
            aria-label="Erinnerung löschen"
            title="Erinnerung löschen"
            className="h-12 w-12 p-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"
          >
            <PiTrash className="h-5 w-5" />
          </Button>
        )}

        {/* Acknowledge-Button (Story 1.6 AC1) - nur bei AUSGELOEST Status */}
        {/* Hinweis: onKeyDown wurde auf Card-Ebene verschoben fuer bessere UX (Enter auf ganzer Card) */}
        {isAcknowledgeable && (
          <Button
            appearance="ghost"
            size="sm"
            onClick={handleAcknowledge}
            disabled={acknowledgeErinnerung.isPending}
            aria-label="Erinnerung bestätigen"
            title="Erinnerung bestätigen"
            className={cn(
              'h-12 w-12 p-0 text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-900/20 dark:hover:text-green-300',
              acknowledgeErinnerung.isPending && 'cursor-wait opacity-50',
            )}
          >
            <PiCheckCircle className={cn('h-5 w-5', acknowledgeErinnerung.isPending && 'animate-pulse')} />
          </Button>
        )}

        {/* Story 2.5: Als Erledigt markieren Button - nur bei ACKNOWLEDGED oder ESKALIERT Status */}
        {isMarkErledigtable && (
          <Button
            appearance="ghost"
            size="sm"
            onClick={handleMarkErledigt}
            aria-label="Erinnerung als erledigt markieren"
            title="Als erledigt markieren"
            className="h-12 w-12 p-0 text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-900/20 dark:hover:text-green-300"
          >
            <PiCheckSquareOffset className="h-5 w-5" />
          </Button>
        )}

        {/* Story 2.1 AC1: Snooze-Buttons mit Presets (1, 5, 10 Min) - nur bei AUSGELOEST Status */}
        {/* F2 Fix: Extracted to SnoozeButtonGroup component */}
        {isSnoozeable && <SnoozeButtonGroup onSnooze={handleSnooze} disabled={snoozeErinnerung.isPending} />}
      </div>
    </div>
  );

  // Render: Interaktiver Container fuer acknowledgeable Cards, sonst normaler div
  // Biome a11y: Semantisches <button> Element statt div mit role="button"
  if (isAcknowledgeable) {
    return (
      <button
        type="button"
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onClick={handleAcknowledge}
        aria-label={`Erinnerung "${erinnerung.titel}" - Enter: Bestätigen, Escape: 5 Min Snooze`}
        className={cn(cardBaseClasses, 'w-full cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-green-500')}
      >
        {cardContent}
      </button>
    );
  }

  return <div className={cardBaseClasses}>{cardContent}</div>;
}
