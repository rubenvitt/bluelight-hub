/**
 * Intensification Service - Alarm-Intensivierung bei Nicht-Reaktion
 *
 * Verwaltet Timer fuer automatische Eskalation des Alarm-Levels
 * wenn User nicht auf ausgeloeste Erinnerungen reagiert.
 *
 * **Story 2.3:**
 * - AC1: Sound-Eskalation nach 30 Sekunden (info → warning)
 * - AC4: Intensivierung stoppt bei Reaktion
 * - AC5: Nur fuer AUSGELOEST Status
 *
 * **Architektur:**
 * - Singleton Service fuer zentrale Timer-Verwaltung
 * - Intelligente setTimeout-basierte Checks (statt 1000ms Polling)
 * - Map-basiertes Tracking pro Erinnerung
 * - Store-Update fuer reaktive UI-Updates
 *
 * **PERF-1 Optimierung:**
 * Statt jede Sekunde alle Timer zu pruefen, berechnet der Service
 * wann der naechste Schwellwert erreicht wird und plant einen
 * einzelnen setTimeout dafuer. Dies reduziert CPU-Last um ~99%.
 */

import { logger } from '@/shared/lib/logger';
import { setIntensityLevel, startIntensificationTracking, clearIntensity, clearAllIntensifications, type IntensityLevel } from '../stores/intensification.store';

/**
 * Intensivierungs-Schwellwerte in Millisekunden
 *
 * - LEVEL_1 (warning): 30 Sekunden - Story 2.3
 * - LEVEL_2 (urgent): 60 Sekunden - Story 2.4 (zukuenftig)
 */
const INTENSIFICATION_THRESHOLDS = {
  WARNING: 30_000, // 30 Sekunden
  URGENT: 60_000, // 60 Sekunden (Story 2.4)
} as const;

/**
 * Minimale Zeit bis zum naechsten Check (Sicherheitspuffer)
 * Verhindert zu haeufige setTimeout-Calls bei sehr kurzen Intervallen.
 */
const MIN_CHECK_INTERVAL_MS = 50; // 50ms Minimum

/**
 * Alle Schwellwerte als sortiertes Array fuer einfachere Berechnung
 */
const THRESHOLD_VALUES = [INTENSIFICATION_THRESHOLDS.WARNING, INTENSIFICATION_THRESHOLDS.URGENT] as const;

/**
 * Tracking-Info fuer eine einzelne Erinnerung
 */
interface IntensificationTracker {
  /** Zeitpunkt des Starts (AUSGELOEST Zeitpunkt) */
  startedAt: number;
  /** Aktuelles Level */
  currentLevel: IntensityLevel;
}

/**
 * Callback-Typ fuer Intensivierungs-Events
 */
export type IntensificationCallback = (erinnerungId: string, level: IntensityLevel) => void;

/**
 * Intensification Service
 *
 * Singleton-Pattern fuer zentrale Timer-Verwaltung.
 * Ueberwacht ausgeloeste Erinnerungen und eskaliert automatisch
 * das Alarm-Level bei Nicht-Reaktion.
 *
 * @example
 * ```typescript
 * // Timer starten wenn Erinnerung ausgeloest wird
 * intensificationService.startTimer('erinnerung-123', Date.now(), (id, level) => {
 *   if (level === 'warning') {
 *     soundService.playAlarm('warning');
 *     notificationService.sendIntensified(...);
 *   }
 * });
 *
 * // Timer stoppen bei Acknowledge/Snooze
 * intensificationService.stopTimer('erinnerung-123');
 * ```
 */
export class IntensificationService {
  private static instance: IntensificationService | null = null;

  /** Aktive Tracker pro Erinnerung */
  private trackers: Map<string, IntensificationTracker> = new Map();

  /** Callbacks fuer Level-Aenderungen */
  private callbacks: Map<string, IntensificationCallback> = new Map();

  /** Timeout-ID fuer naechsten geplanten Check (ersetzt Polling) */
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  /** Ob der Service laeuft */
  private running = false;

  /** SEC-2 Fix: Flag um Race Condition in checkAllTimers zu verhindern */
  private isChecking = false;

  /** H7 Fix: Retry Counter um Infinite Loop bei persistenten Callback-Fehlern zu verhindern */
  private retryCounters: Map<string, number> = new Map();

