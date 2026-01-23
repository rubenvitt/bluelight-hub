import { isTauri } from '@tauri-apps/api/core';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { toast } from 'sonner';
import { logger } from '@/shared/lib/logger';

/**
 * Optionen für das Öffnen des Admin-Fensters
 */
export interface OpenAdminOptions {
  width?: number;
  height?: number;
}

/**
 * Fenster-Orientierungen für verschiedene App-Bereiche
 */
export type WindowOrientation = 'portrait' | 'landscape';

/**
 * Konfiguration für Fenster-Größen basierend auf Orientierung
 */
export interface WindowSizeConfig {
  width: number;
  height: number;
}

/**
 * Vordefinierte Fenster-Konfigurationen
 */
export const WINDOW_CONFIGS: Record<WindowOrientation, WindowSizeConfig> = {
  portrait: { width: 800, height: 1000 },
  landscape: { width: 1400, height: 900 },
};

/**
 * Service für Window-Management in Tauri und Browser
 *
 * Verwaltet das Öffnen von Fenstern in Tauri (separates Fenster)
 * und im Browser (neuer Tab).
 */
class WindowService {
  private readonly ADMIN_WINDOW_LABEL = 'admin';
  private readonly DEFAULT_WIDTH = 1000;
  private readonly DEFAULT_HEIGHT = 700;

  /**
   * Öffnet das Admin-Dashboard in einem neuen Fenster (Tauri) oder Tab (Browser)
   *
   * @param opts Optionale Fenster-Einstellungen (Breite, Höhe)
   * @returns Promise<void>
   */
  async openAdmin(opts?: OpenAdminOptions): Promise<void> {
    try {
      if (isTauri()) {
        await this.openAdminInTauri(opts);
      } else {
        this.openAdminInBrowser();
      }
    } catch (error) {
      logger.error('Fehler beim Öffnen des Admin-Fensters:', error);
      toast.error('Fehler', {
        description: 'Das Admin-Fenster konnte nicht geöffnet werden.',
      });
    }
  }

  /**
   * Fokussiert das Admin-Fenster, falls es existiert
   */
  async focusAdmin(): Promise<void> {
    if (!isTauri()) {
      logger.warn('focusAdmin ist nur in Tauri verfügbar');
      return;
    }

    const adminWindow = await WebviewWindow.getByLabel(this.ADMIN_WINDOW_LABEL);
    if (adminWindow) {
      await adminWindow.setFocus();
      await adminWindow.unminimize();
    }
  }

  /**
   * Schließt das Admin-Fenster, falls es existiert
   */
  async closeAdmin(): Promise<void> {
    if (!isTauri()) {
      logger.warn('closeAdmin ist nur in Tauri verfügbar');
      return;
    }

    const adminWindow = await WebviewWindow.getByLabel(this.ADMIN_WINDOW_LABEL);
    if (adminWindow) {
      await adminWindow.close();
    }
  }

  /**
   * Prüft, ob das Admin-Fenster geöffnet ist
   */
  async isAdminOpen(): Promise<boolean> {
    if (!isTauri()) {
      return false;
    }

    const adminWindow = await WebviewWindow.getByLabel(this.ADMIN_WINDOW_LABEL);
    return adminWindow !== null;
  }

  /**
   * Prüft, ob das aktuelle Fenster das Admin-Fenster ist
   * @returns Promise<boolean> - true wenn im Admin-Fenster, sonst false
   */
  async isInAdminWindow(): Promise<boolean> {
    if (!isTauri()) {
      logger.debug('isInAdminWindow: Nicht in Tauri');
      return false;
    }

    try {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const currentWindow = getCurrentWebviewWindow();
      const isAdmin = currentWindow.label === this.ADMIN_WINDOW_LABEL;

      logger.debug('isInAdminWindow: Window Label =', currentWindow.label, '| Is Admin =', isAdmin);

      return isAdmin;
    } catch (error) {
      logger.error('Fehler beim Prüfen des aktuellen Fensters:', error);
      return false;
    }
  }

