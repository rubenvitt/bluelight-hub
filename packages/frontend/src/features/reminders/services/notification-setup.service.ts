/**
 * Notification Setup Service
 *
 * Initialisiert Notification-Channels und Action Types beim App-Start.
 * Registriert auch den onAction Handler für Deep Link Navigation.
 *
 * **Wichtig:** Muss einmalig beim App-Start aufgerufen werden (main.tsx)
 *
 * Features:
 * - Channel "erinnerungen" mit High Importance (Priorität 4)
 * - Action Type "erinnerung-action" für Klick-Handling
 * - Deep Link Navigation zur Erinnerung bei Notification-Klick
 */

import { isTauri } from '@tauri-apps/api/core';
import { z } from 'zod';
import { logger } from '@/shared/lib/logger';

/**
 * Schema für Runtime-Validierung der Notification extra Daten.
 *
 * Verhindert unsichere Type-Assertions bei externen Daten.
 */
const notificationExtraSchema = z.object({
  erinnerungId: z.string().min(1),
  einsatzId: z.string().min(1),
});

/** Channel ID für Erinnerungen */
export const ERINNERUNG_CHANNEL_ID = 'erinnerungen';

/** Action Type ID für Erinnerung-Notifications */
export const ERINNERUNG_ACTION_TYPE_ID = 'erinnerung-action';

/** Action ID für "Öffnen" Button */
export const ERINNERUNG_ACTION_OPEN_ID = 'open-erinnerung';

/**
 * Callback-Typ für Navigation bei Notification-Klick
 */
export type NavigateToErinnerungCallback = (einsatzId: string, erinnerungId: string) => void;

/**
 * Pending Navigation Eintrag
 *
 * Speichert Navigationsanfragen die vor Callback-Registrierung eintrafen.
 */
interface PendingNavigation {
  einsatzId: string;
  erinnerungId: string;
}

/**
 * Notification Setup Service
 *
 * Singleton für einmalige Initialisierung beim App-Start.
 *
 * **Race Condition Handling:**
 * Wenn eine Notification bei App-Start eintrifft bevor der navigateCallback
 * registriert wurde, wird die Navigation in einer Queue gespeichert und
 * automatisch verarbeitet sobald setNavigateCallback() aufgerufen wird.
 */
class NotificationSetupService {
  private isInitialized = false;
  private navigateCallback: NavigateToErinnerungCallback | null = null;
  private actionListenerUnsubscribe: (() => void) | null = null;
  private pendingNavigations: PendingNavigation[] = [];

  /**
   * Initialisiert Notification Channels und Action Types
   *
   * Sollte beim App-Start aufgerufen werden (main.tsx).
   * Ist idempotent - mehrfache Aufrufe sind sicher.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('[NotificationSetup] Already initialized, skipping...');
      return;
    }

    if (!isTauri()) {
      logger.info('[NotificationSetup] Not in Tauri environment, skipping...');
      this.isInitialized = true;
      return;
    }

    try {
      // Cleanup vor neuer Registrierung um Memory Leaks zu vermeiden
      this.cleanup();

      await this.createErinnerungChannel();
      await this.registerActionTypes();
      await this.registerActionHandler();

      this.isInitialized = true;
      logger.info('[NotificationSetup] Initialized successfully');
    } catch (error) {
      logger.error('[NotificationSetup] Initialization failed:', error);
      // Nicht re-thrown - App soll trotzdem funktionieren
    }
  }

  /**
   * Entfernt registrierte Listener um Memory Leaks zu vermeiden
   *
   * Wird automatisch vor Re-Initialisierung aufgerufen.
   * Kann auch manuell beim App-Shutdown aufgerufen werden.
   */
  cleanup(): void {
    if (this.actionListenerUnsubscribe) {
      this.actionListenerUnsubscribe();
      this.actionListenerUnsubscribe = null;
      logger.debug('[NotificationSetup] Action listener cleaned up');
    }
  }

  /**
   * Registriert Callback für Navigation bei Notification-Klick
   *
   * Verarbeitet automatisch alle pending Navigationen die vor der
   * Callback-Registrierung eingetroffen sind (Race Condition Fix).
   *
   * @param callback - Wird aufgerufen mit (einsatzId, erinnerungId)
   */
  setNavigateCallback(callback: NavigateToErinnerungCallback): void {
    this.navigateCallback = callback;

    // Verarbeite alle pending Navigationen die vor Callback-Registrierung eintrafen
    if (this.pendingNavigations.length > 0) {
      logger.info(`[NotificationSetup] Processing ${this.pendingNavigations.length} pending navigation(s)`);

      for (const pending of this.pendingNavigations) {
        logger.info('[NotificationSetup] Executing pending navigation:', pending);
        callback(pending.einsatzId, pending.erinnerungId);
      }

      // Queue leeren nach Verarbeitung
      this.pendingNavigations = [];
    }
  }