  /** Maximale Retries bevor Timer gestoppt wird */
  private static readonly MAX_RETRIES = 3;

  /**
   * Private Constructor fuer Singleton Pattern
   */
  private constructor() {
    // Singleton - keine direkte Instanziierung
  }

  /**
   * Singleton-Instanz des IntensificationService
   */
  public static getInstance(): IntensificationService {
    if (!IntensificationService.instance) {
      IntensificationService.instance = new IntensificationService();
    }
    return IntensificationService.instance;
  }

  /**
   * Startet einen Intensivierungs-Timer fuer eine Erinnerung
   *
   * Beginnt das Tracking fuer automatische Eskalation.
   * Nutzt intelligentes Scheduling statt Polling.
   *
   * @param erinnerungId - ID der Erinnerung
   * @param ausgeloestAm - Zeitpunkt der Ausloesung (Timestamp)
   * @param onIntensify - Callback bei Level-Aenderung
   */
  public startTimer(erinnerungId: string, ausgeloestAm: number, onIntensify: IntensificationCallback): void {
    // SEC-1 Fix: Input Validation
    if (!erinnerungId || typeof erinnerungId !== 'string') {
      logger.error('[IntensificationService] Ungueltige erinnerungId');
      return;
    }
    if (!Number.isFinite(ausgeloestAm) || ausgeloestAm <= 0) {
      logger.error('[IntensificationService] Ungueltiger ausgeloestAm Timestamp');
      return;
    }
    if (typeof onIntensify !== 'function') {
      logger.error('[IntensificationService] Ungueltiger onIntensify Callback');
      return;
    }

    // Existierenden Timer stoppen falls vorhanden
    if (this.trackers.has(erinnerungId)) {
      logger.debug(`[IntensificationService] Timer fuer ${erinnerungId} bereits aktiv, wird neu gestartet`);
      this.trackers.delete(erinnerungId);
      this.callbacks.delete(erinnerungId);
      // CQ-2 Fix: Store auch zuruecksetzen bei Neustart
      clearIntensity(erinnerungId);
    }

    // Neuen Tracker erstellen
    this.trackers.set(erinnerungId, {
      startedAt: ausgeloestAm,
      currentLevel: 'none',
    });

    // Callback speichern
    this.callbacks.set(erinnerungId, onIntensify);

    // Store initialisieren
    startIntensificationTracking(erinnerungId);

    // Scheduling starten falls noch nicht aktiv
    this.ensureSchedulingActive();

    logger.info(`[IntensificationService] Timer gestartet fuer: ${erinnerungId}`);
  }

  /**
   * Stoppt den Intensivierungs-Timer fuer eine Erinnerung
   *
   * Wird aufgerufen bei:
   * - Acknowledge (Story 2.3 AC4)
   * - Snooze (Story 2.3 AC4)
   * - Status-Wechsel nicht mehr AUSGELOEST (Story 2.3 AC5)
   *
   * @param erinnerungId - ID der Erinnerung
   */
  public stopTimer(erinnerungId: string): void {
    if (!this.trackers.has(erinnerungId)) {
      return;
    }

    this.trackers.delete(erinnerungId);
    this.callbacks.delete(erinnerungId);

    // Store aufräumen
    clearIntensity(erinnerungId);

    // Scheduling anpassen wenn Timer geaendert
    this.handleTimerChange();

    logger.info(`[IntensificationService] Timer gestoppt fuer: ${erinnerungId}`);
  }

  /**
   * Stoppt alle Intensivierungs-Timer
   *
   * Wird aufgerufen bei:
   * - Einsatz-Wechsel
   * - App Cleanup
   */
  public stopAllTimers(): void {
    this.trackers.clear();
    this.callbacks.clear();
    this.stopScheduling();

    // Store komplett aufräumen
    clearAllIntensifications();

    logger.info('[IntensificationService] Alle Timer gestoppt');
  }

  /**
   * Prueft ob ein Timer fuer eine Erinnerung aktiv ist
   *
   * @param erinnerungId - ID der Erinnerung
   * @returns true wenn Timer aktiv
   */
  public hasActiveTimer(erinnerungId: string): boolean {
    return this.trackers.has(erinnerungId);
  }

