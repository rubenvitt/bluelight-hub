/**
 * TestHiOrgConnectionCommand - Testet die HiOrg-Server Verbindung.
 *
 * @module application/integrations/commands/test-hiorg-connection
 */

import { Result } from '@domain/common/result';

/**
 * Command Properties.
 */
export interface TestHiOrgConnectionProps {
  /** User ID des ausführenden Admins */
  userId: string;
}

/**
 * Command zum Testen der HiOrg-Server Verbindung.
 *
 * Verwendet die gespeicherten Credentials.
 */
export class TestHiOrgConnectionCommand {
  private constructor(public readonly userId: string) {}

  /**
   * Factory-Methode.
   */
  static create(props: TestHiOrgConnectionProps): Result<TestHiOrgConnectionCommand> {
    return Result.ok(new TestHiOrgConnectionCommand(props.userId));
  }
}
