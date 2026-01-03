/**
 * GetQualifikationMappingsQuery - Query für Qualifikations-Mappings.
 *
 * Story 7.2: HiOrg-Server Import - Qualifikations-Mapping
 *
 * @module application/integrations/queries/get-qualifikation-mappings
 */

import { Result } from '@domain/common/result';
import { INTEGRATION_TYPES, type IntegrationType } from '@domain/integrations';

/**
 * Query Parameter für GetQualifikationMappings.
 */
export interface GetQualifikationMappingsQueryParams {
  /** Externe Quelle (z.B. "HIORG_SERVER") */
  source: IntegrationType;
  /** Optional: Nur ungemappte anzeigen */
  onlyUnmapped?: boolean;
}

/**
 * Query zum Laden aller Qualifikations-Mappings.
 */
export class GetQualifikationMappingsQuery {
  public readonly source: IntegrationType;
  public readonly onlyUnmapped: boolean;

  private constructor(params: GetQualifikationMappingsQueryParams) {
    this.source = params.source;
    this.onlyUnmapped = params.onlyUnmapped ?? false;
  }

  /**
   * Factory Method mit Validierung.
   */
  static create(params: GetQualifikationMappingsQueryParams): Result<GetQualifikationMappingsQuery> {
    if (!params.source) {
      return Result.fail('Source ist erforderlich');
    }

    // Validiere dass es ein gültiger IntegrationType ist
    if (!Object.values(INTEGRATION_TYPES).includes(params.source)) {
      return Result.fail(`Unbekannte Integration Source: ${params.source}`);
    }

    return Result.ok(new GetQualifikationMappingsQuery(params));
  }
}
