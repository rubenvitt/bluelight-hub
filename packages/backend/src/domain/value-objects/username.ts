import { Result } from '@domain/common/result';
import { ValueObject } from '@domain/common/value-object';

/**
 * Props Interface für Username Value Object
 */
interface UsernameProps extends Record<string, unknown> {
  value: string;
}

/**
 * Username Value Object
 *
 * Repräsentiert einen Benutzernamen mit folgenden Eigenschaften:
 * - Normalisierung auf Lowercase für case-insensitive Uniqueness (verhindert Duplikate wie "Ruben" und "ruben")
 * - 3-50 Zeichen Länge (Balance zwischen Eindeutigkeit und Benutzerfreundlichkeit)
 * - Nur alphanumerische Zeichen und Underscore (technische Sicherheit und URL-Kompatibilität)
 *
 * @example
 * ```typescript
 * const usernameResult = Username.create('Ruben_123');
 * if (usernameResult.isSuccess) {
 *   console.log(usernameResult.value.toString()); // "ruben_123"
 * }
 * ```
 */
export class Username extends ValueObject<UsernameProps> {
  /**
   * Private Constructor - Verwendung über Factory Method `create()`
   *
   * Der Constructor ist private, um ungültige Instanzen zu verhindern.
   * Alle Instanzen müssen durch die validierende Factory Method erstellt werden.
   *
   * @param props - Username Properties
   */
  private constructor(props: UsernameProps) {
    super(props);
  }

  /**
   * Validiert einen Username-String
   *
   * Regex-Erklärung:
   * - `^` Start der Zeichenkette
   * - `[a-zA-Z0-9_]` Erlaubte Zeichen: Buchstaben (groß/klein), Ziffern, Underscore
   * - `{3,50}` Länge zwischen 3 und 50 Zeichen
   * - `$` Ende der Zeichenkette
   *
   * Warum diese Einschränkungen:
   * - Keine Leerzeichen: Verhindert Parsing-Probleme in URLs und Logs
   * - Keine Sonderzeichen: Reduziert XSS-Risiko und erhöht Kompatibilität
   * - 3-50 Zeichen: Verhindert zu kurze (nicht eindeutige) oder zu lange (unpraktische) Namen
   *
   * @param username - Zu validierender Username-String
   * @returns true wenn valid, false wenn invalid
   */
  private static isValid(username: string): boolean {
    return /^[a-zA-Z0-9._@-]{3,50}$/.test(username);
  }

  /**
   * Factory Method zur Erstellung eines Username Value Objects
   *
   * Normalisiert den Input zu lowercase, um case-insensitive Uniqueness zu garantieren.
   * Dies verhindert, dass "Ruben" und "ruben" als unterschiedliche Usernames gespeichert werden.
   *
   * @param username - Username-String (wird zu lowercase normalisiert)
   * @returns Result<Username> mit Success oder Failure
   *
   * @example
   * ```typescript
   * const result = Username.create('Ruben_123');
   * if (result.isSuccess) {
   *   console.log(result.value.value); // "ruben_123"
   * } else {
   *   console.error(result.error);
   * }
   * ```
   */
  static create(username: string): Result<Username> {
    if (!Username.isValid(username)) {
      return Result.fail<Username>('Username ungültig: Muss 3-50 Zeichen sein (alphanumerisch oder . _ @ -)');
    }

    // Normalisierung zu lowercase für case-insensitive uniqueness
    // Dies ermöglicht case-insensitive Vergleiche und verhindert Duplikate
    return Result.ok<Username>(new Username({ value: username.toLowerCase() }));
  }

  /**
   * Getter für den normalisierten Username-Wert
   *
   * @returns Lowercase Username-String
   */
  get value(): string {
    return this.props.value;
  }

  /**
   * String-Repräsentation des Username Value Objects
   *
   * Gibt den normalisierten (lowercase) Username-Wert zurück.
   * Nützlich für Logging, Debugging und String-Konversion.
   *
   * @returns Lowercase Username-String
   */
  public toString(): string {
    return this.value;
  }
}
