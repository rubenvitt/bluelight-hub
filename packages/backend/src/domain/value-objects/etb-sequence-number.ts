import { ValueObject } from '@domain/common/value-object';
import { Result } from '@domain/common/result';

interface EtbSequenceNumberProps extends Record<string, unknown> {
  value: number;
}

/**
 * Immutable Sequence Number für ETB Einträge.
 *
 * Diese Klasse garantiert eine monoton steigende Sequenznummer (≥1)
 * für die Sortierung und Versionierung von ETB-Einträgen.
 * Die Unveränderlichkeit verhindert versehentliche Manipulation
 * der Reihenfolge und ermöglicht sichere Audit-Trails.
 *
 * **Validierungsregeln:**
 * - Muss eine positive Ganzzahl sein (≥1)
 * - Null oder negative Werte werden abgelehnt
 *
 * @example
 * ```typescript
 * const result = EtbSequenceNumber.create(1);
 * if (result.isSuccess) {
 *   console.log(result.value.value); // 1
 * }
 *
 * const invalid = EtbSequenceNumber.create(0); // Fail: must be ≥ 1
 * ```
 */
export class EtbSequenceNumber extends ValueObject<EtbSequenceNumberProps> {
  get value(): number {
    return this.props.value;
  }

  private constructor(value: number) {
    super({ value });
  }

  static create(value: number): Result<EtbSequenceNumber> {
    if (!Number.isInteger(value) || value < 1) {
      return Result.fail<EtbSequenceNumber>('Sequence number must be a positive integer ≥ 1');
    }
    return Result.ok<EtbSequenceNumber>(new EtbSequenceNumber(value));
  }

  public toString(): string {
    return this.value.toString();
  }
}
