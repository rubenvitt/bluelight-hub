import { ValueObject } from '@domain/common/value-object';
import { Result } from '@domain/common/result';

/**
 * Props für ErinnerungTitel Value Object.
 */
interface ErinnerungTitelProps extends Record<string, unknown> {
  value: string;
}

/**
 * ErinnerungTitel Value Object mit Längen-Validierung.
 *
 * Kapselt den Titel einer Erinnerung mit folgenden Business Rules:
 * - Titel ist erforderlich (nicht leer)
 * - Titel darf maximal 100 Zeichen haben
 * - Whitespace am Anfang/Ende wird automatisch entfernt
 *
 * @example
 * ```typescript
 * // Erfolgreiche Erstellung
 * const result = ErinnerungTitel.create('Lagebesprechung');
 * if (result.isSuccess) {
 *   console.log(result.value!.value); // "Lagebesprechung"
 * }
 *
 * // Fehler: Leerer Titel
 * const emptyResult = ErinnerungTitel.create('');
 * emptyResult.isFailure; // true
 *
 * // Fehler: Zu langer Titel
 * const longResult = ErinnerungTitel.create('a'.repeat(101));
 * longResult.isFailure; // true
 * ```
 */
export class ErinnerungTitel extends ValueObject<ErinnerungTitelProps> {
  /**
   * Maximale Länge des Titels in Zeichen.
   * Konsistent mit Prisma Schema: @db.VarChar(100)
   */
  public static readonly MAX_LENGTH = 100;

  /**
   * Public Getter für den Titel-Wert.
   */
  get value(): string {
    return this.props.value;
  }

  /**
   * Private Constructor erzwingt Verwendung von Factory Method.
   */
  private constructor(value: string) {
    super({ value });
  }

  /**
   * Factory Method zur Erstellung eines ErinnerungTitel mit Validierung.
   *
   * **Validierungsregeln:**
   * 1. Titel darf nicht leer sein (nach Trimming)
   * 2. Titel darf maximal 100 Zeichen haben
   *
   * @param value - Der Titel-Text
   * @returns Result mit ErinnerungTitel bei Erfolg oder Fehlermeldung
   */
  static create(value: string): Result<ErinnerungTitel> {
    // Null/undefined Check
    if (value == null) {
      return Result.fail<ErinnerungTitel>('ERINNERUNG_TITEL_REQUIRED');
    }

    // Trimmen und prüfen ob leer
    const trimmedValue = value.trim();
    if (trimmedValue.length === 0) {
      return Result.fail<ErinnerungTitel>('ERINNERUNG_TITEL_REQUIRED');
    }

    // Längen-Check
    if (trimmedValue.length > ErinnerungTitel.MAX_LENGTH) {
      return Result.fail<ErinnerungTitel>(`ERINNERUNG_TITEL_TOO_LONG: Titel darf maximal ${ErinnerungTitel.MAX_LENGTH} Zeichen haben, aber ${trimmedValue.length} gefunden`);
    }

    return Result.ok<ErinnerungTitel>(new ErinnerungTitel(trimmedValue));
  }

  /**
   * Prüft ob der Titel kürzer als eine bestimmte Länge ist.
   * Nützlich für UI-Darstellung (z.B. Abkürzung).
   */
  public isShorterThan(length: number): boolean {
    return this.value.length < length;
  }

  /**
   * String-Repräsentation für Logging und Debugging.
   */
  public toString(): string {
    return this.value;
  }
}
