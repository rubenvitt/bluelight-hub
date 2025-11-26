import { Result } from '@domain/common/result';
import { ValueObject } from '@domain/common/value-object';

interface EtbKategorieProps extends Record<string, unknown> {
  value: string;
}

/**
 * Liste aller erlaubten EtbKategorie Werte.
 *
 * Definiert als const Array fuer Type-Safe Iteration und Validierung.
 * Wird sowohl intern als auch extern verwendet (z.B. fuer DTOs).
 */
export const ETB_KATEGORIE_VALUES = [
  'ALARMIERUNG',
  'ANKUNFT',
  'BEFEHL',
  'ERKUNDUNG',
  'LAGE',
  'MASSNAHME',
  'PERSONAL',
  'FAHRZEUG',
  'MATERIAL',
  'KOMMUNIKATION',
  'WETTER',
  'DOKUMENTATION',
  'SONSTIGES',
  'SYSTEM',
] as const;

/**
 * Union Type fuer EtbKategorie String-Werte.
 *
 * Ermoeglicht Type-Safe Verwendung in DTOs und Application Layer.
 */
export type EtbKategorieValue = (typeof ETB_KATEGORIE_VALUES)[number];

/**
 * EtbKategorie Value Object fuer ETB-Eintragskategorien.
 *
 * Kategorisiert ETB-Eintraege nach DRK-spezifischen Typen fuer Filterung
 * und Sortierung. Der Default-Wert ist LAGE (Lagemeldungen).
 *
 * **Warum Value Object?**
 * - Immutabilitaet: Kategorie aendert sich nie nach Zuweisung
 * - Validierung: Nur erlaubte Werte moeglich (keine ungueltige Kategorie)
 * - Domain-Semantik: Explizite Bedeutung statt primitiver String
 *
 * **Verfuegbare Kategorien:**
 * - ALARMIERUNG: Alarmierungsmeldungen
 * - ANKUNFT: Ankunft am Einsatzort
 * - BEFEHL: Befehle und Anweisungen
 * - ERKUNDUNG: Erkundungsergebnisse
 * - LAGE: Lagemeldungen (Default)
 * - MASSNAHME: Durchgefuehrte Massnahmen
 * - PERSONAL: Personalaenderungen
 * - FAHRZEUG: Fahrzeugbewegungen
 * - MATERIAL: Material- und Ausruestungseinsatz
 * - KOMMUNIKATION: Kommunikation mit anderen Stellen
 * - WETTER: Wetteraenderungen
 * - DOKUMENTATION: Dokumentarische Eintraege (Screenshots, Fotos, Anhaenge)
 * - SONSTIGES: Sonstige Eintraege
 * - SYSTEM: Systemeintraege (automatisch)
 *
 * @example
 * ```typescript
 * // Factory Method mit Validierung
 * const result = EtbKategorie.create('LAGE');
 * if (result.isSuccess) {
 *   const kategorie = result.value;
 *   console.log(kategorie.value); // 'LAGE'
 * }
 *
 * // Static Factory Methods (keine Validierung noetig)
 * const lage = EtbKategorie.LAGE();
 * const alarm = EtbKategorie.ALARMIERUNG();
 *
 * // Gleichheit
 * EtbKategorie.LAGE().equals(EtbKategorie.LAGE()); // true
 * ```
 */
export class EtbKategorie extends ValueObject<EtbKategorieProps> {
  /**
   * Gibt den String-Wert der Kategorie zurueck.
   *
   * Wird fuer Persistence Mapping und String-Konvertierung verwendet.
   */
  get value(): EtbKategorieValue {
    return this.props.value as EtbKategorieValue;
  }

  /**
   * Private Constructor erzwingt Verwendung von Factory Methods.
   *
   * @param value - Validierter Kategorie-String
   */
  private constructor(value: string) {
    super({ value });
  }

  /**
   * Prueft ob ein String-Wert eine gueltige Kategorie ist.
   *
   * @param value - Zu pruefender String
   * @returns true wenn gueltige Kategorie
   */
  private static isValidKategorie(value: string): value is EtbKategorieValue {
    return ETB_KATEGORIE_VALUES.includes(value as EtbKategorieValue);
  }

