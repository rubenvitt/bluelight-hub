import { Result } from '@domain/common/result';

/**
 * Props für MarkErledigtErinnerungCommand.
 */
export interface MarkErledigtErinnerungCommandProps {
  /** ID der Erinnerung die erledigt werden soll (CUID2 Format) */
  erinnerungId: string;
  /** ID des Users der die Erinnerung erledigt (CUID2 Format) */
  erledigtBy: string;
  /** Optionale Notiz zur Erledigung (max 500 Zeichen) */
  erledigungsNotiz?: string;
}

/**
 * Command zum Markieren einer Erinnerung als erledigt.
 *
 * **Business Rules (Story 2.5):**
 * - Nur Erinnerungen mit Status ACKNOWLEDGED oder ESKALIERT können erledigt werden
 * - Command validiert Format der IDs (CUID2)
 * - Optionale Notiz maximal 500 Zeichen
 * - Business-Validierung erfolgt im Handler via Domain Entity
 *
 * @example
 * ```typescript
 * const cmdResult = MarkErledigtErinnerungCommand.create({
 *   erinnerungId: 'cmb1234...',
 *   erledigtBy: 'cma5678...',
 *   erledigungsNotiz: 'Aufgabe abgeschlossen',
 * });
 * if (cmdResult.isSuccess) {
 *   const result = await handler.execute(cmdResult.value);
 * }
 * ```
 */
export class MarkErledigtErinnerungCommand {
  /**
   * Maximale Länge der Erledigungs-Notiz.
   * Konsistent mit Prisma Schema: @db.VarChar(500)
   */
  static readonly MAX_NOTIZ_LENGTH = 500;

  /**
   * Private Constructor - Erzwingt Factory Method Nutzung.
   */
  private constructor(
    public readonly erinnerungId: string,
    public readonly erledigtBy: string,
    public readonly erledigungsNotiz: string | null,
  ) {}

  /**
   * Factory Method mit Validierung.
   *
   * @param props - Command Properties
   * @returns Result mit Command oder Fehler
   */
  static create(props: MarkErledigtErinnerungCommandProps): Result<MarkErledigtErinnerungCommand> {
    // Validierung: erinnerungId erforderlich und CUID2 Format
    if (!props.erinnerungId || typeof props.erinnerungId !== 'string') {
      return Result.fail<MarkErledigtErinnerungCommand>('ERINNERUNG_ID_REQUIRED');
    }

    // CUID2 Format-Check (24-32 Zeichen, lowercase alphanumerisch)
    const cuidPattern = /^[a-z0-9]{24,32}$/;
    if (!cuidPattern.test(props.erinnerungId)) {
      return Result.fail<MarkErledigtErinnerungCommand>('ERINNERUNG_ID_INVALID_FORMAT');
    }

    // Validierung: erledigtBy erforderlich und CUID2 Format
    if (!props.erledigtBy || typeof props.erledigtBy !== 'string') {
      return Result.fail<MarkErledigtErinnerungCommand>('ERLEDIGT_BY_REQUIRED');
    }

    if (!cuidPattern.test(props.erledigtBy)) {
      return Result.fail<MarkErledigtErinnerungCommand>('ERLEDIGT_BY_INVALID_FORMAT');
    }

    // Validierung: erledigungsNotiz (optional, max 500 Zeichen)
    let notiz: string | null = null;
    if (props.erledigungsNotiz != null && typeof props.erledigungsNotiz === 'string') {
      const trimmed = props.erledigungsNotiz.trim();
      if (trimmed.length > 0) {
        if (trimmed.length > MarkErledigtErinnerungCommand.MAX_NOTIZ_LENGTH) {
          return Result.fail<MarkErledigtErinnerungCommand>('ERLEDIGUNGS_NOTIZ_TOO_LONG');
        }
        notiz = trimmed;
      }
    }

    return Result.ok<MarkErledigtErinnerungCommand>(new MarkErledigtErinnerungCommand(props.erinnerungId, props.erledigtBy, notiz));
  }
}
