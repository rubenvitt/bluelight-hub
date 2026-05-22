/**
 * CUID2-Regex für Frontend-Validierung.
 *
 * Das Backend nutzt `isCuid` aus `@paralleldrive/cuid2`. Da `@paralleldrive/cuid2`
 * im Frontend bewusst nicht installiert ist (Bundle-Size), spiegeln wir die
 * Validierung hier als zentrale Regex.
 *
 * CUID2-Spezifikation (`@paralleldrive/cuid2` v2):
 *  - startet mit Buchstaben `[a-z]`
 *  - gefolgt von 23-31 alphanumerischen Zeichen `[a-z0-9]`
 *  - Default-Länge ist 24, konfigurierbar bis 32.
 *
 * Wir akzeptieren das Spektrum 24-32 Zeichen — passend zur Backend-Validierung
 * via `isCuid`. Strikte Validierung erfolgt serverseitig.
 *
 * @see https://github.com/paralleldrive/cuid2
 */
export const CUID2_REGEX = /^[a-z][a-z0-9]{23,31}$/;

/**
 * Type-Guard: Prüft, ob ein Wert ein syntaktisch gültiger CUID2-String ist.
 * Whitespace wird vor der Prüfung getrimmt.
 */
export function isCuid2(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return CUID2_REGEX.test(value.trim());
}
