import { serverStore } from '@/features/server/stores/server.store';
import { logger } from '@/shared/lib/logger';

/**
 * Flag um mehrfache "No server configured" Warnungen zu verhindern.
 * Wird beim ersten fehlenden Server gesetzt und bei Server-Konfiguration zurückgesetzt.
 */
let hasLoggedNoServerWarning = false;
import {
  AdminApi,
  AdminIntegrationsHiorgApi,
  AdminKraefteQualifikationenApi,
  AdminKraefteRollenApi,
  AdminStammdatenFahrzeugeApi,
  AdminStammdatenPersonenApi,
  AuthApi,
  Configuration,
  EinsatzApi,
  EinsatzFahrzeugeApi,
  EinsatzPersonenApi,
  EinsatzTeilnehmerApi,
  ErinnerungenApi,
  ETBApi,
  GeocodingApi,
  HealthApi,
  KraefteDashboardApi,
  KraefteFahrzeugtypenApi,
  KraefteRollenDefinitionenApi,
  KraefteStammFahrzeugeApi,
  KraefteStammPersonenApi,
  LagekarteApi,
  LagekarteCQRSApi,
  RollenBesetzungApi,
  UserManagementApi,
  UsersApi,
} from '@bluelight-hub/shared/client';
import { fetchWithRefresh } from './fetchWithRefresh';

/**
 * Ermittelt die Basis-URL für die API basierend auf dem aktiven Server.
 *
 * WICHTIG: Es muss ein Server konfiguriert sein. Ohne konfigurierten Server
 * wird ein leerer String zurückgegeben, was API-Requests fehlschlagen lässt.
 * Der User wird dann automatisch zur Server-Setup-Seite weitergeleitet
 * (via useRequireServer Hook).
 *
 * HINWEIS: Diese Funktion greift direkt auf den Store zu und funktioniert
 * auch außerhalb von React-Komponenten.
 *
 * @returns Die Basis-URL ohne abschließenden Slash, oder leerer String wenn kein Server
 */
export const getBaseUrl = (): string => {
  const state = serverStore.state;

  // Nur wenn hydratisiert und ein Server aktiv ist
  if (state.isHydrated && state.activeServerId) {
    const activeServer = state.servers.find((s) => s.id === state.activeServerId);
    if (activeServer) {
      // Server gefunden - Warning-Flag zurücksetzen für nächsten Server-Wechsel
      hasLoggedNoServerWarning = false;
      logger.debug('Using active server URL', { url: activeServer.url, serverName: activeServer.name });
      // URL normalisieren (trailing slash entfernen)
      return activeServer.url.endsWith('/') ? activeServer.url.slice(0, -1) : activeServer.url;
    }
  }

  // Kein Server konfiguriert - leerer String führt zu fehlgeschlagenen Requests
  // useRequireServer Hook wird User zur Server-Setup-Seite leiten
  // Nur einmal warnen um Console-Spam zu vermeiden
  if (!hasLoggedNoServerWarning) {
    logger.warn('No server configured - API requests will fail');
    hasLoggedNoServerWarning = true;
  }
  return '';
};

/**
 * Zentrale Backend-API-Klasse für die Kommunikation mit dem BlueLight Hub Backend
 *
 * Diese Klasse stellt eine einheitliche Schnittstelle für alle API-Endpunkte bereit
 * und verwaltet die Konfiguration sowie Instanziierung der API-Clients.
 *
 * @example
 * ```typescript
 * const api = new BackendApi();
 * const healthStatus = await api.health().checkHealth();
 * ```
 */
class BackendApi {
  private readonly configuration: Configuration;
  private readonly adminApi: AdminApi;
  private readonly healthApi: HealthApi;
  private readonly authApi: AuthApi;
  private readonly userManagementApi: UserManagementApi;
  private readonly usersApi: UsersApi;
  private readonly einsatzApi: EinsatzApi;
  private readonly etbApi: ETBApi;
  private readonly lagekarteApi: LagekarteApi;
  private readonly lagekarteCqrsApi: LagekarteCQRSApi;
  private readonly geocodingApi: GeocodingApi;
  private readonly adminKraefteQualifikationenApi: AdminKraefteQualifikationenApi;
  private readonly adminStammdatenFahrzeugeApi: AdminStammdatenFahrzeugeApi;
  private readonly adminStammdatenPersonenApi: AdminStammdatenPersonenApi;
  private readonly einsatzFahrzeugeApi: EinsatzFahrzeugeApi;
  private readonly einsatzPersonenApi: EinsatzPersonenApi;
  private readonly kraefteDashboardApi: KraefteDashboardApi;
  private readonly kraefteFahrzeugtypenApi: KraefteFahrzeugtypenApi;
  private readonly kraefteStammFahrzeugeApi: KraefteStammFahrzeugeApi;
  private readonly kraefteStammPersonenApi: KraefteStammPersonenApi;
  private readonly adminKraefteRollenApi: AdminKraefteRollenApi;
  private readonly kraefteRollenDefinitionenApi: KraefteRollenDefinitionenApi;
  private readonly rollenBesetzungApi: RollenBesetzungApi;
  private readonly adminIntegrationsHiorgApi: AdminIntegrationsHiorgApi;
  private readonly einsatzTeilnehmerApi: EinsatzTeilnehmerApi;
  private readonly erinnerungenApi: ErinnerungenApi;

