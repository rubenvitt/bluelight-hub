import { PatientDomainEvent } from './patient-domain-event';

/**
 * Patient-Korrektur-Feld-Union (Story 1.4, FR42).
 *
 * Die drei korrigierbaren Snapshot-Felder; jede Korrektur emittiert exakt ein
 * `PatientKorrigiert`-Event und überschreibt den jeweiligen Slot — der
 * Originaleintrag im Event-Stream bleibt append-only erhalten (NFR-S5).
 */
export type PatientKorrekturFeld = 'sichtung' | 'behandlungsstatus' | 'transportstatus' | 'notiz';

export const PATIENT_KORREKTUR_FELDER: readonly PatientKorrekturFeld[] = ['sichtung', 'behandlungsstatus', 'transportstatus', 'notiz'];

/**
 * Domain-Event — „Patient korrigiert" (Story 1.4, FR42, Architecture §D-2).
 *
 * **Append-only-Vertrag:** Korrektur ersetzt nicht den Originaleintrag,
 * sondern erzeugt einen neuen `PatientEvent`-Row mit `eventType='patient.korrigiert'`.
 * **Keine Übergangs-Validierung** — Korrektur darf jeden Enum-Wert erreichen
 * (das ist die Eigenschaft, die Korrektur von regulärer Transition unterscheidet).
 * `grund` ist Pflicht (Audit-Trail-Hygiene).
 */
export class PatientKorrigiert extends PatientDomainEvent {
  constructor(
    einsatzId: string,
    patientId: string,
    eventVersion: number,
    public readonly feld: PatientKorrekturFeld,
    /**
     * Vorheriger Wert. `null` ist nur für `feld='notiz'` zulässig (Story 1.7,
     * AC9) — bei den enum-basierten Feldern (`sichtung`/`behandlungsstatus`/
     * `transportstatus`) ist immer ein String aus dem jeweiligen VO gesetzt.
     */
    public readonly vorher: string | null,
    /**
     * Neuer Wert. `null` ist nur für `feld='notiz'` zulässig — entspricht dem
     * „Notiz löschen"-Pfad.
     */
    public readonly neu: string | null,
    public readonly grund: string,
    actorUserId?: string,
    actorDeviceId?: string,
    originSessionId?: string,
    clockDriftSeconds?: number,
    occurredOn?: Date,
  ) {
    super(einsatzId, patientId, eventVersion, actorUserId, actorDeviceId, originSessionId, clockDriftSeconds, occurredOn);
  }

  static eventName(): string {
    return 'patient.korrigiert';
  }
}
