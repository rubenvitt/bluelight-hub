import type { BehandlungsstatusCode } from '../value-objects/behandlungsstatus.vo';
import { PatientDomainEvent } from './patient-domain-event';

/**
 * Domain-Event — „Behandlung des Patienten abgeschlossen" (Story 1.4, FR18).
 *
 * Trägt `vorher`/`neu`, damit Audit-Spur (ETB, FR40) und KPI-Delta (Story 1.5)
 * ohne Reload arbeiten. Erlaubte Übergänge: `IN_BEHANDLUNG → VERSORGT` und
 * `IN_BEHANDLUNG → TRANSPORTBEREIT` (operative Realität bei MANV).
 */
export class PatientBehandlungAbgeschlossen extends PatientDomainEvent {
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
    return 'patient.behandlung-abgeschlossen';
  }
}
