import { logger } from '@/utils/logger';
import { AuthApi, Configuration, EinsatzApi, ETBApi, HealthApi, LagekarteApi, POIApi, UserManagementApi, UsersApi } from '@bluelight-hub/shared/client';
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
  const fallbackUrl = 'http://localhost:3090';
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
  private readonly poiApi: POIApi;

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
    this.poiApi = new POIApi(this.configuration);
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
   * Gibt die gecachte POI-API-Instanz zurück
   *
   * @returns Die POI-API-Instanz für POI-Management (Points of Interest)
   */
  poi(): POIApi {
    return this.poiApi;
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
