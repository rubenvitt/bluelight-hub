import { Result } from '@domain/common/result';
import { ValueObject } from '@domain/common/value-object';

/**
 * Transportstatus eines Patienten (Story 1.1).
 *
 * Linearer Workflow: `WARTEND → IM_TRANSPORT → IM_KRANKENHAUS`. Korrekturen
 * laufen über den expliziten Patient-Korrektur-Pfad (Story 1.3), nicht über den
 * regulären Status-Übergang.
 */
export const TRANSPORTSTATUS_CODES = ['WARTEND', 'IM_TRANSPORT', 'IM_KRANKENHAUS'] as const;
export type TransportstatusCode = (typeof TRANSPORTSTATUS_CODES)[number];

interface TransportstatusProps extends Record<string, unknown> {
  code: TransportstatusCode;
}

const ALLOWED_TRANSITIONS: Record<TransportstatusCode, readonly TransportstatusCode[]> = {
  WARTEND: ['IM_TRANSPORT'],
  IM_TRANSPORT: ['IM_KRANKENHAUS'],
  IM_KRANKENHAUS: [],
};

export class Transportstatus extends ValueObject<TransportstatusProps> {
  private constructor(props: TransportstatusProps) {
    super(props);
  }

  static create(code: string): Result<Transportstatus> {
    if (typeof code !== 'string') {
      return Result.fail<Transportstatus>('Transportstatus: code muss ein String sein');
    }
    if (!TRANSPORTSTATUS_CODES.includes(code as TransportstatusCode)) {
      return Result.fail<Transportstatus>(`Transportstatus: ungültiger Code "${code}". Erwartet: ${TRANSPORTSTATUS_CODES.join(', ')}`);
    }
    return Result.ok(new Transportstatus({ code: code as TransportstatusCode }));
  }

  static initial(): Transportstatus {
    return new Transportstatus({ code: 'WARTEND' });
  }

  get code(): TransportstatusCode {
    return this.props.code;
  }

  canTransitionTo(next: TransportstatusCode): boolean {
    return ALLOWED_TRANSITIONS[this.props.code].includes(next);
  }
}
