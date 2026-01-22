/**
 * Sound Service - Erinnerungen Akustische Benachrichtigungen
 *
 * Hybrid Audio Pattern: Tauri Native Sounds primary, Web Audio API als Fallback.
 * Ermöglicht plattformübergreifende Alarmsounds für Erinnerungen.
 *
 * **Architektur:**
 * - Desktop (Tauri): Native Sound-Wiedergabe via Tauri invoke
 * - Browser (Testing): Web Audio API mit Sound-Files oder Graceful Degradation
 *
 * **Story 1.5 AC2:** Akustisches Feedback bei Erinnerungs-Trigger
 * **Story 2.7:** Audio-Einstellungen (Volume, Sound-Auswahl, Preview)
 */

import { isTauri } from '@tauri-apps/api/core';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/shared/lib/logger';
import { SOUND_FILES, toAudioVolume, type AlarmLevel, type SoundOption } from '@/features/settings/schemas';
import { getAudioSettings } from '@/features/settings/hooks';

/**
 * Sound Level für Erinnerungen
 *
 * - info: Dezenter Hinweiston (niedrige Priorität)
 * - warning: Aufmerksamkeitston (mittlere Priorität)
 * - urgent: Dringender Alarmton (hohe Priorität)
 */
export type SoundLevel = 'info' | 'warning' | 'urgent';

/**
 * Web Audio Error - Recoverable (könnte nach User-Interaktion funktionieren)
 *
 * **Story 2.8 AC2:** Autoplay blocked ist ein recoverable Error - der Sound
 * könnte nach einer User-Interaktion (z.B. Klick auf Button) funktionieren.
 */
export class WebAudioRecoverableError extends Error {
  readonly isRecoverable = true;
  constructor(message: string) {
    super(message);
    this.name = 'WebAudioRecoverableError';
  }
}

/**
 * Web Audio Error - Fatal (wird nie funktionieren)
 *
 * **Story 2.8 AC2:** Fatal Errors wie fehlende Dateien erfordern visuellen Alarm.
 */
export class WebAudioFatalError extends Error {
  readonly isRecoverable = false;
  constructor(message: string) {
    super(message);
    this.name = 'WebAudioFatalError';
  }
}

/**
 * Ergebnis einer Sound-Wiedergabe
 *
 * @property fallbackUsed - True wenn Web Audio als Fallback nach Tauri-Fehler genutzt wurde (Story 2.8)
 */
export interface SoundResult {
  success: boolean;
  error?: string;
  skipped?: boolean;
  fallbackUsed?: boolean;
}

/**
 * Web Audio Fallback State
 *
 * Caching der Audio-Elemente für schnellere Wiedergabe bei erneutem Abspielen.
 * Lazy initialisiert um Browser-Autoplay-Policies zu umgehen.
 */
interface WebAudioState {
  audioElements: Map<SoundLevel, HTMLAudioElement>;
  initialized: boolean;
}

/**
 * Sound Service für Erinnerungs-Alarme
 *
 * Singleton-Pattern für zentrale Sound-Verwaltung.
 * Hybrid-Architektur: Tauri Native oder Web Audio Fallback.
 *
 * @example
 * ```typescript
 * // Alarm abspielen
 * await soundService.playAlarm('warning');
 *
 * // Oder mit Error-Handling
 * const result = await soundService.playAlarm('urgent');
 * if (!result.success) {
 *   console.warn('Sound konnte nicht abgespielt werden:', result.error);
 * }
 * ```
 */
export class SoundService {
  private static instance: SoundService | null = null;
  private webAudioState: WebAudioState = {
    audioElements: new Map(),
    initialized: false,
  };

  /**
   * Private Constructor für Singleton Pattern
   */
  private constructor() {
    // Singleton - keine direkte Instanziierung
  }

  /**
   * Singleton-Instanz des SoundService.
   *
   * Verwendet Singleton Pattern um sicherzustellen, dass nur eine
   * Service-Instanz existiert und Audio-Ressourcen zentral verwaltet werden.
   */
  public static getInstance(): SoundService {
    if (!SoundService.instance) {
      SoundService.instance = new SoundService();
    }
    return SoundService.instance;
  }

