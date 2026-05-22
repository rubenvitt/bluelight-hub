import { Result } from '@domain/common/result';
import { ValueObject } from '@domain/common/value-object';

/**
 * DIN-/SiKoKo-konforme Sichtungskategorien (Story 1.1, Architecture §D-2).
 *
 * Canonical-Codes — NIEMALS Farb-Strings in DB/API/Events:
 * - `SK_I` … `SK_IV` = lebende Patienten (SK_IV = "lebt, ohne Überlebenschance",
 *   memory `manv_sichtungskategorien_farben`)
 * - `TOT` = separate Kategorie für Verstorbene (nicht mit SK_IV vermischen)
 *
 * Farbe ist reines UI-Rendering-Concern (Frontend `sk-color-map`, Story 1.5).
 */
export const SK_CODES = ['SK_I', 'SK_II', 'SK_III', 'SK_IV', 'TOT'] as const;
export type SkCode = (typeof SK_CODES)[number];

interface SichtungskategorieProps extends Record<string, unknown> {
  code: SkCode;
}

/**
 * Enum-ValueObject für die Sichtungskategorie eines Patienten.
 */
export class Sichtungskategorie extends ValueObject<SichtungskategorieProps> {
  private constructor(props: SichtungskategorieProps) {
    super(props);
  }

  static create(code: string): Result<Sichtungskategorie> {
    if (typeof code !== 'string') {
      return Result.fail<Sichtungskategorie>('Sichtungskategorie: code muss ein String sein');
    }
    if (!SK_CODES.includes(code as SkCode)) {
      return Result.fail<Sichtungskategorie>(`Sichtungskategorie: ungültiger Code "${code}". Erwartet: ${SK_CODES.join(', ')}`);
    }
    return Result.ok(new Sichtungskategorie({ code: code as SkCode }));
  }

  get code(): SkCode {
    return this.props.code;
  }

  /** True, falls die Kategorie eine lebende Sichtung beschreibt (SK_I..SK_IV). */
  get istLebend(): boolean {
    return this.props.code !== 'TOT';
  }
}
