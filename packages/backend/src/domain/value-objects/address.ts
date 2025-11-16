import { Result } from '@domain/common/result';
import { ValueObject } from '@domain/common/value-object';

/**
 * Properties des Address Value Objects.
 * Alle Felder sind optional, da nicht jede Adresse vollständig sein muss.
 */
interface AddressProps extends Record<string, unknown> {
  strasse?: string;
  hausnummer?: string;
  plz?: string;
  ort?: string;
}

/**
 * Address Value Object repräsentiert eine physische Adresse im deutschen Format.
 *
 * Diese Klasse implementiert DDD Value Object Prinzipien:
 * - Immutabilität: Props sind frozen, keine Setter
 * - Strukturelle Gleichheit: equals() vergleicht Werte, nicht Referenzen
 * - Validierung: PLZ muss deutsches Format (5 Ziffern) haben
 *
 * Warum PLZ-Validierung wichtig ist:
 * - Verhindert ungültige Datensätze in der Domain
 * - Ermöglicht sichere Postleitzahlen-basierte Queries
 * - Garantiert Datenqualität für Geo-Services und Routing
 *
 * @example
 * ```typescript
 * // Vollständige Adresse
 * const result = Address.create({
 *   strasse: 'Musterstr.',
 *   hausnummer: '42',
 *   plz: '80331',
 *   ort: 'München'
 * });
 *
 * if (result.isSuccess) {
 *   console.log(result.value.toString()); // "Musterstr. 42, 80331 München"
 * }
 *
 * // Teiladresse (ohne PLZ)
 * const partial = Address.create({ strasse: 'Hauptstr.', ort: 'Berlin' });
 *
 * // Ungültige PLZ
 * const invalid = Address.create({ plz: '1234' }); // Result.fail
 * ```
 */
export class Address extends ValueObject<AddressProps> {
  /**
   * Strasse der Adresse (optional).
   */
  get strasse(): string | undefined {
    return this.props.strasse;
  }

  /**
   * Hausnummer der Adresse (optional).
   */
  get hausnummer(): string | undefined {
    return this.props.hausnummer;
  }

  /**
   * Postleitzahl der Adresse (optional, aber validiert wenn vorhanden).
   */
  get plz(): string | undefined {
    return this.props.plz;
  }

  /**
   * Ort der Adresse (optional).
   */
  get ort(): string | undefined {
    return this.props.ort;
  }

  /**
   * Protected Constructor verhindert direkte Instanziierung.
   * Nutze stattdessen Address.create() Factory Method.
   *
   * @param props - Die Address Properties
   */
  private constructor(props: AddressProps) {
    super(props); // Object.freeze() happens in base class
  }

  /**
   * Validiert deutsches PLZ-Format (exakt 5 Ziffern).
   *
   * Warum exakt 5 Ziffern:
   * - Deutsche PLZ haben seit 1993 einheitlich 5 Stellen
   * - Führende Nullen sind signifikant (z.B. "01067" Dresden)
   * - Verhindert Fehleingaben wie "123" oder "123456"
   *
   * @param plz - Die zu validierende Postleitzahl
   * @returns true wenn Format korrekt (5 Ziffern)
   */
  private static isValidPlz(plz: string): boolean {
    return /^\d{5}$/.test(plz);
  }

  /**
   * Factory Method zur Erstellung einer Address mit Validierung.
   *
   * Validiert PLZ-Format wenn PLZ vorhanden ist. Alle anderen Felder
   * sind ohne Einschränkung optional, da Teiladressen valide sein können
   * (z.B. nur Ort für Briefköpfe, oder nur Strasse für interne Referenzen).
   *
   * @param props - Die Address Properties
   * @returns Result mit Address oder Fehlermeldung bei ungültiger PLZ
   */
  static create(props: AddressProps): Result<Address> {
    // PLZ Validierung nur wenn PLZ vorhanden ist
    if (props.plz !== undefined && !Address.isValidPlz(props.plz)) {
      return Result.fail<Address>('PLZ ungültig: Muss exakt 5 Ziffern sein');
    }

    return Result.ok<Address>(new Address(props));
  }

  /**
   * Formatiert die Adresse als lesbaren String.
   *
   * Format-Logik:
   * - Zeile 1: "Strasse Hausnummer" (oder nur "Strasse" wenn Hausnummer fehlt)
   * - Zeile 2: "PLZ Ort" (oder nur PLZ oder nur Ort wenn jeweils eins fehlt)
   * - Trennzeichen: ", " zwischen Zeilen
   * - Leere Adresse: "" (leerer String)
   *
   * Warum flexible Formatierung:
   * - Verschiedene Adressquellen liefern unterschiedliche Vollständigkeit
   * - UI soll auch Teiladressen anzeigen können
   * - CSV/Export-Funktionen benötigen konsistente Darstellung
   *
   * @returns Formatierte Adresse als String
   *
   * @example
   * ```typescript
   * // Vollständig: "Musterstr. 42, 80331 München"
   * // Ohne Hausnummer: "Hauptstr., 10115 Berlin"
   * // Nur Ort: "Hamburg"
   * // Leer: ""
   * ```
   */
  public toString(): string {
    const parts: string[] = [];

    // Zeile 1: Strasse + Hausnummer
    if (this.strasse) {
      const strasseHausnummer = this.hausnummer ? `${this.strasse} ${this.hausnummer}` : this.strasse;
      parts.push(strasseHausnummer);
    }

    // Zeile 2: PLZ + Ort
    if (this.plz && this.ort) {
      parts.push(`${this.plz} ${this.ort}`);
    } else if (this.plz) {
      parts.push(this.plz);
    } else if (this.ort) {
      parts.push(this.ort);
    }

    return parts.join(', ');
  }
}
