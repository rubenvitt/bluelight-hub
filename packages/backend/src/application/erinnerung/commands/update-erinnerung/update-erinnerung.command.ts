import { Result } from '@domain/common/result';
import { ERINNERUNG_ERROR_CODES } from '../../errors/erinnerung-error.codes';

/**
 * Props für die UpdateErinnerungCommand Erstellung.
 *
 * Alle Felder außer `erinnerungId` und `aktualisierVon` sind optional - mindestens eines muss aber gesetzt sein.
 */
export interface UpdateErinnerungCommandProps {
  erinnerungId: string;
  aktualisierVon: string;
  titel?: string;
  beschreibung?: string | null;
  faelligAm?: Date;
  eskalationsPersonId?: string | null;
}

/**
 * Command zum Aktualisieren einer bestehenden Erinnerung.
 *
 * Factory Method Pattern mit Result<T> für konsistente Validierung.
 * Keine Exceptions, sondern explizite Fehlerbehandlung (AC4).
 *
 * **Business Rules (Validierung):**
 * - ErinnerungId ist erforderlich (CUID2 Format)
 * - Mindestens ein Feld (titel, beschreibung, faelligAm) muss gesetzt sein
 * - Titel: Optional, wenn gesetzt max 100 Zeichen
 * - FaelligAm: Optional, wenn gesetzt muss in der Zukunft liegen
 *
 * @example
 * ```typescript
 * const result = UpdateErinnerungCommand.create({
 *   erinnerungId: 'clw3h8x9y0000...',
 *   titel: 'Neue Lagebesprechung',
 *   faelligAm: addMinutes(new Date(), 30),
 * });
 *
 * if (result.isSuccess) {
 *   await handler.execute(result.value!);
 * }
 * ```
 */
export class UpdateErinnerungCommand {
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
    public readonly erinnerungId: string,
    public readonly aktualisierVon: string,
    public readonly titel: string | undefined,
    public readonly beschreibung: string | null | undefined,
    public readonly faelligAm: Date | undefined,
    public readonly eskalationsPersonId: string | null | undefined,
  ) {}

  /**
   * Factory Method zur Erstellung eines validierten Commands.
   *
   * **Validierung:**
   * 1. ErinnerungId: Erforderlich, CUID2 Format
   * 2. Mindestens ein Feld muss gesetzt sein
   * 3. Titel: Falls gesetzt, max 100 Zeichen, wird getrimmt
   * 4. FaelligAm: Falls gesetzt, muss in der Zukunft liegen
   *
   * @param props - Command Properties
   * @returns Result<UpdateErinnerungCommand> - Validierter Command oder Fehler
   */
  static create(props: UpdateErinnerungCommandProps): Result<UpdateErinnerungCommand> {
    // ════════════════════════════════════════════════════════════════════════
    // Validiere ErinnerungId
    // ════════════════════════════════════════════════════════════════════════
    const trimmedId = props.erinnerungId?.trim() ?? '';

    if (trimmedId.length === 0) {
      return Result.fail<UpdateErinnerungCommand>(ERINNERUNG_ERROR_CODES.ID_REQUIRED);
    }

    if (!UpdateErinnerungCommand.CUID2_PATTERN.test(trimmedId)) {
      return Result.fail<UpdateErinnerungCommand>(ERINNERUNG_ERROR_CODES.ID_INVALID);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Validiere dass mindestens ein Feld gesetzt ist
    // ════════════════════════════════════════════════════════════════════════
    const hasTitel = props.titel !== undefined;
    const hasBeschreibung = props.beschreibung !== undefined;
    const hasFaelligAm = props.faelligAm !== undefined;
    const hasEskalationsPersonId = props.eskalationsPersonId !== undefined;

    if (!hasTitel && !hasBeschreibung && !hasFaelligAm && !hasEskalationsPersonId) {
      return Result.fail<UpdateErinnerungCommand>(ERINNERUNG_ERROR_CODES.NO_CHANGES);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Validiere Titel (falls gesetzt)
    // ════════════════════════════════════════════════════════════════════════
    let trimmedTitel: string | undefined;
    if (hasTitel) {
      trimmedTitel = props.titel?.trim() ?? '';

      if (trimmedTitel.length === 0) {
        return Result.fail<UpdateErinnerungCommand>(ERINNERUNG_ERROR_CODES.TITEL_REQUIRED);
      }

      if (trimmedTitel.length > UpdateErinnerungCommand.MAX_TITEL_LENGTH) {
        return Result.fail<UpdateErinnerungCommand>(ERINNERUNG_ERROR_CODES.TITEL_TOO_LONG);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Validiere FaelligAm (falls gesetzt)
    // ════════════════════════════════════════════════════════════════════════
    if (hasFaelligAm && props.faelligAm) {
      const now = new Date();
      if (props.faelligAm <= now) {
        return Result.fail<UpdateErinnerungCommand>(ERINNERUNG_ERROR_CODES.FAELLIG_AM_IN_PAST);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Beschreibung verarbeiten (null = löschen, undefined = nicht ändern)
    // ════════════════════════════════════════════════════════════════════════
    let beschreibung: string | null | undefined;
    if (hasBeschreibung) {
      // null bedeutet: Beschreibung löschen
      // string bedeutet: Beschreibung setzen/ändern
      beschreibung = props.beschreibung === null ? null : props.beschreibung?.trim() || null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Validierung und Trimmen von eskalationsPersonId
    // ════════════════════════════════════════════════════════════════════════
    let eskalationsPersonId: string | null | undefined;
    if (hasEskalationsPersonId) {
      eskalationsPersonId = props.eskalationsPersonId === null ? null : props.eskalationsPersonId?.trim() || null;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Command erstellen
    // ════════════════════════════════════════════════════════════════════════
    return Result.ok(new UpdateErinnerungCommand(trimmedId, props.aktualisierVon, trimmedTitel, beschreibung, props.faelligAm, eskalationsPersonId));
  }
}
