import type { BehandlungsstatusCode } from '../value-objects/behandlungsstatus.vo';
import { PatientDomainEvent } from './patient-domain-event';

/**
 * Domain-Event — „Behandlung des Patienten begonnen" (Story 1.1 Skeleton,
 * Story 1.4 verdrahtet).
 *
 * Trägt seit Story 1.4 `vorher`/`neu` (Payload-Erweiterung — Naming-Boyscout
 * aus `deferred-work.md`): erlaubter Übergang `UNVERSORGT → IN_BEHANDLUNG`.
 * `eventName()` ist auf Dot-Notation umgestellt (konsistent mit den anderen
 * Patient-Events).
 */
export class PatientBehandlungBegonnen extends PatientDomainEvent {
  constructor(
    einsatzId: string,
    patientId: string,
    eventVersion: number,
    public readonly vorher: BehandlungsstatusCode,
    public readonly neu: BehandlungsstatusCode,
    actorUserId?: string,
    actorDeviceId?: string,
    originSessionId?: string,
    clockDriftSeconds?: number,
    occurredOn?: Date,
  ) {
    super(einsatzId, patientId, eventVersion, actorUserId, actorDeviceId, originSessionId, clockDriftSeconds, occurredOn);
  }

  static eventName(): string {
    return 'patient.behandlung-begonnen';
  }
}
