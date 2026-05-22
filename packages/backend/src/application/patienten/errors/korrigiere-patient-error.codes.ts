/**
 * Sentinel-Error-Codes für den `korrigiere-patient`-Use-Case (Story 1.4, FR42).
 *
 * Domain-emittierte Sentinels (`BusinessRule:KorrekturFeldInvalid`,
 * `BusinessRule:KorrekturNeuerWertInvalid`, `BusinessRule:KorrekturGrundRequired`,
 * `BusinessRule:KorrekturUnveraendert`,
 * `BusinessRule:KorrekturTotBenoetigtBestaetigung`) propagiert der Handler
 * unverändert — der Controller mappt sie in `error-to-http.ts`.
 *
 * Story 1.4 Code-Review Feature 2: `KORREKTUR_TOT_BENOETIGT_BESTAETIGUNG` schützt
 * lebende Patienten vor einer stillen TOT-Markierung via Korrektur-Pfad — die
 * irreversible regulatorische Aussage (DIN 13050) verlangt eine explizite
 * Bestätigung (`bestaetigeTotKorrektur=true`) vom Client.
 */
export const KORRIGIERE_PATIENT_ERROR_CODES = {
  EINSATZ_ID_REQUIRED: 'Validation:EinsatzIdRequired',
  PATIENT_ID_REQUIRED: 'Validation:PatientIdRequired',
  FELD_INVALID: 'Validation:FeldInvalid',
  NEUER_WERT_INVALID: 'Validation:NeuerWertInvalid',
  GRUND_REQUIRED: 'Validation:GrundRequired',
  ACTOR_INVALID: 'Validation:ActorInvalid',
  CLOCK_DRIFT_INVALID: 'Validation:ClockDriftInvalid',
  PATIENT_NICHT_GEFUNDEN: 'NotFound:PatientNichtGefunden',
  ETB_APPEND_FAILED: 'Infrastructure:EtbAppendFailed',
  ETB_CONTEXT_INVALID: 'Validation:EtbContextInvalid',
  PATIENT_SAVE_FAILED: 'Infrastructure:PatientSaveFailed',
  KORREKTUR_TOT_BENOETIGT_BESTAETIGUNG: 'BusinessRule:KorrekturTotBenoetigtBestaetigung',
} as const;

export type KorrigierePatientErrorCode = (typeof KORRIGIERE_PATIENT_ERROR_CODES)[keyof typeof KORRIGIERE_PATIENT_ERROR_CODES];