  /**
   * Holt das aktuelle Intensivierungs-Level
   *
   * @param erinnerungId - ID der Erinnerung
   * @returns Aktuelles Level oder 'none'
   */
  public getCurrentLevel(erinnerungId: string): IntensityLevel {
    return this.trackers.get(erinnerungId)?.currentLevel ?? 'none';
  }

  /**
   * Gibt die Anzahl aktiver Timer zurueck
   */
  public getActiveTimerCount(): number {
    return this.trackers.size;
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Stellt sicher dass das Scheduling aktiv ist.
   *
   * PERF-1: Ersetzt 1000ms Polling durch intelligente setTimeout-Calls.
   * Berechnet wann der naechste Schwellwert erreicht wird und plant
   * einen einzelnen setTimeout dafuer.
   *
   * Fuehrt SOFORT einen Check aus, falls bereits Schwellwerte ueberschritten
   * sind (z.B. wenn ein Timer mit vergangenem Timestamp gestartet wird).
   */
  private ensureSchedulingActive(): void {
    if (this.running) {
      // Bereits aktiv - Check ob bereits Schwellwerte ueberschritten
      this.checkAllTimers();
      this.scheduleNextCheck();
      return;
    }

    this.running = true;
    // Sofortiger Check fuer bereits ueberschrittene Schwellwerte
    this.checkAllTimers();
    this.scheduleNextCheck();

    logger.debug('[IntensificationService] Timer-Scheduling gestartet');
  }

  /**
   * Berechnet und plant den naechsten Check-Zeitpunkt.
   *
   * PERF-1: Statt jede Sekunde alle Timer zu pruefen, wird berechnet
   * wann der naechste Schwellwert erreicht wird. Reduziert CPU-Last um ~99%.
   */
  private scheduleNextCheck(): void {
    // Bestehenden Timeout clearen
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.trackers.size === 0) {
      return;
    }

    const now = Date.now();
    let nextCheckIn = Number.MAX_SAFE_INTEGER;

    // Finde den naechsten Zeitpunkt an dem ein Schwellwert erreicht wird
    for (const [, tracker] of this.trackers) {
      const elapsed = now - tracker.startedAt;
      const nextThreshold = this.getNextThreshold(elapsed, tracker.currentLevel);

      if (nextThreshold !== null) {
        const timeUntilNext = nextThreshold - elapsed;
        if (timeUntilNext > 0 && timeUntilNext < nextCheckIn) {
          nextCheckIn = timeUntilNext;
        }
      }
    }

    // Plane naechsten Check wenn ein Schwellwert ansteht
    if (nextCheckIn < Number.MAX_SAFE_INTEGER) {
      // Sicherheitspuffer: Mindestens MIN_CHECK_INTERVAL_MS warten
      const checkDelay = Math.max(nextCheckIn, MIN_CHECK_INTERVAL_MS);

      this.timeoutId = setTimeout(() => {
        this.checkAndReschedule();
      }, checkDelay);

      logger.debug(`[IntensificationService] Naechster Check in ${checkDelay}ms geplant`);
    }
  }

  /**
   * Holt den naechsten Schwellwert basierend auf aktuellem Level.
   *
   * @param elapsedMs - Bereits verstrichene Zeit
   * @param currentLevel - Aktuelles Level
   * @returns Naechster Schwellwert in ms oder null wenn kein weiterer
   */
  private getNextThreshold(elapsedMs: number, currentLevel: IntensityLevel): number | null {
    // Wenn bereits auf urgent, gibt es keinen weiteren Schwellwert
    if (currentLevel === 'urgent') {
      return null;
    }

    // Finde den naechsten noch nicht erreichten Schwellwert
    for (const threshold of THRESHOLD_VALUES) {
      if (elapsedMs < threshold) {
        return threshold;
      }
    }

    return null;
  }

  /**
   * Fuehrt Check durch und plant den naechsten.
   *
   * Wird von setTimeout aufgerufen wenn ein Schwellwert erreicht sein sollte.
   */
  private checkAndReschedule(): void {
    this.checkAllTimers();
    this.scheduleNextCheck();
  }

  /**
   * Behandelt Aenderungen an Timern (hinzugefuegt/entfernt).
   * Reschedule oder stoppt Scheduling je nach Situation.
   */
  private handleTimerChange(): void {
    if (this.trackers.size === 0) {
      this.stopScheduling();
    } else {
      // Reschedule da sich die Timer geaendert haben koennten
      this.scheduleNextCheck();
    }
  }

