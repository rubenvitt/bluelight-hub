import { PoiId } from '@domain/value-objects/poi-id';
import type { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import type { GeoCoordinate } from '@domain/value-objects/geo-coordinate';
import type { PoiCategory } from '@domain/value-objects/poi-category';
import type { UserId } from '@domain/value-objects/user-id';

/**
 * Entity für Points of Interest (POI), verwaltet durch LagekarteAggregate.
 *
 * Diese Klasse repräsentiert einen einzelnen markierten Punkt auf der Lagekarte
 * (z.B. Einsatzstelle, Bereitstellungsraum, Gefahrenstelle).
 *
 * WICHTIG: Poi ist KEINE Aggregate Root, sondern eine Entity die
 * ausschließlich über das parent LagekarteAggregate manipuliert wird.
 * Es existiert KEIN dediziertes Repository für Poi - alle Persistierung
 * erfolgt über das Aggregate (transactional boundary).
 *
 * **Warum Entity und nicht Value Object?**
 * - Hat eigene Identity (PoiId): POIs sind unterscheidbar auch mit gleicher Position
 * - Hat Lifecycle: Position kann aktualisiert werden (mutable)
 * - Hat Audit-Informationen: createdBy, createdAt
 * - Business Methods: updatePosition() zur Positionsänderung
 *
 * **Koordinatensystem:**
 * MGRS (Military Grid Reference System) ist das primäre Koordinatensystem gemäß
 * DRK-Standards. Alle POIs speichern ihre Position als MGRS-Koordinate.
 * Die Konvertierung zu Lat/Lng erfolgt on-demand via getLatLng() für externe
 * APIs (z.B. Nominatim Geocoding, Web-Maps).
 *
 * **Design Patterns:**
 * - Protected Constructor: Nur LagekarteAggregate kann POIs erstellen
 * - ID-based Equality: Zwei POIs sind gleich wenn ihre IDs gleich sind
 * - Immutable Coordinate Reference: Coordinate-Property ist readonly, aber Wert kann via updatePosition() ersetzt werden
 *
 * @example
 * ```typescript
 * // Nur innerhalb von LagekarteAggregate:
 * const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.40, 5).getValue();
 * const category = PoiCategory.EINSATZSTELLE();
 * const userId = UserId.create().getValue();
 *
 * const poi = Poi.create(
 *   'Brandenburger Tor',
 *   berlinMgrs,
 *   category,
 *   userId,
 *   'Haupteinsatzort'
 * );
 *
 * // Position aktualisieren (LagekarteAggregate emittiert dann PoiPositionUpdatedEvent)
 * const newMgrs = MgrsCoordinate.fromLatLng(53.55, 10.00, 5).getValue();
 * poi.updatePosition(newMgrs);
 *
 * // Lat/Lng für externe APIs abrufen
 * const latLng = poi.getLatLng();
 * console.log(latLng.toString()); // "53.5500°N, 10.0000°E"
 * ```
 */
export class Poi {
  /**
   * Eindeutige ID des POI.
   * Readonly: Identity ist unveränderlich nach Creation.
   */
  private readonly _id: PoiId;

  /**
   * Name/Label des POI für UI-Darstellung.
   * Readonly: Name kann nach Erstellung nicht geändert werden.
   * Für Änderungen muss POI gelöscht und neu erstellt werden.
   */
  private readonly _name: string;

  /**
   * MGRS-Koordinate des POI (primäres Koordinatensystem).
   * Mutable: Kann via updatePosition() geändert werden.
   * MGRS ist DRK-Standard wegen Kompaktheit und metrischer Genauigkeit.
   */
  private _coordinate: MgrsCoordinate;

  /**
   * Kategorie des POI für Filterung und Farb-Codierung.
   * Readonly: Kategorie kann nach Erstellung nicht geändert werden.
   */
  private readonly _category: PoiCategory;

  /**
   * Optionale Beschreibung für zusätzliche Informationen.
   * Readonly: Beschreibung kann nach Erstellung nicht geändert werden.
   */
  private readonly _beschreibung?: string;

  /**
   * User ID des Erstellers.
   * Readonly: Ersteller kann nicht nachträglich geändert werden (Audit-Trail).
   */
  private readonly _createdBy: UserId;

  /**
   * Creation Timestamp.
   * Readonly: Erstellungszeitpunkt ist unveränderlich.
   */
  private readonly _createdAt: Date;

  /**
   * Protected Constructor verhindert direkte Instanziierung.
   * Nur LagekarteAggregate kann POIs erstellen (Aggregate Boundary).
   *
   * @param id - Eindeutige POI-ID
   * @param name - POI-Name/Label
   * @param coordinate - MGRS-Koordinate (primäres System)
   * @param category - POI-Kategorie
   * @param createdBy - User ID des Erstellers
   * @param beschreibung - Optional: Beschreibung
   * @param createdAt - Optional: Creation timestamp (default: new Date())
   */
  protected constructor(id: PoiId, name: string, coordinate: MgrsCoordinate, category: PoiCategory, createdBy: UserId, beschreibung?: string, createdAt?: Date) {
    this._id = id;
    this._name = name;
    this._coordinate = coordinate;
    this._category = category;
    this._createdBy = createdBy;
    this._beschreibung = beschreibung;
    this._createdAt = createdAt ?? new Date();
  }

  /**
   * Erstellt eine neue POI-Entität für die Lagekarte.
   *
   * Diese Methode wird vom LagekarteAggregate aufgerufen, wenn ein neuer POI
   * hinzugefügt wird. Die ID wird automatisch generiert.
   *
   * Die Position wird als MGRS-Koordinate gespeichert (DRK-Standard). Falls
   * externe APIs Lat/Lng zurückgeben, muss vorher MgrsCoordinate.fromLatLng()
   * verwendet werden.
   *
   * @param name - POI-Name (z.B. "Einsatzstelle", "Bereitstellungsraum")
   * @param coordinate - MGRS-Koordinate (primäres Koordinatensystem)
   * @param category - POI-Kategorie (für UI-Darstellung und Filterung)
   * @param createdBy - Benutzer-ID des Erstellers
   * @param beschreibung - Optionale Beschreibung
   * @returns Neue POI-Entität
   */
  public static create(name: string, coordinate: MgrsCoordinate, category: PoiCategory, createdBy: UserId, beschreibung?: string): Poi {
    const id = PoiId.create().value as PoiId;
    return new Poi(id, name, coordinate, category, createdBy, beschreibung);
  }

  /**
   * Readonly getter für POI-ID.
   */
  get id(): PoiId {
    return this._id;
  }

  /**
   * Readonly getter für POI-Name.
   */
  get name(): string {
    return this._name;
  }

  /**
   * Readonly getter für MGRS-Koordinate.
   * MGRS ist das primäre Koordinatensystem (DRK-Standard).
   */
  get coordinate(): MgrsCoordinate {
    return this._coordinate;
  }

  /**
   * Readonly getter für POI-Kategorie.
   */
  get category(): PoiCategory {
    return this._category;
  }

  /**
   * Readonly getter für Beschreibung.
   */
  get beschreibung(): string | undefined {
    return this._beschreibung;
  }

  /**
   * Readonly getter für Ersteller-ID.
   */
  get createdBy(): UserId {
    return this._createdBy;
  }

  /**
   * Readonly getter für Creation Timestamp.
   */
  get createdAt(): Date {
    return this._createdAt;
  }

  /**
   * Aktualisiert die Position des POI.
   *
   * Diese Methode wird vom LagekarteAggregate aufgerufen, wenn die Position
   * eines POI geändert wird. Das Aggregat emittiert anschließend ein
   * PoiPositionUpdatedEvent mit alten und neuen Koordinaten für Audit-Trail
   * und Notification-Zwecke.
   *
   * Die neue Position muss als MGRS-Koordinate übergeben werden. Falls externe
   * APIs Lat/Lng zurückgeben, muss vorher MgrsCoordinate.fromLatLng() verwendet
   * werden.
   *
   * @param newCoordinate - Neue MGRS-Koordinate
   */
  public updatePosition(newCoordinate: MgrsCoordinate): void {
    this._coordinate = newCoordinate;
  }

  /**
   * Konvertiert die MGRS-Koordinate zu Lat/Lng-Koordinaten.
   *
   * Diese Methode wird für externe APIs benötigt (z.B. Nominatim Geocoding,
   * Web-Maps), die Lat/Lng als Eingabeformat erwarten. MGRS bleibt das
   * primäre Speicherformat gemäß DRK-Standards.
   *
   * Die Konvertierung erfolgt on-demand und cached nicht, da POIs ihre Position
   * ändern können. Für performance-kritische Anwendungen sollte das Ergebnis
   * zwischengespeichert werden.
   *
   * @returns GeoCoordinate (Lat/Lng)
   *
   * @example
   * ```typescript
   * const poi = Poi.create('Brandenburger Tor', berlinMgrs, category, userId);
   * const latLng = poi.getLatLng();
   * console.log(latLng.toString()); // "52.5200°N, 13.4000°E"
   * ```
   */
  public getLatLng(): GeoCoordinate {
    return this._coordinate.toLatLng();
  }

  /**
   * ID-based Equality Check.
   *
   * Zwei POIs sind gleich wenn ihre IDs gleich sind, unabhängig
   * von Position, Kategorie oder anderen Properties (Entity Identity Pattern).
   *
   * @param other - Anderer POI zum Vergleichen (optional)
   * @returns true wenn IDs gleich, false sonst
   */
  public equals(other?: Poi): boolean {
    if (other == null) return false;
    if (other === this) return true;
    return this._id.equals(other._id);
  }
}