  /**
   * Factory Method mit Validierung.
   *
   * Erstellt ein EtbKategorie Value Object aus einem String.
   * Gibt Result.fail() zurueck wenn der String keine gueltige Kategorie ist.
   *
   * @param value - Kategorie-String
   * @returns Result mit EtbKategorie oder Fehlermeldung
   *
   * @example
   * ```typescript
   * const result = EtbKategorie.create('LAGE');
   * if (result.isSuccess) {
   *   const kategorie = result.value;
   * } else {
   *   console.error(result.error);
   * }
   * ```
   */
  static create(value: string): Result<EtbKategorie> {
    if (!EtbKategorie.isValidKategorie(value)) {
      return Result.fail<EtbKategorie>(`Ungueltige Kategorie: ${value}. Erlaubte Werte: ${ETB_KATEGORIE_VALUES.join(', ')}`);
    }
    return Result.ok<EtbKategorie>(new EtbKategorie(value));
  }

  // ============================================================================
  // STATIC FACTORY METHODS
  // ============================================================================
  // Diese Methoden erstellen vordefinierte Kategorien ohne Validierung.
  // Sie sind typsicher und werfen keine Fehler.

  /**
   * Erstellt Kategorie ALARMIERUNG (Alarmierungsmeldungen).
   */
  static ALARMIERUNG(): EtbKategorie {
    return new EtbKategorie('ALARMIERUNG');
  }

  /**
   * Erstellt Kategorie ANKUNFT (Ankunft am Einsatzort).
   */
  static ANKUNFT(): EtbKategorie {
    return new EtbKategorie('ANKUNFT');
  }

  /**
   * Erstellt Kategorie BEFEHL (Befehle und Anweisungen).
   */
  static BEFEHL(): EtbKategorie {
    return new EtbKategorie('BEFEHL');
  }

  /**
   * Erstellt Kategorie ERKUNDUNG (Erkundungsergebnisse).
   */
  static ERKUNDUNG(): EtbKategorie {
    return new EtbKategorie('ERKUNDUNG');
  }

  /**
   * Erstellt Kategorie LAGE (Lagemeldungen).
   *
   * Dies ist die Default-Kategorie fuer neue Eintraege.
   */
  static LAGE(): EtbKategorie {
    return new EtbKategorie('LAGE');
  }

  /**
   * Erstellt Kategorie MASSNAHME (Durchgefuehrte Massnahmen).
   */
  static MASSNAHME(): EtbKategorie {
    return new EtbKategorie('MASSNAHME');
  }

  /**
   * Erstellt Kategorie PERSONAL (Personalaenderungen).
   */
  static PERSONAL(): EtbKategorie {
    return new EtbKategorie('PERSONAL');
  }

  /**
   * Erstellt Kategorie FAHRZEUG (Fahrzeugbewegungen).
   */
  static FAHRZEUG(): EtbKategorie {
    return new EtbKategorie('FAHRZEUG');
  }

  /**
   * Erstellt Kategorie MATERIAL (Material- und Ausruestungseinsatz).
   */
  static MATERIAL(): EtbKategorie {
    return new EtbKategorie('MATERIAL');
  }

  /**
   * Erstellt Kategorie KOMMUNIKATION (Kommunikation mit anderen Stellen).
   */
  static KOMMUNIKATION(): EtbKategorie {
    return new EtbKategorie('KOMMUNIKATION');
  }

  /**
   * Erstellt Kategorie WETTER (Wetteraenderungen).
   */
  static WETTER(): EtbKategorie {
    return new EtbKategorie('WETTER');
  }

  /**
   * Erstellt Kategorie DOKUMENTATION (Dokumentarische Eintraege).
   */
  static DOKUMENTATION(): EtbKategorie {
    return new EtbKategorie('DOKUMENTATION');
  }

  /**
   * Erstellt Kategorie SONSTIGES (Sonstige Eintraege).
   */
  static SONSTIGES(): EtbKategorie {
    return new EtbKategorie('SONSTIGES');
  }

  /**
   * Erstellt Kategorie SYSTEM (Systemeintraege automatisch).
   */
  static SYSTEM(): EtbKategorie {
    return new EtbKategorie('SYSTEM');
  }

  /**
   * Konvertiert zu String (fuer Logging/Debugging).
   */
  public toString(): string {
    return this.value;
  }
}
