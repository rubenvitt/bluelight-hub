/**
 * Sentinel-Error-Codes für den `aktualisiere-transport`-Use-Case (Story 1.4, FR19).
 *
 * Symmetrisch zu `aktualisiere-behandlung-error.codes.ts`.
 */
export const AKTUALISIERE_TRANSPORT_ERROR_CODES = {
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

export type AktualisiereTransportErrorCode = (typeof AKTUALISIERE_TRANSPORT_ERROR_CODES)[keyof typeof AKTUALISIERE_TRANSPORT_ERROR_CODES];
