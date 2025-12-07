import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';

/**
 * Validiert, dass ein String im CUID-Format ist.
 *
 * CUIDs werden von Prisma's `@default(cuid())` generiert und haben folgende Eigenschaften:
 * - Länge: 25 Zeichen
 * - Beginnen mit 'c'
 * - Bestehen aus Kleinbuchstaben und Ziffern
 *
 * @example
 * // Gültiges CUID: 'clw3h8x9y0000qwertyuiopas'
 *
 * @param validationOptions Optionale Validierungsoptionen für class-validator
 * @returns PropertyDecorator für class-validator
 */
export function IsCuid(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isCuid',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          return validateCuidFormat(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} muss eine gültige CUID sein (25 Zeichen, beginnt mit 'c', nur Kleinbuchstaben und Ziffern)`;
        },
      },
    });
  };
}

/**
 * Validiert das CUID-Format.
 *
 * CUIDs (Collision-resistant Unique Identifiers) werden von Prisma standardmäßig generiert.
 * Format: 25 Zeichen, beginnt mit 'c', nur Kleinbuchstaben (a-z) und Ziffern (0-9).
 *
 * Diese Funktion ist als Export verfügbar, da sie in Unit Tests direkt getestet werden muss,
 * um sicherzustellen, dass Legacy-Daten (existierende Einsätze) korrekt validiert werden.
 *
 * @example
 * validateCuidFormat('clw3h8x9y0000qwertyuiopas') // true
 * validateCuidFormat('abc') // false - zu kurz
 * validateCuidFormat('Clw3h8x9y0000qwertyuiopas') // false - Großbuchstabe
 *
 * @param value Der zu validierende Wert
 * @returns true wenn der Wert ein gültiges CUID-Format hat, false sonst
 */
export function validateCuidFormat(value: unknown): boolean {
  // Null/undefined sind erlaubt (Handling durch @IsOptional)
  if (value === undefined || value === null) {
    return true;
  }

  // Muss ein String sein
  if (typeof value !== 'string') {
    return false;
  }

  // CUID-Format: 25 Zeichen, beginnt mit 'c', nur Kleinbuchstaben und Ziffern
  // Regex erklärt:
  // ^c       - Muss mit 'c' beginnen
  // [a-z0-9] - Nur Kleinbuchstaben und Ziffern
  // {24}$    - Genau 24 weitere Zeichen (insgesamt 25)
  return /^c[a-z0-9]{24}$/.test(value);
}
