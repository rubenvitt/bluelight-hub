import { Result } from '@domain/common/result';
import { ERINNERUNG_ERROR_CODES } from '../../errors/erinnerung-error.codes';

/**
 * Props Interface fuer typsichere Command-Erstellung.
 */
export interface TriggerErinnerungCommandProps {
  /** Die ID der auszuloesenden Erinnerung (CUID2 Format) */
  erinnerungId: string;
}

/**
 * Command fuer das Ausloesen einer Erinnerung bei Faelligkeit.
 *
 * **Story 1.5:** Alarm bei Faelligkeit ausloesen
 * - AC1: Timer-basierte Alarm-Ausloesung (Client-seitig ausgeloest)
 * - AC4: WebSocket Event fuer Team-Sync
 * - AC5: ETB-Integration via Domain Event
 *
 * **Validierung:**
 * - erinnerungId: Erforderlich, CUID2 Format
 *
 * **Hinweis:** Kein User-Parameter noetig da Trigger automatisch vom Client erfolgt
 * wenn faelligAm erreicht ist.
 *
 * @example
 * ```typescript
 * const commandResult = TriggerErinnerungCommand.create({
 *   erinnerungId: 'clx123...',
 * });
 *
 * if (commandResult.isSuccess) {
 *   await handler.execute(commandResult.value!);
 * }
 * ```
 */
export class TriggerErinnerungCommand {
  /**
   * CUID2 ID Pattern: Lowercase alphanumeric, 24-32 Zeichen.
   * Konsistent mit anderen Commands im Projekt.
   */
  private static readonly CUID2_PATTERN = /^[a-z0-9]{24,32}$/;

  private constructor(public readonly erinnerungId: string) {}

  /**
   * Factory Method mit Validierung.
   *
   * **Validierung (Result Pattern - kein throw!):**
   * - erinnerungId: Erforderlich, CUID2 Format
   *
   * @param props - TriggerErinnerungCommandProps
   * @returns Result<TriggerErinnerungCommand> - Success mit Command oder Failure mit Error Code
   */
  static create(props: TriggerErinnerungCommandProps): Result<TriggerErinnerungCommand> {
    // Validiere erinnerungId
    if (!props.erinnerungId || props.erinnerungId.trim().length === 0) {
      return Result.fail(ERINNERUNG_ERROR_CODES.ID_REQUIRED);
    }
    if (!TriggerErinnerungCommand.CUID2_PATTERN.test(props.erinnerungId)) {
      return Result.fail(ERINNERUNG_ERROR_CODES.ID_INVALID);
    }

    return Result.ok(new TriggerErinnerungCommand(props.erinnerungId.trim()));
  }
}
