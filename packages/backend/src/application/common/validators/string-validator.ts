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
 * Nanoid format: 21 characters, alphanumeric + underscore and hyphen.
 */
export const NANOID_REGEX = /^[A-Za-z0-9_-]{21}$/;

/**
 * Validiert, ob ein String dem Nanoid-Format entspricht (21 Zeichen).
 *
 * Nanoid-Format: Genau 21 alphanumerische Zeichen (A-Z, a-z, 0-9, _, -).
 * Verwendet für alle Entity-IDs im System.
 *
 * @param value - Der zu validierende String
 * @param fieldName - Name des Feldes (für Fehlermeldung)
 * @throws Error wenn Format ungültig
 */
export function validateNanoidFormat(value: string, fieldName: string): void {
  if (!NANOID_REGEX.test(value)) {
    throw new Error(`${fieldName} must be a valid nanoid format (21 alphanumeric characters)`);
  }
}
