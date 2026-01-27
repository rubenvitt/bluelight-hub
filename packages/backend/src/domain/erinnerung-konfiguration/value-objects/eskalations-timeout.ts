import { Result } from '@domain/common/result';
import { ValueObject } from '@domain/common/value-object';

interface EskalationsTimeoutProps {
  value: number;
  [index: string]: unknown;
}

/**
 * ValueObject für den Eskalations-Timeout in Minuten.
 *
 * **Business Rules:**
 * - Wert muss eine Ganzzahl sein
 * - Mindestens 1 Minute
 * - Maximal 60 Minuten
 * - Default: 5 Minuten
 */
export class EskalationsTimeout extends ValueObject<EskalationsTimeoutProps> {
  public static readonly MIN_MINUTES = 1;
  public static readonly MAX_MINUTES = 60;
  public static readonly DEFAULT_MINUTES = 5;

  get value(): number {
    return this.props.value;
  }

  /**
   * Gibt den Wert in Sekunden zurück.
   */
  get seconds(): number {
    return this.props.value * 60;
  }

  private constructor(props: EskalationsTimeoutProps) {
    super(props);
  }

  public static create(minutes: number): Result<EskalationsTimeout> {
    if (!Number.isInteger(minutes)) {
      return Result.fail<EskalationsTimeout>('ESKALATIONS_TIMEOUT_MUST_BE_INTEGER');
    }

    if (minutes < EskalationsTimeout.MIN_MINUTES) {
      return Result.fail<EskalationsTimeout>(`ESKALATIONS_TIMEOUT_TOO_LOW: Minimal ${EskalationsTimeout.MIN_MINUTES} Minute(n)`);
    }

    if (minutes > EskalationsTimeout.MAX_MINUTES) {
      return Result.fail<EskalationsTimeout>(`ESKALATIONS_TIMEOUT_TOO_HIGH: Maximal ${EskalationsTimeout.MAX_MINUTES} Minuten`);
    }

    return Result.ok<EskalationsTimeout>(new EskalationsTimeout({ value: minutes }));
  }

  /**
   * Erstellt einen Default-Timeout (5 Minuten).
   */
  public static default(): EskalationsTimeout {
    const result = EskalationsTimeout.create(EskalationsTimeout.DEFAULT_MINUTES);
    if (result.isFailure || !result.value) {
      throw new Error('Failed to create default EskalationsTimeout');
    }
    return result.value;
  }
}
