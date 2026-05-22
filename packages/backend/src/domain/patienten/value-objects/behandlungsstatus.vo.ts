import { Result } from '@domain/common/result';
import { ValueObject } from '@domain/common/value-object';

/**
 * Behandlungsstatus eines Patienten (Story 1.1).
 *
 * Übergänge folgen dem Sani-/RD-Workflow: erst Versorgung, dann Transport-
 * bereitschaft. Story 1.4 verdrahtet die Übergänge fachlich; das VO stellt die
 * Validierungs-Logik bereits hier bereit, damit das Aggregate sich darauf
 * verlassen kann.
 */
export const BEHANDLUNGSSTATUS_CODES = ['UNVERSORGT', 'IN_BEHANDLUNG', 'VERSORGT', 'TRANSPORTBEREIT'] as const;
export type BehandlungsstatusCode = (typeof BEHANDLUNGSSTATUS_CODES)[number];

interface BehandlungsstatusProps extends Record<string, unknown> {
  code: BehandlungsstatusCode;
}

/**
 * Erlaubte Übergänge im Behandlungsstatus.
 *
 * Bewusst restriktiv: Rücksprünge (z. B. `VERSORGT → IN_BEHANDLUNG`) sind nur
 * über expliziten Korrektur-Pfad (Story 1.4, `PatientKorrigiert`-Event) möglich,
 * nicht über den regulären Status-Übergang.
 *
 * Story 1.4 erweitert `IN_BEHANDLUNG`-Übergänge um `TRANSPORTBEREIT`: nicht jeder
 * Patient durchläuft formell `VERSORGT`, bevor er als transportbereit gemeldet
 * werden kann (operative Realität bei MANV — OrgL kann direkt zur Transport-
 * Phase springen, wenn die Versorgung am Schadensort abgeschlossen ist).
 */
const ALLOWED_TRANSITIONS: Record<BehandlungsstatusCode, readonly BehandlungsstatusCode[]> = {
  UNVERSORGT: ['IN_BEHANDLUNG'],
  IN_BEHANDLUNG: ['VERSORGT', 'TRANSPORTBEREIT'],
  VERSORGT: ['TRANSPORTBEREIT'],
  TRANSPORTBEREIT: [],
};

export class Behandlungsstatus extends ValueObject<BehandlungsstatusProps> {
  private constructor(props: BehandlungsstatusProps) {
    super(props);
  }

  static create(code: string): Result<Behandlungsstatus> {
    if (typeof code !== 'string') {
      return Result.fail<Behandlungsstatus>('Behandlungsstatus: code muss ein String sein');
    }
    if (!BEHANDLUNGSSTATUS_CODES.includes(code as BehandlungsstatusCode)) {
      return Result.fail<Behandlungsstatus>(`Behandlungsstatus: ungültiger Code "${code}". Erwartet: ${BEHANDLUNGSSTATUS_CODES.join(', ')}`);
    }
    return Result.ok(new Behandlungsstatus({ code: code as BehandlungsstatusCode }));
  }

  static initial(): Behandlungsstatus {
    return new Behandlungsstatus({ code: 'UNVERSORGT' });
  }

  get code(): BehandlungsstatusCode {
    return this.props.code;
  }

  /**
   * Prüft, ob ein direkter Übergang in den angegebenen Folgestatus zulässig ist.
   * Story 1.4 baut auf dieser Methode auf.
   */
  canTransitionTo(next: BehandlungsstatusCode): boolean {
    return ALLOWED_TRANSITIONS[this.props.code].includes(next);
  }
}