  /**
   * Erstellt eine neue Instanz der BackendApi-Klasse
   *
   * Initialisiert die Konfiguration mit der Backend-URL aus den Umgebungsvariablen
   * und erstellt gecachte Instanzen der API-Clients für optimale Performance.
   *
   * Verwendet einen custom fetch wrapper der automatisches Token-Refresh bei 401 handhabt.
   */
  constructor() {
    this.configuration = new Configuration({
      basePath: getBaseUrl(),
      fetchApi: fetchWithRefresh, // Use our custom fetch with refresh logic
      credentials: 'include',
    });

    // API-Instanzen werden einmalig erstellt und gecacht
    this.adminApi = new AdminApi(this.configuration);
    this.healthApi = new HealthApi(this.configuration);
    this.authApi = new AuthApi(this.configuration);
    this.userManagementApi = new UserManagementApi(this.configuration);
    this.usersApi = new UsersApi(this.configuration);
    this.einsatzApi = new EinsatzApi(this.configuration);
    this.etbApi = new ETBApi(this.configuration);
    this.lagekarteApi = new LagekarteApi(this.configuration);
    this.lagekarteCqrsApi = new LagekarteCQRSApi(this.configuration);
    this.geocodingApi = new GeocodingApi(this.configuration);
    this.adminKraefteQualifikationenApi = new AdminKraefteQualifikationenApi(this.configuration);
    this.adminKraefteRollenApi = new AdminKraefteRollenApi(this.configuration);
    this.kraefteRollenDefinitionenApi = new KraefteRollenDefinitionenApi(this.configuration);
    this.adminStammdatenFahrzeugeApi = new AdminStammdatenFahrzeugeApi(this.configuration);
    this.adminStammdatenPersonenApi = new AdminStammdatenPersonenApi(this.configuration);
    this.einsatzFahrzeugeApi = new EinsatzFahrzeugeApi(this.configuration);
    this.einsatzPersonenApi = new EinsatzPersonenApi(this.configuration);
    this.kraefteDashboardApi = new KraefteDashboardApi(this.configuration);
    this.kraefteFahrzeugtypenApi = new KraefteFahrzeugtypenApi(this.configuration);
    this.kraefteStammFahrzeugeApi = new KraefteStammFahrzeugeApi(this.configuration);
    this.kraefteStammPersonenApi = new KraefteStammPersonenApi(this.configuration);
    this.rollenBesetzungApi = new RollenBesetzungApi(this.configuration);
    this.adminIntegrationsHiorgApi = new AdminIntegrationsHiorgApi(this.configuration);
    this.einsatzTeilnehmerApi = new EinsatzTeilnehmerApi(this.configuration);
    this.erinnerungenApi = new ErinnerungenApi(this.configuration);
  }

  /**
   * Gibt die gecachte Admin-API-Instanz zurück
   *
   * @returns Die Admin-API-Instanz für Server-Setup und Admin-Operationen
   */
  admin(): AdminApi {
    return this.adminApi;
  }

  /**
   * Gibt die gecachte Health-API-Instanz zurück
   *
   * @returns Die Health-API-Instanz für Gesundheitsprüfungen des Backends
   */
  health(): HealthApi {
    return this.healthApi;
  }

  /**
   * Gibt die gecachte Auth-API-Instanz zurück
   *
   * @returns Die Auth-API-Instanz für Authentifizierung und Benutzerregistrierung
   */
  auth(): AuthApi {
    return this.authApi;
  }

  /**
   * Gibt die gecachte UserManagement-API-Instanz zurück
   *
   * @returns Die UserManagement-API-Instanz für Benutzerverwaltung durch Administratoren
   */
  userManagement(): UserManagementApi {
    return this.userManagementApi;
  }

  /**
   * Gibt die gecachte Users-API-Instanz zurück
   *
   * @returns Die Users-API-Instanz für öffentliche Benutzerabfragen
   */
  users(): UsersApi {
    return this.usersApi;
  }

