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
 */

import { isTauri } from '@tauri-apps/api/core';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/shared/lib/logger';

/**
 * Sound Level für Erinnerungen
 *
 * - info: Dezenter Hinweiston (niedrige Priorität)
 * - warning: Aufmerksamkeitston (mittlere Priorität)
 * - urgent: Dringender Alarmton (hohe Priorität)
 */
export type SoundLevel = 'info' | 'warning' | 'urgent';

/**
 * Sound File Mapping für Web Audio Fallback
 *
 * Pfade relativ zum public/ Ordner.
 * Fallback wird nur im Browser-Modus (Testing) verwendet.
 */
const SOUND_FILES: Record<SoundLevel, string> = {
  info: '/sounds/alarm-info.mp3',
  warning: '/sounds/alarm-warning.mp3',
  urgent: '/sounds/alarm-urgent.mp3',
};

/**
 * Web Audio Fallback State
 *
 * Caching der Audio-Elemente für schnellere Wiedergabe bei erneutem Abspielen.
 * AudioContext wird lazy initialisiert um Browser-Autoplay-Policies zu umgehen.
 */
interface WebAudioState {
  audioElements: Map<SoundLevel, HTMLAudioElement>;
  audioContext: AudioContext | null;
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
    audioContext: null,
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
   * Priorisiert Tauri Native Sound (Desktop) und fällt auf Web Audio
   * zurück (Browser Testing). Bei Fehlern wird graceful degradiert
   * mit Console-Log statt Absturz.
   *
   * @param level - Sound-Level ('info' | 'warning' | 'urgent')
   * @returns Promise mit Erfolgs-Status und optionalem Fehler
   */
  public async playAlarm(level: SoundLevel): Promise<{ success: boolean; error?: string }> {
    try {
      if (isTauri()) {
        await this.playTauriNativeSound(level);
      } else {
        await this.playWebAudioFallback(level);
      }

      logger.info(`[SoundService] Alarm abgespielt: ${level}`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      logger.warn(`[SoundService] Sound konnte nicht abgespielt werden (${level}): ${errorMessage}`);

      // Graceful Degradation: Log statt Fehler werfen
      console.log(`[SoundService] Fallback: Alarm-Event für Level "${level}" (kein Sound verfügbar)`);

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Spielt Sound über Tauri Native API ab.
   *
   * Nutzt Tauri invoke() um den Sound im Rust-Backend abzuspielen.
   * Dies ermöglicht native System-Sounds und bessere Performance.
   *
   * @param level - Sound-Level für Tauri Backend
   * @throws Error wenn Tauri invoke fehlschlägt
   */
  private async playTauriNativeSound(level: SoundLevel): Promise<void> {
    await invoke('play_sound', { soundType: level });
  }

  /**
   * Spielt Sound über Web Audio API ab (Browser Fallback).
   *
   * Verwendet HTML5 Audio Element mit Caching für bessere Performance.
   * Bei fehlendem Sound-File wird graceful degradiert mit Console-Log.
   *
   * @param level - Sound-Level für Audio-File Auswahl
   * @throws Error wenn Audio nicht abgespielt werden kann
   */
  private async playWebAudioFallback(level: SoundLevel): Promise<void> {
    // Lazy Initialisierung des Web Audio State
    if (!this.webAudioState.initialized) {
      this.initializeWebAudio();
    }

    // Cached Audio Element verwenden oder neu erstellen
    let audio = this.webAudioState.audioElements.get(level);

    if (!audio) {
      audio = new Audio(SOUND_FILES[level]);
      this.webAudioState.audioElements.set(level, audio);
    }

    // Audio zurücksetzen falls bereits abgespielt
    audio.currentTime = 0;

    try {
      await audio.play();
    } catch (playError) {
      // Graceful Degradation: Wenn kein Sound-File vorhanden
      // oder Autoplay blockiert, loggen statt Fehler werfen
      if (playError instanceof Error) {
        if (playError.name === 'NotAllowedError') {
          console.log(`[SoundService] Browser blockiert Autoplay für "${level}". User-Interaktion erforderlich.`);
        } else if (playError.name === 'NotSupportedError') {
          console.log(`[SoundService] Sound-File nicht gefunden: ${SOUND_FILES[level]}`);
        } else {
          throw playError;
        }
      }
    }
  }

  /**
   * Initialisiert Web Audio State für Browser-Umgebung.
   *
   * Erstellt AudioContext für erweiterte Audio-Kontrolle.
   * AudioContext wird erst bei Bedarf erstellt (Browser-Policy).
   */
  private initializeWebAudio(): void {
    try {
      // AudioContext für erweiterte Kontrolle (Volume, etc.)
      // Nicht unbedingt nötig für simple Playback, aber für zukünftige Features
      if (typeof AudioContext !== 'undefined') {
        this.webAudioState.audioContext = new AudioContext();
      }

      this.webAudioState.initialized = true;
      logger.debug('[SoundService] Web Audio initialisiert');
    } catch (error) {
      // Browser unterstützt AudioContext nicht - kein kritischer Fehler
      logger.warn('[SoundService] AudioContext nicht verfügbar, nutze nur HTML5 Audio');
      this.webAudioState.initialized = true;
    }
  }

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
   * Räumt Audio-Ressourcen auf.
   *
   * Schließt AudioContext und stoppt alle Sounds.
   * Sollte beim App-Shutdown aufgerufen werden um Resource Leaks zu vermeiden.
   *
   * @returns Promise das resolvet wenn Cleanup abgeschlossen ist
   */
  public async cleanup(): Promise<void> {
    this.stopAllSounds();

    if (this.webAudioState.audioContext) {
      await this.webAudioState.audioContext.close().catch(() => {
        // Ignorieren - AudioContext Cleanup ist nicht kritisch
      });
      this.webAudioState.audioContext = null;
    }

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

      if (SoundService.instance.webAudioState.audioContext) {
        SoundService.instance.webAudioState.audioContext.close().catch(() => {
          // Ignorieren - AudioContext Cleanup ist nicht kritisch
        });
      }

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
