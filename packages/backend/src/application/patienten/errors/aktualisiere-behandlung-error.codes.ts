/**
 * Sentinel-Error-Codes für den `aktualisiere-behandlung`-Use-Case (Story 1.4, FR18).
 *
 * Konsumenten:
 *  - `AktualisiereBehandlungHandler` für `Result.fail(...)` Returns
 *  - `mapErrorToHttp` im Modules-Layer für die HTTP-Übersetzung
 *
 * Domain-emittierte Sentinels (`BusinessRule:BehandlungUngueltigerUebergang`,
 * `BusinessRule:BehandlungUnveraendert`, `BusinessRule:ClockDriftUngueltig`)
 * propagiert der Handler unverändert — der Controller mappt sie in `error-to-http.ts`.
 *
 * Lessons-Learned aus Story 1.3: Code-Namen prüfen — `NEUER_STATUS_INVALID`
 * statt `…_REQUIRED` (semantisch korrekt für Enum-Mismatch).
 */
export const AKTUALISIERE_BEHANDLUNG_ERROR_CODES = {
  EINSATZ_ID_REQUIRED: 'Validation:EinsatzIdRequired',
  PATIENT_ID_REQUIRED: 'Validation:PatientIdRequired',
  NEUER_STATUS_INVALID: 'Validation:NeuerStatusInvalid',
  ACTOR_INVALID: 'Validation:ActorInvalid',
  CLOCK_DRIFT_INVALID: 'Validation:ClockDriftInvalid',
  PATIENT_NICHT_GEFUNDEN: 'NotFound:PatientNichtGefunden',
  ETB_APPEND_FAILED: 'Infrastructure:EtbAppendFailed',
  ETB_CONTEXT_INVALID: 'Validation:EtbContextInvalid',
  PATIENT_SAVE_FAILED: 'Infrastructure:PatientSaveFailed',
} as const;

export type AktualisiereBehandlungErrorCode = (typeof AKTUALISIERE_BEHANDLUNG_ERROR_CODES)[keyof typeof AKTUALISIERE_BEHANDLUNG_ERROR_CODES];
