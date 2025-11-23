/**
 * Validiert, ob ein String-Wert gesetzt und nicht leer ist.
 *
 * Diese Helper-Funktion zentralisiert die Validierung von Pflichtfeldern,
 * um Code-Duplikation zu vermeiden.
 *
 * @param value - Der zu validierende String
 * @param fieldName - Name des Feldes (für Fehlermeldung)
 * @throws Error wenn Wert leer oder nur Whitespace
 */
export function validateRequiredString(value: string | undefined, fieldName: string): void {
  if (!value?.trim()) {
    throw new Error(`${fieldName} is required`);
  }
}

/**
 * CUID2 format: 20-30 characters, lowercase a-z0-9, starts with lowercase letter.
 * This is the format used by @paralleldrive/cuid2 for Entity IDs.
 */
export const CUID2_REGEX = /^[a-z][a-z0-9]{19,29}$/;

/**
 * @deprecated Use validateCuid2Format instead. Kept for backwards compatibility.
 */
export const NANOID_REGEX = CUID2_REGEX;

/**
 * Validiert, ob ein String dem CUID2-Format entspricht.
 *
 * CUID2-Format: 20-30 Zeichen, nur lowercase (a-z, 0-9), startet mit Kleinbuchstabe.
 * Verwendet für alle Entity-IDs im System nach Migration von Nanoid.
 *
 * @param value - Der zu validierende String
 * @param fieldName - Name des Feldes (für Fehlermeldung)
 * @throws Error wenn Format ungültig
 */
export function validateCuid2Format(value: string, fieldName: string): void {
  if (!CUID2_REGEX.test(value)) {
    throw new Error(`${fieldName} must be a valid CUID2 format (20-30 lowercase alphanumeric characters, starting with a letter)`);
  }
}

/**
 * @deprecated Use validateCuid2Format instead. Kept for backwards compatibility.
 */
export function validateNanoidFormat(value: string, fieldName: string): void {
  validateCuid2Format(value, fieldName);
}
