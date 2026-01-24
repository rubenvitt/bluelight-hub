/**
 * Alarm Trigger Hook fuer automatische Erinnerungs-Ausloesung
 *
 * Orchestriert die komplette Trigger-Sequenz wenn eine Erinnerung faellig wird:
 * 1. Sound abspielen (info Level)
 * 2. OS Notification zeigen
 * 3. API POST /erinnerungen/:id/trigger aufrufen
 * 4. TanStack Query Cache invalidieren
 * 5. Intensification Timer starten (Story 2.3)
 * 6. FloatingPill aktivieren bei urgent (Story 2.4)
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
 *
 * **Story 2.4 AC1, AC2, AC3, AC4, AC5:**
 * - AC1: Sound-Eskalation nach 60 Sekunden (warning → urgent)
 * - AC2: FloatingPill wird aktiviert (schwebt ueber anderen UI-Elementen)
 * - AC3: Rote pulsierende Farbe (animate-pulse-urgent)
 * - AC4: FloatingPill stoppt bei Acknowledge/Snooze
 * - AC5: FloatingPill verschwindet bei Status-Wechsel
 */

import { useCallback, useEffect, useRef } from 'react';
import type { ErinnerungResponseDto } from '@bluelight-hub/shared/client';
import { logger } from '@/shared/lib/logger';
import { toast } from 'sonner';
import { useTriggerErinnerung } from '../api';
import { timerService, soundService, sendErinnerungNotification, sendIntensifiedNotification, requestNotificationPermission, intensificationService } from '../services';
import { type IntensityLevel, setAudioFailed } from '../stores/intensification.store';
import { showFloatingPill, hideFloatingPill } from '../stores/floating-pill.store';

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

  // CQ-4: Ref fuer mutateAsync um Effect-Loop zu vermeiden
  //
  // Pattern-Erklaerung:
  // - triggerMutation.mutateAsync aendert sich bei State-Aenderungen (isPending, isError, etc.)
  // - Wenn wir mutateAsync direkt in useCallback Dependencies verwenden wuerden,
  //   wuerde executeTriggerSequence bei jedem State-Wechsel neu erstellt werden
  // - Das wuerde wiederum den Timer-Effect re-triggern (infinite loop)
  //
  // Loesung:
  // - Ref mit initialem Wert erstellen
  // - Bei JEDEM Render den Ref aktualisieren (Zeile darunter)
  // - Im Callback ueber mutateAsyncRef.current zugreifen
  // - So ist der Callback stabil, aber nutzt immer die aktuelle mutateAsync Funktion
  const mutateAsyncRef = useRef(triggerMutation.mutateAsync);
  mutateAsyncRef.current = triggerMutation.mutateAsync; // Immer aktuell halten!

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

      // Story 2.4 AC2: FloatingPill bei urgent Level aktivieren
      if (level === 'urgent') {
        logger.info(`[AlarmTrigger] Story 2.4: Activating FloatingPill for: ${erinnerung.titel}`);
        showFloatingPill(erinnerung.id, {
          titel: erinnerung.titel,
          // Nutze ausgeloestAm wenn vorhanden, sonst faelligAm als Fallback
          ausgeloestAm: erinnerung.ausgeloestAm ?? erinnerung.faelligAm,
        });
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
      let soundResult: { success: boolean; error?: string; fallbackUsed?: boolean } = { success: false };
      try {
        soundResult = await soundService.playAlarm('info');
        soundSuccess = soundResult.success;
        if (!soundSuccess) {
          logger.warn(`[AlarmTrigger] Sound failed (non-critical): ${soundResult.error}`);
        }
        // Story 2.8 AC3: Log Fallback-Nutzung
        if (soundResult.fallbackUsed) {
          logger.info(`[AlarmTrigger] Used Web Audio fallback for ${erinnerung.id}`);
        }
      } catch (err) {
        logger.warn(`[AlarmTrigger] Sound failed (non-critical): ${err}`);
      }

      // Story 2.8 AC2: Toast und visuelle Verstaerkung bei totalem Audio-Ausfall
      // WICHTIG: Dieser Block darf NICHT die Funktion beenden (kein return),
      // da der API-Call danach noch passieren muss!
      if (soundResult.error) {
        // Story 2.8 CR Fix: audioFailed Flag nur setzen wenn Erinnerung bereits AUSGELOEST ist.
        // Bei neuem Trigger (GEPLANT -> AUSGELOEST) wird das Flag nach dem API-Call gesetzt.
        // Hinweis: Wir setzen das Flag jetzt immer, da der API-Call gleich kommt.
        setAudioFailed(erinnerung.id, true);

        // FloatingPill sofort aktivieren da kein Audio
        logger.info(`[AlarmTrigger] Story 2.8: Audio-Ausfall - Aktiviere FloatingPill sofort fuer: ${erinnerung.titel}`);
        showFloatingPill(erinnerung.id, {
          titel: erinnerung.titel,
          ausgeloestAm: erinnerung.ausgeloestAm ?? erinnerung.faelligAm,
        });

        toast.error('Audio nicht verfügbar', {
          description: `${erinnerung.titel} - Bitte Lautsprecher prüfen. Der visuelle Alarm wurde verstärkt.`,
          duration: 10000,
        });
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
        //
        // CQ-3 Dokumentation: Wir nutzen Date.now() statt ausgeloestAm aus dem API-Response.
        // Gruende:
        // 1. Das API-Response DTO enthaelt zwar ausgeloestAm, aber es ist zu diesem Zeitpunkt
        //    noch nicht im lokalen erinnerung-Objekt aktualisiert (erst nach Cache-Invalidation).
        // 2. Die API-Latenz wuerde die Intensivierung sonst um die Roundtrip-Zeit verzögern.
        // 3. Fuer die UX ist es besser, wenn die 30s Intensivierung ab dem Zeitpunkt startet,
        //    an dem der User den Sound/Notification erhalten hat, nicht ab Backend-Zeitstempel.
        // 4. Bei Netzwerk-Latenzen (z.B. 2s) wuerde der User sonst nur 28s bis zur Eskalation haben.
        intensificationService.startTimer(erinnerung.id, Date.now(), handleIntensification);

        callbacksRef.current.onTriggerSuccess?.(erinnerung);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error(`[AlarmTrigger] API trigger failed: ${erinnerung.id}`, error);

        // Bug Fix: Bei API-Fehler die Erinnerung aus triggeredIds entfernen,
        // damit sie beim naechsten Check erneut getriggert werden kann.
        // Ohne diesen Reset bleibt die Erinnerung "stuck" im GEPLANT Status.
        timerService.resetTriggered(erinnerung.id);

        callbacksRef.current.onTriggerError?.(erinnerung, err);
      }
    },
    [handleIntensification], // handleIntensification ist stabil (leeres Dependency Array)
  );

  // Timer starten/stoppen basierend auf enabled und erinnerungen
  useEffect(() => {
    console.info(`[useAlarmTrigger] Effect: enabled=${enabled}, erinnerungen.length=${erinnerungen.length}, einsatzId=${einsatzId}`);

    if (!enabled || !erinnerungen.length) {
      console.warn(`[useAlarmTrigger] Timer NOT started: enabled=${enabled}, count=${erinnerungen.length}`);
      timerService.stop();
      // Story 2.3: Alle Intensification Timer stoppen
      intensificationService.stopAllTimers();
      return;
    }

    console.info(`[useAlarmTrigger] Starting timer with ${erinnerungen.length} erinnerungen`);

    // C5 Fix: Timer starten mit Trigger-Callback und einsatzId
    timerService.start(erinnerungen, einsatzId, (erinnerung) => {
      console.info(`[useAlarmTrigger] Timer callback for: ${erinnerung.titel}`);
      // Async in Callback starten (nicht blockierend)
      executeTriggerSequence(erinnerung);
    });

    // Cleanup bei Unmount oder Dependency-Change
    return () => {
      timerService.stop();
      // Story 2.3: Alle Intensification Timer stoppen
      intensificationService.stopAllTimers();
      // Story 2.8 CR Fix: Clear audioFailed flags to prevent memory leak
      for (const erinnerung of erinnerungen) {
        setAudioFailed(erinnerung.id, false);
      }
    };
  }, [enabled, erinnerungen, einsatzId, executeTriggerSequence]);

  // Erinnerungen aktualisieren ohne Timer-Neustart
  useEffect(() => {
    if (enabled && timerService.isRunning()) {
      // C5 Fix: updateErinnerungen mit einsatzId
      timerService.updateErinnerungen(erinnerungen, einsatzId);
    }
  }, [erinnerungen, einsatzId, enabled]);

  // Story 2.3 AC5 + Story 2.4 AC5: Timer und FloatingPill stoppen wenn Status nicht mehr AUSGELOEST
  // Wenn eine Erinnerung per WebSocket den Status aendert (z.B. AUSGELOEST → ERLEDIGT),
  // muessen Intensification Timer und FloatingPill gestoppt werden.
  // UPDATE: ESKALIERT Status soll Intensivierung/Pill NICHT stoppen (damit Acknowledge möglich bleibt)
  useEffect(() => {
    for (const erinnerung of erinnerungen) {
      // Pruefe ob die Erinnerung NICHT mehr AUSGELOEST oder ESKALIERT ist,
      // aber noch einen aktiven Intensification Timer hat
      const isActiveAlarm = erinnerung.status === 'AUSGELOEST' || erinnerung.status === 'ESKALIERT';

      if (!isActiveAlarm && intensificationService.hasActiveTimer(erinnerung.id)) {
        logger.info(`[AlarmTrigger] AC5: Status nicht mehr AUSGELOEST/ESKALIERT, stoppe Timer fuer: ${erinnerung.id}`);
        intensificationService.stopTimer(erinnerung.id);

        // Story 2.4 AC5: FloatingPill ebenfalls entfernen
        hideFloatingPill(erinnerung.id);
      }
    }
  }, [erinnerungen]);

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
     * Story 2.4 AC4: Stoppt auch die FloatingPill.
     */
    resetTriggered: (erinnerungId: string) => {
      timerService.resetTriggered(erinnerungId);
      // Story 2.3 AC4: Intensification Timer stoppen bei Snooze
      intensificationService.stopTimer(erinnerungId);
      // Story 2.4 AC4: FloatingPill entfernen
      hideFloatingPill(erinnerungId);
    },

    /**
     * Stoppt den Intensification Timer fuer eine Erinnerung (Story 2.3 AC4)
     *
     * Wird aufgerufen bei Acknowledge oder Snooze.
     * Story 2.4 AC4: Stoppt auch die FloatingPill.
     */
    stopIntensification: (erinnerungId: string) => {
      intensificationService.stopTimer(erinnerungId);
      // Story 2.4 AC4: FloatingPill entfernen
      hideFloatingPill(erinnerungId);
    },
  };
}
