/**
 * Offline Detection Service fuer Netzwerk-Status Ueberwachung
 *
 * Ueberwacht den Online/Offline-Status und benachrichtigt Subscriber
 * bei Statuswechseln. Nutzt navigator.onLine + window events.
 *
 * **Story 1.8 AC1, AC3:**
 * - Offline Detection via navigator.onLine + window events
 * - State: { isOffline: boolean, offlineSince: Date | null }
 * - Callbacks fuer Reconnect-Handling (Sync-Trigger)
 */

/**
 * Offline-Status State
 */
export interface OfflineState {
  /** True wenn keine Netzwerkverbindung besteht */
  isOffline: boolean;
  /** Zeitpunkt seit dem die Verbindung offline ist (null wenn online) */
  offlineSince: Date | null;
}

/**
 * Callback-Daten bei Reconnect (online Event)
 */
export interface OnlineCallbackData {
  /** Zeitpunkt seit dem offline war */
  offlineSince: Date;
  /** Zeitpunkt der Wiederverbindung */
  onlineSince: Date;
}

/**
 * Subscriber-Callback fuer State-Aenderungen
 */
export type OfflineStateSubscriber = (state: OfflineState) => void;

/**
 * Callback bei Wiederverbindung (fuer Sync-Trigger)
 */
export type OnOnlineCallback = (data: OnlineCallbackData) => void;

/**
 * Callback bei Verbindungsverlust
 */
export type OnOfflineCallback = () => void;

/**
 * Offline Detection Service Klasse
 *
 * Verwaltet den Netzwerk-Status und benachrichtigt Subscriber bei Aenderungen.
 * Nutzt das Singleton Pattern fuer globale Verfuegbarkeit.
 *
 * **AC1:** Erkennt Offline-Status via navigator.onLine
 * **AC3:** Triggert Reconnect-Callbacks fuer Synchronisation
 *
 * @example
 * ```typescript
 * const service = new OfflineDetectionService();
 *
 * // Subscribe to state changes
 * const unsubscribe = service.subscribe((state) => {
 *   console.log('Offline:', state.isOffline);
 * });
 *
 * // Set reconnect callback for sync
 * service.setOnOnlineCallback((data) => {
 *   console.log('Back online, was offline since:', data.offlineSince);
 *   syncService.sync();
 * });
 *
 * // Cleanup
 * unsubscribe();
 * service.destroy();
 * ```
 */
export class OfflineDetectionService {
  /** Aktueller Offline-Status */
  private state: OfflineState;

  /** Subscriber fuer State-Aenderungen */
  private subscribers: Set<OfflineStateSubscriber> = new Set();

  /** Callback bei Wiederverbindung */
  private onOnlineCallback: OnOnlineCallback | null = null;

  /** Callback bei Verbindungsverlust */
  private onOfflineCallback: OnOfflineCallback | null = null;

  /** Bound Event Handler fuer cleanup */
  private boundHandleOnline: () => void;
  private boundHandleOffline: () => void;

  /** Flag ob Service zerstoert wurde */
  private destroyed = false;

  /**
   * Erstellt eine neue Instanz des Offline Detection Service
   *
   * Registriert automatisch Event Listener fuer online/offline Events
   * und initialisiert den State basierend auf navigator.onLine.
   */
  constructor() {
    // Initialer State basierend auf navigator.onLine
    const initialOffline = !navigator.onLine;
    this.state = {
      isOffline: initialOffline,
      offlineSince: initialOffline ? new Date() : null,
    };

    // Bind event handlers fuer cleanup
    this.boundHandleOnline = this.handleOnline.bind(this);
    this.boundHandleOffline = this.handleOffline.bind(this);

    // Event Listener registrieren
    window.addEventListener('online', this.boundHandleOnline);
    window.addEventListener('offline', this.boundHandleOffline);
  }

  /**
   * Gibt den aktuellen Offline-Status zurueck
   *
   * @returns Aktueller OfflineState
   */
  getState(): OfflineState {
    return { ...this.state };
  }

  /**
   * Prueft ob aktuell offline
   *
   * @returns true wenn offline
   */
  isOffline(): boolean {
    return this.state.isOffline;
  }

