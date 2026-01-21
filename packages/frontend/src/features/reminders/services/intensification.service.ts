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
 * - 1000ms Polling-Interval fuer praezise 30s Erkennung
 * - Map-basiertes Tracking pro Erinnerung
 * - Store-Update fuer reaktive UI-Updates
 */

import { logger } from '@/shared/lib/logger';
import { setIntensityLevel, startIntensificationTracking, clearIntensity, clearAllIntensifications, getIntensityLevel, type IntensityLevel } from '../stores/intensification.store';

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
 * Polling-Interval fuer Timer-Checks
 */
const CHECK_INTERVAL_MS = 1000; // 1 Sekunde

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

  /** Interval-ID fuer Polling */
  private intervalId: ReturnType<typeof setInterval> | null = null;

  /** Ob der Service laeuft */
  private running = false;

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
   * Der Timer prueft jede Sekunde ob Schwellwerte erreicht wurden.
   *
   * @param erinnerungId - ID der Erinnerung
   * @param ausgeloestAm - Zeitpunkt der Ausloesung (Timestamp)
   * @param onIntensify - Callback bei Level-Aenderung
   */
  public startTimer(erinnerungId: string, ausgeloestAm: number, onIntensify: IntensificationCallback): void {
    // Existierenden Timer stoppen falls vorhanden
    if (this.trackers.has(erinnerungId)) {
      logger.debug(`[IntensificationService] Timer fuer ${erinnerungId} bereits aktiv, wird neu gestartet`);
      this.trackers.delete(erinnerungId);
      this.callbacks.delete(erinnerungId);
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

    // Polling starten falls noch nicht aktiv
    this.ensurePollingActive();

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

    // Polling stoppen wenn keine Timer mehr aktiv
    this.stopPollingIfEmpty();

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
    this.stopPolling();

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
   * Stellt sicher dass das Polling aktiv ist
   */
  private ensurePollingActive(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.intervalId = setInterval(() => {
      this.checkAllTimers();
    }, CHECK_INTERVAL_MS);

    logger.debug('[IntensificationService] Polling gestartet');
  }

  /**
   * Stoppt das Polling wenn keine Timer mehr aktiv
   */
  private stopPollingIfEmpty(): void {
    if (this.trackers.size === 0) {
      this.stopPolling();
    }
  }

  /**
   * Stoppt das Polling
   */
  private stopPolling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;

    logger.debug('[IntensificationService] Polling gestoppt');
  }

  /**
   * Prueft alle aktiven Timer auf Schwellwert-Ueberschreitung
   */
  private checkAllTimers(): void {
    const now = Date.now();

    for (const [erinnerungId, tracker] of this.trackers) {
      const elapsed = now - tracker.startedAt;
      const newLevel = this.calculateLevel(elapsed);

      // Level hat sich geaendert
      if (newLevel !== tracker.currentLevel) {
        this.escalateLevel(erinnerungId, tracker, newLevel);
      }
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
   * @param erinnerungId - ID der Erinnerung
   * @param tracker - Tracker-Objekt
   * @param newLevel - Neues Level
   */
  private escalateLevel(erinnerungId: string, tracker: IntensificationTracker, newLevel: IntensityLevel): void {
    const oldLevel = tracker.currentLevel;
    tracker.currentLevel = newLevel;

    // Store aktualisieren
    setIntensityLevel(erinnerungId, newLevel);

    // Callback ausfuehren
    const callback = this.callbacks.get(erinnerungId);
    if (callback) {
      try {
        callback(erinnerungId, newLevel);
      } catch (error) {
        logger.error(`[IntensificationService] Callback-Fehler fuer ${erinnerungId}:`, error);
      }
    }

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