  /**
   * Spielt einen Alarm-Sound basierend auf dem Sound-Level ab.
   *
   * Lädt Audio-Settings aus dem Tauri Store und spielt den konfigurierten
   * Sound mit der eingestellten Lautstärke ab. Bei deaktiviertem Audio
   * wird die Wiedergabe übersprungen.
   *
   * @param level - Sound-Level ('info' | 'warning' | 'urgent')
   * @returns Promise mit Erfolgs-Status und optionalem Fehler
   *
   * **Story 2.7 AC6:** Konfigurierte Töne bei Alarm nutzen
   */
  public async playAlarm(level: SoundLevel): Promise<SoundResult> {
    try {
      // Audio-Settings laden (Story 2.7 AC6)
      const settings = await getAudioSettings();

      // Globale Stummschaltung prüfen (Story 2.7 AC7)
      if (!settings.enabled) {
        logger.info(`[SoundService] Audio deaktiviert, überspringe Alarm: ${level}`);
        return { success: true, skipped: true };
      }

      const levelConfig = settings.levels[level as AlarmLevel];
      return this.playWithConfig(level, levelConfig.sound, levelConfig.volume);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      logger.warn(`[SoundService] Sound konnte nicht abgespielt werden (${level}): ${errorMessage}`);

      // Graceful Degradation: Log statt Fehler werfen
      logger.info(`[SoundService] Fallback: Alarm-Event für Level "${level}" (kein Sound verfügbar)`);

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Spielt einen Sound mit expliziter Konfiguration ab.
   *
   * Diese Methode erlaubt die direkte Steuerung von Sound-Auswahl und
   * Lautstärke ohne Zugriff auf den Settings-Store.
   *
   * @param level - Alarm-Level ('info' | 'warning' | 'urgent')
   * @param sound - Sound-Option ('default' | 'chime' | 'bell' | 'alert')
   * @param volume - Lautstärke (0-100)
   * @returns Promise mit Erfolgs-Status
   *
   * **Story 2.7 AC3:** Lautstärke-Einstellung pro Stufe
   * **Story 2.7 AC6:** Konfigurierte Töne bei Alarm nutzen
   */
  public async playWithConfig(level: SoundLevel, sound: SoundOption, volume: number): Promise<SoundResult> {
    try {
      const audioVolume = toAudioVolume(volume);
      const soundFile = SOUND_FILES[level as AlarmLevel][sound];

      if (isTauri()) {
        // Story 2.8 AC1: Tauri mit Fallback zu Web Audio
        try {
          await this.playTauriNativeSoundWithVolume(level, sound, audioVolume);
          logger.info(`[SoundService] Sound abgespielt: ${level}/${sound} @ ${volume}%`);
          return { success: true };
        } catch (tauriError) {
          // AC1: Bei Tauri-Fehler automatisch Web Audio Fallback
          const tauriErrorMessage = tauriError instanceof Error ? tauriError.message : 'Unbekannter Tauri-Fehler';
          logger.warn(`[SoundService] Tauri sound failed, using Web Audio fallback: ${tauriErrorMessage}`);

          // Fallback zu Web Audio
          const webAudioResult = await this.playWebAudioWithFallbackTracking(soundFile, audioVolume);
          if (webAudioResult.success) {
            logger.info(`[SoundService] Fallback erfolgreich: ${level}/${sound} @ ${volume}%`);
            return { success: true, fallbackUsed: true };
          }
          // Beide fehlgeschlagen → AC2 wird von Caller behandelt
          return { success: false, error: webAudioResult.error, fallbackUsed: true };
        }
      } else {
        // Nicht-Tauri Umgebung: Nur Web Audio
        await this.playWebAudioWithVolume(soundFile, audioVolume);
        logger.info(`[SoundService] Sound abgespielt: ${level}/${sound} @ ${volume}%`);
        return { success: true };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      logger.warn(`[SoundService] playWithConfig fehlgeschlagen: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Spielt eine Sound-Vorschau für die Einstellungs-UI ab.
   *
   * Identisch zu playWithConfig, aber mit explizitem Logging für
   * bessere Unterscheidung im Debug-Output.
   *
   * @param level - Alarm-Level
   * @param sound - Sound-Option
   * @param volume - Lautstärke (0-100)
   * @returns Promise mit Erfolgs-Status
   *
   * **Story 2.7 AC4:** Vorschau-Funktion
   */
  public async playPreview(level: SoundLevel, sound: SoundOption, volume: number): Promise<SoundResult> {
    logger.info(`[SoundService] Preview: ${level}/${sound} @ ${volume}%`);
    return this.playWithConfig(level, sound, volume);
  }

  /**
   * Spielt Sound über Tauri Native API mit Volume-Control ab.
   *
   * Nutzt Tauri invoke() um den Sound im Rust-Backend abzuspielen.
   * Volume wird als Float (0.0-1.0) an das Backend übergeben.
   *
   * @param level - Sound-Level für Tauri Backend
   * @param sound - Sound-Option für Custom Sound
   * @param volume - Lautstärke (0.0-1.0)
   * @throws Error wenn Tauri invoke fehlschlägt
   *
   * **Story 2.7 AC3:** Volume-Control für Tauri
   */
  private async playTauriNativeSoundWithVolume(level: SoundLevel, sound: SoundOption, volume: number): Promise<void> {
    // Volume clamping VOR Tauri invoke (Defense in Depth)
    const clampedVolume = Math.max(0, Math.min(1, volume));

    await invoke('play_sound', {
      soundType: level,
      volume: clampedVolume,
      soundFile: sound !== 'default' ? SOUND_FILES[level as AlarmLevel][sound] : undefined,
    });
  }

  /**
   * Spielt Sound über Web Audio API mit Fallback-Tracking (Story 2.8).
   *
   * Wie playWebAudioWithVolume(), aber gibt SoundResult zurück statt zu werfen.
   * Ermöglicht dem Caller zwischen recoverable und fatal Errors zu unterscheiden.
   *
   * @param soundFile - Pfad zur Sound-Datei
   * @param volume - Lautstärke (0.0-1.0)
   * @returns SoundResult mit success/error Status
   *
   * **Story 2.8 AC1:** Web Audio als Fallback nach Tauri-Fehler
   */
  private async playWebAudioWithFallbackTracking(soundFile: string, volume: number): Promise<SoundResult> {
    try {
      await this.playWebAudioWithVolume(soundFile, volume);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Web Audio Fehler';
      logger.warn(`[SoundService] Web Audio fallback failed: ${errorMessage}`);
      return { success: false, error: `Audio nicht verfügbar: ${errorMessage}` };
    }
  }

  /**
   * Spielt Sound über Web Audio API mit Volume-Control ab.
   *
   * Verwendet HTML5 Audio Element. Volume wird über audio.volume gesetzt.
   * Audio-Elemente werden nach Playback automatisch freigegeben (Memory Leak Prevention).
   *
   * **Story 2.8 AC2:** Unterscheidet zwischen recoverable und fatal Errors:
   * - Recoverable: Autoplay blocked (NotAllowedError) - könnte nach User-Interaktion funktionieren
   * - Fatal: File not found (NotSupportedError), AbortError - wird nie funktionieren
   *
   * @param soundFile - Pfad zur Sound-Datei
   * @param volume - Lautstärke (0.0-1.0)
   * @throws Error wenn Audio nicht abgespielt werden kann (mit Fehler-Typ für Caller)
   *
   * **Story 2.7 AC3:** Volume-Control für Web Audio
   * **Story 2.8 AC2:** Error-Unterscheidung für visuellen Alarm
   */
  private async playWebAudioWithVolume(soundFile: string, volume: number): Promise<void> {
    // Lazy Initialisierung des Web Audio State
    if (!this.webAudioState.initialized) {
      this.initializeWebAudio();
    }

    // Audio Element für diese spezifische Datei erstellen
    // (kein Caching, da verschiedene Sound-Optionen)
    const audio = new Audio(soundFile);
    audio.volume = Math.max(0, Math.min(1, volume)); // Clamp 0-1

    /**
     * Gibt Audio-Element Ressourcen frei.
     * Wird nach Playback-Ende oder bei Fehlern aufgerufen.
     */
    const releaseAudioElement = () => {
      audio.src = '';
      audio.remove();
    };

    try {
      await audio.play();

      // Audio-Element nach Playback freigeben (Memory Leak Prevention)
      audio.addEventListener('ended', releaseAudioElement, { once: true });

      // Bei Error ebenfalls freigeben
      audio.addEventListener('error', releaseAudioElement, { once: true });
    } catch (playError) {
      // Bei Exception sofort freigeben
      releaseAudioElement();

      // Story 2.8 AC2: Error-Klassifizierung für Caller
      if (playError instanceof Error) {
        if (playError.name === 'NotAllowedError') {
          // Recoverable: Autoplay blocked - könnte nach User-Interaktion funktionieren
          logger.warn(`[SoundService] Browser blockiert Autoplay. User-Interaktion erforderlich.`);
          throw new WebAudioRecoverableError('Autoplay blockiert - bitte interagieren Sie mit der App');
        } else if (playError.name === 'NotSupportedError') {
          // Fatal: File not found
          logger.error(`[SoundService] Sound-File nicht gefunden: ${soundFile}`);
          throw new WebAudioFatalError(`Sound-Datei nicht gefunden: ${soundFile}`);
        } else if (playError.name === 'AbortError') {
          // Fatal: Playback wurde abgebrochen
          logger.error(`[SoundService] Sound-Wiedergabe abgebrochen: ${playError.message}`);
          throw new WebAudioFatalError(`Sound-Wiedergabe abgebrochen`);
        } else {
          // Unbekannter Fehler → als fatal behandeln
          throw new WebAudioFatalError(playError.message);
        }
      }
      throw playError;
    }
  }

  /**
   * Initialisiert Web Audio State für Browser-Umgebung.
   *
   * Setzt initialized Flag für Lazy Initialization.
   * AudioContext entfernt (YAGNI) - HTMLAudioElement.volume reicht für Volume Control.
   */
  private initializeWebAudio(): void {
    this.webAudioState.initialized = true;
    logger.debug('[SoundService] Web Audio initialisiert');
  }

  /**
   * Eskaliert den Sound zu einem hoeheren Level (Story 2.3 AC1)
   *
   * Diese Methode ersetzt den aktuellen Sound durch den neuen Level.
   * Im Gegensatz zu stopAllSounds() + playAlarm() ist dies eine atomare Operation
   * die Debouncing eingebaut hat um Sound-Ueberlappung zu vermeiden.
   *
   * Nutzt die Audio-Settings für Sound-Auswahl und Lautstärke.
   *
   * @param level - Neues Sound-Level ('warning' oder 'urgent')
   * @returns Promise mit Erfolgs-Status und optionalem Fehler
   *
   * @example
   * ```typescript
   * // Bei Intensivierung nach 30s
   * await soundService.escalateToLevel('warning');
   * ```
   */
  public async escalateToLevel(level: SoundLevel): Promise<SoundResult> {
    // Debounce: Verhindere zu schnelle aufeinanderfolgende Eskalationen
    const now = Date.now();
    if (this.lastEscalationTime && now - this.lastEscalationTime < SoundService.ESCALATION_DEBOUNCE_MS) {
      logger.debug(`[SoundService] Eskalation gedrosselt (${now - this.lastEscalationTime}ms seit letzter)`);
      return { success: true }; // Silently skip, nicht als Fehler behandeln
    }
    this.lastEscalationTime = now;

    logger.info(`[SoundService] Eskaliere Sound zu: ${level}`);

    // Spiele neuen Sound mit konfigurierten Settings
    return this.playAlarm(level);
  }

  /** Timestamp der letzten Eskalation (fuer Debouncing) */
  private lastEscalationTime: number | null = null;

  /** Debounce-Zeit fuer Eskalationen in Millisekunden (konfigurierbar) */
  private static readonly ESCALATION_DEBOUNCE_MS = 200;

  /**
   * Stoppt alle aktuell spielenden Sounds.
   *
   * Nützlich für UI-Interaktionen (z.B. "Stummschalten"-Button)
   * oder beim Wechsel zwischen Views.
   */
  public stopAllSounds(): void {
    for (const audio of this.webAudioState.audioElements.values()) {
      audio.pause();
      audio.currentTime = 0;
    }
    logger.debug('[SoundService] Alle Sounds gestoppt');
  }

  /**
   * Setzt den Eskalations-Debounce-Zustand zurueck.
   *
   * Verhindert Memory Leak durch lastEscalationTime nach langen Sessions.
   * Wird automatisch von cleanup() aufgerufen.
   */
  public clearEscalationDebounce(): void {
    this.lastEscalationTime = null;
    logger.debug('[SoundService] Eskalation-Debounce zurueckgesetzt');
  }

  /**
   * Räumt Audio-Ressourcen auf.
   *
   * Stoppt alle Sounds, gibt Audio-Elemente frei und setzt Debounce-State zurueck.
   * Sollte beim App-Shutdown aufgerufen werden um Resource Leaks zu vermeiden.
   *
   * @returns Promise das resolvet wenn Cleanup abgeschlossen ist
   */
  public async cleanup(): Promise<void> {
    this.stopAllSounds();

    // Audio-Elemente vollstaendig freigeben (Memory Leak Prevention)
    for (const audio of this.webAudioState.audioElements.values()) {
      audio.src = ''; // Browser-Ressourcen freigeben
    }
    this.webAudioState.audioElements.clear();

    // Debounce-State zuruecksetzen (Memory Leak Prevention)
    this.clearEscalationDebounce();

    this.webAudioState.initialized = false;
    logger.info('[SoundService] Audio-Ressourcen freigegeben');
  }

  /**
   * Setzt Service-Instanz zurück (nur für Tests!).
   *
   * Erlaubt Test-Isolation durch Zurücksetzen des Singleton-State.
   * WARNUNG: Nur in Test-Umgebung verwenden!
   */
  public static reset(): void {
    if (SoundService.instance) {
      SoundService.instance.stopAllSounds();
      SoundService.instance.webAudioState.audioElements.clear();
      SoundService.instance = null;
    }
  }
}

/**
 * Singleton Instance Export (Convenience)
 *
 * Ermöglicht direkten Import ohne getInstance() Aufruf:
 * ```typescript
 * import { soundService } from './sound.service';
 * await soundService.playAlarm('warning');
 * ```
 */
export const soundService = SoundService.getInstance();
