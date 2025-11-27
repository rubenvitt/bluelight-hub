/**
 * Max-Lengths für Einsatz-Felder.
 *
 * Diese Limits basieren auf deutschen Rettungswesen-Konventionen und
 * verhindern überlange Eingaben, die die UI oder Datenbankperformance
 * beeinträchtigen könnten.
 */
export const EINSATZ_FIELD_LIMITS = {
  ALARMSTICHWORT_MAX_LENGTH: 200,
  BEMERKUNG_MAX_LENGTH: 2000,
  EINSATZ_ID_LENGTH: 25, // CUID2 standard
} as const;

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
 * Result-Pattern-kompatible Validierung für Required Strings.
 *
 * Diese Funktion ist speziell für Commands designed, die das Result<T>-Pattern
 * verwenden. Statt Exceptions zu werfen, gibt sie null bei Erfolg oder eine
 * Fehlermeldung bei Fehler zurück.
 *
 * @param value - Der zu validierende String
 * @param fieldName - Name des Feldes (für Fehlermeldung)
 * @param maxLength - Optionale maximale Länge
 * @returns null bei Erfolg, Fehlermeldung bei Fehler
 */
export function validateRequiredStringResult(value: string | undefined, fieldName: string, maxLength?: number): string | null {
  // Required-Check
  if (!value?.trim()) {
    return `${fieldName} ist erforderlich`;
  }

  // MaxLength-Check wenn angegeben
  if (maxLength !== undefined && value.trim().length > maxLength) {
    return `${fieldName} darf maximal ${maxLength} Zeichen lang sein`;
  }

  return null;
}

/**
 * Result-Pattern-kompatible Validierung für optionale Strings.
 *
 * Prüft nur die Länge, NICHT ob der String gesetzt ist. Für Required-Checks
 * nutze validateRequiredStringResult().
 *
 * @param value - Der zu validierende String (optional)
 * @param fieldName - Name des Feldes (für Fehlermeldung)
 * @param maxLength - Maximale Länge
 * @returns null bei Erfolg, Fehlermeldung bei Fehler
 */
export function validateStringLengthResult(value: string | undefined, fieldName: string, maxLength: number): string | null {
  // Skip wenn value nicht gesetzt (optional)
  if (value === undefined || value === null) {
    return null;
  }

  // Prüfe ob leer aber nicht undefined (leerer String)
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return `${fieldName} darf nicht leer sein`;
  }

  // MaxLength-Check
  if (trimmed.length > maxLength) {
    return `${fieldName} darf maximal ${maxLength} Zeichen lang sein`;
  }

  return null;
}

/**
 * CUID2 format: 20-30 characters, lowercase a-z0-9, starts with lowercase letter.
 * This is the format used by @paralleldrive/cuid2 for Entity IDs.
 */
export const CUID2_REGEX = /^[a-z][a-z0-9]{19,29}$/;

/**
 * Validiert, ob ein String dem CUID2-Format entspricht.
 *
 * CUID2-Format: 20-30 Zeichen, nur lowercase (a-z, 0-9), startet mit Kleinbuchstabe.
 * Verwendet für alle Entity-IDs im System nach Migration von cuid.
 *
 * **Warum CUID2_REGEX und nicht isCuid():**
 * Die isCuid() Funktion aus @paralleldrive/cuid2 ist zu permissiv und akzeptiert
 * auch kürzere oder ungültige Strings. Für strikte Validierung nutzen wir das Regex.
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
