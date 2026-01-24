/**
 * Zentrale Error Codes fuer Einsatz Application Layer.
 *
 * **Warum Error Codes statt Error Messages:**
 * - Internationalisierung: Codes koennen in verschiedene Sprachen uebersetzt werden
 * - Konsistenz: Einheitliche Fehlercodes ueber alle Handler hinweg
 * - Testbarkeit: Einfacher in Tests zu pruefen als Freitext-Messages
 * - Frontend-Mapping: Frontend kann spezifische UI-Reaktionen per Code triggern
 *
 * **Naming Convention:**
 * - Praefix: EINSATZ_
 * - Suffix: Beschreibung des Fehlers in SCREAMING_SNAKE_CASE
 */
export const EINSATZ_ERROR_CODES = {
  // Query/Handler Errors
  NOT_FOUND: 'EINSATZ_NOT_FOUND',
  QUERY_FAILED: 'EINSATZ_QUERY_FAILED',

  // Command Validation Errors
  ID_REQUIRED: 'EINSATZ_ID_REQUIRED',
  ID_INVALID: 'EINSATZ_ID_INVALID',
  ALARMSTICHWORT_REQUIRED: 'EINSATZ_ALARMSTICHWORT_REQUIRED',

  // Status Transition Errors
  ALREADY_STARTED: 'EINSATZ_ALREADY_STARTED',
  ALREADY_COMPLETED: 'EINSATZ_ALREADY_COMPLETED',
  ALREADY_ARCHIVED: 'EINSATZ_ALREADY_ARCHIVED',
  CANNOT_START: 'EINSATZ_CANNOT_START',
  CANNOT_COMPLETE: 'EINSATZ_CANNOT_COMPLETE',
  CANNOT_ARCHIVE: 'EINSATZ_CANNOT_ARCHIVE',

  // Persistence Errors
  CREATION_FAILED: 'EINSATZ_CREATION_FAILED',
  SAVE_FAILED: 'EINSATZ_SAVE_FAILED',
} as const;

export type EinsatzErrorCode = (typeof EINSATZ_ERROR_CODES)[keyof typeof EINSATZ_ERROR_CODES];
