/**
 * Rekursive Deep-Equality-Prüfung für strukturelle Gleichheit.
 * Vergleicht primitive Werte, Arrays und Objekte rekursiv.
 *
 * @param a - Erster Wert zum Vergleich
 * @param b - Zweiter Wert zum Vergleich
 * @returns true wenn strukturell gleich, sonst false
 */
function deepEquals(a: unknown, b: unknown): boolean {
  // Identische Referenz oder primitive Gleichheit
  if (a === b) return true;

  // Null/undefined Handling
  if (a == null || b == null) return a === b;

  // Typ-Mismatch
  if (typeof a !== typeof b) return false;

  // Array Vergleich
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => deepEquals(val, b[idx]));
  }

  // Objekt Vergleich
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);

    if (keysA.length !== keysB.length) return false;

    return keysA.every((key) => deepEquals((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
  }

  // Primitive Werte (bereits durch === abgedeckt, aber fallback)
  return false;
}

/**
 * Generiert einen Hash-Code aus einem String mittels DJB2-Algorithmus.
 * Wird für Set/Map-Kompatibilität verwendet.
 *
 * @param str - Der zu hashende String
 * @returns Hash-Code als Zahl
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Abstract Base Class für DDD Value Objects mit struktureller Gleichheit.
 * Value Objects haben keine Identität - sie sind durch ihre Properties definiert.
 *
 * Charakteristika:
 * - Immutabilität: Alle Properties sind readonly und durch Object.freeze() gesichert
 * - Strukturelle Gleichheit: equals() vergleicht Properties, nicht Referenzen
 * - Set/Map Support: hashCode() ermöglicht Verwendung in Collections
 *
 * @template TProps - Record mit allen Value Object Properties
 *
 * @example
 * ```typescript
 * interface AddressProps {
 *   street: string;
 *   city: string;
 *   zipCode: string;
 * }
 *
 * class Address extends ValueObject<AddressProps> {
 *   get street() { return this.props.street; }
 *   get city() { return this.props.city; }
 *   get zipCode() { return this.props.zipCode; }
 *
 *   private constructor(props: AddressProps) {
 *     super(props);
 *   }
 *
 *   static create(props: AddressProps): Address {
 *     // Validation logic here
 *     return new Address(props);
 *   }
 * }
 * ```
 */
export abstract class ValueObject<TProps extends Record<string, unknown>> {
  /**
   * Readonly Properties des Value Objects.
   * Durch Object.freeze() immutabel gemacht zur Runtime.
   */
  public readonly props: Readonly<TProps>;

  /**
   * Protected Constructor erzwingt Factory Methods in Subklassen.
   * Verhindert direkte Instanziierung und ermöglicht Validierung vor Konstruktion.
   *
   * @param props - Die Properties des Value Objects
   */
  protected constructor(props: TProps) {
    // Runtime Immutability durch Object.freeze()
    // TypeScript readonly ist nur compile-time enforcement!
    this.props = Object.freeze({ ...props });
  }

  /**
   * Prüft strukturelle Gleichheit mit einem anderen Value Object.
   * Nutzt Deep Equality für alle Properties - nicht Referenz-Gleichheit!
   *
   * @param other - Das zu vergleichende Value Object (oder undefined)
   * @returns true wenn alle Properties strukturell gleich sind
   *
   * @example
   * ```typescript
   * const addr1 = Address.create({ street: 'Main St', city: 'NYC', zipCode: '10001' });
   * const addr2 = Address.create({ street: 'Main St', city: 'NYC', zipCode: '10001' });
   * const addr3 = Address.create({ street: 'Oak Ave', city: 'LA', zipCode: '90001' });
   *
   * addr1.equals(addr2); // true (same values, different instances)
   * addr1.equals(addr3); // false (different values)
   * addr1 === addr2; // false (different references)
   * ```
   */
  public equals(other?: ValueObject<TProps>): boolean {
    if (other == null) return false;
    if (other === this) return true;

    return deepEquals(this.props, other.props);
  }

  /**
   * Generiert einen Hash-Code für Set/Map-Kompatibilität.
   * Garantiert: Gleiche Properties → gleicher hashCode.
   *
   * @returns Hash-Code als Zahl
   *
   * @example
   * ```typescript
   * const addresses = new Set<Address>();
   * const addr1 = Address.create({ street: 'Main St', city: 'NYC', zipCode: '10001' });
   * const addr2 = Address.create({ street: 'Main St', city: 'NYC', zipCode: '10001' });
   *
   * addresses.add(addr1);
   * addresses.add(addr2);
   * // Set kann Duplikate via hashCode erkennen (wenn Set custom equality nutzt)
   * ```
   */
  public hashCode(): number {
    // Konvertiere props zu String-Repräsentation
    const propsString = JSON.stringify(this.props);
    return hashString(propsString);
  }
}
