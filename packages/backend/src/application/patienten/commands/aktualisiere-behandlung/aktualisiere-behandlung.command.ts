import type { BehandlungsstatusCode } from '@domain/patienten/value-objects/behandlungsstatus.vo';
import type { ErfasserRefData } from '@domain/patienten/value-objects/erfasser-ref.vo';

/**
 * Command-Payload für den `aktualisiere-behandlung`-Use-Case (Story 1.4, FR18).
 *
 * Der `PatientenController` baut den Command aus DTO + `@CurrentUser()`; in
 * Story 1.4 ist `actor` fest auf den `user`-Branch verdrahtet — der
 * `device`-Branch folgt mit Epic 2 (Standalone-Attach).
 */
export interface AktualisiereBehandlungCommandProps {
  einsatzId: string;
  patientId: string;
  neuerStatus: BehandlungsstatusCode;
  actor: ErfasserRefData;
  clockDriftSeconds?: number;
}

export class AktualisiereBehandlungCommand {
  readonly einsatzId: string;
  readonly patientId: string;
  readonly neuerStatus: BehandlungsstatusCode;
  readonly actor: ErfasserRefData;
  readonly clockDriftSeconds?: number;

  constructor(props: AktualisiereBehandlungCommandProps) {
    this.einsatzId = props.einsatzId;
    this.patientId = props.patientId;
    this.neuerStatus = props.neuerStatus;
    this.actor = props.actor;
    this.clockDriftSeconds = props.clockDriftSeconds;
  }
}
