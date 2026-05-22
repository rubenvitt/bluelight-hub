import { Result } from '@domain/common/result';
import { ValueObject } from '@domain/common/value-object';

/**
 * Patientennummer im Format `P-NNN` (mindestens drei Stellen, beliebig viele
 * darüber hinaus). Pro Einsatz monoton steigend, persistiert mit
 * `@@unique([einsatzId, patientennummer])` (Architecture §D-1, §D-3).
 *
 * Beispiele: `P-001`, `P-042`, `P-999`, `P-1000`.
 */
const PATIENTENNUMMER_REGEX = /^P-\d{3,}$/;
const MIN_SEQUENCE = 1;

interface PatientennummerProps extends Record<string, unknown> {
  value: string;
}

export class Patientennummer extends ValueObject<PatientennummerProps> {
  private constructor(props: PatientennummerProps) {
    super(props);
  }

  /**
   * Baut eine Patientennummer aus einer Sequenz-Zahl (≥ 1). Werte ≤ 999 werden
   * auf drei Stellen left-padded; größere Sequenzen behalten ihre natürliche
   * Stellenzahl (z. B. `1000 → "P-1000"`).
   */
  static fromSequence(n: number): Result<Patientennummer> {
    if (!Number.isInteger(n)) {
      return Result.fail<Patientennummer>('Patientennummer: Sequenz muss eine ganze Zahl sein');
    }
    if (n < MIN_SEQUENCE) {
      return Result.fail<Patientennummer>(`Patientennummer: Sequenz muss ≥ ${MIN_SEQUENCE} sein (erhalten: ${n})`);
    }
    const padded = String(n).padStart(3, '0');
    return Result.ok(new Patientennummer({ value: `P-${padded}` }));
  }

  static fromString(value: string): Result<Patientennummer> {
    if (typeof value !== 'string') {
      return Result.fail<Patientennummer>('Patientennummer: value muss ein String sein');
    }
    const trimmed = value.trim();
    if (!PATIENTENNUMMER_REGEX.test(trimmed)) {
      return Result.fail<Patientennummer>(`Patientennummer: ungültiges Format "${value}" (erwartet "P-NNN")`);
    }
    // Sequenz-Anteil muss ≥ 1 sein; "P-000" ist syntaktisch valide laut Regex,
    // verletzt aber die Sequenz-Konvention (siehe `fromSequence`).
    const sequencePart = trimmed.slice(2);
    if (Number.parseInt(sequencePart, 10) < MIN_SEQUENCE) {
      return Result.fail<Patientennummer>(`Patientennummer: Sequenz muss ≥ ${MIN_SEQUENCE} sein (erhalten: ${value})`);
    }
    return Result.ok(new Patientennummer({ value: trimmed }));
  }

  get value(): string {
    return this.props.value;
  }

  toString(): string {
    return this.props.value;
  }
}
