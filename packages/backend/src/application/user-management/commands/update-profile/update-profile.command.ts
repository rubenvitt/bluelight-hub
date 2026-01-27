import { Result } from '@domain/common/result';

/**
 * Command zum Aktualisieren des eigenen Profils.
 *
 * Erlaubt Benutzern, ihre eigenen Einstellungen zu ändern,
 * z.B. die Standard-Eskalationsperson.
 */
export class UpdateProfileCommand {
  private constructor(
    public readonly userId: string,
    public readonly defaultEscalationTargetId: string | undefined | null,
  ) {}

  public static create(userId: string, defaultEscalationTargetId?: string | null): Result<UpdateProfileCommand> {
    if (!userId) {
      return Result.fail('userId is required');
    }

    // Validation for escalation target is done in Handler (User existence check)
    // Here we just pass the ID.

    return Result.ok(new UpdateProfileCommand(userId, defaultEscalationTargetId));
  }
}
