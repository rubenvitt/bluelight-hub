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
 *
 * **Story 3.2 AC2 (Status-Aenderungsanimation):**
 * - Update-Animation: Kurzer Highlight bei Status-Wechsel via WebSocket
 * - Insert-Animation: Slide-in bei neuer Erinnerung via WebSocket
 */

import type { ErinnerungResponseDto } from '@/shared';
import { Button } from '@/shared/ui/atoms/button.atom';
import { cn } from '@/shared/ui/cn';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PiCheckCircle, PiCheckSquareOffset, PiCloudSlash, PiNotepad, PiPencil, PiTrash, PiUserPlus } from 'react-icons/pi';
import { useAcknowledgeErinnerung, useSnoozeErinnerung, type SnoozeMinutes } from '../../api';
import { soundService, timerService, intensificationService } from '../../services';
import { useCountdown } from '../../hooks/use-countdown';
import { syncService } from '../../services/sync.service';
import { openDeleteDialog, openEditDialog, openMarkErledigtDialog, useAnimationEntry, useIntensityLevel, useAudioFailed } from '../../stores';
import { markAsSeen, useIsUnseen } from '../../stores/seen-assignments.store';
import { AlarmStateBadge } from '../atoms/AlarmStateBadge';
import { AvatarInitials } from '../atoms/AvatarInitials';
import { CountdownDisplay } from '../atoms/CountdownDisplay';
import { NewBadge } from '../atoms';
import { SnoozeButtonGroup } from './SnoozeButtonGroup';
import { ErinnerungAssignDialog } from '../organisms/ErinnerungAssignDialog';

/**
 * Hook zur Erkennung der Benutzer-Praeferenz fuer reduzierte Bewegung.
 *
 * Story 3.2 AC2 Accessibility: Bei `prefers-reduced-motion: reduce` werden
 * Animationen durch subtile statische Effekte ersetzt.
 *
 * @returns true wenn der Benutzer reduzierte Bewegung bevorzugt
 */
const usePrefersReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    // SSR-safe: Pruefe ob window verfuegbar ist
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
};

interface ErinnerungCardProps {
  /** Die anzuzeigende Erinnerung */
  erinnerung: ErinnerungResponseDto;
  /** Die Einsatz-ID (fuer den Edit Dialog) */
  einsatzId: string;
  /** Zusaetzliche CSS-Klassen */
  className?: string;
  /**
   * Story 3.1 AC3/AC4: Ersteller-Namen anzeigen (fuer Team-Ansicht)
   * @default false
   */
  showCreator?: boolean;
  /**
   * Story 3.1 AC5/AC8: Aktuelle User-ID fuer "eigene vs fremde" Unterscheidung
   * Wenn angegeben, werden fremde Erinnerungen mit "Team"-Badge markiert
   */
  currentUserId?: string;
}

/**
 * Karte fuer eine einzelne Erinnerung mit Status-Badge, Countdown und Bearbeiten-Button.
 *
 * **Story 1.3 AC1:** Bearbeiten-Button oeffnet Edit Dialog
 * **Story 1.3 AC3:** Nur GEPLANT Status ist editierbar
 * **Story 1.7:** Visuelle Status-Anzeige mit AlarmStateBadge und CountdownDisplay
 */
