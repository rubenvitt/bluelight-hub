/**
 * Zentrale Error Codes für Erinnerung Application Layer.
 *
 * **Warum Error Codes statt Error Messages:**
 * - Internationalisierung: Codes können in verschiedene Sprachen übersetzt werden
 * - Konsistenz: Einheitliche Fehlercodes über alle Handler hinweg
 * - Testbarkeit: Einfacher in Tests zu prüfen als Freitext-Messages
 * - Frontend-Mapping: Frontend kann spezifische UI-Reaktionen per Code triggern
 *
 * **Naming Convention:**
 * - Präfix: ERINNERUNG_
 * - Suffix: Beschreibung des Fehlers in SCREAMING_SNAKE_CASE
 */
export const ERINNERUNG_ERROR_CODES = {
  // Command Validation Errors
  TITEL_REQUIRED: 'ERINNERUNG_TITEL_REQUIRED',
  TITEL_TOO_LONG: 'ERINNERUNG_TITEL_TOO_LONG',
  FAELLIG_AM_REQUIRED: 'ERINNERUNG_FAELLIG_AM_REQUIRED',
  FAELLIG_AM_IN_PAST: 'ERINNERUNG_FAELLIG_AM_IN_PAST',
  EINSATZ_ID_REQUIRED: 'ERINNERUNG_EINSATZ_ID_REQUIRED',
  EINSATZ_ID_INVALID: 'ERINNERUNG_EINSATZ_ID_INVALID',
  ERSTELLT_VON_REQUIRED: 'ERINNERUNG_ERSTELLT_VON_REQUIRED',

  // Handler Errors
  CREATION_FAILED: 'ERINNERUNG_CREATION_FAILED',
  SAVE_FAILED: 'ERINNERUNG_SAVE_FAILED',
  NOT_FOUND: 'ERINNERUNG_NOT_FOUND',
  NOT_EDITABLE: 'ERINNERUNG_NOT_EDITABLE',
  NO_CHANGES: 'ERINNERUNG_NO_CHANGES',
  ID_REQUIRED: 'ERINNERUNG_ID_REQUIRED',
  ID_INVALID: 'ERINNERUNG_ID_INVALID',

  // Query Errors
  QUERY_EINSATZ_ID_REQUIRED: 'ERINNERUNG_QUERY_EINSATZ_ID_REQUIRED',
  QUERY_FAILED: 'ERINNERUNG_QUERY_FAILED',
} as const;

export type ErinnerungErrorCode = (typeof ERINNERUNG_ERROR_CODES)[keyof typeof ERINNERUNG_ERROR_CODES];
