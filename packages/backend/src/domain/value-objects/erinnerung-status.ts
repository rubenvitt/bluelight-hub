import { ValueObject } from '@domain/common/value-object';
import { Result } from '@domain/common/result';

/**
 * Alle gültigen Erinnerung Status Werte.
 * Exportiert für DTO Validierung und OpenAPI Schema Generation.
 */
export const ERINNERUNG_STATUS_VALUES = ['GEPLANT', 'AUSGELOEST', 'ACKNOWLEDGED', 'SNOOZED', 'ESKALIERT', 'ERLEDIGT'] as const;

/**
 * Type für einen gültigen Erinnerung Status Wert.
 */
export type ErinnerungStatusValue = (typeof ERINNERUNG_STATUS_VALUES)[number];

/**
 * Props für ErinnerungStatus Value Object.
 */
interface ErinnerungStatusProps extends Record<string, unknown> {
  value: string;
}

/**
 * ErinnerungStatus Value Object mit State Machine Logic.
 *
 * Modelliert den Lebenszyklus einer Erinnerung als State Machine.
 * Verhindert ungültige Zustandsübergänge zur Compile- und Laufzeit.
 *
 * **Erlaubte Zustände:**
 * - `GEPLANT`: Initialer Zustand, Erinnerung wurde erstellt
 * - `AUSGELOEST`: Timer ist abgelaufen, Alarm wird angezeigt
 * - `ACKNOWLEDGED`: User hat die Erinnerung bestätigt
 * - `SNOOZED`: User hat die Erinnerung verschoben
 * - `ESKALIERT`: Erinnerung wurde an Eskalationsperson weitergeleitet
 * - `ERLEDIGT`: Erinnerung wurde abgeschlossen
 *
 * **State Machine Regeln:**
 * - GEPLANT → AUSGELOEST (Timer abgelaufen)
 * - AUSGELOEST → ACKNOWLEDGED, SNOOZED, ESKALIERT
 * - ACKNOWLEDGED → ERLEDIGT
 * - SNOOZED → AUSGELOEST (erneut ausgelöst), ESKALIERT
 * - ESKALIERT → ACKNOWLEDGED, ERLEDIGT
 * - ERLEDIGT → (finale Transition)
 *
 * @example
 * ```typescript
 * // Factory Method mit Validierung
 * const result = ErinnerungStatus.create('GEPLANT');
 * if (result.isSuccess) {
 *   const status = result.value!;
 * }
 *
 * // Static Convenience Factories
 * const geplant = ErinnerungStatus.GEPLANT();
 * const ausgeloest = ErinnerungStatus.AUSGELOEST();
 *
 * // State Transition Validierung
 * if (geplant.canTransitionTo(ausgeloest)) {
 *   // Transition ist gültig
 * }
 * ```
 */
export class ErinnerungStatus extends ValueObject<ErinnerungStatusProps> {
  /**
   * Erlaubte Status-Werte (enum-like).
   * Nutzt die exportierte Konstante für Konsistenz.
   */
  private static readonly ALLOWED_VALUES = ERINNERUNG_STATUS_VALUES;

  /**
   * Public Getter für den Status-Wert.
   */
  get value(): string {
    return this.props.value;
  }

  /**
   * Private Constructor erzwingt Verwendung von Factory Methods.
   */
  private constructor(value: string) {
    super({ value });
  }

  /**
   * Prüft, ob ein Wert ein gültiger Status ist.
   */
  private static isValidStatus(value: string): boolean {
    return ErinnerungStatus.ALLOWED_VALUES.includes(value as (typeof ErinnerungStatus.ALLOWED_VALUES)[number]);
  }

  /**
   * Factory Method zur Erstellung eines ErinnerungStatus mit Validierung.
   *
   * @param value - Der gewünschte Status-Wert
   * @returns Result mit ErinnerungStatus bei Erfolg oder Fehlermeldung bei ungültigem Wert
   */
  static create(value: string): Result<ErinnerungStatus> {
    if (!ErinnerungStatus.isValidStatus(value)) {
      return Result.fail<ErinnerungStatus>(`Ungültiger Status: ${value}. Erlaubte Werte: ${ErinnerungStatus.ALLOWED_VALUES.join(', ')}`);
    }
    return Result.ok<ErinnerungStatus>(new ErinnerungStatus(value));
  }

