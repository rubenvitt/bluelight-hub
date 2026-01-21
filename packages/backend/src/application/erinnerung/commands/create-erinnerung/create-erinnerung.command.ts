import { Result } from '@domain/common/result';
import { ERINNERUNG_ERROR_CODES } from '../../errors/erinnerung-error.codes';

/**
 * Props für die CreateErinnerungCommand Erstellung.
 */
export interface CreateErinnerungCommandProps {
  einsatzId: string;
  titel: string;
  beschreibung?: string;
  faelligAm: Date;
  erstelltVon: string;
  /** Story 2.6: Pflicht-Notiz bei Erledigung erforderlich (default: false) */
  requiresNote?: boolean;
}

/**
 * Command zum Erstellen einer neuen Erinnerung.
 *
 * Factory Method Pattern mit Result<T> für konsistente Validierung.
 * Keine Exceptions, sondern explizite Fehlerbehandlung (AC4).
 *
 * **Business Rules (Validierung):**
 * - Titel ist erforderlich und maximal 100 Zeichen
 * - FaelligAm muss in der Zukunft liegen
 * - EinsatzId ist erforderlich (CUID2 Format)
 * - ErstelltVon (UserId) ist erforderlich
 *
 * @example
 * ```typescript
 * const result = CreateErinnerungCommand.create({
 *   einsatzId: 'clw3h8x9y0000...',
 *   titel: 'Lagebesprechung',
 *   faelligAm: addMinutes(new Date(), 30),
 *   erstelltVon: 'clw3h8x9y0001...',
 * });
 *
 * if (result.isSuccess) {
 *   await handler.execute(result.value!);
 * }
 * ```
 */
export class CreateErinnerungCommand {
  /**
   * Maximale Länge des Titels.
   * Konsistent mit ErinnerungTitel Value Object und Prisma Schema.
   */
  private static readonly MAX_TITEL_LENGTH = 100;

  /**
   * CUID2 Pattern für ID-Validierung.
   * CUID2 ist 24-32 Zeichen lang, lowercase alphanumeric.
   */
  private static readonly CUID2_PATTERN = /^[a-z0-9]{24,32}$/;

  private constructor(
    public readonly einsatzId: string,
    public readonly titel: string,
    public readonly beschreibung: string | undefined,
    public readonly faelligAm: Date,
    public readonly erstelltVon: string,
    public readonly requiresNote: boolean,
  ) {}

  /**
   * Factory Method zur Erstellung eines validierten Commands.
   *
   * **Validierung:**
   * 1. Titel: Erforderlich, max 100 Zeichen, wird getrimmt
   * 2. FaelligAm: Muss in der Zukunft liegen
   * 3. EinsatzId: Erforderlich, CUID2 Format
   * 4. ErstelltVon: Erforderlich, CUID2 Format
   *
   * @param props - Command Properties
   * @returns Result<CreateErinnerungCommand> - Validierter Command oder Fehler
   */
  static create(props: CreateErinnerungCommandProps): Result<CreateErinnerungCommand> {
    // ════════════════════════════════════════════════════════════════════════
    // Validiere Titel
    // ════════════════════════════════════════════════════════════════════════
    const trimmedTitel = props.titel?.trim() ?? '';

    if (trimmedTitel.length === 0) {
      return Result.fail<CreateErinnerungCommand>(ERINNERUNG_ERROR_CODES.TITEL_REQUIRED);
    }

    if (trimmedTitel.length > CreateErinnerungCommand.MAX_TITEL_LENGTH) {
      return Result.fail<CreateErinnerungCommand>(ERINNERUNG_ERROR_CODES.TITEL_TOO_LONG);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Validiere FaelligAm
    // ════════════════════════════════════════════════════════════════════════
    if (!props.faelligAm) {
      return Result.fail<CreateErinnerungCommand>(ERINNERUNG_ERROR_CODES.FAELLIG_AM_REQUIRED);
    }

    const now = new Date();
    if (props.faelligAm <= now) {
      return Result.fail<CreateErinnerungCommand>(ERINNERUNG_ERROR_CODES.FAELLIG_AM_IN_PAST);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Validiere EinsatzId
    // ════════════════════════════════════════════════════════════════════════
    const trimmedEinsatzId = props.einsatzId?.trim() ?? '';

    if (trimmedEinsatzId.length === 0) {
      return Result.fail<CreateErinnerungCommand>(ERINNERUNG_ERROR_CODES.EINSATZ_ID_REQUIRED);
    }

    if (!CreateErinnerungCommand.CUID2_PATTERN.test(trimmedEinsatzId)) {
      return Result.fail<CreateErinnerungCommand>(ERINNERUNG_ERROR_CODES.EINSATZ_ID_INVALID);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Validiere ErstelltVon
    // ════════════════════════════════════════════════════════════════════════
    const trimmedErstelltVon = props.erstelltVon?.trim() ?? '';

    if (trimmedErstelltVon.length === 0) {
      return Result.fail<CreateErinnerungCommand>(ERINNERUNG_ERROR_CODES.ERSTELLT_VON_REQUIRED);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Command erstellen
    // ════════════════════════════════════════════════════════════════════════
    return Result.ok(new CreateErinnerungCommand(trimmedEinsatzId, trimmedTitel, props.beschreibung?.trim() || undefined, props.faelligAm, trimmedErstelltVon, props.requiresNote ?? false));
  }
}
