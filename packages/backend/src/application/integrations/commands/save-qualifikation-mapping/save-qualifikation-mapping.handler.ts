/**
 * SaveQualifikationMappingHandler - Handler für SaveQualifikationMappingCommand.
 *
 * Aktualisiert ein einzelnes Qualifikations-Mapping.
 * Bei manuellem Update wird isAutoMatched auf false gesetzt.
 *
 * Story 7.2: HiOrg-Server Import - Qualifikations-Mapping
 *
 * @module application/integrations/commands/save-qualifikation-mapping
 */

import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import { INTEGRATION_ERROR_CODES, IntegrationError, type IQualifikationMappingRepository } from '@domain/integrations';
import type { IQualifikationRepository } from '@domain/kraefte/repositories/i-qualifikation.repository';
import { INTEGRATIONS, DI_TOKENS, LOGGER } from '@/infrastructure/di-tokens';
import type { ILogger } from '@domain/ports/i-logger.port';
import type { SaveQualifikationMappingCommand } from './save-qualifikation-mapping.command';
import { QualifikationId } from '@domain/kraefte/value-objects/qualifikation-id';

/**
 * DTO für Update-Response.
 */
export interface UpdateMappingResultDto {
  /** Mapping ID */
  id: string;
  /** Neuer Qualifikation-ID Wert */
  qualifikationId: string | null;
  /** War es ein Auto-Match? */
  isAutoMatched: boolean;
}

/**
 * Handler für SaveQualifikationMappingCommand.
 */
@Injectable()
export class SaveQualifikationMappingHandler {
  constructor(
    @Inject(LOGGER)
    private readonly logger: ILogger,
    @Inject(INTEGRATIONS.QUALIFIKATION_MAPPING_REPOSITORY)
    private readonly mappingRepository: IQualifikationMappingRepository,
    @Inject(DI_TOKENS.REPOSITORIES.QUALIFIKATION)
    private readonly qualifikationRepository: IQualifikationRepository,
  ) {}

  /**
   * Führt den Command aus.
   */
  async execute(command: SaveQualifikationMappingCommand): Promise<Result<UpdateMappingResultDto>> {
    this.logger.log(`Updating mapping ${command.mappingId} by ${command.updatedBy}`);

    // 1. Mapping laden
    const mappingResult = await this.mappingRepository.findById(command.mappingId);
    if (mappingResult.isFailure) {
      return Result.fail(mappingResult.error ?? 'Fehler beim Laden des Mappings');
    }

    const mapping = mappingResult.value;
    if (!mapping) {
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.MAPPING_NOT_FOUND, `Mapping mit ID ${command.mappingId} nicht gefunden`));
    }

    // 2. Wenn qualifikationId gesetzt, prüfen ob Qualifikation existiert
    if (command.qualifikationId) {
      const qualId = QualifikationId.create(command.qualifikationId);
      if (qualId.isFailure) {
        return Result.fail(`Ungültige Qualifikation-ID: ${command.qualifikationId}`);
      }

      const qualIdValue = qualId.value;
      if (!qualIdValue) {
        return Result.fail(`Ungültige Qualifikation-ID: ${command.qualifikationId}`);
      }
      const existsResult = await this.qualifikationRepository.findById(qualIdValue);
      if (existsResult.isFailure || !existsResult.value) {
        return Result.fail(`Qualifikation mit ID ${command.qualifikationId} nicht gefunden`);
      }
    }

    // 3. Mapping aktualisieren (manuelles Update)
    const updatedMapping = mapping.updateMapping({
      qualifikationId: command.qualifikationId,
      updatedBy: command.updatedBy,
    });

    // 4. Speichern
    const saveResult = await this.mappingRepository.save(updatedMapping);
    if (saveResult.isFailure) {
      return Result.fail(saveResult.error ?? 'Fehler beim Speichern des Mappings');
    }

    this.logger.log(`Mapping ${command.mappingId} updated: qualifikationId=${command.qualifikationId ?? 'null'}`);

    return Result.ok({
      id: updatedMapping.id,
      qualifikationId: updatedMapping.qualifikationId,
      isAutoMatched: updatedMapping.isAutoMatched,
    });
  }
}
