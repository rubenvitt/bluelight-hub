import { createId } from '@paralleldrive/cuid2';

/**
 * Erzeugt eine ID für eine Capture-Session.
 *
 * Das Prefix `cs_` ist Teil des Storage-Vertrags aus ADR-017: IDs werden über
 * ihr Präfix dem jeweiligen Aggregat zugeordnet, damit Replay- und
 * Sync-Schichten ohne Schema-Lookup zwischen Session-, Patient- und Device-IDs
 * unterscheiden können.
 */
export function createCaptureSessionId(): string {
  return `cs_${createId()}`;
}

/**
 * Erzeugt eine lokale Patient-ID (vor Server-Roundtrip).
 *
 * Das Prefix `pl_` markiert die ID als "patient-local" gemäß ADR-017. So lassen
 * sich offline erzeugte Patienten-Datensätze von server-vergebenen IDs trennen
 * und während des Sync eindeutig auflösen.
 */
export function createPatientLocalId(): string {
  return `pl_${createId()}`;
}

/**
 * Erzeugt eine stabile Geräte-ID für diesen Client.
 *
 * Das Prefix `dev_` folgt dem Storage-Vertrag aus ADR-017 und kennzeichnet die
 * ID eindeutig als Geräte-Identität — relevant für Audit-Trails und
 * Konflikt-Auflösung beim Mehrgeräte-Capture.
 */
export function createDeviceId(): string {
  return `dev_${createId()}`;
}
