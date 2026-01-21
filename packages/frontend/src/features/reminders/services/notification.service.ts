import { isTauri } from '@tauri-apps/api/core';
import { logger } from '@/shared/lib/logger';

/**
 * Notification Permission Status
 *
 * Beschreibt den aktuellen Status der Benachrichtigungsberechtigung.
 */
export type NotificationPermissionStatus = 'granted' | 'denied' | 'unknown' | 'not-supported';

/**
 * Optionen für das Senden einer Benachrichtigung
 */
export interface SendNotificationOptions {
  /** Titel der Benachrichtigung */
  title: string;
  /** Optionaler Body-Text (Standard: 'Jetzt fällig') */
  body?: string;
  /** Optionales Icon für Web Notifications */
  icon?: string;
  /** Erinnerung-ID für Deep Link Navigation */
  erinnerungId?: string;
  /** Einsatz-ID für Deep Link Navigation */
  einsatzId?: string;
}

/**
 * Ergebnis einer Notification-Operation
 */
export interface NotificationResult {
  /** Ob die Operation erfolgreich war */
  success: boolean;
  /** Fehlermeldung falls nicht erfolgreich */
  error?: string;
}

/**
 * Notification Service für Erinnerungen
 *
 * Ermöglicht das Senden von nativen OS-Benachrichtigungen mit automatischem
 * Fallback auf Web Notifications falls Tauri nicht verfügbar ist.
 *
 * Features:
 * - Tauri 2.x Native Notifications (funktioniert auch bei minimierter App)
 * - Web Notification API Fallback für Browser-Testing
 * - Permission-Request Handling
 * - Graceful Degradation bei fehlenden Permissions
 *
 * ## Setup (Tauri Native Notifications)
 *
 * 1. Frontend: `pnpm add @tauri-apps/plugin-notification`
 * 2. Rust (Cargo.toml): `tauri-plugin-notification = "2"`
 * 3. Capability (default.json): `"notification:default"`
 * 4. Rust (lib.rs): `.plugin(tauri_plugin_notification::init())`
 *
 * Ohne diese Konfiguration wird automatisch auf Web Notifications zurückgefallen.
 *
 * @example
 * ```typescript
 * // Permission anfordern
 * const status = await notificationService.requestPermission();
 * if (status === 'granted') {
 *   await notificationService.send({ title: 'Erinnerung: Meeting' });
 * }
 * ```
 */
class NotificationService {
  private permissionStatus: NotificationPermissionStatus = 'unknown';

  /** Cache ob Tauri Plugin funktionsfähig ist (null = nicht geprüft) */
  private tauriPluginAvailable: boolean | null = null;

  /**
   * Prüft ob Benachrichtigungen grundsätzlich unterstützt werden
   *
   * @returns true wenn Tauri Notification Plugin oder Web Notifications verfügbar
   */
  async isSupported(): Promise<boolean> {
    if (isTauri() && (await this.isTauriPluginAvailable())) {
      return true;
    }

    // Web: Prüfe Notification API
    return 'Notification' in window;
  }

  /**
   * Prüft ob das Tauri Notification Plugin wirklich funktioniert
   *
   * Der Import alleine reicht nicht - das Plugin muss auch im Rust Backend
   * registriert sein. Diese Methode testet die tatsächliche Funktionalität.
   */
  private async isTauriPluginAvailable(): Promise<boolean> {
    // Cached Ergebnis nutzen
    if (this.tauriPluginAvailable !== null) {
      return this.tauriPluginAvailable;
    }

    try {
      const { isPermissionGranted } = await import('@tauri-apps/plugin-notification');
      // Tatsächlichen Plugin-Aufruf testen
      await isPermissionGranted();
      this.tauriPluginAvailable = true;
      return true;
    } catch {
      logger.warn('Tauri Notification Plugin nicht verfügbar, nutze Web Notifications als Fallback');
      this.tauriPluginAvailable = false;
      return false;
    }
  }

  /**
   * Prüft den aktuellen Permission-Status
   *
   * Fragt bei Tauri die native Permission ab, im Browser die Web Notification Permission.
   *
   * @returns Aktueller Permission-Status
   */
  async checkPermission(): Promise<NotificationPermissionStatus> {
    if (!(await this.isSupported())) {
      this.permissionStatus = 'not-supported';
      return this.permissionStatus;
    }

    // Nutze Tauri nur wenn Plugin wirklich verfügbar
    if (isTauri() && this.tauriPluginAvailable) {
      return this.checkTauriPermission();
    }

    return this.checkWebPermission();
  }

