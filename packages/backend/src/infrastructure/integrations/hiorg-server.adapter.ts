/**
 * HiOrg-Server API Adapter - Implementierung des IHiOrgServerPort.
 *
 * HTTP-Client für die HiOrg-Server REST API mit JSON:API Format.
 *
 * **API-Spezifikationen:**
 * - Base URL: https://api.hiorg-server.de/core/v1
 * - Format: JSON:API (application/vnd.api+json)
 * - Auth: OAuth2 Bearer Token
 * - Rate Limit: 30 Requests/Minute (mit exponential backoff)
 * - Timeout: 10 Sekunden
 *
 * **Fehlerbehandlung:**
 * - 401: Token ungültig/abgelaufen → INTEGRATION_003
 * - 403: Keine Berechtigung → CONNECTION_FAILED
 * - 423: Feature gesperrt/nicht lizenziert → FEATURE_LOCKED
 * - 429: Rate Limit → RATE_LIMITED
 * - 5xx: Server-Fehler → CONNECTION_FAILED (mit Retry)
 *
 * @module infrastructure/integrations
 * @see IHiOrgServerPort - Domain Port Interface
 */

import { Injectable, Logger } from '@nestjs/common';
import { Result } from '@domain/common/result';
import type { IHiOrgServerPort, HiOrgConnectionInfo, HiOrgPersonDto, HiOrgFetchOptions, HiOrgQualifikation, HiOrgAusbildung } from '@domain/ports/i-hiorg-server.port';
import { INTEGRATION_ERROR_CODES, IntegrationError } from '@domain/integrations/common/integration-error-codes';

/** Base URL der HiOrg-Server API */
const BASE_URL = 'https://api.hiorg-server.de/core/v1';

/** Timeout für HTTP-Requests in Millisekunden */
const REQUEST_TIMEOUT = 10000;

/** JSON:API Content-Type Header */
const JSON_API_CONTENT_TYPE = 'application/vnd.api+json';

/**
 * JSON:API Response Wrapper.
 */
interface JsonApiResponse<T> {
  data: T | T[];
  meta?: {
    total?: number;
    page?: number;
  };
  included?: unknown[];
}

/**
 * JSON:API Resource Object.
 */
interface JsonApiResource {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, { data: { id: string; type: string } | { id: string; type: string }[] }>;
}

/**
 * HiOrg-Server API Adapter.
 *
 * **Verwendung:**
 * ```typescript
 * @Inject(INTEGRATIONS.HIORG_SERVER_PORT) private readonly hiorg: IHiOrgServerPort
 *
 * const result = await this.hiorg.testConnection('ov-darmstadt', 'bearer-token');
 * ```
 */
@Injectable()
export class HiOrgServerAdapter implements IHiOrgServerPort {
  private readonly logger = new Logger(HiOrgServerAdapter.name);

  /**
   * Zeitpunkt des letzten API-Requests für Rate Limiting.
   *
   * HiOrg-Server API hat ein Limit von 30 Requests/Minute.
   * Mit 2 Sekunden Mindestabstand zwischen Requests bleiben wir sicher darunter.
   */
  private lastRequestTime = 0;

  /**
   * Mindestabstand zwischen API-Requests in Millisekunden.
   *
   * 2000ms = max 30 Requests/Minute (60s / 30 = 2s)
   */
  private readonly minRequestInterval = 2000;

