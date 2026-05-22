/**
 * Sentinel-Error-Codes für den `erfasse-patient`-Use-Case (Story 1.2).
 *
 * Konsumenten:
 * - `ErfassePatientHandler` für `Result.fail(...)` Returns
 * - `mapErrorToHttp` im Modules-Layer für die HTTP-Übersetzung
 *
 * Die Codes folgen dem repo-weiten Pattern (`PRÄFIX:Kennung[:Detail]`); die
 * konkreten Präfixe spiegeln die HTTP-Mapping-Klasse (`BusinessRule:` → 422,
 * `ConflictDetected:` → 409, `Validation:` → 400, `Infrastructure:` → 500).
 */
export const PATIENT_ERFASSEN_ERROR_CODES = {
  /** Pflichtfeld `initialeSk` fehlt oder ist kein bekannter SK-Code. */
  INITIALE_SK_REQUIRED: 'Validation:InitialeSkRequired',
  /** `erfasserRef` ist ungültig (Bimodalitäts-Vertrag verletzt). */
  ERFASSER_REF_INVALID: 'Validation:ErfasserRefInvalid',
  /** `diviVakNummer` überschreitet die Längengrenze oder ist leer-getrimmt. */
  DIVI_VAK_NUMMER_INVALID: 'Validation:DiviVakNummerInvalid',
  /** `notiz` ist länger als 500 Zeichen oder leer-getrimmt. */
  NOTIZ_INVALID: 'Validation:NotizInvalid',
  /** `clockDriftSeconds` ist kein endlicher Integer. */
  CLOCK_DRIFT_INVALID: 'Validation:ClockDriftInvalid',
  /** `einsatzId` ist leer oder unbekannt. */
  EINSATZ_ID_REQUIRED: 'Validation:EinsatzIdRequired',
  /** Patientennummer-Race: `(einsatzId, patientennummer)` bereits vergeben. */
  PATIENTENNUMMER_KONFLIKT: 'ConflictDetected:PatientennummerKonflikt',
  /** Der aktive Einsatz ist im Zustand, der das Erfassen verbietet. */
  EINSATZ_NICHT_AKTIV: 'BusinessRule:EinsatzNichtAktiv',
  /** Der zugehörige ETB-Append schlug fehl (Aggregate-Validierung blockierte). */
  ETB_APPEND_FAILED: 'Infrastructure:EtbAppendFailed',
  /** Die `PatientEtbContextSchema`-Validierung des Zod-Payloads schlug fehl. */
  ETB_CONTEXT_INVALID: 'Validation:EtbContextInvalid',
} as const;

export type PatientErfassenErrorCode = (typeof PATIENT_ERFASSEN_ERROR_CODES)[keyof typeof PATIENT_ERFASSEN_ERROR_CODES];
