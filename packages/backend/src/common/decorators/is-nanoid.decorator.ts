import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';

/**
 * CUID2 format regex: 20-30 chars, lowercase a-z0-9, starts with lowercase letter.
 */
const CUID2_REGEX = /^[a-z][a-z0-9]{19,29}$/;

/**
 * Validiert, dass ein String im CUID2-Format ist.
 *
 * CUID2-Format: 20-30 Zeichen, nur lowercase (a-z, 0-9), startet mit Kleinbuchstabe.
 * Wird für alle Domain-generierten IDs verwendet (z.B. POI-IDs, Lagekarte-IDs).
 *
 * @param validationOptions Optionale Validierungsoptionen für class-validator
 * @returns PropertyDecorator für class-validator
 */
export function IsCuid2(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isCuid2',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return validateCuid2Format(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} muss eine gültige CUID2 sein (20-30 Zeichen, nur lowercase a-z0-9, startet mit Buchstabe)`;
        },
      },
    });
  };
}

/**
 * @deprecated Use IsCuid2 instead. Kept for backwards compatibility.
 */
export function IsNanoId(validationOptions?: ValidationOptions, _length: number = 21) {
  return IsCuid2(validationOptions);
}

/**
 * Validiert das CUID2-Format.
 *
 * CUID2s sind kollisionssichere, eindeutige IDs mit folgendem Format:
 * - Länge: 20-30 Zeichen
 * - Zeichensatz: nur lowercase a-z und 0-9
 * - Startet mit einem Kleinbuchstaben
 *
 * @example
 * validateCuid2Format('clw3h8x9y0000qwertyui00001') // true
 * validateCuid2Format('ABC123') // false - uppercase und zu kurz
 *
 * @param value Der zu validierende Wert
 * @returns true wenn der Wert ein gültiges CUID2-Format hat, false sonst
 */
export function validateCuid2Format(value: unknown): boolean {
  // Null/undefined sind erlaubt (Handling durch @IsOptional)
  if (value === undefined || value === null) {
    return true;
  }

  // Muss ein String sein
  if (typeof value !== 'string') {
    return false;
  }

  // CUID2-Format prüfen
  return CUID2_REGEX.test(value);
}

/**
 * @deprecated Use validateCuid2Format instead. Kept for backwards compatibility.
 */
export function validateNanoidFormat(value: unknown, _expectedLength: number = 21): boolean {
  return validateCuid2Format(value);
}