  /**
   * Fordert die Notification-Berechtigung an
   *
   * Zeigt bei Bedarf einen System-Dialog zur Berechtigungsanfrage.
   * Bei bereits erteilter Berechtigung wird 'granted' zurückgegeben.
   *
   * @returns Promise mit dem neuen Permission-Status
   */
  async requestPermission(): Promise<NotificationPermissionStatus> {
    if (!(await this.isSupported())) {
      logger.warn('Benachrichtigungen werden nicht unterstützt');
      this.permissionStatus = 'not-supported';
      return this.permissionStatus;
    }

    // Nutze Tauri nur wenn Plugin wirklich verfügbar
    if (isTauri() && this.tauriPluginAvailable) {
      return this.requestTauriPermission();
    }

    return this.requestWebPermission();
  }

  /**
   * Sendet eine native Benachrichtigung
   *
   * Nutzt Tauri Native Notifications wenn verfügbar, sonst Web Notification API.
   * Die Benachrichtigung erscheint auch wenn die App minimiert oder im Hintergrund ist.
   *
   * @param options - Notification-Optionen (title, body)
   * @returns Promise mit Erfolgs-Status
   *
   * @example
   * ```typescript
   * await notificationService.send({
   *   title: 'Erinnerung: Funkgerät prüfen',
   *   body: 'Jetzt fällig'
   * });
   * ```
   */
  async send(options: SendNotificationOptions): Promise<NotificationResult> {
    const { title, body = 'Jetzt fällig' } = options;

    // Prüfe Permission falls noch nicht bekannt
    if (this.permissionStatus === 'unknown') {
      await this.checkPermission();
    }

    // Keine Permission - graceful degradation
    if (this.permissionStatus !== 'granted') {
      logger.warn('Keine Berechtigung für Benachrichtigungen', {
        status: this.permissionStatus,
        title,
      });
      return {
        success: false,
        error: `Keine Berechtigung: ${this.permissionStatus}`,
      };
    }

    // Nutze Tauri nur wenn Plugin wirklich verfügbar
    if (isTauri() && this.tauriPluginAvailable) {
      return this.sendTauriNotification(title, body, options.erinnerungId, options.einsatzId);
    }

    return this.sendWebNotification(title, body, options.icon);
  }

  /**
   * Sendet eine Erinnerungs-Benachrichtigung mit Standard-Format
   *
   * Convenience-Methode für Erinnerungen mit konsistentem Format.
   * Nutzt High Importance Channel und Deep Link Action für Navigation.
   *
   * @param erinnerungTitle - Titel der Erinnerung
   * @param erinnerungId - ID der Erinnerung für Deep Link
   * @param einsatzId - ID des Einsatzes für Deep Link
   * @returns Promise mit Erfolgs-Status
   */
  async sendErinnerungNotification(erinnerungTitle: string, erinnerungId?: string, einsatzId?: string): Promise<NotificationResult> {
    return this.send({
      title: `Erinnerung: ${erinnerungTitle}`,
      body: 'Jetzt fällig',
      erinnerungId,
      einsatzId,
    });
  }

  // ===================
  // Tauri Implementation
  // ===================

  /**
   * Prüft Tauri Native Permission
   */
  private async checkTauriPermission(): Promise<NotificationPermissionStatus> {
    try {
      const { isPermissionGranted } = await import('@tauri-apps/plugin-notification');
      const granted = await isPermissionGranted();

      this.permissionStatus = granted ? 'granted' : 'unknown';
      logger.debug('Tauri Notification Permission:', this.permissionStatus);

      return this.permissionStatus;
    } catch (error) {
      logger.error('Fehler beim Prüfen der Tauri Notification Permission:', error);
      this.permissionStatus = 'not-supported';
      return this.permissionStatus;
    }
  }

