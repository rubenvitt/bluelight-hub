import type { PatientKorrekturFeld } from '@domain/patienten/events/patient-korrigiert.event';
import type { ErfasserRefData } from '@domain/patienten/value-objects/erfasser-ref.vo';

/**
 * Command-Payload für den `korrigiere-patient`-Use-Case (Story 1.4, FR42).
 *
 * Generischer Korrektur-Pfad: jedes der drei Snapshot-Felder
 * (`sichtung`/`behandlungsstatus`/`transportstatus`) kann auf einen beliebigen
 * Enum-Wert gesetzt werden; das Aggregate validiert den Ziel-Wert über das
 * jeweilige VO, **ohne** Übergangs-Check. `grund` ist Pflicht und wird im
 * Konstruktor getrimmt.
 */
export interface KorrigierePatientCommandProps {
  einsatzId: string;
  patientId: string;
  feld: PatientKorrekturFeld;
  /**
   * Neuer Wert. Bei `feld='notiz'` (Story 1.7, AC9) ist `null` zulässig
   * (Notiz löschen); sonst ein nicht-leerer String aus dem jeweiligen
   * VO-Wertebereich.
   */
  neuerWert: string | null;
  grund: string;
  actor: ErfasserRefData;
  clockDriftSeconds?: number;
  /**
   * Story 1.4 Code-Review Feature 2: explizite Bestätigung für die irreversible
   * TOT-Markierung via Korrektur-Pfad (`feld='sichtung' && neuerWert='TOT'` gegen
   * einen lebenden Patienten). Default `undefined` → das Aggregate lehnt die
   * Korrektur mit `BusinessRule:KorrekturTotBenoetigtBestaetigung` ab.
   */
  bestaetigeTotKorrektur?: boolean;
}

export class KorrigierePatientCommand {
  readonly einsatzId: string;
  readonly patientId: string;
  readonly feld: PatientKorrekturFeld;
  readonly neuerWert: string | null;
  readonly grund: string;
  readonly actor: ErfasserRefData;
  readonly clockDriftSeconds?: number;
  readonly bestaetigeTotKorrektur: boolean | undefined;

  constructor(props: KorrigierePatientCommandProps) {
    this.einsatzId = props.einsatzId;
    this.patientId = props.patientId;
    this.feld = props.feld;
    this.neuerWert = props.neuerWert;
    this.grund = props.grund.trim();
    this.actor = props.actor;
    this.clockDriftSeconds = props.clockDriftSeconds;
    this.bestaetigeTotKorrektur = props.bestaetigeTotKorrektur;
  }
}
