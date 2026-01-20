/**
 * Timer Service fuer Erinnerungs-Ueberwachung
 *
 * Ueberwacht faellige Erinnerungen und triggert Callbacks bei Faelligkeit.
 * Das Check-Interval von 500ms garantiert eine Latenz <1s (NFR1).
 *
 * **Story 1.5 AC1, AC6:**
 * - Polling-Interval: 500ms
 * - Trigger-Logik: faelligAm <= Date.now() UND status === 'GEPLANT'
 * - Deduplizierung ueber triggered Set (verhindert Mehrfach-Ausloesung)
 */

import type { ErinnerungResponseDto, ErinnerungResponseDtoStatusEnum } from '@bluelight-hub/shared/client';

/** Check-Interval in Millisekunden (500ms fuer <1s Latenz-Garantie) */
const CHECK_INTERVAL_MS = 500;

/** Status-Wert fuer geplante Erinnerungen */
const GEPLANT_STATUS: ErinnerungResponseDtoStatusEnum = 'GEPLANT';

/**
 * Callback-Typ fuer Erinnerungs-Trigger
 *
 * Wird aufgerufen wenn eine Erinnerung faellig wird.
 *
 * @param erinnerung - Die ausgeloeste Erinnerung
 */
export type OnTriggerCallback = (erinnerung: ErinnerungResponseDto) => void;

/**
 * Timer Service Klasse
 *
 * Verwaltet die Ueberwachung von Erinnerungen und triggert Callbacks
 * wenn eine Erinnerung faellig wird. Nutzt Set fuer Deduplizierung
 * um Mehrfach-Ausloesung zu verhindern.
 *
 * **C5 Fix:** Singleton unterstuetzt nun einsatzId-Context um Race Conditions
 * zwischen mehreren Hooks zu vermeiden.
 *
 * @example
 * ```typescript
 * const timer = new TimerService();
 *
 * timer.start(erinnerungen, einsatzId, (erinnerung) => {
 *   console.log('Erinnerung faellig:', erinnerung.titel);
 * });
 *
 * // Spaeter stoppen
 * timer.stop();
 * ```
 */
export class TimerService {
  /** Interval ID fuer clearInterval */
  private intervalId: ReturnType<typeof setInterval> | null = null;

  /** Set der bereits getriggerten Erinnerungs-IDs (Deduplizierung) */
  private triggeredIds: Set<string> = new Set();

  /** Aktuelle Erinnerungen fuer die Ueberwachung */
  private currentErinnerungen: ErinnerungResponseDto[] = [];

  /** Aktueller Trigger-Callback */
  private onTriggerCallback: OnTriggerCallback | null = null;

  /** C5 Fix: Aktueller Einsatz-Context (verhindert Race Conditions) */
  private currentEinsatzId: string | null = null;

  /**
   * Startet die Timer-Ueberwachung fuer gegebene Erinnerungen
   *
   * Stoppt automatisch einen vorherigen Timer falls vorhanden.
   * Prueft alle 500ms ob Erinnerungen faellig sind.
   *
   * **WICHTIG:** Bei gleichem einsatzId werden triggeredIds NICHT geloescht,
   * um Mehrfach-Ausloesung bei Query-Refetch zu verhindern.
   *
   * @param erinnerungen - Liste der zu ueberwachenden Erinnerungen
   * @param einsatzId - C5 Fix: Einsatz-ID fuer Context-Tracking
   * @param onTrigger - Callback bei Faelligkeit einer Erinnerung
   */
  start(erinnerungen: ErinnerungResponseDto[], einsatzId: string, onTrigger: OnTriggerCallback): void {
    // Prüfe ob gleicher Einsatz - wenn ja, behalte triggeredIds für Deduplizierung
    const sameEinsatz = this.currentEinsatzId === einsatzId;

    // Stoppe vorherigen Timer falls vorhanden (aber ohne triggeredIds zu clearen bei gleichem Einsatz)
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Nur bei Einsatz-Wechsel triggeredIds clearen
    if (!sameEinsatz) {
      this.triggeredIds.clear();
    }

    // Speichere aktuelle Konfiguration
    this.currentErinnerungen = erinnerungen;
    this.currentEinsatzId = einsatzId;
    this.onTriggerCallback = onTrigger;

    // Starte Interval-basierte Ueberwachung
    this.intervalId = setInterval(() => {
      this.checkErinnerungen();
    }, CHECK_INTERVAL_MS);

    // Sofortiger erster Check
    this.checkErinnerungen();
  }