  /**
   * Fordert Tauri Native Permission an
   */
  private async requestTauriPermission(): Promise<NotificationPermissionStatus> {
    try {
      const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');

      // Erst prüfen ob schon granted
      let granted = await isPermissionGranted();

      if (!granted) {
        // Permission anfordern
        const result = await requestPermission();
        granted = result === 'granted';
      }

      this.permissionStatus = granted ? 'granted' : 'denied';
      logger.info('Tauri Notification Permission angefordert:', this.permissionStatus);

      return this.permissionStatus;
    } catch (error) {
      logger.error('Fehler beim Anfordern der Tauri Notification Permission:', error);
      this.permissionStatus = 'not-supported';
      return this.permissionStatus;
    }
  }

  /**
   * Sendet Tauri Native Notification mit High Importance Channel
   *
   * Nutzt den "erinnerungen" Channel für hohe Priorität und
   * registriert Action Type für Deep Link Navigation.
   */
  private async sendTauriNotification(title: string, body: string, erinnerungId?: string, einsatzId?: string): Promise<NotificationResult> {
    try {
      const { sendNotification: tauriSendNotification } = await import('@tauri-apps/plugin-notification');
      const { ERINNERUNG_CHANNEL_ID, ERINNERUNG_ACTION_TYPE_ID } = await import('./notification-setup.service');

      await tauriSendNotification({
        title,
        body,
        // High Importance Channel für prominente Anzeige
        channelId: ERINNERUNG_CHANNEL_ID,
        // Action Type für Klick-Handling mit Deep Link
        actionTypeId: ERINNERUNG_ACTION_TYPE_ID,
        // Extra-Daten für Deep Link Navigation
        extra: erinnerungId && einsatzId ? { erinnerungId, einsatzId } : undefined,
        // Notification bleibt bis User interagiert (kein Auto-Dismiss)
        autoCancel: true,
      });

      logger.debug('Tauri Notification gesendet:', { title, body, erinnerungId, einsatzId });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      logger.error('Fehler beim Senden der Tauri Notification:', error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // ===================
  // Web Implementation
  // ===================

  /**
   * Prüft Web Notification Permission
   */
  private checkWebPermission(): NotificationPermissionStatus {
    if (!('Notification' in window)) {
      this.permissionStatus = 'not-supported';
      return this.permissionStatus;
    }

    switch (Notification.permission) {
      case 'granted':
        this.permissionStatus = 'granted';
        break;
      case 'denied':
        this.permissionStatus = 'denied';
        break;
      default:
        this.permissionStatus = 'unknown';
    }

    logger.debug('Web Notification Permission:', this.permissionStatus);
    return this.permissionStatus;
  }

  /**
   * Fordert Web Notification Permission an
   */
  private async requestWebPermission(): Promise<NotificationPermissionStatus> {
    if (!('Notification' in window)) {
      this.permissionStatus = 'not-supported';
      return this.permissionStatus;
    }

    try {
      const result = await Notification.requestPermission();

      switch (result) {
        case 'granted':
          this.permissionStatus = 'granted';
          break;
        case 'denied':
          this.permissionStatus = 'denied';
          break;
        default:
          this.permissionStatus = 'unknown';
      }

      logger.info('Web Notification Permission angefordert:', this.permissionStatus);
      return this.permissionStatus;
    } catch (error) {
      logger.error('Fehler beim Anfordern der Web Notification Permission:', error);
      this.permissionStatus = 'unknown';
      return this.permissionStatus;
    }
  }

  /**
   * Sendet Web Notification
   */
  private sendWebNotification(title: string, body: string, icon?: string): NotificationResult {
    try {
      const notification = new Notification(title, {
        body,
        icon: icon ?? '/favicon.ico',
        tag: 'erinnerung', // Verhindert Duplikate
        requireInteraction: false,
      });

      // Auto-close nach 5 Sekunden
      setTimeout(() => {
        notification.close();
      }, 5000);

      logger.debug('Web Notification gesendet:', { title, body });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      logger.error('Fehler beim Senden der Web Notification:', error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

// Singleton-Instanz exportieren
const notificationService = new NotificationService();

export { notificationService, NotificationService };

// Named Exports für einfachere Verwendung
export const checkNotificationPermission = () => notificationService.checkPermission();
export const requestNotificationPermission = () => notificationService.requestPermission();
export const sendNotification = (options: SendNotificationOptions) => notificationService.send(options);
export const sendErinnerungNotification = (title: string, erinnerungId?: string, einsatzId?: string) => notificationService.sendErinnerungNotification(title, erinnerungId, einsatzId);
export const isNotificationSupported = () => notificationService.isSupported();