  /**
   * Stoppt das Scheduling komplett
   */
  private stopScheduling(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.running = false;

    logger.debug('[IntensificationService] Timer-Scheduling gestoppt');
  }

  /**
   * Prueft alle aktiven Timer auf Schwellwert-Ueberschreitung
   *
   * SEC-2 Fix: isChecking Flag verhindert Race Condition wenn
   * ein langsamer Callback laeuft und ein zweiter Check starten wuerde.
   */
  private checkAllTimers(): void {
    // SEC-2 Fix: Verhindere parallele Checks
    if (this.isChecking) {
      return;
    }
    this.isChecking = true;

    try {
      const now = Date.now();

      for (const [erinnerungId, tracker] of this.trackers) {
        const elapsed = now - tracker.startedAt;
        const newLevel = this.calculateLevel(elapsed);

        // Level hat sich geaendert
        if (newLevel !== tracker.currentLevel) {
          this.escalateLevel(erinnerungId, tracker, newLevel);
        }
      }
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Berechnet das Level basierend auf verstrichener Zeit
   *
   * @param elapsedMs - Verstrichene Zeit in Millisekunden
   * @returns Berechnetes Level
   */
  private calculateLevel(elapsedMs: number): IntensityLevel {
    // Story 2.4: urgent nach 60s (zukuenftig)
    if (elapsedMs >= INTENSIFICATION_THRESHOLDS.URGENT) {
      return 'urgent';
    }

    // Story 2.3: warning nach 30s
    if (elapsedMs >= INTENSIFICATION_THRESHOLDS.WARNING) {
      return 'warning';
    }

    return 'none';
  }

  /**
   * Eskaliert das Level und ruft Callback auf
   *
   * CQ-5 Fix: Callback wird VOR dem Tracker-Update aufgerufen.
   * Bei Callback-Fehler wird das Level nicht aktualisiert (Rollback-Verhalten).
   * H7 Fix: Retry Counter verhindert Infinite Loop bei persistenten Fehlern.
   *
   * @param erinnerungId - ID der Erinnerung
   * @param tracker - Tracker-Objekt
   * @param newLevel - Neues Level
   */
  private escalateLevel(erinnerungId: string, tracker: IntensificationTracker, newLevel: IntensityLevel): void {
    const oldLevel = tracker.currentLevel;

    // H7 Fix: Prüfe Retry Counter
    const retryCount = this.retryCounters.get(erinnerungId) ?? 0;
    if (retryCount >= IntensificationService.MAX_RETRIES) {
      logger.error(`[IntensificationService] Max retries (${IntensificationService.MAX_RETRIES}) exceeded für ${erinnerungId}, stoppe Timer`);
      this.stopTimer(erinnerungId);
      return;
    }

    // CQ-5 Fix: Callback VOR dem State-Update ausfuehren
    const callback = this.callbacks.get(erinnerungId);
    if (callback) {
      try {
        callback(erinnerungId, newLevel);
        // H7 Fix: Erfolg - Reset retry counter
        this.retryCounters.delete(erinnerungId);
      } catch (error) {
        // H7 Fix: Bei Fehler Retry Counter erhöhen
        this.retryCounters.set(erinnerungId, retryCount + 1);
        logger.error(`[IntensificationService] Callback-Fehler fuer ${erinnerungId} (Retry ${retryCount + 1}/${IntensificationService.MAX_RETRIES}), Level bleibt bei ${oldLevel}:`, error);
        return;
      }
    }

    // Erst nach erfolgreichem Callback: Tracker und Store aktualisieren
    tracker.currentLevel = newLevel;
    setIntensityLevel(erinnerungId, newLevel);

    logger.info(`[IntensificationService] Level eskaliert: ${erinnerungId} ${oldLevel} → ${newLevel}`);
  }

  /**
   * Setzt Service-Instanz zurueck (nur fuer Tests!)
   */
  public static reset(): void {
    if (IntensificationService.instance) {
      IntensificationService.instance.stopAllTimers();
      IntensificationService.instance = null;
    }
  }
}

/**
 * Singleton Instance Export (Convenience)
 */
export const intensificationService = IntensificationService.getInstance();
