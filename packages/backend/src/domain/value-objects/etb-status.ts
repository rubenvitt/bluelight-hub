import { ValueObject } from '@domain/common/value-object';
import { Result } from '@domain/common/result';

interface EtbStatusProps extends Record<string, unknown> {
  value: string;
}

/**
 * EtbStatus Value Object mit State Machine Logic.
 *
 * Diese Klasse modelliert den Lebenszyklus eines ETB als State Machine,
 * um ungültige Zustandsübergänge zur Compile- und Laufzeit zu verhindern.
 * Die State Machine erzwingt DRK-konforme Workflows für Einsatztagebücher.
 *
 * **Erlaubte Zustände:**
 * - `DRAFT`: Initialer Zustand, Bearbeitung erlaubt
 * - `ACTIVE`: Aktiv im Einsatz, Bearbeitung erlaubt
 * - `LOCKED`: Finale Sperrung, keine Änderungen mehr möglich
 *
 * **State Machine Regeln:**
 * - Nur Vorwärts-Transitions
 * - DRAFT → ACTIVE, LOCKED ✅
 * - ACTIVE → LOCKED ✅
 * - LOCKED → (keine Transitions) ❌
 *
 * **Wichtig:**
 * Der LOCKED-Status ist final und verhindert jegliche Manipulation
 * des ETB nach Abschluss (Audit-Trail Sicherheit).
 *
 * @example
 * ```typescript
 * const draft = EtbStatus.DRAFT();
 * const active = EtbStatus.ACTIVE();
 *
 * console.log(draft.canTransitionTo(active)); // true
 * console.log(active.canTransitionTo(draft)); // false (no backward transitions)
 *
 * const locked = EtbStatus.LOCKED();
 * console.log(locked.canTransitionTo(active)); // false (locked is final)
 * ```
 */
export class EtbStatus extends ValueObject<EtbStatusProps> {
  private static readonly ALLOWED_VALUES = ['DRAFT', 'ACTIVE', 'LOCKED'] as const;

  get value(): string {
    return this.props.value;
  }

  private constructor(value: string) {
    super({ value });
  }

  private static isValidStatus(value: string): boolean {
    return EtbStatus.ALLOWED_VALUES.includes(value as (typeof EtbStatus.ALLOWED_VALUES)[number]);
  }

  static create(value: string): Result<EtbStatus> {
    if (!EtbStatus.isValidStatus(value)) {
      return Result.fail<EtbStatus>(`Ungültiger Status: ${value}. Erlaubte Werte: ${EtbStatus.ALLOWED_VALUES.join(', ')}`);
    }
    return Result.ok<EtbStatus>(new EtbStatus(value));
  }

  static DRAFT(): EtbStatus {
    return new EtbStatus('DRAFT');
  }

  static ACTIVE(): EtbStatus {
    return new EtbStatus('ACTIVE');
  }

  static LOCKED(): EtbStatus {
    return new EtbStatus('LOCKED');
  }

  /**
   * Prüft, ob ein Zustandsübergang erlaubt ist.
   *
   * Diese Methode erzwingt die State Machine Regeln zur Laufzeit
   * und verhindert ungültige Transitions (z.B. von LOCKED zu ACTIVE).
   * Sie wird vom ETB Aggregate verwendet, um Domain-Invarianten
   * zu garantieren.
   *
   * @param newStatus Ziel-Status für die Transition
   * @returns true wenn Transition erlaubt, false sonst
   */
  public canTransitionTo(newStatus: EtbStatus): boolean {
    const validTransitions: Record<string, string[]> = {
      DRAFT: ['ACTIVE', 'LOCKED'],
      ACTIVE: ['LOCKED'],
      LOCKED: [],
    };

    const allowedTargets = validTransitions[this.value] || [];
    return allowedTargets.includes(newStatus.value);
  }

  public toString(): string {
    return this.value;
  }
}
