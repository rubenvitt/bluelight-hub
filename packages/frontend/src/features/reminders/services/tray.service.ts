/**
 * Tray Service - Story 1.9: System-Tray mit Status-Badge
 *
 * Bridge zwischen Frontend und Tauri Tray-Commands.
 * Aktualisiert das System-Tray-Badge basierend auf ausgelösten Erinnerungen.
 *
 * AC1: Tray-Badge bei ausgelösten Erinnerungen
 * AC2: Neutrales Icon ohne aktive Alarme
 */

import { isTauri } from '@tauri-apps/api/core';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/shared/lib/logger';

/**
 * Result-Type für Tray-Operationen.
 */
export interface TrayResult {
  success: boolean;
  error?: string;
}

/**
 * Tray Service Singleton.
 *
 * Verwaltet die Kommunikation mit dem Tauri System-Tray.
 * Graceful Degradation: Im Web-Browser werden Aufrufe ignoriert.
 */
export class TrayService {
  private static instance: TrayService | null = null;
  private lastBadgeCount = 0;

  private constructor() {
    logger.info('[TrayService] Initialisiert');
  }

  /**
   * Gibt die Singleton-Instanz zurück.
   */
  public static getInstance(): TrayService {
    if (!TrayService.instance) {
      TrayService.instance = new TrayService();
    }
    return TrayService.instance;
  }

  /**
   * Aktualisiert das Tray-Badge mit der Anzahl ausgelöster Erinnerungen.
   *
   * AC1: Zeigt rotes Badge mit Anzahl bei count > 0.
   * AC2: Zeigt neutrales Icon bei count === 0.
   *
   * @param count Anzahl der ausgelösten Erinnerungen
   * @returns TrayResult mit Erfolg/Fehler-Status
   */
  public async updateBadge(count: number): Promise<TrayResult> {
    // Web-Fallback: Ignorieren (kein System-Tray im Browser)
    if (!isTauri()) {
      logger.debug('[TrayService] Nicht in Tauri - Badge-Update ignoriert');
      return { success: true };
    }

    // Optimierung: Kein Update wenn Count gleich bleibt
    if (count === this.lastBadgeCount) {
      logger.debug(`[TrayService] Badge-Count unverändert: ${count}`);
      return { success: true };
    }

    try {
      await invoke('update_tray_badge', { count });
      this.lastBadgeCount = count;
      logger.info(`[TrayService] Badge aktualisiert: ${count}`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[TrayService] Badge-Update fehlgeschlagen: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Setzt das Tray-Badge zurück (neutrales Icon).
   *
   * Convenience-Wrapper für updateBadge(0).
   *
   * @returns TrayResult mit Erfolg/Fehler-Status
   */
  public async clearBadge(): Promise<TrayResult> {
    return this.updateBadge(0);
  }

  /**
   * Gibt den aktuellen Badge-Count zurück.
   *
   * Nützlich für Tests und Debugging.
   */
  public getCurrentBadgeCount(): number {
    return this.lastBadgeCount;
  }

  /**
   * Setzt den Service-State zurück.
   *
   * Nützlich für Tests.
   */
  public reset(): void {
    this.lastBadgeCount = 0;
    logger.debug('[TrayService] State zurückgesetzt');
  }
}

/**
 * Singleton-Instanz des TrayService.
 */
export const trayService = TrayService.getInstance();
