import { Result } from '@domain/common/result';
import { ValueObject } from '@domain/common/value-object';

/**
 * Sekundär-Identifier `DIVI-VAK-Nummer` (Architecture §D-12).
 *
 * Freier String aus dem Anwender-Kontext (Vorausabteilung, Krankenhausvorbereitung).
 * Hier nur Format-Grobschliff: getrimmt, nicht leer, max. 64 Zeichen.
 * Detail-Validierung bleibt der späteren Domäne überlassen.
 */
const MAX_LENGTH = 64;

interface DiviVakNummerProps extends Record<string, unknown> {
  value: string;
}

export class DiviVakNummer extends ValueObject<DiviVakNummerProps> {
  private constructor(props: DiviVakNummerProps) {
    super(props);
  }

  static create(value: string): Result<DiviVakNummer> {
    if (typeof value !== 'string') {
      return Result.fail<DiviVakNummer>('DiviVakNummer: value muss ein String sein');
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return Result.fail<DiviVakNummer>('DiviVakNummer: darf nicht leer sein');
    }
    if (trimmed.length > MAX_LENGTH) {
      return Result.fail<DiviVakNummer>(`DiviVakNummer: maximal ${MAX_LENGTH} Zeichen (erhalten: ${trimmed.length})`);
    }
    return Result.ok(new DiviVakNummer({ value: trimmed }));
  }

  get value(): string {
    return this.props.value;
  }
}
