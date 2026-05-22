import type { ErfasserRefData } from '@domain/patienten/value-objects/erfasser-ref.vo';
import type { SkCode } from '@domain/patienten/value-objects/sichtungskategorie.vo';
import type { SichtungArt } from '@domain/patienten/value-objects/sichtung.vo';

/**
 * Command-Payload für den `aktualisiere-sichtung`-Use-Case (Story 1.3, FR17).
 *
 * Der `PatientenController` baut den Command aus DTO + `@CurrentUser()`; in
 * Story 1.3 wird `sichter` fest auf den `user`-Branch verdrahtet — der
 * `device`-Branch folgt mit Epic 2 (Standalone-Attach).
 *
 * Konstruktor-Parameter sind absichtlich Plain-Strings — VO-Validierung
 * passiert im Handler, damit der Command framework-agnostisch bleibt.
 */
export interface AktualisiereSichtungCommandProps {
  einsatzId: string;
  patientId: string;
  neueSk: SkCode;
  sichtungArt: SichtungArt;
  sichter: ErfasserRefData;
  grund?: string;
  clockDriftSeconds?: number;
}

export class AktualisiereSichtungCommand {
  readonly einsatzId: string;
  readonly patientId: string;
  readonly neueSk: SkCode;
  readonly sichtungArt: SichtungArt;
  readonly sichter: ErfasserRefData;
  readonly grund?: string;
  readonly clockDriftSeconds?: number;

  constructor(props: AktualisiereSichtungCommandProps) {
    this.einsatzId = props.einsatzId;
    this.patientId = props.patientId;
    this.neueSk = props.neueSk;
    this.sichtungArt = props.sichtungArt;
    this.sichter = props.sichter;
    this.grund = props.grund?.trim();
    this.clockDriftSeconds = props.clockDriftSeconds;
  }
}