  /**
   * Gibt die gecachte Einsatz-API-Instanz zurück
   *
   * @returns Die Einsatz-API-Instanz für Einsatz-Management
   */
  einsatz(): EinsatzApi {
    return this.einsatzApi;
  }

  /**
   * Gibt die gecachte ETB-API-Instanz zurück
   *
   * @returns Die ETB-API-Instanz für Einsatztagebuch-Management
   */
  etb(): ETBApi {
    return this.etbApi;
  }

  /**
   * Gibt die gecachte Lagekarte-API-Instanz zurück
   *
   * @returns Die Lagekarte-API-Instanz für Lagekarten-Management
   */
  lagekarte(): LagekarteApi {
    return this.lagekarteApi;
  }

  /**
   * Gibt die gecachte LagekarteCQRS-API-Instanz zurück
   *
   * @returns Die LagekarteCQRS-API-Instanz für POI-Management und CQRS-Operationen
   */
  lagekarteCqrs(): LagekarteCQRSApi {
    return this.lagekarteCqrsApi;
  }

  /**
   * Gibt die gecachte Geocoding-API-Instanz zurück
   *
   * @returns Die Geocoding-API-Instanz für Adress-Geocoding
   */
  geocoding(): GeocodingApi {
    return this.geocodingApi;
  }

  /**
   * Gibt die gecachte AdminKraefteQualifikationen-API-Instanz zurück
   *
   * @returns Die AdminKraefteQualifikationen-API-Instanz für Qualifikationen-Management
   */
  adminKraefteQualifikationen(): AdminKraefteQualifikationenApi {
    return this.adminKraefteQualifikationenApi;
  }

  /**
   * Gibt die gecachte AdminKraefteRollen-API-Instanz zurück
   *
   * @returns Die AdminKraefteRollen-API-Instanz für RollenDefinitionen-Management
   */
  adminKraefteRollen(): AdminKraefteRollenApi {
    return this.adminKraefteRollenApi;
  }

  /**
   * Gibt die gecachte KraefteRollenDefinitionen-API-Instanz zurück
   *
   * @returns Die KraefteRollenDefinitionen-API-Instanz für öffentliche RollenDefinitionen-Abfragen
   */
  kraefteRollenDefinitionen(): KraefteRollenDefinitionenApi {
    return this.kraefteRollenDefinitionenApi;
  }

  /**
   * Gibt die gecachte AdminStammdatenFahrzeuge-API-Instanz zurück
   *
   * @returns Die AdminStammdatenFahrzeuge-API-Instanz für Stamm-Fahrzeuge-Management
   */
  adminStammdatenFahrzeuge(): AdminStammdatenFahrzeugeApi {
    return this.adminStammdatenFahrzeugeApi;
  }

  /**
   * Gibt die gecachte EinsatzFahrzeuge-API-Instanz zurück
   *
   * @returns Die EinsatzFahrzeuge-API-Instanz für Einsatz-Fahrzeuge-Management
   */
  einsatzFahrzeuge(): EinsatzFahrzeugeApi {
    return this.einsatzFahrzeugeApi;
  }

  /**
   * Gibt die gecachte KraefteDashboard-API-Instanz zurück
   *
   * @returns Die KraefteDashboard-API-Instanz für Kräfte-Dashboard-Abfragen (Taktische Stärke)
   */
  kraefteDashboard(): KraefteDashboardApi {
    return this.kraefteDashboardApi;
  }

  /**
   * Gibt die gecachte KraefteFahrzeugtypen-API-Instanz zurück
   *
   * @returns Die KraefteFahrzeugtypen-API-Instanz für öffentliche Fahrzeugtypen-Abfragen
   */
  kraefteFahrzeugtypen(): KraefteFahrzeugtypenApi {
    return this.kraefteFahrzeugtypenApi;
  }

  /**
   * Gibt die gecachte EinsatzPersonen-API-Instanz zurück
   *
   * @returns Die EinsatzPersonen-API-Instanz für Einsatz-Personen-Management
   */
  einsatzPersonen(): EinsatzPersonenApi {
    return this.einsatzPersonenApi;
  }

  /**
   * Gibt die gecachte KraefteStammFahrzeuge-API-Instanz zurück
   *
   * @returns Die KraefteStammFahrzeuge-API-Instanz für öffentliche StammFahrzeuge-Abfragen
   */
  kraefteStammFahrzeuge(): KraefteStammFahrzeugeApi {
    return this.kraefteStammFahrzeugeApi;
  }

  /**
   * Gibt die gecachte AdminStammdatenPersonen-API-Instanz zurück
   *
   * @returns Die AdminStammdatenPersonen-API-Instanz für Stamm-Personen-Management
   */
  adminStammdatenPersonen(): AdminStammdatenPersonenApi {
    return this.adminStammdatenPersonenApi;
  }