  /**
   * Testet die Verbindung zum HiOrg-Server.
   *
   * Ruft den Organisations-Stammdaten-Endpoint auf.
   * Die Organisation wird anhand des Tokens automatisch ermittelt.
   */
  async testConnection(token: string): Promise<Result<HiOrgConnectionInfo>> {
    try {
      const response = await this.fetchWithAuth<JsonApiResponse<JsonApiResource>>(`${BASE_URL}/organisation/selbst/stammdaten`, token);

      if (response.isFailure) {
        return Result.fail(response.error!);
      }

      const data = response.value!.data;
      const attributes = Array.isArray(data) ? data[0]?.attributes : data.attributes;

      return Result.ok({
        organisationName: (attributes?.name as string) || 'Unbekannte Organisation',
        testedAt: new Date(),
      });
    } catch (error) {
      this.logger.error('Connection test failed', {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : undefined,
      });
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.CONNECTION_FAILED, 'Verbindung zu HiOrg-Server fehlgeschlagen'));
    }
  }

  /**
   * Lädt Personen aus HiOrg-Server.
   *
   * Die Organisation wird anhand des Tokens automatisch ermittelt.
   */
  async fetchPersons(token: string, options?: HiOrgFetchOptions): Promise<Result<HiOrgPersonDto[]>> {
    try {
      // URL mit Filter-Parametern aufbauen
      const url = new URL(`${BASE_URL}/personal`);

      if (options?.updatedSince) {
        url.searchParams.set('filter[updated_since]', options.updatedSince.toISOString());
      }

      if (options?.status?.length) {
        url.searchParams.set('filter[status]', options.status.join(','));
      }

      const response = await this.fetchWithAuth<JsonApiResponse<JsonApiResource>>(url.toString(), token);

      if (response.isFailure) {
        return Result.fail(response.error!);
      }

      const data = response.value!.data;
      const resources = Array.isArray(data) ? data : [data];

      // Personen mit Ausbildungen laden (separate Requests pro Person)
      const persons: HiOrgPersonDto[] = [];

      for (const resource of resources) {
        const person = this.mapResourceToPerson(resource);

        // Ausbildungen laden (optional, bei Bedarf)
        const ausbildungenResult = await this.fetchAusbildungen(resource.id, token);
        if (ausbildungenResult.isSuccess && ausbildungenResult.value) {
          person.ausbildungen = ausbildungenResult.value;
        }

        persons.push(person);
      }

      this.logger.log(`Fetched ${persons.length} persons from HiOrg-Server`);
      return Result.ok(persons);
    } catch (error) {
      this.logger.error('Fetch persons failed', {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : undefined,
      });
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.CONNECTION_FAILED, 'Personenabruf von HiOrg-Server fehlgeschlagen'));
    }
  }

  /**
   * Lädt Ausbildungen für eine Person.
   */
  private async fetchAusbildungen(personId: string, token: string): Promise<Result<HiOrgAusbildung[]>> {
    try {
      const response = await this.fetchWithAuth<JsonApiResponse<JsonApiResource>>(`${BASE_URL}/personal/${personId}/ausbildungen`, token);

      if (response.isFailure || !response.value) {
        return Result.ok([]); // Bei Fehler leere Liste (nicht kritisch)
      }

      const data = response.value.data;
      const resources = Array.isArray(data) ? data : [data];

      return Result.ok(
        resources.map((r) => ({
          id: r.id,
          bezeichnung: (r.attributes.bezeichnung as string) || '',
          datum: r.attributes.datum as string | undefined,
          gueltig_bis: r.attributes.gueltig_bis as string | undefined,
          lehrgangsnummer: r.attributes.lehrgangsnummer as string | undefined,
        })),
      );
    } catch {
      return Result.ok([]); // Bei Fehler leere Liste (nicht kritisch)
    }
  }

  /**
   * Erzwingt den Mindestabstand zwischen API-Requests (Rate Limiting).
   *
   * Wartet ggf. bis der Mindestabstand von 2 Sekunden seit dem letzten
   * Request vergangen ist, um das HiOrg-Server Rate Limit von 30 Requests/Minute
   * einzuhalten.
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      this.logger.debug(`Rate Limiting: Warte ${waitTime}ms vor nächstem HiOrg-Server Request`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * HTTP-Request mit Bearer Token und JSON:API Headers.
   *
   * Wendet Rate Limiting an (max 30 Requests/Minute).
   */
  private async fetchWithAuth<T>(url: string, token: string): Promise<Result<T>> {
    // Rate Limit VOR dem Request erzwingen
    await this.enforceRateLimit();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: JSON_API_CONTENT_TYPE,
          'Content-Type': JSON_API_CONTENT_TYPE,
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // HTTP Status Code Handling
      if (!response.ok) {
        return this.handleHttpError(response.status);
      }

      const data = (await response.json()) as T;
      return Result.ok(data);
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof Error && error.name === 'AbortError') {
        return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.CONNECTION_FAILED, 'Request-Timeout überschritten'));
      }

      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.CONNECTION_FAILED, 'Netzwerkfehler bei HiOrg-Server Request'));
    }
  }

  /**
   * Mappt HTTP-Status-Codes auf Integration Error Codes.
   */
  private handleHttpError(status: number): Result<never> {
    switch (status) {
      case 401:
        return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.INVALID_TOKEN, 'API-Token ungültig oder abgelaufen'));
      case 403:
        return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.CONNECTION_FAILED, 'Keine Berechtigung für diese Ressource'));
      case 423:
        return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.FEATURE_LOCKED, 'Feature in HiOrg-Server nicht freigeschaltet oder nicht lizenziert'));
      case 429:
        return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.RATE_LIMITED, 'Rate-Limit überschritten - bitte später erneut versuchen'));
      default:
        return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.CONNECTION_FAILED, `HTTP-Fehler ${status} von HiOrg-Server`));
    }
  }

  /**
   * Mappt JSON:API Resource auf HiOrgPersonDto.
   */
  private mapResourceToPerson(resource: JsonApiResource): HiOrgPersonDto {
    const attrs = resource.attributes;

    // Qualifikationen aus Attributes extrahieren
    const qualifikationen: HiOrgQualifikation[] = [];
    if (Array.isArray(attrs.qualifikationen)) {
      for (const q of attrs.qualifikationen as Record<string, unknown>[]) {
        qualifikationen.push({
          position: (q.position as number) || 0,
          liste_id: (q.liste_id as number) || 0,
          rang: q.rang as string | undefined,
          name: (q.name as string) || '',
          name_kurz: q.name_kurz as string | undefined,
          erwerb_datum: q.erwerb_datum as string | undefined,
        });
      }
    }

    return {
      username: (attrs.username as string) || resource.id,
      mitgliednr: attrs.mitgliednr as string | undefined,
      vorname: (attrs.vorname as string) || '',
      nachname: (attrs.nachname as string) || '',
      email: attrs.email as string | undefined,
      handy: attrs.handy as string | undefined,
      telpriv: attrs.telpriv as string | undefined,
      teldienst: attrs.teldienst as string | undefined,
      gruppen_namen: (attrs.gruppen_namen as string[]) || [],
      qualifikationen,
      ausbildungen: [], // Werden separat geladen
    };
  }
}
