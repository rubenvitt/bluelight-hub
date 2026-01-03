/**
 * GetHiOrgCredentialsQuery - Lädt HiOrg-Server Credentials (ohne Token!).
 *
 * @module application/integrations/queries/get-hiorg-credentials
 */

import { Result } from '@domain/common/result';

/**
 * Query zum Abrufen der HiOrg-Server Credentials.
 *
 * Gibt Credentials OHNE das API-Token zurück (nur hasToken: boolean).
 */
export class GetHiOrgCredentialsQuery {
  private constructor() {}

  /**
   * Factory-Methode.
   */
  static create(): Result<GetHiOrgCredentialsQuery> {
    return Result.ok(new GetHiOrgCredentialsQuery());
  }
}