export function ErinnerungCard({ erinnerung, einsatzId, className, showCreator = false, currentUserId }: ErinnerungCardProps) {
  // Story 1.7: Countdown Hook für dynamische Updates und Urgency Level
  const { urgencyLevel, remaining } = useCountdown(erinnerung.faelligAm);

  // Berechne minutesUntilDue für AlarmStateBadge progressive Farben
  const minutesUntilDue = useMemo(() => {
    return Math.max(0, Math.floor(remaining / 60000));
  }, [remaining]);

  // Story 2.3: Intensivierungs-Level aus Store
  const intensityLevel = useIntensityLevel(erinnerung.id);

  // Story 2.8: Audio-Ausfall Flag aus Store
  const audioFailed = useAudioFailed(erinnerung.id);

  // Story 3.2 AC2: Animation bei WebSocket-Updates
  const animationEntry = useAnimationEntry(erinnerung.id);

  // Story 3.2 AC2 Accessibility: Reduced-Motion Praeferenz des Benutzers
  const prefersReducedMotion = usePrefersReducedMotion();

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
  // Story 1.5 Task 14.4: Nur AUSGELOEST oder ESKALIERT Status kann bestätigt werden
  const isAcknowledgeable = erinnerung.status === 'AUSGELOEST' || erinnerung.status === 'ESKALIERT';
  // Story 2.1 AC1: Nur AUSGELOEST Status kann gesnoozed werden
  const isSnoozeable = erinnerung.status === 'AUSGELOEST';
  // Story 2.5 AC1: Nur ACKNOWLEDGED oder ESKALIERT Status kann erledigt werden
  const isMarkErledigtable = erinnerung.status === 'ACKNOWLEDGED' || erinnerung.status === 'ESKALIERT';
  // Story 1.8 AC1: Offline erstellte Erinnerung (temp_ ID)
  const isOfflineCreated = syncService.isTempId(erinnerung.id);
  // Story 2.2 AC2: Re-Trigger Badge anzeigen wenn snoozeCount > 0 und AUSGELOEST
  const isRetrigger = isTriggered && (erinnerung.snoozeCount ?? 0) > 0;
  const retriggerNumber = (erinnerung.snoozeCount ?? 0) + 1; // 1. Auslösung = 0 Snoozes + 1
  // Story 3.4 AC1: Nur aktive Erinnerungen (nicht ERLEDIGT/ESKALIERT) können zugewiesen werden
  const isAssignable = ['GEPLANT', 'AUSGELOEST'].includes(erinnerung.status);

  // Story 3.4: State fuer Zuweisungs-Dialog
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  // Story 3.1 AC5/AC8: Eigene vs. fremde Erinnerung erkennen
  // Eine Erinnerung ist "meine" wenn ich sie erstellt habe ODER mir zugewiesen wurde
  // biome-ignore lint/suspicious/noExplicitAny: DTO missing fields
  const isOwnReminder = currentUserId ? (erinnerung as any).erstelltVon === currentUserId || (erinnerung as any).assignedToId === currentUserId : true;
  const isTeamReminder = currentUserId && !isOwnReminder;

  // Story 3.7 AC3: "Neu" Badge Logik
  // Zeige "Neu" wenn:
  // 1. Mir zugewiesen (assignedTo === me) - bereits durch AC abgedeckt, da store nur meine Zuweisungen trackt?
  //    Nein, store trackt IDs. Wir müssen prüfen ob es AKTUELL mir zugewiesen ist.
  // 2. ID ist im seen-store (als unseen)
  // 3. Ich habe es NICHT selbst zugewiesen (updater !== me) - das ist schwer zu prüfen ohne extra props.
  //    Aber: Wenn ich es selbst zuweise, sollte ich es beim Erstellen/Update gleich als "seen" markieren?
  //    Vereinfachung: Store Logic `markAsSeen` sollte bei aktiven Actions aufgerufen werden.
  const isUnseen = useIsUnseen(erinnerung.id);
  const shouldShowNewBadge = isUnseen && erinnerung.assignedToId === currentUserId;

  // Story 3.7 AC4: "Neu" Markierung entfernen
  const handleMarkAsSeen = useCallback(() => {
    if (shouldShowNewBadge) {
      markAsSeen(erinnerung.id);
    }
  }, [shouldShowNewBadge, erinnerung.id]);

  const handleEdit = useCallback(() => {
    handleMarkAsSeen();
    if (isEditable) {
      openEditDialog(erinnerung, einsatzId);
    }
  }, [erinnerung, einsatzId, isEditable, handleMarkAsSeen]);

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

  // Story 3.4: Zuweisungs-Dialog oeffnen
  const handleOpenAssignDialog = useCallback(() => {
    if (isAssignable) {
      setIsAssignDialogOpen(true);
    }
  }, [isAssignable]);

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

  // Story 3.7 AC4: Markiere als gesehen beim Klicken/Fokussieren der Karte?
  // "When ich sie öffne / Details ansehe".
  // Wir nutzen handleCardClick (unten) dafür, erweitern es aber.

  // Focus-State für visuellen Indikator tracken
  const [isFocused, setIsFocused] = useState(false);

  // Story 1.7 AC5: Card-Border-Farben basierend auf Status und Urgency Level
  // Story 2.3 AC2: Intensivierte Border-Animation bei Nicht-Reaktion
  // Story 2.8 AC2: Intensivere Farben bei Audio-Ausfall
  const getBorderClasses = () => {
    // AUSGELOEST: Roter Border mit Animation
    if (isTriggered) {
      // Story 2.8 AC2: Bei Audio-Ausfall intensivere visuelle Darstellung
      if (audioFailed) {
        return 'border-red-600 dark:border-red-500 ring-4 ring-red-400 dark:ring-red-700 animate-border-glow-urgent';
      }
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

  // Story 3.2 AC2: Animation-Classes basierend auf Animation-Typ
  // Accessibility: Bei prefers-reduced-motion subtile statische Effekte statt Animationen
  const getAnimationClasses = () => {
    if (!animationEntry) return '';

    // Bei prefers-reduced-motion: Subtile statische Effekte statt Animationen
    // Dies erfuellt AC2 "subtile Animation" - bei reduced-motion als statischer visueller Hinweis
    if (prefersReducedMotion) {
      switch (animationEntry.type) {
        case 'update':
          // Statischer blauer Ring als Highlight (ohne Animation)
          return 'ring-2 ring-blue-400 ring-opacity-50';
        case 'insert':
          // Statischer gruener Ring fuer neue Items (ohne Slide-Animation)
          return 'ring-2 ring-green-400 ring-opacity-50';
        default:
          return '';
      }
    }

    // Normale Animationen wenn reduced-motion nicht aktiv
    switch (animationEntry.type) {
      case 'update':
        // Highlight-Effekt bei Update (kurzer Glow/Pulse)
        return 'animate-highlight ring-2 ring-blue-400 ring-opacity-75';
      case 'insert':
        // Slide-in Animation für neue Items
        return 'animate-slide-in-right';
      default:
        return '';
    }
  };

  // Gemeinsame CSS-Klassen für Card-Container
  const cardBaseClasses = cn(
    'rounded-lg border bg-white p-4 shadow-sm transition-all dark:bg-gray-800',
    getBorderClasses(),
    // Background für AUSGELOEST
    isTriggered && 'bg-red-50 dark:bg-red-900/20',
    // Story 3.2 AC2: Animation bei WebSocket-Updates
    getAnimationClasses(),
    className,
  );

  // Card-Inhalt als JSX (wird in beiden Varianten wiederverwendet)
  const cardContent = (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        {/* Status-Badge und Inhalt */}
        <div className="flex items-start gap-3">
          {/* Story 1.7 AC1/AC6: AlarmStateBadge statt inline Icon */}
          {/* biome-ignore lint/suspicious/noExplicitAny: DTO type mismatch */}
          <AlarmStateBadge status={erinnerung.status as any} minutesUntilDue={minutesUntilDue} size="md" intensityLevel={intensityLevel} audioFailed={audioFailed} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-medium text-gray-900 text-sm dark:text-white">{erinnerung.titel}</h4>
              {/* Story 3.7 AC3: Neu Badge */}
              {shouldShowNewBadge && <NewBadge />}
              {/* Story 1.8 AC1: Offline-Badge */}
              {isOfflineCreated && (
                <output
                  aria-label="Offline erstellt"
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700 text-xs dark:bg-amber-900/40 dark:text-amber-300"
                  title="Offline erstellt"
                >
                  <PiCloudSlash className="h-3 w-3" aria-hidden="true" />
                  Offline
                </output>
              )}
              {/* Story 2.2 AC2: Re-Trigger Badge */}
              {isRetrigger && (
                <output
                  aria-label={`${retriggerNumber}. Auslösung`}
                  className="inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 font-medium text-red-700 text-xs dark:bg-red-900/40 dark:text-red-300"
                  title={`${retriggerNumber}. Auslösung`}
                >
                  {retriggerNumber}. Auslösung
                </output>
              )}
              {/* Story 2.6: Pflicht-Notiz */}
              {erinnerung.requiresNote && (
                <output
                  aria-label="Pflicht-Notiz"
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700 text-xs dark:bg-amber-900/40 dark:text-amber-300"
                  title="Notiz erforderlich"
                >
                  <PiNotepad className="h-3 w-3" aria-hidden="true" />
                  Pflicht
                </output>
              )}
              {/* Story 3.1 AC8: Team-Badge */}
              {isTeamReminder && (
                <output
                  aria-label="Team-Erinnerung"
                  className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 font-medium text-blue-700 text-xs dark:bg-blue-900/40 dark:text-blue-300"
                >
                  Team
                </output>
              )}
            </div>
            {/* biome-ignore lint/suspicious/noExplicitAny: DTO missing fields */}
            {(erinnerung as any).beschreibung && <p className="mt-0.5 text-gray-500 text-xs dark:text-gray-400">{(erinnerung as any).beschreibung as any}</p>}

            {/* biome-ignore lint/suspicious/noExplicitAny: DTO missing fields */}
            {(showCreator || isTeamReminder || ((erinnerung as any).assignedToId && (erinnerung as any).assignedToId === currentUserId)) && (erinnerung as any).erstellerName && (
              <div className="mt-0.5 flex items-center gap-1.5">
                {/* biome-ignore lint/suspicious/noExplicitAny: DTO missing fields */}
                <AvatarInitials name={(erinnerung as any).erstellerName} size="sm" />
                <p className="text-gray-400 text-xs dark:text-gray-500">
                  {/* biome-ignore lint/suspicious/noExplicitAny: DTO missing fields */}
                  <span className="text-gray-500 dark:text-gray-400">{(erinnerung as any).assignedToId === currentUserId ? 'Erstellt von' : 'von'}</span> {(erinnerung as any).erstellerName}
                </p>
              </div>
            )}

            <div className="mt-1 flex items-center gap-2">
              {erinnerung.status === 'GEPLANT' && <CountdownDisplay faelligAm={erinnerung.faelligAm} className="text-sm" />}
              <span className="text-gray-400 text-xs">{new Date(erinnerung.faelligAm).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>

        {/* Administrative Aktionen (Immer oben rechts) */}
        <div className="flex flex-shrink-0 gap-1">
          {isEditable && (
            <Button appearance="ghost" size="sm" onClick={handleEdit} aria-label="Erinnerung bearbeiten" title="Erinnerung bearbeiten" className="h-10 w-10 p-0">
              <PiPencil className="h-5 w-5" />
            </Button>
          )}

          {isAssignable && (
            <Button
              appearance="ghost"
              size="sm"
              onClick={handleOpenAssignDialog}
              aria-label="Erinnerung zuweisen"
              title="Erinnerung zuweisen"
              className="h-10 w-10 p-0 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
            >
              <PiUserPlus className="h-5 w-5" />
            </Button>
          )}

          {isDeletable && (
            <Button
              appearance="ghost"
              size="sm"
              onClick={handleDelete}
              aria-label="Erinnerung löschen"
              title="Erinnerung löschen"
              className="h-10 w-10 p-0 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <PiTrash className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Primäre Aktionen für AUSGELOEST oder ACKNOWLEDGED (Neue Zeile für bessere Containment) */}
      {(isAcknowledgeable || isMarkErledigtable || isSnoozeable) && (
        <div className={cn('flex flex-wrap items-center gap-2 border-t pt-2', isTriggered ? 'border-red-200 dark:border-red-800' : 'border-gray-100 dark:border-gray-700')}>
          {/* Acknowledge Button */}
          {isAcknowledgeable && (
            <Button
              appearance="filled"
              size="sm"
              onClick={handleAcknowledge}
              disabled={acknowledgeErinnerung.isPending}
              className={cn('h-10 min-w-[120px] flex-1 justify-center gap-2', isTriggered ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700')}
            >
              <PiCheckCircle className={cn('h-5 w-5', acknowledgeErinnerung.isPending && 'animate-pulse')} />
              <span>Bestätigen</span>
            </Button>
          )}

          {/* Erledigt Markieren Button */}
          {isMarkErledigtable && (
            <Button appearance="outline" size="sm" onClick={handleMarkErledigt} className="h-10 flex-1 justify-center gap-2 border-green-600 text-green-600 hover:bg-green-50">
              <PiCheckSquareOffset className="h-5 w-5" />
              <span>Erledigt</span>
            </Button>
          )}

          {/* Snooze Buttons (Nur bei AUSGELOEST) */}
          {isSnoozeable && <SnoozeButtonGroup onSnooze={handleSnooze} disabled={snoozeErinnerung.isPending} className="flex-shrink-0" variant={isTriggered ? 'default' : 'default'} />}

          {/* Keyboard Hint */}
          {isFocused && isAcknowledgeable && <span className="mt-1 w-full animate-pulse text-center font-medium text-red-600 text-xs dark:text-red-400">Enter: Bestätigen · Esc: 5 Min Snooze</span>}
        </div>
      )}
    </div>
  );

  // Story 3.4: Zuweisungs-Dialog (wird immer gerendert, sichtbar nur wenn isAssignDialogOpen)
  const assignDialog = <ErinnerungAssignDialog isOpen={isAssignDialogOpen} onClose={() => setIsAssignDialogOpen(false)} erinnerung={erinnerung} einsatzId={einsatzId} />;

  /**
   * Click-Handler fuer den Card-Container.
   * Triggert Acknowledge nur wenn direkt auf die Card geklickt wird,
   * nicht wenn auf innere interaktive Elemente (Buttons) geklickt wird.
   */
  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      // Story 3.7 AC4: Bei Klick immer als gesehen markieren
      handleMarkAsSeen();

      // Ignoriere Clicks auf innere interaktive Elemente (Buttons, Links, etc.)
      const target = e.target as HTMLElement;
      if (target.closest('button, a, [role="button"]')) {
        return;
      }

      // Acknowledge nur wenn möglich
      if (isAcknowledgeable) {
        handleAcknowledge();
      }
    },
    [handleAcknowledge, isAcknowledgeable, handleMarkAsSeen],
  );

  // Render: Interaktiver Container fuer acknowledgeable Cards, sonst normaler div
  // Fix: Kein <button> als Container, da innere Buttons enthalten sind (HTML Nesting Violation)
  // Stattdessen: <div> mit tabIndex fuer Keyboard-Zugaenglichkeit
  if (isAcknowledgeable) {
    return (
      <>
        {/* biome-ignore lint/a11y/useSemanticElements: div mit role="group" ist hier korrekt, da Container interaktive Elemente enthaelt */}
        <div
          role="group"
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onClick={handleCardClick}
          aria-label={`Erinnerung "${erinnerung.titel}" - Enter: Bestätigen, Escape: 5 Min Snooze`}
          className={cn(cardBaseClasses, 'w-full cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-green-500')}
        >
          {cardContent}
        </div>
        {assignDialog}
      </>
    );
  }

  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: interactive card container requires div */}
      <div
        role="button"
        tabIndex={0}
        className={cardBaseClasses}
        onClick={handleCardClick}
        onKeyUp={(e) => {
          if (e.key === 'Enter') handleMarkAsSeen();
        }} // Accessibility
      >
        {cardContent}
      </div>
      {assignDialog}
    </>
  );
}
