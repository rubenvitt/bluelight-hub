/**
 * ProcessOAuthCallbackCommand - Command für die Verarbeitung des OAuth2 Callbacks.
 *
 * Enthält den Authorization Code und State aus dem OAuth2 Callback.
 * Der Handler validiert den State und tauscht den Code gegen Tokens.
 *
 * @module application/integrations/commands/process-oauth-callback
 */

import { Result } from '@domain/common/result';

/**
 * Properties für ProcessOAuthCallbackCommand Factory.
 */
export interface ProcessOAuthCallbackCommandProps {
  /** Authorization Code vom OAuth2 Provider */
  code: string;
  /** State-Token für CSRF-Validierung */
  state: string;
}

/**
 * Command zur Verarbeitung des OAuth2 Callbacks.
 *
 * **Verwendung:**
 * ```typescript
 * const commandResult = ProcessOAuthCallbackCommand.create({
 *   code: req.query.code,
 *   state: req.query.state,
 * });
 *
 * if (commandResult.isSuccess) {
 *   const result = await handler.execute(commandResult.value);
 *   if (result.isSuccess) {
 *     // Tokens wurden gespeichert, redirect zu Success-Page
 *   }
 * }
 * ```
 */
export class ProcessOAuthCallbackCommand {
  private constructor(
    public readonly code: string,
    public readonly state: string,
  ) {}

  /**
   * Factory-Methode mit Validierung.
   *
   * @param props - Command Properties
   * @returns Result mit Command bei Erfolg
   */
  static create(props: ProcessOAuthCallbackCommandProps): Result<ProcessOAuthCallbackCommand> {
    if (!props.code || props.code.trim().length === 0) {
      return Result.fail('Authorization Code ist erforderlich');
    }

    if (!props.state || props.state.trim().length === 0) {
      return Result.fail('State ist erforderlich');
    }

    return Result.ok(new ProcessOAuthCallbackCommand(props.code.trim(), props.state.trim()));
  }
}