  /**
   * Öffnet Admin-Dashboard in Tauri WebviewWindow
   */
  private async openAdminInTauri(opts?: OpenAdminOptions): Promise<void> {
    // Prüfe ob Admin-Fenster bereits existiert
    const existingWindow = await WebviewWindow.getByLabel(this.ADMIN_WINDOW_LABEL);

    if (existingWindow) {
      // Fenster existiert bereits - fokussiere es
      await existingWindow.setFocus();
      await existingWindow.unminimize();
      return;
    }

    // Erstelle neues Admin-Fenster
    // Navigiere direkt zu /admin-login - diese Seite kann die Auth prüfen
    // und bei Bedarf weiterleiten, ohne dass die Index-Route dazwischenfunkt
    const adminUrl = `${window.location.origin}/admin-login`;
    logger.log('Öffne Admin-Fenster mit URL:', adminUrl);

    const adminWindow = new WebviewWindow(this.ADMIN_WINDOW_LABEL, {
      url: adminUrl,
      title: 'BlueLight Hub - Admin Dashboard',
      width: opts?.width ?? this.DEFAULT_WIDTH,
      height: opts?.height ?? this.DEFAULT_HEIGHT,
      resizable: true,
      center: true,
      decorations: true,
      alwaysOnTop: false,
      skipTaskbar: false,
    });

    // Warte bis Fenster erstellt wurde
    await adminWindow.once('tauri://created', () => {
      logger.log('Admin-Fenster erfolgreich erstellt');
    });

    // Error Handler für Fenster-Ereignisse
    adminWindow.once('tauri://error', (error) => {
      logger.error('Fehler beim Erstellen des Admin-Fensters:', error);
      toast.error('Fehler', {
        description: 'Das Admin-Fenster konnte nicht erstellt werden.',
      });
    });
  }

  /**
   * Öffnet Admin-Dashboard in neuem Browser-Tab
   */
  private openAdminInBrowser(): void {
    const adminUrl = '/admin-login';

    try {
      const newWindow = window.open(adminUrl, '_blank');

      if (newWindow === null) {
        logger.warn('Fenster konnte nicht geöffnet werden - möglicherweise durch Popup-Blocker verhindert');
        toast.warning('Hinweis', {
          description: 'Das Admin-Dashboard wird im aktuellen Fenster geöffnet.',
        });

        window.location.href = adminUrl;
      } else {
        // Neutralize window.opener to prevent reverse-tabnabbing
        newWindow.opener = null;
        logger.log('Admin-Dashboard in neuem Tab geöffnet');
      }
    } catch (error) {
      logger.error('Fehler beim Öffnen des neuen Tabs:', error);
      window.location.href = adminUrl;
    }
  }

  /**
   * Holt das aktuelle Main-Window (nur in Tauri)
   * @returns WebviewWindow oder null wenn nicht verfügbar
   */
  async getCurrentMainWindow(): Promise<WebviewWindow | null> {
    if (!isTauri()) {
      return null;
    }

    try {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      return getCurrentWebviewWindow();
    } catch (error) {
      logger.error('Fehler beim Abrufen des aktuellen Fensters:', error);
      return null;
    }
  }

  /**
   * Ändert die Größe des Main-Windows basierend auf der gewünschten Orientierung
   *
   * @param orientation - 'portrait' oder 'landscape'
   * @returns Promise<void>
   */
  async resizeMainWindow(orientation: WindowOrientation): Promise<void> {
    // TODO: Temporär deaktiviert - wieder aktivieren wenn gewünscht
    logger.debug('resizeMainWindow: Temporär deaktiviert');
    return;

    if (!isTauri()) {
      logger.debug('resizeMainWindow: Nur in Tauri verfügbar');
      return;
    }

    try {
      const currentWindow = await this.getCurrentMainWindow();
      if (!currentWindow) {
        logger.warn('resizeMainWindow: Kein aktuelles Fenster gefunden');
        return;
      }

      const config = WINDOW_CONFIGS[orientation];
      const size = new LogicalSize(config.width, config.height);

      await currentWindow.setSize(size);
      await currentWindow.center();

      logger.log(`Fenster-Größe geändert zu ${orientation}:`, config);
    } catch (error) {
      logger.error('Fehler beim Ändern der Fenster-Größe:', error);
      // Kein Toast - soll im Hintergrund laufen ohne User zu stören
    }
  }
}

// Singleton-Instanz exportieren
const service = new WindowService();

export const openAdminWindow = (opts?: OpenAdminOptions) => service.openAdmin(opts);
export const focusAdminWindow = () => service.focusAdmin();
export const closeAdminWindow = () => service.closeAdmin();
export const isAdminWindowOpen = () => service.isAdminOpen();
export const isInAdminWindow = () => service.isInAdminWindow();
export const resizeMainWindow = (orientation: WindowOrientation) => service.resizeMainWindow(orientation);
