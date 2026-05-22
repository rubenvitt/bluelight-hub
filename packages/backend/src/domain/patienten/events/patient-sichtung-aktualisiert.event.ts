import type { SichterRef, SichtungArt } from '../value-objects/sichtung.vo';
import type { SkCode } from '../value-objects/sichtungskategorie.vo';
import { PatientDomainEvent } from './patient-domain-event';

/**
 * Domain-Event — „Patient-Sichtung aktualisiert" (Story 1.3, Architecture §D-2/§D-8).
 *
 * Fachlich getrennt von `PatientGesichtet`: emittiert wird dieses Event NUR bei
 * Reevaluierung (Sichtungs-Korrektur auf einen bereits erfassten Patienten),
 * niemals beim Erst-Erfassen. Trägt `vorher` und `neu` zusätzlich zum
 * `PatientGesichtet`-Shape, damit Audit-Spur und KPI-Delta (Story 1.5) ohne
 * Reload arbeiten können. Append-only (DIN 13050, NFR-S5): persistierter
 * Event-Stream bleibt unverändert; nur der denormalisierte `Patient.aktuelleSk`-
 * Snapshot zieht nach.
 */
export class PatientSichtungAktualisiert extends PatientDomainEvent {
  constructor(
    einsatzId: string,
    patientId: string,
    eventVersion: number,
    public readonly vorher: SkCode,
    public readonly neu: SkCode,
    public readonly sichtungArt: SichtungArt,
    public readonly sichter: SichterRef,
    public readonly grund?: string,
    clockDriftSeconds?: number,
    occurredOn?: Date,
  ) {
    const actorUserId = sichter.type === 'user' ? sichter.userId : undefined;
    const actorDeviceId = sichter.type === 'device' ? sichter.deviceId : undefined;
    const originSessionId = sichter.type === 'device' ? sichter.captureSessionId : undefined;
    super(einsatzId, patientId, eventVersion, actorUserId, actorDeviceId, originSessionId, clockDriftSeconds, occurredOn);
  }

  static eventName(): string {
    return 'patient.sichtung-aktualisiert';
  }
}
