import { Result } from '@domain/common/result';

/**
 * Props für AcknowledgeErinnerungCommand.
 */
export interface AcknowledgeErinnerungCommandProps {
  /** ID der Erinnerung die bestätigt werden soll (CUID2 Format) */
  erinnerungId: string;
  /** ID des Users der die Erinnerung bestätigt (CUID2 Format) */
  acknowledgedBy: string;
}

/**
 * Command zum Bestätigen einer ausgelösten Erinnerung (1-Tap Acknowledge).
 *
 * **Business Rules (Story 1.6):**
 * - Nur Erinnerungen mit Status AUSGELOEST können bestätigt werden
 * - Command validiert Format der IDs (CUID2)
 * - Business-Validierung erfolgt im Handler via Domain Entity
 *
 * @example
 * ```typescript
 * const cmdResult = AcknowledgeErinnerungCommand.create({
 *   erinnerungId: 'cmb1234...',
 *   acknowledgedBy: 'cma5678...',
 * });
 * if (cmdResult.isSuccess) {
 *   const result = await handler.execute(cmdResult.value);
 * }
 * ```
 */
export class AcknowledgeErinnerungCommand {
  /**
   * Private Constructor - Erzwingt Factory Method Nutzung.
   */
  private constructor(
    public readonly erinnerungId: string,
    public readonly acknowledgedBy: string,
  ) {}

  /**
   * Factory Method mit Validierung.
   *
   * @param props - Command Properties
   * @returns Result mit Command oder Fehler
   */
  static create(props: AcknowledgeErinnerungCommandProps): Result<AcknowledgeErinnerungCommand> {
    // Validierung: erinnerungId erforderlich und CUID2 Format
    if (!props.erinnerungId || typeof props.erinnerungId !== 'string') {
      return Result.fail<AcknowledgeErinnerungCommand>('ERINNERUNG_ID_REQUIRED');
    }

    // CUID2 Format-Check (24-32 Zeichen, lowercase alphanumerisch)
    const cuidPattern = /^[a-z0-9]{24,32}$/;
    if (!cuidPattern.test(props.erinnerungId)) {
      return Result.fail<AcknowledgeErinnerungCommand>('ERINNERUNG_ID_INVALID_FORMAT');
    }

    // Validierung: acknowledgedBy erforderlich und CUID2 Format
    if (!props.acknowledgedBy || typeof props.acknowledgedBy !== 'string') {
      return Result.fail<AcknowledgeErinnerungCommand>('ACKNOWLEDGED_BY_REQUIRED');
    }

    if (!cuidPattern.test(props.acknowledgedBy)) {
      return Result.fail<AcknowledgeErinnerungCommand>('ACKNOWLEDGED_BY_INVALID_FORMAT');
    }

    return Result.ok<AcknowledgeErinnerungCommand>(new AcknowledgeErinnerungCommand(props.erinnerungId, props.acknowledgedBy));
  }
}