  // ============================================================
  // Static Convenience Factories
  // ============================================================

  /**
   * Initialer Status: Erinnerung wurde erstellt, Timer läuft.
   */
  static GEPLANT(): ErinnerungStatus {
    return new ErinnerungStatus('GEPLANT');
  }

  /**
   * Timer abgelaufen: Alarm wird angezeigt.
   */
  static AUSGELOEST(): ErinnerungStatus {
    return new ErinnerungStatus('AUSGELOEST');
  }

  /**
   * User hat die Erinnerung bestätigt (1-Tap Acknowledge).
   */
  static ACKNOWLEDGED(): ErinnerungStatus {
    return new ErinnerungStatus('ACKNOWLEDGED');
  }

  /**
   * User hat die Erinnerung verschoben (Snooze).
   */
  static SNOOZED(): ErinnerungStatus {
    return new ErinnerungStatus('SNOOZED');
  }

  /**
   * Erinnerung wurde an Eskalationsperson weitergeleitet.
   */
  static ESKALIERT(): ErinnerungStatus {
    return new ErinnerungStatus('ESKALIERT');
  }

  /**
   * Finale Status: Erinnerung wurde abgeschlossen.
   */
  static ERLEDIGT(): ErinnerungStatus {
    return new ErinnerungStatus('ERLEDIGT');
  }

  // ============================================================
  // State Machine Logic
  // ============================================================

  /**
   * State Machine Logic: Prüft ob eine Transition zu einem neuen Status erlaubt ist.
   *
   * **Valid Transitions:**
   * - GEPLANT → AUSGELOEST (Timer abgelaufen)
   * - AUSGELOEST → ACKNOWLEDGED, SNOOZED, ESKALIERT
   * - ACKNOWLEDGED → ERLEDIGT
   * - SNOOZED → AUSGELOEST, ESKALIERT
   * - ESKALIERT → ACKNOWLEDGED, ERLEDIGT
   * - ERLEDIGT → (keine Transitions - finaler Zustand)
   *
   * @param newStatus - Der Ziel-Status der Transition
   * @returns true wenn Transition erlaubt ist, sonst false
   */
  public canTransitionTo(newStatus: ErinnerungStatus): boolean {
    const validTransitions: Record<string, string[]> = {
      GEPLANT: ['AUSGELOEST'],
      AUSGELOEST: ['ACKNOWLEDGED', 'SNOOZED', 'ESKALIERT'],
      ACKNOWLEDGED: ['ERLEDIGT'],
      SNOOZED: ['AUSGELOEST', 'ESKALIERT'],
      ESKALIERT: ['ACKNOWLEDGED', 'ERLEDIGT'],
      ERLEDIGT: [], // Finale Transition
    };

    const allowedTargets = validTransitions[this.value] || [];
    return allowedTargets.includes(newStatus.value);
  }

  /**
   * Prüft ob der Status initial ist.
   */
  public isGeplant(): boolean {
    return this.value === 'GEPLANT';
  }

  /**
   * Prüft ob der Status ausgelöst ist.
   */
  public isAusgeloest(): boolean {
    return this.value === 'AUSGELOEST';
  }

  /**
   * Prüft ob der Status final (erledigt) ist.
   */
  public isErledigt(): boolean {
    return this.value === 'ERLEDIGT';
  }

  /**
   * Prüft ob der Status acknowledged (bestätigt) ist.
   */
  public isAcknowledged(): boolean {
    return this.value === 'ACKNOWLEDGED';
  }

  /**
   * Prüft ob der Status snoozed (verschoben) ist (Story 2.2).
   */
  public isSnoozed(): boolean {
    return this.value === 'SNOOZED';
  }

  /**
   * Prüft ob die Erinnerung noch aktiv ist (nicht erledigt).
   */
  public isActive(): boolean {
    return this.value !== 'ERLEDIGT';
  }

  /**
   * String-Repräsentation für Logging und Debugging.
   */
  public toString(): string {
    return this.value;
  }
}
