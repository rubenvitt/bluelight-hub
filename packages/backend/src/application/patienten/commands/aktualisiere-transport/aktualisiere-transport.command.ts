import type { ErfasserRefData } from '@domain/patienten/value-objects/erfasser-ref.vo';
import type { TransportstatusCode } from '@domain/patienten/value-objects/transportstatus.vo';

/**
 * Command-Payload für den `aktualisiere-transport`-Use-Case (Story 1.4, FR19).
 */
export interface AktualisiereTransportCommandProps {
  einsatzId: string;
  patientId: string;
  neuerStatus: TransportstatusCode;
  actor: ErfasserRefData;
  clockDriftSeconds?: number;
}

export class AktualisiereTransportCommand {
  readonly einsatzId: string;
  readonly patientId: string;
  readonly neuerStatus: TransportstatusCode;
  readonly actor: ErfasserRefData;
  readonly clockDriftSeconds?: number;

  constructor(props: AktualisiereTransportCommandProps) {
    this.einsatzId = props.einsatzId;
    this.patientId = props.patientId;
    this.neuerStatus = props.neuerStatus;
    this.actor = props.actor;
    this.clockDriftSeconds = props.clockDriftSeconds;
  }
}
