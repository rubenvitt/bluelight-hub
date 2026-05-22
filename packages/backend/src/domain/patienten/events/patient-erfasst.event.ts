import type { ErfasserRefData } from '../value-objects/erfasser-ref.vo';
import type { SkCode } from '../value-objects/sichtungskategorie.vo';
import { PatientDomainEvent } from './patient-domain-event';

/**
 * Domain-Event — „Patient erfasst" (Story 1.1, Architecture §D-1).
 *
 * Wird vom `Patient.create()`-Factory atomar mit der initialen Aggregate-
 * Persistierung emittiert. Die Outbox-Verdrahtung (Serializer + Adapter +
 * Index, ADR-006) folgt in **Story 1.2** — Story 1.1 legt die Klasse nur an.
 */
export class PatientErfasst extends PatientDomainEvent {
  constructor(
    einsatzId: string,
    patientId: string,
    public readonly patientennummer: string,
    public readonly initialeSk: SkCode,
    public readonly erfasserRef: ErfasserRefData,
    clockDriftSeconds?: number,
    occurredOn?: Date,
  ) {
    const actorUserId = erfasserRef.type === 'user' ? erfasserRef.userId : undefined;
    const actorDeviceId = erfasserRef.type === 'device' ? erfasserRef.deviceId : undefined;
    const originSessionId = erfasserRef.type === 'device' ? erfasserRef.captureSessionId : undefined;
    super(einsatzId, patientId, 1, actorUserId, actorDeviceId, originSessionId, clockDriftSeconds, occurredOn);
  }

  static eventName(): string {
    return 'patient.erfasst';
  }
}
