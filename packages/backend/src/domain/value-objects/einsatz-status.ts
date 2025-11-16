import { ValueObject } from '@domain/common/value-object';
import { Result } from '@domain/common/result';

/**
 * Props für EinsatzStatus Value Object.
 */
interface EinsatzStatusProps extends Record<string, unknown> {
  value: string;
}

/**
 * EinsatzStatus Value Object mit State Machine Logic.
 *
 * Diese Klasse modelliert den Lebenszyklus eines Einsatzes als State Machine,
 * um ungültige Zustandsübergänge zur Compile- und Laufzeit zu verhindern.
 *
 * **Warum State Machine Logic wichtig ist:**
 * - Verhindert inkonsistente Daten (z.B. Einsatz "rückgängig machen")
 * - Business Rules sind zentral in einem Objekt gekapselt (Single Source of Truth)
 * - Explizite Transition-Validierung macht Fehler früh sichtbar (Fail Fast)
 * - Ermöglicht spätere Erweiterungen (z.B. Audit-Log bei Transitions)
 *
 * **Erlaubte Zustände:**
 * - `ANGELEGT`: Initialer Zustand, Einsatz wurde angelegt
 * - `IN_BEARBEITUNG`: Einsatz wird aktiv bearbeitet
 * - `ABGESCHLOSSEN`: Einsatz wurde beendet
 * - `ARCHIVIERT`: Einsatz ist archiviert (finale Transition)
 *
 * **State Machine Regeln:**
 * - Nur Vorwärts-Transitions erlaubt (keine Rückschritte)
 * - ANGELEGT → IN_BEARBEITUNG, ABGESCHLOSSEN, ARCHIVIERT ✅
 * - IN_BEARBEITUNG → ABGESCHLOSSEN, ARCHIVIERT ✅
 * - ABGESCHLOSSEN → ARCHIVIERT ✅
 * - ARCHIVIERT → (keine weiteren Transitions) ❌
 *
 * @example
 * ```typescript
 * // Factory Method mit Validierung
 * const result = EinsatzStatus.create('ANGELEGT');
 * if (result.isSuccess) {
 *   const status = result.value!;
 * }
 *
 * // Static Convenience Factories
 * const angelegt = EinsatzStatus.ANGELEGT();
 * const inBearbeitung = EinsatzStatus.IN_BEARBEITUNG();
 *
 * // State Transition Validierung
 * if (angelegt.canTransitionTo(inBearbeitung)) {
 *   // Transition ist gültig - kann durchgeführt werden
 * }
 *
 * // Strukturelle Gleichheit
 * const status1 = EinsatzStatus.ANGELEGT();
 * const status2 = EinsatzStatus.ANGELEGT();
 * status1.equals(status2); // true (gleicher Wert)
 * status1 === status2; // false (verschiedene Instanzen)
 * ```
 */
export class EinsatzStatus extends ValueObject<EinsatzStatusProps> {
  /**
   * Erlaubte Status-Werte als Enum-Alternative.
   * as const macht das Array immutable und ermöglicht Type Narrowing.
   */
  private static readonly ALLOWED_VALUES = ['ANGELEGT', 'IN_BEARBEITUNG', 'ABGESCHLOSSEN', 'ARCHIVIERT'] as const;

  /**
   * Public Getter für den Status-Wert.
   * @returns Der Status-Wert als String
   */
  get value(): string {
    return this.props.value;
  }

  /**
   * Private Constructor erzwingt Verwendung von Factory Methods.
   * Garantiert, dass nur validierte Instanzen erstellt werden können.
   *
   * @param value - Der validierte Status-Wert
   */
  private constructor(value: string) {
    super({ value });
  }

  /**
   * Prüft, ob ein Wert ein gültiger Status ist.
   * Type Guard für ALLOWED_VALUES.
   *
   * @param value - Zu prüfender Wert
   * @returns true wenn Wert in ALLOWED_VALUES enthalten ist
   */
  private static isValidStatus(value: string): boolean {
    return EinsatzStatus.ALLOWED_VALUES.includes(value as (typeof EinsatzStatus.ALLOWED_VALUES)[number]);
  }

