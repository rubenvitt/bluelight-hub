import { logger } from '@/shared/lib/logger';
import {
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
 * Ermittelt die Basis-URL für die API basierend auf der Umgebung
 *
 * @returns Die Basis-URL ohne abschließenden Slash
 */
export const getBaseUrl = (): string => {
  const configuredUrl = import.meta.env.VITE_API_URL;
  if (configuredUrl && configuredUrl.trim() !== '') {
    logger.debug('Using configured API URL', { configuredUrl });

    if (configuredUrl.endsWith('/')) {
      return configuredUrl.slice(0, -1);
    }

    return configuredUrl;
  }
  // Fallback für Entwicklung
  const fallbackUrl = 'http://localhost:3091';
  logger.debug('Using fallback API URL', { fallbackUrl });
  return fallbackUrl;
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
}

/**
 * Singleton-Instanz der BackendApi für die Verwendung in der gesamten Anwendung
 *
 * @example
 * ```typescript
 * import {api} from '@/api';
 * const users = await api.userManagement().userManagementControllerFindAllVAlpha();
 * ```
 */
export const api = new BackendApi();
