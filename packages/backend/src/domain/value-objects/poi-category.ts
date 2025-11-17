import { ValueObject } from '@domain/common/value-object';
import { Result } from '@domain/common/result';

/**
 * Erlaubte POI-Kategorien nach DRK-Vorgaben.
 * Diese Typen spiegeln die gängigen Markierungen auf Einsatzkarten wider.
 */
type PoiCategoryType = 'EINSATZSTELLE' | 'BEREITSTELLUNGSRAUM' | 'GEFAHRENSTELLE' | 'WASSERENTNAHMESTELLE' | 'SONSTIGES';

/**
 * Properties für PoiCategory Value Object.
 */
interface PoiCategoryProps extends Record<string, unknown> {
  value: PoiCategoryType;
}

/**
 * Value Object für POI-Kategorien mit vordefiniertem Farbschema.
 *
 * Kapselt die erlaubten Kategorietypen für POIs auf Lagekarten und
 * verknüpft jede Kategorie mit einer standardisierten Farbe für UI-Darstellung.
 * Verhindert ungültige Kategorien durch Factory Pattern mit Validierung.
 *
 * Die Kategorien orientieren sich an DRK-Standardisierungen für Einsatzkarten.
 *
 * @example
 * ```typescript
 * // Factory Method mit Validierung
 * const result = PoiCategory.create('EINSATZSTELLE');
 * if (result.isSuccess) {
 *   const category = result.value;
 *   console.log(category.value); // 'EINSATZSTELLE'
 *   console.log(category.getColor()); // '#FF0000' (red)
 * }
 *
 * // Static Factory für Convenience
 * const category = PoiCategory.EINSATZSTELLE();
 * console.log(category.value); // 'EINSATZSTELLE'
 *
 * // Validierung bei ungültiger Kategorie
 * const invalid = PoiCategory.create('UNKNOWN');
 * console.log(invalid.isFailure); // true
 * ```
 */
export class PoiCategory extends ValueObject<PoiCategoryProps> {
  /**
   * Set aller erlaubten POI-Kategorien.
   * Wird für Validierung im Factory Method verwendet.
   */
  private static readonly ALLOWED_CATEGORIES: ReadonlySet<string> = new Set(['EINSATZSTELLE', 'BEREITSTELLUNGSRAUM', 'GEFAHRENSTELLE', 'WASSERENTNAHMESTELLE', 'SONSTIGES']);

  /**
   * Protected Constructor erzwingt Factory Method Nutzung.
   *
   * @param props - Die Properties mit validierter Kategorie
   */
  private constructor(props: PoiCategoryProps) {
    super(props);
  }

  /**
   * Readonly getter für den Kategoriewert.
   * @returns Der Kategorie-String
   */
  get value(): PoiCategoryType {
    return this.props.value;
  }

  /**
   * Factory Method mit Kategorie-Validierung.
   *
   * Normalisiert den Input zu Uppercase und validiert gegen erlaubte Werte.
   * Verwendet Result<T> Pattern zur expliziten Fehlerbehandlung statt Exceptions.
   *
   * @param value - Die POI-Kategorie als String (case-insensitive)
   * @returns Result<PoiCategory> - Success oder Failure mit Fehlermeldung
   *
   * @example
   * ```typescript
   * // Valide Kategorie (case-insensitive)
   * const result1 = PoiCategory.create('einsatzstelle');
   * // result1.isSuccess === true
   *
   * // Ungültige Kategorie
   * const result2 = PoiCategory.create('INVALID');
   * // result2.isFailure === true
   * // result2.error === "Invalid POI category: INVALID. Allowed: EINSATZSTELLE, BEREITSTELLUNGSRAUM, ..."
   * ```
   */
  public static create(value: string): Result<PoiCategory> {
    // Normalize zu Uppercase für case-insensitive Validierung
    const normalized = value.toUpperCase();

    // Validiere gegen erlaubte Kategorien
    if (!PoiCategory.ALLOWED_CATEGORIES.has(normalized)) {
      const allowedList = Array.from(PoiCategory.ALLOWED_CATEGORIES).join(', ');
      return Result.fail<PoiCategory>(`Invalid POI category: ${value}. Allowed: ${allowedList}`);
    }

    // Success: Erstelle PoiCategory Instanz
    return Result.ok(new PoiCategory({ value: normalized as PoiCategoryType }));
  }

  /**
   * Static Factory für EINSATZSTELLE.
   * Convenience-Methode für häufig verwendete Kategorie.
   *
   * @returns PoiCategory Instanz für EINSATZSTELLE
   */
  public static EINSATZSTELLE(): PoiCategory {
    return new PoiCategory({ value: 'EINSATZSTELLE' });
  }

  /**
   * Static Factory für BEREITSTELLUNGSRAUM.
   * Convenience-Methode für häufig verwendete Kategorie.
   *
   * @returns PoiCategory Instanz für BEREITSTELLUNGSRAUM
   */
  public static BEREITSTELLUNGSRAUM(): PoiCategory {
    return new PoiCategory({ value: 'BEREITSTELLUNGSRAUM' });
  }

  /**
   * Static Factory für GEFAHRENSTELLE.
   * Convenience-Methode für häufig verwendete Kategorie.
   *
   * @returns PoiCategory Instanz für GEFAHRENSTELLE
   */
  public static GEFAHRENSTELLE(): PoiCategory {
    return new PoiCategory({ value: 'GEFAHRENSTELLE' });
  }

  /**
   * Static Factory für WASSERENTNAHMESTELLE.
   * Convenience-Methode für häufig verwendete Kategorie.
   *
   * @returns PoiCategory Instanz für WASSERENTNAHMESTELLE
   */
  public static WASSERENTNAHMESTELLE(): PoiCategory {
    return new PoiCategory({ value: 'WASSERENTNAHMESTELLE' });
  }

  /**
   * Static Factory für SONSTIGES.
   * Convenience-Methode für häufig verwendete Kategorie.
   *
   * @returns PoiCategory Instanz für SONSTIGES
   */
  public static SONSTIGES(): PoiCategory {
    return new PoiCategory({ value: 'SONSTIGES' });
  }

  /**
   * Gibt die standardisierte Farbe für UI-Darstellung zurück.
   *
   * Diese Methode verknüpft jede Kategorie mit einer Hex-Farbe gemäß
   * Einsatzleiter-Standards für Lagekarten:
   * - EINSATZSTELLE: Rot (hohe Priorität, akute Gefahr)
   * - BEREITSTELLUNGSRAUM: Blau (sicherer Bereich, Organisation)
   * - GEFAHRENSTELLE: Gelb (Warnung, potenzielle Gefahr)
   * - WASSERENTNAHMESTELLE: Cyan (Wasser, Ressource)
   * - SONSTIGES: Grau (neutral, unklassifiziert)
   *
   * @returns Hex-Farbcode für die Kategorie
   *
   * @example
   * ```typescript
   * const category = PoiCategory.EINSATZSTELLE();
   * const color = category.getColor(); // '#FF0000'
   * ```
   */
  public getColor(): string {
    switch (this.props.value) {
      case 'EINSATZSTELLE':
        return '#FF0000'; // Red - Hohe Priorität
      case 'BEREITSTELLUNGSRAUM':
        return '#0000FF'; // Blue - Sicherer Bereich
      case 'GEFAHRENSTELLE':
        return '#FFFF00'; // Yellow - Warnung
      case 'WASSERENTNAHMESTELLE':
        return '#00FFFF'; // Cyan - Wasser/Ressource
      case 'SONSTIGES':
        return '#808080'; // Gray - Neutral
    }
  }
}
