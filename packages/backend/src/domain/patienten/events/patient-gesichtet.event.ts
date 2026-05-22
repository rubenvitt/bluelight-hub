import type { SichterRef, SichtungArt } from '../value-objects/sichtung.vo';
import type { SkCode } from '../value-objects/sichtungskategorie.vo';
import { PatientDomainEvent } from './patient-domain-event';

/**
 * Domain-Event — „Patient gesichtet" (Story 1.1, Story 1.3 fachlich).
 *
 * Trägt die volle Sichtungs-Information, damit Consumer (KPI-Aggregate,
 * Re-Evaluierungs-Marker, ETB-Verzahnung) ohne DB-Roundtrip arbeiten können.
 */
export class PatientGesichtet extends PatientDomainEvent {
  constructor(
    einsatzId: string,
    patientId: string,
    eventVersion: number,
    public readonly sk: SkCode,
    public readonly sichtungArt: SichtungArt,
    public readonly sichter: SichterRef,
    clockDriftSeconds?: number,
    occurredOn?: Date,
  ) {
    const actorUserId = sichter.type === 'user' ? sichter.userId : undefined;
    const actorDeviceId = sichter.type === 'device' ? sichter.deviceId : undefined;
    const originSessionId = sichter.type === 'device' ? sichter.captureSessionId : undefined;
    super(einsatzId, patientId, eventVersion, actorUserId, actorDeviceId, originSessionId, clockDriftSeconds, occurredOn);
  }

  static eventName(): string {
    return 'patient.gesichtet';
  }
}
