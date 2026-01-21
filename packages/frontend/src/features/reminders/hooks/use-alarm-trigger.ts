/**
 * Alarm Trigger Hook fuer automatische Erinnerungs-Ausloesung
 *
 * Orchestriert die komplette Trigger-Sequenz wenn eine Erinnerung faellig wird:
 * 1. Sound abspielen (info Level)
 * 2. OS Notification zeigen
 * 3. API POST /erinnerungen/:id/trigger aufrufen
 * 4. TanStack Query Cache invalidieren
 * 5. Intensification Timer starten (Story 2.3)
 *
 * **Story 1.5 AC1, AC2, AC3, AC4, AC6:**
 * - AC1: Timer-basiertes Ausloesen (Status GEPLANT → AUSGELOEST)
 * - AC2: Akustisches Feedback (Sound Service)
 * - AC3: OS Notification (auch bei minimierter App)
 * - AC4: Backend emittiert WebSocket Event
 * - AC6: Latenz <1s (500ms Timer Interval)
 *
 * **Story 2.2 AC1, AC3:**
 * - AC1: Nach Snooze-Ablauf automatisches Re-Triggern (Status SNOOZED → AUSGELOEST)
 * - AC3: Sound/Notification werden erneut abgespielt
 * - TimerService ueberwacht auch SNOOZED Status (faelligAm = snoozedUntil)
 *
 * **Story 2.3 AC1, AC2, AC3, AC4, AC5:**
 * - AC1: Sound-Eskalation nach 30 Sekunden (info → warning)
 * - AC2: Visuelle Intensivierung (via Store)
 * - AC3: Re-Notification mit "Überfällig - Bitte reagieren!"
 * - AC4: Intensivierung stoppt bei Reaktion
 * - AC5: Nur fuer AUSGELOEST Status
 */

import { useCallback, useEffect, useRef } from 'react';
import type { ErinnerungResponseDto } from '@bluelight-hub/shared/client';
import { logger } from '@/shared/lib/logger';
import { toast } from 'sonner';
import { useTriggerErinnerung } from '../api';
import { timerService, soundService, sendErinnerungNotification, sendIntensifiedNotification, requestNotificationPermission, intensificationService } from '../services';
import type { IntensityLevel } from '../stores/intensification.store';

/**
 * Optionen fuer den Alarm Trigger Hook
 */
export interface UseAlarmTriggerOptions {
  /**
   * Liste der zu ueberwachenden Erinnerungen
   *
   * Der Timer wird nur fuer Erinnerungen mit Status GEPLANT gestartet.
   */
  erinnerungen: ErinnerungResponseDto[];

  /**
   * Einsatz-ID fuer API Calls
   *
   * Wird benoetigt um den Trigger API-Endpunkt aufzurufen.
   */
  einsatzId: string;

  /**
   * Aktiviert/deaktiviert den Timer
   *
   * Nutze dies um den Timer zu stoppen wenn die Komponente nicht sichtbar ist.
   * @default true
   */
  enabled?: boolean;

  /**
   * Callback nach erfolgreichem Trigger
   *
   * Wird aufgerufen nachdem alle Trigger-Aktionen erfolgreich waren.
   * Nuetzlich fuer UI-Updates oder zusaetzliche Logik.
   */
  onTriggerSuccess?: (erinnerung: ErinnerungResponseDto) => void;

  /**
   * Callback bei Trigger-Fehlern
   *
   * Wird aufgerufen wenn eine Trigger-Aktion fehlschlaegt.
   */
  onTriggerError?: (erinnerung: ErinnerungResponseDto, error: Error) => void;

  /**
   * Callback bei Alarm-Intensivierung (Story 2.3)
   *
   * Wird aufgerufen wenn das Intensivierungs-Level sich aendert (nach 30s/60s).
   * Nuetzlich fuer zusaetzliche UI-Updates oder Analytics.
   */
  onIntensify?: (erinnerung: ErinnerungResponseDto, level: IntensityLevel) => void;
}

/**
 * Alarm Trigger Hook
 *
 * Startet einen Timer der alle 500ms prueft ob Erinnerungen faellig sind.
 * Bei Faelligkeit wird die Trigger-Sequenz gestartet:
 * Sound → Notification → API Call → Cache Update
 *
 * @param options - Hook Optionen
 * @returns Hook State mit Hilfsfunktionen
 *
 * @example
 * ```tsx
 * const { data: erinnerungen } = useErinnerungenByEinsatz({ einsatzId });
 *
 * useAlarmTrigger({
 *   erinnerungen: erinnerungen ?? [],
 *   einsatzId,
 *   onTriggerSuccess: (e) => console.log('Triggered:', e.titel),
 * });
 * ```
 */
