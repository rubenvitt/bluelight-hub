import { Result } from '@domain/common/result';
import { ERINNERUNG_ERROR_CODES } from '../../errors/erinnerung-error.codes';

/**
 * Props Interface fuer typsichere Command-Erstellung.
 */
export interface DeleteErinnerungCommandProps {
  /** Die ID der zu loeschenden Erinnerung (CUID2 Format) */
  erinnerungId: string;
  /** Die ID des Users der loescht (CUID2 Format) - fuer Audit Trail */
  geloeschtVon: string;
}

/**
 * Command fuer das Loeschen einer Erinnerung (Soft-Delete).
 *
 * **Story 1.4:** Erinnerung loeschen
 * - AC1: Nur GEPLANT oder AUSGELOEST Status loeschbar (im Entity geprueft)
 * - AC3: Soft-Delete (nicht physisch loeschen)
 * - AC4: Domain Event emittieren
 *
 * **Validierung:**
 * - erinnerungId: Erforderlich, CUID2 Format
 * - geloeschtVon: Erforderlich, CUID2 Format (Audit Trail)
 *
 * @example
 * ```typescript
 * const commandResult = DeleteErinnerungCommand.create({
 *   erinnerungId: 'clx123...',
 *   geloeschtVon: 'clu456...',
 * });
 *
 * if (commandResult.isSuccess) {
 *   await handler.execute(commandResult.value!);
 * }
 * ```
 */
export class DeleteErinnerungCommand {
  /**
   * CUID2 ID Pattern: Lowercase alphanumeric, 24-32 Zeichen.
   * Konsistent mit anderen Commands im Projekt.
   */
  private static readonly CUID2_PATTERN = /^[a-z0-9]{24,32}$/;

  private constructor(
    public readonly erinnerungId: string,
    public readonly geloeschtVon: string,
  ) {}

  /**
   * Factory Method mit Validierung.
   *
   * **Validierung (Result Pattern - kein throw!):**
   * - erinnerungId: Erforderlich, CUID2 Format
   * - geloeschtVon: Erforderlich, CUID2 Format
   *
   * @param props - DeleteErinnerungCommandProps
   * @returns Result<DeleteErinnerungCommand> - Success mit Command oder Failure mit Error Code
   */
  static create(props: DeleteErinnerungCommandProps): Result<DeleteErinnerungCommand> {
    // Validiere erinnerungId
    if (!props.erinnerungId || props.erinnerungId.trim().length === 0) {
      return Result.fail(ERINNERUNG_ERROR_CODES.ID_REQUIRED);
    }
    if (!DeleteErinnerungCommand.CUID2_PATTERN.test(props.erinnerungId)) {
      return Result.fail(ERINNERUNG_ERROR_CODES.ID_INVALID);
    }

    // Validiere geloeschtVon (UserId)
    if (!props.geloeschtVon || props.geloeschtVon.trim().length === 0) {
      return Result.fail(ERINNERUNG_ERROR_CODES.GELOESCHT_VON_REQUIRED);
    }
    if (!DeleteErinnerungCommand.CUID2_PATTERN.test(props.geloeschtVon)) {
      return Result.fail(ERINNERUNG_ERROR_CODES.ID_INVALID);
    }

    return Result.ok(new DeleteErinnerungCommand(props.erinnerungId.trim(), props.geloeschtVon.trim()));
  }
}
