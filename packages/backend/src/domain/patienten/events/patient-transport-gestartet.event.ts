import type { TransportstatusCode } from '../value-objects/transportstatus.vo';
import { PatientDomainEvent } from './patient-domain-event';

/**
 * Domain-Event — „Transport des Patienten gestartet" (Story 1.1 Skeleton,
 * Story 1.4 verdrahtet).
 *
 * Trägt seit Story 1.4 `vorher`/`neu` (Payload-Erweiterung — Naming-Boyscout
 * aus `deferred-work.md`): erlaubter Übergang `WARTEND → IM_TRANSPORT`.
 * `eventName()` ist auf Dot-Notation umgestellt.
 */
export class PatientTransportGestartet extends PatientDomainEvent {
  constructor(
    einsatzId: string,
    patientId: string,
    eventVersion: number,
    public readonly vorher: TransportstatusCode,
    public readonly neu: TransportstatusCode,
    actorUserId?: string,
    actorDeviceId?: string,
    originSessionId?: string,
    clockDriftSeconds?: number,
    occurredOn?: Date,
  ) {
    super(einsatzId, patientId, eventVersion, actorUserId, actorDeviceId, originSessionId, clockDriftSeconds, occurredOn);
  }

  static eventName(): string {
    return 'patient.transport-gestartet';
  }
}
