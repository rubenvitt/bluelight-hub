import { Result } from '@domain/common/result';
import { ValueObject } from '@domain/common/value-object';
import { Sichtungskategorie } from './sichtungskategorie.vo';
import { ErfasserRef, type ErfasserRefData } from './erfasser-ref.vo';

/**
 * Sichtungsereignis eines Patienten (Story 1.1).
 *
 * Trägt Sichtungskategorie, Sichter (user oder device — analog zu ErfasserRef)
 * und die Sichtungs-Art. `aerztlich` = ärztliche Sichtung (höhere Verbindlichkeit);
 * `vorsichtung` = Ersteinschätzung durch Nicht-Arzt.
 */
export const SICHTUNG_ARTEN = ['aerztlich', 'vorsichtung'] as const;
export type SichtungArt = (typeof SICHTUNG_ARTEN)[number];

/**
 * Sichter-Referenz — strukturgleich zu ErfasserRef, getrennt benannt, damit die
 * Domain-Bedeutung im Code lesbar bleibt.
 */
export type SichterRef = ErfasserRefData;

interface SichtungProps extends Record<string, unknown> {
  sk: Sichtungskategorie;
  sichter: SichterRef;
  sichtungArt: SichtungArt;
  gesichtetAm: Date;
}

export class Sichtung extends ValueObject<SichtungProps> {
  private constructor(props: SichtungProps) {
    super(props);
  }

  static create(props: { sk: Sichtungskategorie; sichter: SichterRef; sichtungArt: SichtungArt; gesichtetAm: Date }): Result<Sichtung> {
    if (!(props.sk instanceof Sichtungskategorie)) {
      return Result.fail<Sichtung>('Sichtung: sk muss eine Sichtungskategorie sein');
    }
    if (!SICHTUNG_ARTEN.includes(props.sichtungArt)) {
      return Result.fail<Sichtung>(`Sichtung: ungültige sichtungArt "${props.sichtungArt}". Erwartet: ${SICHTUNG_ARTEN.join(', ')}`);
    }
    if (!(props.gesichtetAm instanceof Date) || Number.isNaN(props.gesichtetAm.getTime())) {
      return Result.fail<Sichtung>('Sichtung: gesichtetAm muss ein gültiges Date sein');
    }
    if (props.sichter === null || props.sichter === undefined || typeof props.sichter !== 'object') {
      return Result.fail<Sichtung>('Sichtung: sichter erforderlich');
    }
    if (props.sichter.type === 'user') {
      if (typeof props.sichter.userId !== 'string' || props.sichter.userId.trim().length === 0) {
        return Result.fail<Sichtung>('Sichtung: sichter.userId darf nicht leer sein');
      }
    } else if (props.sichter.type === 'device') {
      if (typeof props.sichter.deviceId !== 'string' || props.sichter.deviceId.trim().length === 0) {
        return Result.fail<Sichtung>('Sichtung: sichter.deviceId darf nicht leer sein');
      }
      if (props.sichter.captureSessionId !== undefined && (typeof props.sichter.captureSessionId !== 'string' || props.sichter.captureSessionId.trim().length === 0)) {
        return Result.fail<Sichtung>('Sichtung: sichter.captureSessionId darf nicht leer sein');
      }
    } else {
      return Result.fail<Sichtung>('Sichtung: sichter.type muss "user" oder "device" sein');
    }
    return Result.ok(new Sichtung({ ...props }));
  }

  get sk(): Sichtungskategorie {
    return this.props.sk;
  }
  get sichter(): SichterRef {
    return this.props.sichter;
  }
  get sichtungArt(): SichtungArt {
    return this.props.sichtungArt;
  }
  get gesichtetAm(): Date {
    return this.props.gesichtetAm;
  }

  static isUserSichter(sichter: SichterRef): boolean {
    return ErfasserRef.isUserErfasser(sichter);
  }
  static isDeviceSichter(sichter: SichterRef): boolean {
    return ErfasserRef.isDeviceErfasser(sichter);
  }
}