  /**
   * Erstellt Notification Channel mit High Importance
   *
   * Android/Desktop: Notifications werden prominent angezeigt
   *
   * **Hinweis:** `channels()` ist nur in Tauri Desktop verfügbar, nicht im Browser.
   * Daher wird createChannel direkt aufgerufen - bei bereits existierendem
   * Channel wird der Fehler ignoriert.
   */
  private async createErinnerungChannel(): Promise<void> {
    try {
      const { createChannel, Importance, Visibility } = await import('@tauri-apps/plugin-notification');

      // Direkt Channel erstellen - Fehler bei Duplikat wird abgefangen
      // (channels() API ist nicht überall verfügbar, z.B. nicht auf macOS)
      await createChannel({
        id: ERINNERUNG_CHANNEL_ID,
        name: 'Erinnerungen',
        description: 'Benachrichtigungen für fällige Erinnerungen',
        importance: Importance.High,
        visibility: Visibility.Public,
        vibration: true,
        lights: true,
      });

      logger.info('[NotificationSetup] Channel created with High Importance');
    } catch (error) {
      // Channel existiert bereits oder API nicht verfügbar - beides OK
      // "not found" bedeutet das Command existiert nicht auf dieser Plattform (z.B. macOS)
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('already exists') || errorMessage.includes('not allowed') || errorMessage.includes('not found')) {
        logger.debug('[NotificationSetup] Channel API not available on this platform (expected on macOS)');
        return;
      }
      logger.error('[NotificationSetup] Failed to create channel:', error);
      throw error;
    }
  }

  /**
   * Registriert Action Types für Notification-Buttons
   *
   * **Hinweis:** Nicht auf allen Plattformen verfügbar (z.B. nicht auf macOS).
   */
  private async registerActionTypes(): Promise<void> {
    try {
      const { registerActionTypes } = await import('@tauri-apps/plugin-notification');

      await registerActionTypes([
        {
          id: ERINNERUNG_ACTION_TYPE_ID,
          actions: [
            {
              id: ERINNERUNG_ACTION_OPEN_ID,
              title: 'Öffnen',
              foreground: true, // App in Vordergrund bringen
            },
          ],
        },
      ]);

      logger.info('[NotificationSetup] Action types registered');
    } catch (error) {
      // API nicht auf allen Plattformen verfügbar (z.B. macOS)
      // "not found" bedeutet das Command existiert nicht auf dieser Plattform
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('not allowed') || errorMessage.includes('not supported') || errorMessage.includes('not found')) {
        logger.debug('[NotificationSetup] Action types API not available on this platform');
        return;
      }
      logger.error('[NotificationSetup] Failed to register action types:', error);
      throw error;
    }
  }

  /**
   * Registriert Handler für Notification-Klicks
   *
   * Wird aufgerufen wenn User auf Notification oder Action-Button klickt.
   * Nutzt Zod safeParse() für sichere Runtime-Validierung der extra Daten.
   *
   * **Hinweis:** Nicht auf allen Plattformen verfügbar (z.B. nicht auf macOS).
   */
  private async registerActionHandler(): Promise<void> {
    try {
      const { onAction } = await import('@tauri-apps/plugin-notification');

      // Speichere Unsubscribe-Funktion um Memory Leaks zu vermeiden
      this.actionListenerUnsubscribe = await onAction((notification) => {
        logger.info('[NotificationSetup] Action received:', notification);

        // Runtime-Validierung der extra Daten mit Zod (Security: keine unsichere Type-Assertion)
        const parseResult = notificationExtraSchema.safeParse(notification.extra);

        if (!parseResult.success) {
          logger.warn('[NotificationSetup] Invalid notification extra data:', parseResult.error);
          return;
        }

        const { einsatzId, erinnerungId } = parseResult.data;

        if (this.navigateCallback) {
          // Callback vorhanden - Navigation sofort ausführen
          logger.info('[NotificationSetup] Navigating to erinnerung:', {
            einsatzId,
            erinnerungId,
          });
          this.navigateCallback(einsatzId, erinnerungId);
        } else {
          // Callback noch nicht registriert - Navigation in Queue speichern
          logger.info('[NotificationSetup] Callback not ready, queueing navigation:', {
            einsatzId,
            erinnerungId,
          });
          this.pendingNavigations.push({
            einsatzId,
            erinnerungId,
          });
        }
      });

      logger.info('[NotificationSetup] Action handler registered');
    } catch (error) {
      // API nicht auf allen Plattformen verfügbar (z.B. macOS)
      // "not found" bedeutet das Command existiert nicht auf dieser Plattform
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('not allowed') || errorMessage.includes('not supported') || errorMessage.includes('not found')) {
        logger.debug('[NotificationSetup] Action handler API not available on this platform');
        return;
      }
      logger.error('[NotificationSetup] Failed to register action handler:', error);
      throw error;
    }
  }
}

// Singleton-Instanz
export const notificationSetupService = new NotificationSetupService();

// Named Exports für einfachere Verwendung
export const initializeNotificationSetup = () => notificationSetupService.initialize();
export const setNotificationNavigateCallback = (callback: NavigateToErinnerungCallback) => notificationSetupService.setNavigateCallback(callback);
export const cleanupNotificationSetup = () => notificationSetupService.cleanup();