  /**
   * Gibt die gecachte KraefteStammPersonen-API-Instanz zurück
   *
   * @returns Die KraefteStammPersonen-API-Instanz für öffentliche StammPersonen-Abfragen
   */
  kraefteStammPersonen(): KraefteStammPersonenApi {
    return this.kraefteStammPersonenApi;
  }

  /**
   * Gibt die gecachte RollenBesetzung-API-Instanz zurück
   *
   * @returns Die RollenBesetzung-API-Instanz für Rollen-Besetzungs-Management
   */
  rollenBesetzung(): RollenBesetzungApi {
    return this.rollenBesetzungApi;
  }

  /**
   * Gibt die gecachte AdminIntegrationsHiorg-API-Instanz zurück
   *
   * @returns Die AdminIntegrationsHiorg-API-Instanz für HiOrg-Server Integration
   */
  adminIntegrationsHiorg(): AdminIntegrationsHiorgApi {
    return this.adminIntegrationsHiorgApi;
  }

  /**
   * Gibt die gecachte EinsatzTeilnehmer-API-Instanz zurück
   *
   * @returns Die EinsatzTeilnehmer-API-Instanz für Einsatz-Beitritt mit Funkrufname
   */
  einsatzTeilnehmer(): EinsatzTeilnehmerApi {
    return this.einsatzTeilnehmerApi;
  }

  /**
   * Gibt die gecachte Erinnerungen-API-Instanz zurück
   *
   * @returns Die Erinnerungen-API-Instanz für Erinnerungs-Management (Wecker)
   */
  erinnerungen(): ErinnerungenApi {
    return this.erinnerungenApi;
  }
}

/**
 * Cache für BackendApi-Instanzen pro Server-URL.
 *
 * Verhindert unnötige Neuerstellung bei jedem API-Aufruf,
 * erstellt aber neue Instanz wenn die URL sich ändert.
 */
const apiCache = new Map<string, BackendApi>();

/**
 * Gibt die letzte verwendete URL zurück (für Debugging/Logs).
 */
let lastUsedUrl: string | null = null;

/**
 * Gibt die aktuelle BackendApi-Instanz für den aktiven Server zurück.
 *
 * Diese Funktion cached API-Instanzen pro URL. Bei Server-Wechsel
 * wird automatisch die richtige (gecachte) Instanz verwendet.
 *
 * @returns BackendApi-Instanz für den aktiven Server
 *
 * @example
 * ```typescript
 * import { getApi } from '@/shared/api/api';
 * const users = await getApi().userManagement().userManagementControllerFindAllVAlpha();
 * ```
 */
export function getApi(): BackendApi {
  const currentUrl = getBaseUrl();

  // Cache-Hit: Instanz für diese URL existiert bereits
  let instance = apiCache.get(currentUrl);
  if (instance) {
    return instance;
  }

  // Cache-Miss: Neue Instanz erstellen und cachen
  logger.debug('Creating new BackendApi instance', {
    url: currentUrl,
    previousUrl: lastUsedUrl,
    cacheSize: apiCache.size,
  });

  instance = new BackendApi();
  apiCache.set(currentUrl, instance);
  lastUsedUrl = currentUrl;

  return instance;
}

/**
 * Leert den API-Cache.
 *
 * Nützlich nach Server-Konfigurationsänderungen oder für Tests.
 */
export function clearApiCache(): void {
  apiCache.clear();
  lastUsedUrl = null;
  logger.debug('API cache cleared');
}

/**
 * Proxy-Objekt für rückwärtskompatiblen `api.*` Zugriff.
 *
 * Ermöglicht bestehenden Code weiter zu verwenden ohne Änderungen:
 * - `api.einsatz()` funktioniert weiterhin
 * - Bei Server-Wechsel wird automatisch die richtige Instanz verwendet
 *
 * Der Proxy delegiert alle Zugriffe an die aktuelle `getApi()` Instanz.
 *
 * @example
 * ```typescript
 * import { api } from '@/shared/api/api';
 * // Funktioniert wie bisher, aber dynamisch
 * const users = await api.userManagement().userManagementControllerFindAllVAlpha();
 * ```
 */
export const api: BackendApi = new Proxy({} as BackendApi, {
  get(_target, prop: string | symbol) {
    // Ignoriere Symbol-Properties (z.B. Symbol.toStringTag)
    if (typeof prop === 'symbol') {
      return undefined;
    }

    // Delegiert alle Property-Zugriffe an die aktuelle API-Instanz
    const currentApi = getApi();
    const value = currentApi[prop as keyof BackendApi];

    // Für Methoden: Binding an die richtige Instanz
    if (typeof value === 'function') {
      return value.bind(currentApi);
    }

    return value;
  },
});
