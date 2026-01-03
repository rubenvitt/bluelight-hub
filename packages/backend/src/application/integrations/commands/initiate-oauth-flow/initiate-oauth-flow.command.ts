/**
 * InitiateOAuthFlowCommand - Command für den Start des OAuth2 Authorization Code Flows.
 *
 * Enthält die notwendigen Parameter um einen OAuth2 Flow mit PKCE zu initiieren.
 * Der Handler generiert daraus eine Authorization URL und speichert den State.
 *
 * @module application/integrations/commands/initiate-oauth-flow
 */

import { Result } from '@domain/common/result';

/**
 * Properties für InitiateOAuthFlowCommand Factory.
 */
export interface InitiateOAuthFlowCommandProps {
  /** Integration-Typ (z.B. HIORG_SERVER) */
  integrationType: string;
  /** User ID der den Flow startet (für Audit Trail) */
  userId: string;
}

/**
 * Command zum Starten des OAuth2 Authorization Code Flows.
 *
 * **Verwendung:**
 * ```typescript
 * const commandResult = InitiateOAuthFlowCommand.create({
 *   integrationType: 'HIORG_SERVER',
 *   userId: currentUser.id,
 * });
 *
 * if (commandResult.isSuccess) {
 *   const result = await handler.execute(commandResult.value);
 *   // result.value.authorizationUrl -> Redirect User
 * }
 * ```
 */
export class InitiateOAuthFlowCommand {
  private constructor(
    public readonly integrationType: string,
    public readonly userId: string,
  ) {}

  /**
   * Factory-Methode mit Validierung.
   *
   * @param props - Command Properties
   * @returns Result mit Command bei Erfolg
   */
  static create(props: InitiateOAuthFlowCommandProps): Result<InitiateOAuthFlowCommand> {
    if (!props.integrationType || props.integrationType.trim().length === 0) {
      return Result.fail('Integration Type ist erforderlich');
    }

    if (!props.userId || props.userId.trim().length === 0) {
      return Result.fail('User ID ist erforderlich');
    }

    return Result.ok(new InitiateOAuthFlowCommand(props.integrationType.trim(), props.userId.trim()));
  }
}
