/**
 * AutoMatchQualifikationenCommand - Command für automatisches Qualifikations-Matching.
 *
 * Story 7.2: HiOrg-Server Import - Qualifikations-Mapping
 *
 * @module application/integrations/commands/auto-match-qualifikationen
 */

import { Result } from '@domain/common/result';
import { INTEGRATION_TYPES, type IntegrationType } from '@domain/integrations';

/**
 * Command Parameter für AutoMatchQualifikationen.
 */
export interface AutoMatchQualifikationenCommandParams {
  /** Externe Quelle (z.B. "HIORG_SERVER") */
  source: IntegrationType;
  /** User der das Matching initiiert */
  initiatedBy: string;
  /** Nur ungemappte Einträge verarbeiten */
  onlyUnmapped?: boolean;
}

/**
 * Command zum automatischen Matchen von externen Qualifikations-Namen.
 *
 * Verwendet Levenshtein-Distanz und exaktes Matching um
 * externe Qualifikationen automatisch zuzuordnen.
 */
export class AutoMatchQualifikationenCommand {
  public readonly source: IntegrationType;
  public readonly initiatedBy: string;
  public readonly onlyUnmapped: boolean;

  private constructor(params: AutoMatchQualifikationenCommandParams) {
    this.source = params.source;
    this.initiatedBy = params.initiatedBy;
    this.onlyUnmapped = params.onlyUnmapped ?? true;
  }

  /**
   * Factory Method mit Validierung.
   */
  static create(params: AutoMatchQualifikationenCommandParams): Result<AutoMatchQualifikationenCommand> {
    if (!params.source) {
      return Result.fail('Source ist erforderlich');
    }

    if (!Object.values(INTEGRATION_TYPES).includes(params.source)) {
      return Result.fail(`Unbekannte Integration Source: ${params.source}`);
    }

    if (!params.initiatedBy || params.initiatedBy.trim().length === 0) {
      return Result.fail('InitiatedBy ist erforderlich');
    }

    return Result.ok(new AutoMatchQualifikationenCommand(params));
  }
}