  /**
   * Factory Method zur Erstellung eines EinsatzStatus mit Validierung.
   *
   * @param value - Der gewünschte Status-Wert
   * @returns Result mit EinsatzStatus bei Erfolg oder Fehlermeldung bei ungültigem Wert
   *
   * @example
   * ```typescript
   * const result = EinsatzStatus.create('ANGELEGT');
   * if (result.isSuccess) {
   *   const status = result.value!;
   * } else {
   *   console.error(result.error);
   * }
   * ```
   */
  static create(value: string): Result<EinsatzStatus> {
    if (!EinsatzStatus.isValidStatus(value)) {
      return Result.fail<EinsatzStatus>(`Ungültiger Status: ${value}. Erlaubte Werte: ${EinsatzStatus.ALLOWED_VALUES.join(', ')}`);
    }
    return Result.ok<EinsatzStatus>(new EinsatzStatus(value));
  }

  /**
   * Static Convenience Factory für Status ANGELEGT.
   * @returns EinsatzStatus mit Wert ANGELEGT
   */
  static ANGELEGT(): EinsatzStatus {
    return new EinsatzStatus('ANGELEGT');
  }

  /**
   * Static Convenience Factory für Status IN_BEARBEITUNG.
   * @returns EinsatzStatus mit Wert IN_BEARBEITUNG
   */
  static IN_BEARBEITUNG(): EinsatzStatus {
    return new EinsatzStatus('IN_BEARBEITUNG');
  }

  /**
   * Static Convenience Factory für Status ABGESCHLOSSEN.
   * @returns EinsatzStatus mit Wert ABGESCHLOSSEN
   */
  static ABGESCHLOSSEN(): EinsatzStatus {
    return new EinsatzStatus('ABGESCHLOSSEN');
  }

  /**
   * Static Convenience Factory für Status ARCHIVIERT.
   * @returns EinsatzStatus mit Wert ARCHIVIERT
   */
  static ARCHIVIERT(): EinsatzStatus {
    return new EinsatzStatus('ARCHIVIERT');
  }

  /**
   * State Machine Logic: Prüft ob eine Transition zu einem neuen Status erlaubt ist.
   *
   * **Warum diese Methode zentral ist:**
   * - Verhindert ungültige Zustandsübergänge (z.B. ABGESCHLOSSEN → ANGELEGT)
   * - Kapselt Business Rules an einem Ort (Single Responsibility)
   * - Ermöglicht einfaches Ändern der Transition-Regeln ohne Application Layer zu berühren
   * - Macht State Machine explizit und testbar
   *
   * **Valid Transitions:**
   * - ANGELEGT → IN_BEARBEITUNG, ABGESCHLOSSEN, ARCHIVIERT
   * - IN_BEARBEITUNG → ABGESCHLOSSEN, ARCHIVIERT
   * - ABGESCHLOSSEN → ARCHIVIERT
   * - ARCHIVIERT → (keine Transitions - finaler Zustand)
   *
   * @param newStatus - Der Ziel-Status der Transition
   * @returns true wenn Transition erlaubt ist, sonst false
   *
   * @example
   * ```typescript
   * const current = EinsatzStatus.ANGELEGT();
   * const target = EinsatzStatus.IN_BEARBEITUNG();
   *
   * if (current.canTransitionTo(target)) {
   *   // Transition ist gültig - Status kann geändert werden
   * } else {
   *   // Transition ist ungültig - Business Rule verletzt
   * }
   * ```
   */
  public canTransitionTo(newStatus: EinsatzStatus): boolean {
    // State Machine als Adjacency Map (aktueller Zustand → erlaubte Ziel-Zustände)
    const validTransitions: Record<string, string[]> = {
      ANGELEGT: ['IN_BEARBEITUNG', 'ABGESCHLOSSEN', 'ARCHIVIERT'],
      IN_BEARBEITUNG: ['ABGESCHLOSSEN', 'ARCHIVIERT'],
      ABGESCHLOSSEN: ['ARCHIVIERT'],
      ARCHIVIERT: [], // Finale Transition - keine weiteren Änderungen erlaubt
    };

    const allowedTargets = validTransitions[this.value] || [];
    return allowedTargets.includes(newStatus.value);
  }

  /**
   * String-Repräsentation für Logging und Debugging.
   * @returns Der Status-Wert als String
   */
  public toString(): string {
    return this.value;
  }
}