  /**
   * Stoppt die Timer-Ueberwachung
   *
   * Loescht den Interval und setzt den internen Zustand zurueck.
   * Kann sicher mehrfach aufgerufen werden.
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Reset internal state
    this.currentErinnerungen = [];
    this.onTriggerCallback = null;
    this.triggeredIds.clear();
  }

  /**
   * Aktualisiert die ueberwachten Erinnerungen ohne Timer-Neustart
   *
   * Nuetzlich wenn Erinnerungen von aussen aktualisiert werden
   * (z.B. nach Query-Refetch oder Mutation).
   *
   * **C5 Fix:** Prueft ob einsatzId-Context uebereinstimmt bevor Update erfolgt.
   *
   * @param erinnerungen - Neue Liste der zu ueberwachenden Erinnerungen
   * @param einsatzId - C5 Fix: Einsatz-ID fuer Context-Validierung
   */
  updateErinnerungen(erinnerungen: ErinnerungResponseDto[], einsatzId: string): void {
    // C5 Fix: Ignore updates from wrong context
    if (this.currentEinsatzId !== einsatzId) {
      return;
    }

    this.currentErinnerungen = erinnerungen;
  }

  /**
   * Entfernt eine Erinnerung aus der Triggered-Liste
   *
   * Erlaubt erneutes Triggern einer Erinnerung (z.B. nach Snooze).
   *
   * @param id - ID der Erinnerung zum Entfernen
   */
  resetTriggered(id: string): void {
    this.triggeredIds.delete(id);
  }

  /**
   * Gibt zurueck ob der Timer aktuell laeuft
   *
   * @returns true wenn der Timer aktiv ist
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Gibt die Anzahl der bereits getriggerten Erinnerungen zurueck
   *
   * Nuetzlich fuer Debugging und Tests.
   *
   * @returns Anzahl der getriggerten Erinnerungen
   */
  getTriggeredCount(): number {
    return this.triggeredIds.size;
  }

  /**
   * Prueft alle Erinnerungen auf Faelligkeit und triggert Callbacks
   *
   * Interne Methode die vom Interval aufgerufen wird.
   * Filtert auf GEPLANT Status und prueft ob faelligAm <= jetzt.
   */
  private checkErinnerungen(): void {
    if (!this.onTriggerCallback) {
      return;
    }

    const now = Date.now();

    for (const erinnerung of this.currentErinnerungen) {
      // Nur GEPLANT Status beruecksichtigen
      if (erinnerung.status !== GEPLANT_STATUS) {
        continue;
      }

      // Bereits getriggerte ueberspringen (Deduplizierung)
      if (this.triggeredIds.has(erinnerung.id)) {
        continue;
      }

      // Faelligkeitspruefung: faelligAm <= now
      const faelligAmTimestamp = new Date(erinnerung.faelligAm).getTime();
      if (faelligAmTimestamp <= now) {
        // Als getriggert markieren (Deduplizierung)
        this.triggeredIds.add(erinnerung.id);

        // Callback ausfuehren
        this.onTriggerCallback(erinnerung);
      }
    }
  }
}

/**
 * Singleton-Instanz des Timer Service
 *
 * Fuer einfache Verwendung ohne manuelle Instanziierung.
 *
 * @example
 * ```typescript
 * import { timerService } from './timer.service';
 *
 * timerService.start(erinnerungen, onTrigger);
 * ```
 */
export const timerService = new TimerService();
