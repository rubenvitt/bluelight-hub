import { Result } from '@domain/common/result';
import { ERINNERUNG_ERROR_CODES } from '../../errors/erinnerung-error.codes';

/**
 * Props für SnoozeErinnerungCommand.
 */
export interface SnoozeErinnerungCommandProps {
  /** ID der Erinnerung die gesnoozed werden soll (CUID2 Format) */
  erinnerungId: string;
  /** ID des Users der die Erinnerung snoozed (CUID2 Format) */
  snoozedBy: string;
  /** Snooze-Dauer in Minuten (1, 5, oder 10) */
  snoozeMinutes: number;
}

/**
 * Command zum Verschieben (Snoozen) einer ausgelösten Erinnerung.
 *
 * **Business Rules (Story 2.1):**
 * - Nur Erinnerungen mit Status AUSGELOEST können gesnoozed werden
 * - snoozeMinutes muss 1, 5, oder 10 sein (Preset-Zeiten)
 * - Command validiert Format der IDs (CUID2)
 * - Business-Validierung erfolgt im Handler via Domain Entity
 *
 * @example
 * ```typescript
 * const cmdResult = SnoozeErinnerungCommand.create({
 *   erinnerungId: 'cmb1234...',
 *   snoozedBy: 'cma5678...',
 *   snoozeMinutes: 5,
 * });
 * if (cmdResult.isSuccess) {
 *   const result = await handler.execute(cmdResult.value);
 * }
 * ```
 */
export class SnoozeErinnerungCommand {
  /** Erlaubte Snooze-Zeiten in Minuten (AC1: Presets 1, 5, 10 Min) */
  private static readonly VALID_SNOOZE_MINUTES = [1, 5, 10];

  /**
   * Private Constructor - Erzwingt Factory Method Nutzung.
   */
  private constructor(
    public readonly erinnerungId: string,
    public readonly snoozedBy: string,
    public readonly snoozeMinutes: number,
  ) {}

  /**
   * Factory Method mit Validierung.
   *
   * @param props - Command Properties
   * @returns Result mit Command oder Fehler
   */
  static create(props: SnoozeErinnerungCommandProps): Result<SnoozeErinnerungCommand> {
    // Validierung: erinnerungId erforderlich und CUID2 Format
    if (!props.erinnerungId || typeof props.erinnerungId !== 'string') {
      return Result.fail<SnoozeErinnerungCommand>(ERINNERUNG_ERROR_CODES.ID_REQUIRED);
    }

    // CUID2 Format-Check (24-32 Zeichen, lowercase alphanumerisch)
    const cuidPattern = /^[a-z0-9]{24,32}$/;
    if (!cuidPattern.test(props.erinnerungId)) {
      return Result.fail<SnoozeErinnerungCommand>(ERINNERUNG_ERROR_CODES.ID_INVALID);
    }

    // Validierung: snoozedBy erforderlich und CUID2 Format
    if (!props.snoozedBy || typeof props.snoozedBy !== 'string') {
      return Result.fail<SnoozeErinnerungCommand>(ERINNERUNG_ERROR_CODES.USER_ID_INVALID);
    }

    if (!cuidPattern.test(props.snoozedBy)) {
      return Result.fail<SnoozeErinnerungCommand>(ERINNERUNG_ERROR_CODES.USER_ID_INVALID);
    }

    // Validierung: snoozeMinutes muss ein erlaubter Wert sein (1, 5, 10)
    if (!SnoozeErinnerungCommand.VALID_SNOOZE_MINUTES.includes(props.snoozeMinutes)) {
      return Result.fail<SnoozeErinnerungCommand>(ERINNERUNG_ERROR_CODES.SNOOZE_MINUTES_INVALID);
    }

    return Result.ok<SnoozeErinnerungCommand>(new SnoozeErinnerungCommand(props.erinnerungId, props.snoozedBy, props.snoozeMinutes));
  }
}
