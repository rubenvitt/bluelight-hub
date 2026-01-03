/**
 * PreviewHiOrgPersonsHandler - Handler für PreviewHiOrgPersonsQuery.
 *
 * Lädt Personen aus HiOrg-Server für die Import-Vorschau.
 * Nutzt HiOrgTokenRefreshService für automatisches Token-Refresh bei Ablauf.
 *
 * @module application/integrations/queries/preview-hiorg-persons
 */

import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import type { IHiOrgServerPort, HiOrgPersonDto } from '@domain/ports/i-hiorg-server.port';
import { INTEGRATIONS } from '@/infrastructure/di-tokens';
import type { HiOrgTokenRefreshService } from '../../services/hiorg-token-refresh.service';
import type { PreviewHiOrgPersonsQuery } from './preview-hiorg-persons.query';

/**
 * DTO für Personen-Vorschau.
 */
export interface HiOrgPersonsPreviewDto {
  /** Gesamtzahl gefundener Personen */
  totalCount: number;
  /** Personen-Liste (vereinfacht für Vorschau) */
  persons: HiOrgPersonPreviewItem[];
}

/**
 * Vereinfachtes Personen-DTO für Vorschau.
 */
export interface HiOrgPersonPreviewItem {
  username: string;
  mitgliednr?: string;
  vorname: string;
  nachname: string;
  qualifikationenCount: number;
  ausbildungenCount: number;
}

/**
 * Handler für PreviewHiOrgPersonsQuery.
 *
 * Verwendet OAuth2 Access Token für HiOrg-Server API-Zugriff.
 * Token wird bei Ablauf automatisch refreshed.
 */
@Injectable()
export class PreviewHiOrgPersonsHandler {
  constructor(
    @Inject(INTEGRATIONS.HIORG_SERVER_PORT)
    private readonly hiorg: IHiOrgServerPort,
    private readonly tokenRefresh: HiOrgTokenRefreshService,
  ) {}

  /**
   * Führt die Query aus.
   */
  async execute(query: PreviewHiOrgPersonsQuery): Promise<Result<HiOrgPersonsPreviewDto>> {
    // 1. Gültiges Access Token holen (ggf. automatisch refreshen)
    const tokenResult = await this.tokenRefresh.getValidAccessToken();
    if (tokenResult.isFailure) {
      return Result.fail(tokenResult.error ?? 'Fehler beim Abrufen des Access Tokens');
    }

    const tokenData = tokenResult.value;
    if (!tokenData) {
      return Result.fail('Kein Access Token verfügbar');
    }
    const { accessToken } = tokenData;

    // 2. Personen laden
    const personsResult = await this.hiorg.fetchPersons(accessToken, {
      status: query.activeOnly ? ['aktiv'] : undefined,
    });

    if (personsResult.isFailure) {
      return Result.fail(personsResult.error ?? 'Fehler beim Laden der Personen');
    }

    const persons = personsResult.value ?? [];

    // 3. Auf Vorschau-Format mappen
    return Result.ok({
      totalCount: persons.length,
      persons: persons.map((p) => this.toPreviewItem(p)),
    });
  }

  /**
   * Mappt HiOrgPersonDto auf vereinfachtes Vorschau-DTO.
   */
  private toPreviewItem(person: HiOrgPersonDto): HiOrgPersonPreviewItem {
    return {
      username: person.username,
      mitgliednr: person.mitgliednr,
      vorname: person.vorname,
      nachname: person.nachname,
      qualifikationenCount: person.qualifikationen.length,
      ausbildungenCount: person.ausbildungen.length,
    };
  }
}