export function useAlarmTrigger({ erinnerungen, einsatzId, enabled = true, onTriggerSuccess, onTriggerError, onIntensify }: UseAlarmTriggerOptions) {
  // API Mutation fuer Backend-Trigger
  const triggerMutation = useTriggerErinnerung();

  // Ref um aktuelle Callbacks im Timer-Callback zu haben
  const callbacksRef = useRef({ onTriggerSuccess, onTriggerError, onIntensify });
  callbacksRef.current = { onTriggerSuccess, onTriggerError, onIntensify };

  // Ref um aktuelle einsatzId im Timer-Callback zu haben
  const einsatzIdRef = useRef(einsatzId);
  einsatzIdRef.current = einsatzId;

  // Ref fuer Erinnerungen um sie im Intensification-Callback zu haben
  const erinnerungenRef = useRef(erinnerungen);
  erinnerungenRef.current = erinnerungen;

  // Ref für mutateAsync um Effect-Loop zu vermeiden
  // (triggerMutation ändert sich bei State-Änderungen wie isPending)
  const mutateAsyncRef = useRef(triggerMutation.mutateAsync);
  mutateAsyncRef.current = triggerMutation.mutateAsync;

  /**
   * Callback fuer Intensivierungs-Events (Story 2.3)
   *
   * Wird vom IntensificationService aufgerufen wenn ein Level-Wechsel stattfindet.
   * Fuehrt Sound-Eskalation und Re-Notification aus.
   *
   * **Wichtig:** Diese Funktion hat KEINE Dependencies um Effect-Loops zu vermeiden.
   */
  const handleIntensification = useCallback(
    async (erinnerungId: string, level: IntensityLevel) => {
      const currentEinsatzId = einsatzIdRef.current;
      const erinnerung = erinnerungenRef.current.find((e) => e.id === erinnerungId);

      if (!erinnerung) {
        logger.warn(`[AlarmTrigger] Intensification fuer unbekannte Erinnerung: ${erinnerungId}`);
        return;
      }

      logger.info(`[AlarmTrigger] Intensification: ${erinnerung.titel} -> ${level}`);

      // Story 2.3 AC1: Sound-Eskalation
      if (level === 'warning' || level === 'urgent') {
        try {
          await soundService.escalateToLevel(level);
        } catch (err) {
          logger.warn(`[AlarmTrigger] Sound escalation failed (non-critical): ${err}`);
        }
      }

      // Story 2.3 AC3: Re-Notification
      if (level === 'warning' || level === 'urgent') {
        try {
          await sendIntensifiedNotification(erinnerung.titel, erinnerung.id, currentEinsatzId);
        } catch (err) {
          logger.warn(`[AlarmTrigger] Intensified notification failed (non-critical): ${err}`);
        }
      }

      // Callback an Consumer
      callbacksRef.current.onIntensify?.(erinnerung, level);
    },
    [], // Keine Dependencies - alle Werte ueber Refs
  );

  /**
   * Fuehrt die komplette Trigger-Sequenz aus
   *
   * Fire-and-Forget fuer Sound/Notification (Fehler werden geloggt, nicht propagiert)
   * API-Fehler werden an onTriggerError propagiert
   *
   * H6 Fix: Wenn Sound UND Notification fehlschlagen, zeige Toast als Fallback
   *
   * **Story 2.3:** Startet Intensification Timer nach erfolgreichem Trigger
   *
   * **Wichtig:** Diese Funktion hat KEINE Dependencies um Effect-Loops zu vermeiden.
   * Alle veränderlichen Werte werden über Refs gelesen.
   */
  const executeTriggerSequence = useCallback(
    async (erinnerung: ErinnerungResponseDto) => {
      const currentEinsatzId = einsatzIdRef.current;

      logger.info(`[AlarmTrigger] Starting trigger sequence for: ${erinnerung.titel} (${erinnerung.id})`);

      // H6 Fix: Track success für Sound und Notification
      let soundSuccess = false;
      let notificationSuccess = false;

      // 1. Sound abspielen
      try {
        const soundResult = await soundService.playAlarm('info');
        soundSuccess = soundResult.success;
        if (!soundSuccess) {
          logger.warn(`[AlarmTrigger] Sound failed (non-critical): ${soundResult.error}`);
        }
      } catch (err) {
        logger.warn(`[AlarmTrigger] Sound failed (non-critical): ${err}`);
      }

      // 2. Notification zeigen (mit Deep Link Daten für Navigation)
      try {
        await sendErinnerungNotification(erinnerung.titel, erinnerung.id, currentEinsatzId);
        notificationSuccess = true;
      } catch (err) {
        logger.warn(`[AlarmTrigger] Notification failed (non-critical): ${err}`);
      }

      // H6 Fix: Fallback Toast wenn beides fehlschlägt
      if (!soundSuccess && !notificationSuccess) {
        toast.warning(`Erinnerung fällig: ${erinnerung.titel}`, {
          description: 'Sound und Benachrichtigung konnten nicht abgespielt werden',
          duration: 10000,
        });
      }

      // 3. API Call (kritisch - mit Error Handling)
      // Nutze Ref um Effect-Loop zu vermeiden (mutateAsync ist stabil über Ref)
      try {
        await mutateAsyncRef.current({
          einsatzId: currentEinsatzId,
          erinnerungId: erinnerung.id,
        });

        logger.info(`[AlarmTrigger] Trigger sequence completed: ${erinnerung.titel}`);

        // 4. Story 2.3: Intensification Timer starten
        // Timer startet ab jetzt, nicht ab ausgeloestAm im DTO
        intensificationService.startTimer(erinnerung.id, Date.now(), handleIntensification);

        callbacksRef.current.onTriggerSuccess?.(erinnerung);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error(`[AlarmTrigger] API trigger failed: ${erinnerung.id}`, error);
        callbacksRef.current.onTriggerError?.(erinnerung, err);
      }
    },
    [handleIntensification], // handleIntensification ist stabil (leeres Dependency Array)
  );

  // Timer starten/stoppen basierend auf enabled und erinnerungen
  useEffect(() => {
    if (!enabled || !erinnerungen.length) {
      timerService.stop();
      // Story 2.3: Alle Intensification Timer stoppen
      intensificationService.stopAllTimers();
      return;
    }

    // C5 Fix: Timer starten mit Trigger-Callback und einsatzId
    timerService.start(erinnerungen, einsatzId, (erinnerung) => {
      // Async in Callback starten (nicht blockierend)
      executeTriggerSequence(erinnerung);
    });

    // Cleanup bei Unmount oder Dependency-Change
    return () => {
      timerService.stop();
      // Story 2.3: Alle Intensification Timer stoppen
      intensificationService.stopAllTimers();
    };
  }, [enabled, erinnerungen, einsatzId, executeTriggerSequence]);

  // Erinnerungen aktualisieren ohne Timer-Neustart
  useEffect(() => {
    if (enabled && timerService.isRunning()) {
      // C5 Fix: updateErinnerungen mit einsatzId
      timerService.updateErinnerungen(erinnerungen, einsatzId);
    }
  }, [erinnerungen, einsatzId, enabled]);

  // Notification Permission beim Mount anfordern
  useEffect(() => {
    if (enabled) {
      requestNotificationPermission().catch((err) => {
        logger.warn(`[AlarmTrigger] Notification permission request failed: ${err}`);
      });
    }
  }, [enabled]);

  return {
    /**
     * Ob der Timer aktuell laeuft
     */
    isRunning: enabled && timerService.isRunning(),

    /**
     * Anzahl der bereits getriggerten Erinnerungen in dieser Session
     */
    triggeredCount: timerService.getTriggeredCount(),

    /**
     * Ob gerade ein API-Trigger laeuft
     */
    isTriggering: triggerMutation.isPending,

    /**
     * Manueller Trigger (fuer Tests oder spezielle Use Cases)
     *
     * Loest die Trigger-Sequenz manuell fuer eine spezifische Erinnerung aus.
     * Normalerweise wird dies automatisch vom Timer aufgerufen.
     */
    triggerManually: executeTriggerSequence,

    /**
     * Reset einer getriggerten Erinnerung (fuer Snooze)
     *
     * Erlaubt erneutes Triggern einer Erinnerung.
     * Story 2.3 AC4: Stoppt auch den Intensification Timer.
     */
    resetTriggered: (erinnerungId: string) => {
      timerService.resetTriggered(erinnerungId);
      // Story 2.3 AC4: Intensification Timer stoppen bei Snooze
      intensificationService.stopTimer(erinnerungId);
    },

    /**
     * Stoppt den Intensification Timer fuer eine Erinnerung (Story 2.3 AC4)
     *
     * Wird aufgerufen bei Acknowledge oder Snooze.
     */
    stopIntensification: (erinnerungId: string) => {
      intensificationService.stopTimer(erinnerungId);
    },
  };
}
