import type { ErfasserRefData } from '@domain/patienten/value-objects/erfasser-ref.vo';
import type { SkCode } from '@domain/patienten/value-objects/sichtungskategorie.vo';

/**
 * Command-Payload für den `erfasse-patient`-Use-Case (Story 1.2, AC1).
 *
 * Wird vom `PatientenController` erzeugt — `erfasserRef` ist im Controller
 * fest auf den `user`-Branch verdrahtet (`@CurrentUser()`); der `device`-Branch
 * folgt mit Story 2.7 (Standalone-Attach).
 *
 * Die Konstruktor-Parameter sind absichtlich Plain-Strings — VO-Validierung
 * passiert im Handler, damit der Command framework-agnostisch bleibt.
 */
export interface ErfassePatientCommandProps {
  einsatzId: string;
  initialeSk: SkCode;
  erfasserRef: ErfasserRefData;
  diviVakNummer?: string;
  notiz?: string;
  clockDriftSeconds?: number;
}

export class ErfassePatientCommand {
  readonly einsatzId: string;
  readonly initialeSk: SkCode;
  readonly erfasserRef: ErfasserRefData;
  readonly diviVakNummer?: string;
  readonly notiz?: string;
  readonly clockDriftSeconds?: number;

  constructor(props: ErfassePatientCommandProps) {
    this.einsatzId = props.einsatzId;
    this.initialeSk = props.initialeSk;
    this.erfasserRef = props.erfasserRef;
    this.diviVakNummer = props.diviVakNummer;
    this.notiz = props.notiz;
    this.clockDriftSeconds = props.clockDriftSeconds;
  }
}
