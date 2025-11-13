/**
 * Repräsentiert das Ergebnis einer Operation, die erfolgreich sein kann oder fehlschlagen.
 * Ersetzt Exceptions für vorhersagbare Fehlerbehandlung im Domain Layer.
 *
 * @template T - Der Typ des Erfolgs-Werts
 */
export class Result<T> {
  private constructor(
    public readonly isSuccess: boolean,
    public readonly value?: T,
    public readonly error?: string,
  ) {}

  /**
   * Erstellt ein erfolgreiches Result mit einem Wert.
   * @param value - Der Erfolgs-Wert
   */
  static ok<T>(value: T): Result<T> {
    return new Result<T>(true, value);
  }

  /**
   * Erstellt ein fehlgeschlagenes Result mit einer Fehlermeldung.
   * @param error - Die Fehlermeldung
   */
  static fail<T>(error: string): Result<T> {
    return new Result<T>(false, undefined, error);
  }

  /**
   * Gibt an, ob das Result fehlgeschlagen ist.
   */
  get isFailure(): boolean {
    return !this.isSuccess;
  }
}
