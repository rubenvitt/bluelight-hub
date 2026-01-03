/**
 * SaveQualifikationMappingCommand - Command zum Speichern eines Qualifikations-Mappings.
 *
 * Story 7.2: HiOrg-Server Import - Qualifikations-Mapping
 *
 * @module application/integrations/commands/save-qualifikation-mapping
 */

import { Result } from '@domain/common/result';

/**
 * Command Parameter für SaveQualifikationMapping.
 */
export interface SaveQualifikationMappingCommandParams {
  /** Mapping ID (für Update) */
  mappingId: string;
  /** Neue Qualifikation-ID (null zum Entfernen) */
  qualifikationId: string | null;
  /** User der das Mapping aktualisiert */
  updatedBy: string;
}

/**
 * Command zum Aktualisieren eines einzelnen Qualifikations-Mappings.
 */
export class SaveQualifikationMappingCommand {
  public readonly mappingId: string;
  public readonly qualifikationId: string | null;
  public readonly updatedBy: string;

  private constructor(params: SaveQualifikationMappingCommandParams) {
    this.mappingId = params.mappingId;
    this.qualifikationId = params.qualifikationId;
    this.updatedBy = params.updatedBy;
  }

  /**
   * Factory Method mit Validierung.
   */
  static create(params: SaveQualifikationMappingCommandParams): Result<SaveQualifikationMappingCommand> {
    if (!params.mappingId || params.mappingId.trim().length === 0) {
      return Result.fail('Mapping ID ist erforderlich');
    }

    if (!params.updatedBy || params.updatedBy.trim().length === 0) {
      return Result.fail('UpdatedBy ist erforderlich');
    }

    return Result.ok(new SaveQualifikationMappingCommand(params));
  }
}