  /**
   * Markiert den Status manuell als offline
   *
   * Wird verwendet wenn ein API-Call mit Netzwerkfehler fehlschlaegt,
   * obwohl navigator.onLine noch true war (Race Condition).
   * Dies synchronisiert den internen State mit der tatsaechlichen Situation.
   *
   * **Fix Issue #1:** Network Error Detection bei Race Condition
   */
  markOffline(): void {
    if (this.destroyed || this.state.isOffline) {
      return;
    }

    // State aktualisieren
    this.state = {
      isOffline: true,
      offlineSince: new Date(),
    };

    // Subscriber benachrichtigen
    this.notifySubscribers();

    // onOffline Callback
    if (this.onOfflineCallback) {
      try {
        this.onOfflineCallback();
      } catch (error) {
        console.error('[OfflineDetectionService] onOffline callback error:', error);
      }
    }
  }

  /**
   * Setzt den Callback fuer Wiederverbindung
   *
   * Wird aufgerufen wenn die Verbindung wiederhergestellt wird.
   * Nuetzlich fuer Sync-Trigger bei Reconnect (AC3).
   *
   * @param callback - Callback-Funktion oder null zum Entfernen
   */
  setOnOnlineCallback(callback: OnOnlineCallback | null): void {
    this.onOnlineCallback = callback;
  }

  /**
   * Setzt den Callback fuer Verbindungsverlust
   *
   * Wird aufgerufen wenn die Verbindung verloren geht.
   *
   * @param callback - Callback-Funktion oder null zum Entfernen
   */
  setOnOfflineCallback(callback: OnOfflineCallback | null): void {
    this.onOfflineCallback = callback;
  }

  /**
   * Registriert einen Subscriber fuer State-Aenderungen
   *
   * @param subscriber - Callback bei State-Aenderung
   * @returns Unsubscribe-Funktion
   */
  subscribe(subscriber: OfflineStateSubscriber): () => void {
    this.subscribers.add(subscriber);

    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  /**
   * Zerstoert den Service und raeumt Ressourcen auf
   *
   * Entfernt Event Listener und alle Callbacks.
   * Kann sicher mehrfach aufgerufen werden.
   */
  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    // Event Listener entfernen
    window.removeEventListener('online', this.boundHandleOnline);
    window.removeEventListener('offline', this.boundHandleOffline);

    // Callbacks clearen
    this.onOnlineCallback = null;
    this.onOfflineCallback = null;
    this.subscribers.clear();
  }

  /**
   * Handler fuer online Event
   *
   * Aktualisiert State, benachrichtigt Subscriber und
   * ruft onOnline Callback auf (fuer Sync-Trigger).
   */
  private handleOnline(): void {
    if (this.destroyed) {
      return;
    }

    // Nur reagieren wenn vorher offline
    if (!this.state.isOffline) {
      return;
    }

    const offlineSince = this.state.offlineSince;
    const onlineSince = new Date();

    // State aktualisieren
    this.state = {
      isOffline: false,
      offlineSince: null,
    };

    // Subscriber benachrichtigen
    this.notifySubscribers();

    // onOnline Callback (fuer Sync-Trigger)
    if (this.onOnlineCallback && offlineSince) {
      try {
        this.onOnlineCallback({
          offlineSince,
          onlineSince,
        });
      } catch (error) {
        console.error('[OfflineDetectionService] onOnline callback error:', error);
      }
    }
  }

  /**
   * Handler fuer offline Event
   *
   * Aktualisiert State und benachrichtigt Subscriber.
   */
  private handleOffline(): void {
    if (this.destroyed) {
      return;
    }

    // Nur reagieren wenn vorher online
    if (this.state.isOffline) {
      return;
    }

    // State aktualisieren
    this.state = {
      isOffline: true,
      offlineSince: new Date(),
    };

    // Subscriber benachrichtigen
    this.notifySubscribers();

    // onOffline Callback
    if (this.onOfflineCallback) {
      try {
        this.onOfflineCallback();
      } catch (error) {
        console.error('[OfflineDetectionService] onOffline callback error:', error);
      }
    }
  }

  /**
   * Benachrichtigt alle Subscriber ueber State-Aenderung
   */
  private notifySubscribers(): void {
    const stateCopy = this.getState();

    for (const subscriber of this.subscribers) {
      try {
        subscriber(stateCopy);
      } catch (error) {
        console.error('[OfflineDetectionService] Subscriber error:', error);
      }
    }
  }
}

/**
 * Singleton-Instanz des Offline Detection Service
 *
 * Fuer einfache Verwendung ohne manuelle Instanziierung.
 *
 * @example
 * ```typescript
 * import { offlineDetectionService } from './offline-detection.service';
 *
 * if (offlineDetectionService.isOffline()) {
 *   console.log('Currently offline');
 * }
 * ```
 */
export const offlineDetectionService = new OfflineDetectionService();
