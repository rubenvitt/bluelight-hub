/**
 * Sentinel-Error-Codes für den `aktualisiere-sichtung`-Use-Case (Story 1.3).
 *
 * Konsumenten:
 *  - `AktualisiereSichtungHandler` für `Result.fail(...)` Returns
 *  - `mapErrorToHttp` im Modules-Layer für die HTTP-Übersetzung
 *
 * Die Codes folgen dem repo-weiten Pattern (`PRÄFIX:Kennung[:Detail]`).
 * Domain-emittierte Sentinels (`BusinessRule:SichtungVonTotNichtErlaubt`,
 * `BusinessRule:SichtungUnveraendert`, `BusinessRule:SichtungUngueltig`,
 * `BusinessRule:GrundUngueltig`, `BusinessRule:ClockDriftUngueltig`) propagiert
 * der Handler unverändert — der Controller mappt sie in `error-to-http.ts`.
 */
export const AKTUALISIERE_SICHTUNG_ERROR_CODES = {
  /** `einsatzId` ist leer (Validierungsfehler vor Patient-Lookup). */
  EINSATZ_ID_REQUIRED: 'Validation:EinsatzIdRequired',
  /** `patientId` ist leer (Validierungsfehler vor Patient-Lookup). */
  PATIENT_ID_REQUIRED: 'Validation:PatientIdRequired',
  /** `neueSk` ist kein bekannter SK-Code. */
  NEUE_SK_REQUIRED: 'Validation:NeueSkRequired',
  /** `sichtungArt` ist nicht `aerztlich` oder `vorsichtung`. */
  SICHTUNG_ART_INVALID: 'Validation:SichtungArtInvalid',
  /** `sichter` ist keine valide Erfasser-Referenz. */
  SICHTER_INVALID: 'Validation:SichterInvalid',
  /** `clockDriftSeconds` ist kein endlicher Integer. */
  CLOCK_DRIFT_INVALID: 'Validation:ClockDriftInvalid',
  /** `grund` überschreitet 500 Zeichen oder ist leer-getrimmt. */
  GRUND_INVALID: 'Validation:GrundInvalid',
  /** Patient existiert nicht oder ist nicht im aktuellen Einsatz (kein Info-Leak via 404). */
  PATIENT_NICHT_GEFUNDEN: 'NotFound:PatientNichtGefunden',
  /** Der zugehörige ETB-Append schlug fehl (Aggregate-Validierung blockierte). */
  ETB_APPEND_FAILED: 'Infrastructure:EtbAppendFailed',
  /** Die `PatientEtbContextSchema`-Validierung des Zod-Payloads schlug fehl. */
  ETB_CONTEXT_INVALID: 'Validation:EtbContextInvalid',
} as const;

export type AktualisiereSichtungErrorCode = (typeof AKTUALISIERE_SICHTUNG_ERROR_CODES)[keyof typeof AKTUALISIERE_SICHTUNG_ERROR_CODES];
