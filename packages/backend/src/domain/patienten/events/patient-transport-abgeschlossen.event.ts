import type { TransportstatusCode } from '../value-objects/transportstatus.vo';
import { PatientDomainEvent } from './patient-domain-event';

/**
 * Domain-Event — „Transport des Patienten abgeschlossen" (Story 1.4, FR19).
 *
 * Trägt `vorher`/`neu`, damit der ETB-Eintrag und KPI-Delta ohne Reload den
 * Übergang abbilden können. Einziger erlaubter Übergang:
 * `IM_TRANSPORT → IM_KRANKENHAUS`.
 */
export class PatientTransportAbgeschlossen extends PatientDomainEvent {
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
    return 'patient.transport-abgeschlossen';
  }
}
