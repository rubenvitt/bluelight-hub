import type { PatientEventDtoEventTypeEnum } from '@bluelight-hub/shared/client';

/**
 * Story 1.7 (AC8): UI-Labels für die 8 Patient-Event-Typen aus dem
 * `event-deserializer.ts`-Registry.
 *
 * Wird vom `PatientEreignisListe.organism` als Timeline-Header gerendert.
 * Pattern analog zu `SK_LABELS`, `BEHANDLUNGS_STATUS_LABELS` etc. Unbekannte
 * `eventType`-Strings (Forward-Compat: Backend führt neuen Event-Typ vor
 * Frontend-Release ein) werden im Organism als „Unbekanntes Ereignis"
 * gerendert — siehe `getPatientEventLabel`.
 */
export const PATIENT_EVENT_TYPE_LABELS = {
  'patient.erfasst': 'Patient erfasst',
  'patient.gesichtet': 'Sichtung erfasst',
  'patient.sichtung-aktualisiert': 'Sichtung aktualisiert',
  'patient.behandlung-begonnen': 'Behandlung begonnen',
  'patient.behandlung-abgeschlossen': 'Behandlung abgeschlossen',
  'patient.transport-gestartet': 'Transport gestartet',
  'patient.transport-abgeschlossen': 'Transport abgeschlossen',
  'patient.korrigiert': 'Korrektur',
} as const satisfies Record<PatientEventDtoEventTypeEnum, string>;

export type PatientEventTypeLabel = (typeof PATIENT_EVENT_TYPE_LABELS)[keyof typeof PATIENT_EVENT_TYPE_LABELS];

/**
 * Liefert das UI-Label zum Event-Typ — Fallback `Unbekanntes Ereignis (...)`
 * für unbekannte Strings (Backend-Drift, NFR-S5 defensiv).
 */
export function getPatientEventLabel(eventType: string): string {
  if (eventType in PATIENT_EVENT_TYPE_LABELS) {
    return PATIENT_EVENT_TYPE_LABELS[eventType as PatientEventDtoEventTypeEnum];
  }
  return `Unbekanntes Ereignis (${eventType})`;
}
