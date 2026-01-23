import { Result } from '@domain/common/result';
import { ERINNERUNG_ERROR_CODES } from '../../errors/erinnerung-error.codes';

/**
 * Props für die AssignErinnerungCommand Erstellung.
 */
export interface AssignErinnerungCommandProps {
  /** ID der zuzuweisenden Erinnerung */
  erinnerungId: string;
  /** ID des Einsatzes (für Validierung) */
  einsatzId: string;
  /** ID des Users, dem die Erinnerung zugewiesen wird */
  assignedToId: string;
  /** ID des Users, der die Zuweisung vornimmt */
  assignedById: string;
}

/**
 * Command zum Zuweisen einer bestehenden Erinnerung an einen anderen Benutzer.
 *
 * Factory Method Pattern mit Result<T> für konsistente Validierung.
 * Keine Exceptions, sondern explizite Fehlerbehandlung (AC4).
 *
 * **Story 3.4 AC1:**
 * - Bestehende Erinnerung nachträglich zuweisen
 * - Teilnehmer aus aktiven Einsatz-Teilnehmern auswählen
 *
 * **Story 3.4 AC2:**
 * - Nach Zuweisung verschwindet Erinnerung aus "Meine Erinnerungen" des alten Besitzers
 * - Bleibt in "Team-Erinnerungen" sichtbar
 *
 * @example
 * ```typescript
 * const result = AssignErinnerungCommand.create({
 *   erinnerungId: 'clw3h8x9y0000...',
 *   einsatzId: 'clw3h8x9y0001...',
 *   assignedToId: 'clw3h8x9y0002...',
 *   assignedById: 'clw3h8x9y0003...',
 * });
 *
 * if (result.isSuccess) {
 *   await handler.execute(result.value!);
 * }
 * ```
 */
export class AssignErinnerungCommand {
  /**
   * CUID2 Pattern für ID-Validierung.
   * CUID2 ist 24-32 Zeichen lang, lowercase alphanumeric.
   */
  private static readonly CUID2_PATTERN = /^[a-z0-9]{24,32}$/;

  private constructor(
    public readonly erinnerungId: string,
    public readonly einsatzId: string,
    public readonly assignedToId: string,
    public readonly assignedById: string,
  ) {}

  /**
   * Factory Method zur Erstellung eines validierten Commands.
   *
   * **Validierung:**
   * 1. ErinnerungId: Erforderlich, CUID2 Format
   * 2. EinsatzId: Erforderlich, CUID2 Format
   * 3. AssignedToId: Erforderlich, CUID2 Format
   * 4. AssignedById: Erforderlich, CUID2 Format
   *
   * @param props - Command Properties
   * @returns Result<AssignErinnerungCommand> - Validierter Command oder Fehler
   */
  static create(props: AssignErinnerungCommandProps): Result<AssignErinnerungCommand> {
    // ════════════════════════════════════════════════════════════════════════
    // Validiere ErinnerungId
    // ════════════════════════════════════════════════════════════════════════
    const trimmedErinnerungId = props.erinnerungId?.trim() ?? '';

    if (trimmedErinnerungId.length === 0) {
      return Result.fail<AssignErinnerungCommand>(ERINNERUNG_ERROR_CODES.ID_REQUIRED);
    }

    if (!AssignErinnerungCommand.CUID2_PATTERN.test(trimmedErinnerungId)) {
      return Result.fail<AssignErinnerungCommand>(ERINNERUNG_ERROR_CODES.ID_INVALID);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Validiere EinsatzId
    // ════════════════════════════════════════════════════════════════════════
    const trimmedEinsatzId = props.einsatzId?.trim() ?? '';

    if (trimmedEinsatzId.length === 0) {
      return Result.fail<AssignErinnerungCommand>(ERINNERUNG_ERROR_CODES.EINSATZ_ID_REQUIRED);
    }

    if (!AssignErinnerungCommand.CUID2_PATTERN.test(trimmedEinsatzId)) {
      return Result.fail<AssignErinnerungCommand>(ERINNERUNG_ERROR_CODES.EINSATZ_ID_INVALID);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Validiere AssignedToId
    // ════════════════════════════════════════════════════════════════════════
    const trimmedAssignedToId = props.assignedToId?.trim() ?? '';

    if (trimmedAssignedToId.length === 0) {
      return Result.fail<AssignErinnerungCommand>(ERINNERUNG_ERROR_CODES.INVALID_ASSIGNED_TO);
    }

    if (!AssignErinnerungCommand.CUID2_PATTERN.test(trimmedAssignedToId)) {
      return Result.fail<AssignErinnerungCommand>(ERINNERUNG_ERROR_CODES.INVALID_ASSIGNED_TO);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Validiere AssignedById
    // ════════════════════════════════════════════════════════════════════════
    const trimmedAssignedById = props.assignedById?.trim() ?? '';

    if (trimmedAssignedById.length === 0) {
      return Result.fail<AssignErinnerungCommand>(ERINNERUNG_ERROR_CODES.USER_ID_INVALID);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Command erstellen
    // ════════════════════════════════════════════════════════════════════════
    return Result.ok(new AssignErinnerungCommand(trimmedErinnerungId, trimmedEinsatzId, trimmedAssignedToId, trimmedAssignedById));
  }
}
