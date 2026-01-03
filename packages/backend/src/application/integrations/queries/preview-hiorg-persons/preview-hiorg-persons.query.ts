/**
 * PreviewHiOrgPersonsQuery - Lädt Personen-Vorschau aus HiOrg-Server.
 *
 * @module application/integrations/queries/preview-hiorg-persons
 */

import { Result } from '@domain/common/result';

/**
 * Query Properties.
 */
export interface PreviewHiOrgPersonsProps {
  /** Nur aktive Personen laden? */
  activeOnly?: boolean;
}

/**
 * Query zum Laden einer Personen-Vorschau aus HiOrg-Server.
 *
 * Verwendet die gespeicherten Credentials.
 */
export class PreviewHiOrgPersonsQuery {
  private constructor(public readonly activeOnly: boolean) {}

  /**
   * Factory-Methode.
   */
  static create(props?: PreviewHiOrgPersonsProps): Result<PreviewHiOrgPersonsQuery> {
    return Result.ok(new PreviewHiOrgPersonsQuery(props?.activeOnly ?? true));
  }
}
