import { AggregateRoot } from '@domain/common/aggregate-root';
import { Result } from '@domain/common/result';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { PoiId } from '@domain/value-objects/poi-id';
import type { UserId } from '@domain/value-objects/user-id';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { GeoCoordinate } from '@domain/value-objects/geo-coordinate';
import type { PoiCategory } from '@domain/value-objects/poi-category';
import { Poi } from '@domain/entities/poi.entity';
import { LagekarteCreatedEvent } from '@domain/events/lagekarte-created.event';
import { PoiAddedEvent } from '@domain/events/poi-added.event';
import { PoiRemovedEvent } from '@domain/events/poi-removed.event';
import { PoiPositionUpdatedEvent } from '@domain/events/poi-position-updated.event';

/**
 * Lagekarte Aggregate Root für DRK Emergency Response Mapping.
 * Repräsentiert die transactionale Grenze für alle Lagekarten-bezogenen Operationen.
 *
 * Diese Klasse implementiert vollständige DDD Aggregate Patterns:
 * - Verwaltet POI-Entities als Child-Entities (Aggregate Consistency Boundary)
 * - Erzwingt Business Rules (z.B. eindeutige POI-Namen pro Lagekarte)
 * - Emittiert Domain Events für externe Integration (Event-Driven Architecture)
 * - Koordinaten-Normalisierung: MGRS ist primäres System, GeoCoordinate wird automatisch konvertiert
 *
 * **Business Rules (Invarianten):**
 * 1. Eine Lagekarte gehört zu genau einem Einsatz (1:1 Relationship)
 * 2. POI-Namen müssen innerhalb einer Lagekarte eindeutig sein (Duplikate verboten)
 * 3. MGRS ist primäres Koordinatensystem - GeoCoordinate wird automatisch konvertiert
 * 4. POIs können nur über das Aggregat hinzugefügt/entfernt werden (Aggregate Boundary)
 * 5. POIs haben keine eigene Identity außerhalb der Lagekarte (Owned Entities)
 *
 * **Warum eindeutige POI-Namen:**
 * - Kommunikation: Einsatzkräfte referenzieren POIs per Name in Funkgesprächen
 * - Verwechslungsgefahr: Mehrere "Einsatzstelle" POIs führen zu Missverständnissen
 * - Usability: UI-Filterung und Suchfunktion benötigen eindeutige Namen
 *
 * **Warum MGRS primär:**
 * - DRK-Standard: MGRS ist kompakter und weniger fehleranfällig bei Funkdurchsagen
 * - Metrik: Distanzen in Metern direkt ablesbar (wichtig für Einsatzplanung)
 * - NATO-Standard: Interoperabilität mit anderen Hilfsorganisationen
 *
 * **Event Flow:**
 * - create() → Optional: PoiAddedEvent (wenn initialPoi übergeben)
 * - addPoi() → PoiAddedEvent
 * - removePoi() → PoiRemovedEvent
 * - updatePoiPosition() → PoiPositionUpdatedEvent (mit old + new coordinates)
 *
 * @example
 * ```typescript
 * // Lagekarte erstellen (Lazy Creation beim ersten POI)
 * const einsatzId = EinsatzId.create().getValue();
 * const userId = UserId.create().getValue();
 * const result = LagekarteAggregate.create(einsatzId);
 *
 * if (result.isSuccess) {
 *   const lagekarte = result.getValue();
 *
 *   // POI mit MGRS hinzufügen
 *   const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.40, 5).getValue();
 *   const category = PoiCategory.EINSATZSTELLE();
 *   const poiResult = lagekarte.addPoi('Brandenburger Tor', berlinMgrs, category, userId);
 *
 *   if (poiResult.isSuccess) {
 *     const poi = poiResult.getValue();
 *     console.log(poi.name); // "Brandenburger Tor"
 *     console.log(lagekarte.pois.length); // 1
 *     console.log(lagekarte.getDomainEvents().length); // 1 (PoiAddedEvent)
 *   }
 *
 *   // POI mit Lat/Lng hinzufügen (auto-converts zu MGRS)
 *   const hamburgGeo = GeoCoordinate.create(53.55, 10.00).getValue();
 *   const poi2Result = lagekarte.addPoi('Rathaus Hamburg', hamburgGeo, category, userId);
 *   // hamburgGeo wird automatisch zu MGRS konvertiert (DRK-Standard)
 *
 *   // POI Position aktualisieren
 *   const newMgrs = MgrsCoordinate.fromLatLng(53.56, 10.01, 5).getValue();
 *   const updateResult = lagekarte.updatePoiPosition(poi.id, newMgrs, userId);
 *   // Emittiert PoiPositionUpdatedEvent mit old + new coordinates
 *
 *   // POI entfernen
 *   const removeResult = lagekarte.removePoi(poi.id, userId);
 *   // Emittiert PoiRemovedEvent
 *
 *   // POIs nach Kategorie filtern
 *   const einsatzstellen = lagekarte.findPoisByCategory(PoiCategory.EINSATZSTELLE());
 *   console.log(einsatzstellen.length); // 1
 * }
 *
 * // Validation Fehler
 * const dupResult = lagekarte.addPoi('Brandenburger Tor', berlinMgrs, category, userId);
 * console.log(dupResult.isFailure); // true
 * console.log(dupResult.error); // "POI with name 'Brandenburger Tor' already exists"
 * ```
 */
export class LagekarteAggregate extends AggregateRoot<LagekarteId> {
  /**
   * Referenz zum übergeordneten Einsatz (Foreign Aggregate Reference).
   * Readonly: Lagekarte kann nicht zu anderem Einsatz verschoben werden.
   */
  private readonly _einsatzId: EinsatzId;

  /**
   * Liste aller POIs dieser Lagekarte (Child Entities).
   * Managed durch Aggregat: POIs können nur via addPoi()/removePoi() geändert werden.
   * Readonly-Array verhindert direkte Manipulation von außen.
   */
  private _pois: Poi[];

  /**
   * Protected Constructor erzwingt Factory Method Nutzung.
   * Verhindert direkte Instanziierung ohne Validation.
   *
   * @param id - Type-Safe LagekarteId
   * @param einsatzId - Referenz zum übergeordneten Einsatz
   * @param pois - Liste der POI-Entities (default: leeres Array)
   * @param createdAt - Optional: Creation timestamp (für Rekonstruktion aus DB)
   * @param updatedAt - Optional: Update timestamp (für Rekonstruktion aus DB)
   */
  protected constructor(id: LagekarteId, einsatzId: EinsatzId, pois: Poi[] = [], createdAt?: Date, updatedAt?: Date) {
    super(id, createdAt, updatedAt);
    this._einsatzId = einsatzId;
    this._pois = pois;
  }

  /**
   * Readonly getter für Einsatz-ID.
   * @returns EinsatzId der übergeordneten Einsatz-Aggregate
   */
  get einsatzId(): EinsatzId {
    return this._einsatzId;
  }

  /**
   * Readonly getter für POI-Liste.
   * WICHTIG: Gibt ReadonlyArray zurück um direkte Manipulation zu verhindern.
   * POIs dürfen nur via addPoi()/removePoi() geändert werden (Aggregate Boundary).
   *
   * @returns ReadonlyArray aller POIs dieser Lagekarte
   */
  get pois(): ReadonlyArray<Poi> {
    return this._pois;
  }

  /**
   * Erstellt ein neues Lagekarte-Aggregat.
   *
   * Diese Methode wird vom Application Layer aufgerufen, wenn die erste
   * POI zur Lagekarte hinzugefügt wird (Lazy Creation Pattern). Lagekarten
   * ohne POIs existieren nicht in der Datenbank (vermeidet leere Aggregates).
   *
   * **Business Rules:**
   * - EinsatzId ist required (Lagekarte muss zu Einsatz gehören)
   * - CreatedBy (UserId) ist required (für Audit-Trail)
   * - LagekarteId wird auto-generiert (Type-Safe EntityId)
   * - Initial kann optional ein POI übergeben werden (atomare Erstellung)
   * - LagekarteCreatedEvent wird emittiert
   * - Bei initialPoi wird zusätzlich PoiAddedEvent emittiert
   *
   * **Event Flow:**
   * - create() → LagekarteCreatedEvent (immer)
   * - create(einsatzId, createdBy, initialPoi) → LagekarteCreatedEvent + PoiAddedEvent
   *
   * **Warum Lazy Creation:**
   * - Verhindert leere Lagekarten in DB (Storage-Optimierung)
   * - Transaktionale Konsistenz: Lagekarte + erster POI werden zusammen erstellt
   * - Simplizität: Keine separaten "Lagekarte anlegen" und "POI hinzufügen" Operationen
   *
   * @param einsatzId - Referenz zum übergeordneten Einsatz
   * @param createdBy - UserId des Erstellers (für Audit-Trail und LagekarteCreatedEvent)
   * @param initialPoi - Optionaler erster POI (für atomare Erstellung)
   * @returns Result mit Lagekarte-Aggregat oder Fehler
   *
   * @example
   * ```typescript
   * // Ohne initialPoi (nur Lagekarte)
   * const result = LagekarteAggregate.create(einsatzId, userId);
   * // result.getValue().pois.length === 0
   * // result.getValue().getDomainEvents().length === 1 (LagekarteCreatedEvent)
   *
   * // Mit initialPoi (atomare Erstellung)
   * const poi = Poi.create('Einsatzstelle', berlinMgrs, category, userId);
   * const result2 = LagekarteAggregate.create(einsatzId, userId, poi);
   * // result2.getValue().pois.length === 1
   * // result2.getValue().getDomainEvents().length === 2 (LagekarteCreatedEvent + PoiAddedEvent)
   *
   * // Validation Fehler
   * const failResult = LagekarteAggregate.create(null as any, userId);
   * // failResult.isFailure === true
   * // failResult.error === "EinsatzId is required"
   * ```
   */
  public static create(einsatzId: EinsatzId, createdBy: UserId, initialPoi?: Poi): Result<LagekarteAggregate> {
    // Validation: einsatzId required
    if (!einsatzId) {
      return Result.fail('EinsatzId is required');
    }

    // Validation: createdBy required
    if (!createdBy) {
      return Result.fail('CreatedBy (UserId) is required');
    }

    // Auto-generate LagekarteId
    const idResult = LagekarteId.create();
    if (idResult.isFailure) {
      return Result.fail(idResult.error ?? 'Failed to create LagekarteId');
    }

    const id = idResult.value as LagekarteId;
    const pois = initialPoi ? [initialPoi] : [];
    const lagekarte = new LagekarteAggregate(id, einsatzId, pois);

    // Emit LagekarteCreatedEvent (always)
    lagekarte.addDomainEvent(new LagekarteCreatedEvent(lagekarte.id, einsatzId, createdBy, initialPoi !== undefined));

    // If initialPoi provided, also emit PoiAddedEvent
    if (initialPoi) {
      lagekarte.addDomainEvent(new PoiAddedEvent(lagekarte.id, initialPoi.id, initialPoi.name, initialPoi.coordinate, initialPoi.category, initialPoi.createdBy));
    }

    return Result.ok(lagekarte);
  }

  /**
   * Fügt einen neuen POI zur Lagekarte hinzu.
   *
   * Diese Methode validiert den POI-Namen auf Duplikate innerhalb der
   * Lagekarte, da mehrere POIs mit demselben Namen zu Verwechslungen
   * bei Einsatzkräften führen können (Funkdurchsagen, Koordination).
   *
   * WICHTIG: Wenn coordinate als GeoCoordinate übergeben wird, wird
   * automatisch zu MGRS konvertiert, da MGRS das primäre Koordinatensystem
   * gemäß DRK-Standards ist (kompakter, metrik, NATO-Standard).
   *
   * **Business Rules:**
   * - POI-Name darf nicht leer sein (trim check)
   * - POI-Name muss innerhalb Lagekarte eindeutig sein (Case-Sensitive!)
   * - GeoCoordinate wird automatisch zu MGRS konvertiert (5-digit = 1m precision)
   * - Konvertierungsfehler führen zu Failure (z.B. ungültige Lat/Lng)
   * - Bei Erfolg wird PoiAddedEvent mit MGRS-Koordinate emittiert
   *
   * **Warum Case-Sensitive Duplikat-Check:**
   * - "Einsatzstelle" ≠ "einsatzstelle" für präzise Kommunikation
   * - UI kann Case-Normalisierung vornehmen wenn gewünscht
   * - Domain bleibt strikt (Fail-Fast bei Invarianten-Verletzung)
   *
   * **Warum automatische MGRS-Konvertierung:**
   * - DRK-Standard: MGRS ist primäres Koordinatensystem
   * - Convenience: UI kann GeoCoordinate übergeben ohne manuelle Konvertierung
   * - Konsistenz: Alle POIs haben MGRS-Koordinaten (keine gemischten Formate)
   *
   * @param name - POI-Name (z.B. "Einsatzstelle", "Bereitstellungsraum")
   * @param coordinate - MGRS oder Lat/Lng (wird zu MGRS konvertiert)
   * @param category - POI-Kategorie (EINSATZSTELLE, BEREITSTELLUNGSRAUM, etc.)
   * @param userId - Benutzer-ID des Erstellers
   * @param beschreibung - Optionale Beschreibung für zusätzliche Informationen
   * @returns Result mit erstelltem POI oder Fehler
   *
   * @example
   * ```typescript
   * // Mit MGRS-Koordinate
   * const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.40, 5).getValue();
   * const result = lagekarte.addPoi('Brandenburger Tor', berlinMgrs, category, userId);
   * // result.getValue().coordinate === berlinMgrs (kein Konvertierung nötig)
   *
   * // Mit Lat/Lng (auto-convert zu MGRS)
   * const hamburgGeo = GeoCoordinate.create(53.55, 10.00).getValue();
   * const result2 = lagekarte.addPoi('Rathaus Hamburg', hamburgGeo, category, userId);
   * // result2.getValue().coordinate ist MgrsCoordinate (automatisch konvertiert)
   *
   * // Mit Beschreibung
   * const result3 = lagekarte.addPoi('Gefahrenstelle', berlinMgrs, category, userId, 'Überflutete Straße');
   * // result3.getValue().beschreibung === 'Überflutete Straße'
   *
   * // Validation Fehler: Leerer Name
   * const fail1 = lagekarte.addPoi('', berlinMgrs, category, userId);
   * // fail1.error === "POI name cannot be empty"
   *
   * // Validation Fehler: Duplikat Name
   * lagekarte.addPoi('Einsatzstelle', berlinMgrs, category, userId);
   * const fail2 = lagekarte.addPoi('Einsatzstelle', hamburgGeo, category, userId);
   * // fail2.error === "POI with name 'Einsatzstelle' already exists"
   *
   * // Konvertierungsfehler
   * const invalidGeo = GeoCoordinate.create(999, 999).getValue(); // Ungültige Lat/Lng
   * const fail3 = lagekarte.addPoi('Test', invalidGeo, category, userId);
   * // fail3.error === "Failed to convert coordinate to MGRS: ..."
   * ```
   */
  public addPoi(name: string, coordinate: MgrsCoordinate | GeoCoordinate, category: PoiCategory, userId: UserId, beschreibung?: string): Result<Poi> {
    // Validation: name not empty
    if (!name || name.trim().length === 0) {
      return Result.fail('POI name cannot be empty');
    }

    // Business Rule: No duplicate POI names (Case-Sensitive)
    const duplicate = this._pois.find((poi) => poi.name === name);
    if (duplicate) {
      return Result.fail(`POI with name "${name}" already exists`);
    }

    // Business Rule: Convert GeoCoordinate to MGRS (MGRS is primary)
    let mgrsCoord: MgrsCoordinate;
    if (coordinate instanceof GeoCoordinate) {
      const conversionResult = MgrsCoordinate.fromLatLng(coordinate.latitude, coordinate.longitude, 5); // 5 = 1m precision
      if (conversionResult.isFailure) {
        return Result.fail(`Failed to convert coordinate to MGRS: ${conversionResult.error}`);
      }
      mgrsCoord = conversionResult.value as MgrsCoordinate;
    } else {
      mgrsCoord = coordinate;
    }

    // Create POI entity
    const poi = Poi.create(name, mgrsCoord, category, userId, beschreibung);
    this._pois.push(poi);

    // Emit PoiAddedEvent
    this.addDomainEvent(new PoiAddedEvent(this.id, poi.id, poi.name, poi.coordinate, poi.category, poi.createdBy));

    return Result.ok(poi);
  }

  /**
   * Entfernt einen POI von der Lagekarte.
   *
   * Diese Methode führt ein Hard-Delete durch (POI wird komplett entfernt).
   * Soft-Delete ist nicht erforderlich, da POIs keine historische Bedeutung
   * haben und jederzeit neu erstellt werden können. Die Audit-Historie
   * wird über PoiRemovedEvent gewährleistet (Event-Sourcing).
   *
   * **Business Rules:**
   * - POI muss existieren (ID-basierte Suche)
   * - POI wird aus _pois Array entfernt (Splice)
   * - PoiRemovedEvent wird emittiert für Audit-Trail
   *
   * **Warum Hard-Delete:**
   * - POIs sind kurzlebige Marker ohne historische Bedeutung
   * - Event-Sourcing gewährleistet Audit-Trail (PoiRemovedEvent)
   * - Soft-Delete würde DB unnötig belasten (keine Compliance-Anforderung)
   * - POIs können jederzeit neu erstellt werden (keine kritischen Daten)
   *
   * **Warum ID-basierte Suche:**
   * - Entity Equality: POIs sind über ID identifizierbar (nicht Name)
   * - Robustheit: Name könnte sich ändern (bei zukünftigen Features)
   * - Performance: ID-Vergleich ist schneller als String-Vergleich
   *
   * @param poiId - ID des zu entfernenden POI
   * @param userId - Benutzer-ID des Löschenden (für Audit-Trail)
   * @returns Result mit void oder Fehler
   *
   * @example
   * ```typescript
   * // POI hinzufügen und entfernen
   * const poiResult = lagekarte.addPoi('Einsatzstelle', berlinMgrs, category, userId);
   * const poi = poiResult.getValue();
   * console.log(lagekarte.pois.length); // 1
   *
   * // Erfolgreiches Entfernen
   * const result = lagekarte.removePoi(poi.id, userId);
   * // result.isSuccess === true
   * // lagekarte.pois.length === 0
   * // lagekarte.getDomainEvents().length === 2 (PoiAddedEvent, PoiRemovedEvent)
   *
   * // Validation Fehler: POI existiert nicht
   * const fakePoiId = PoiId.create().getValue();
   * const failResult = lagekarte.removePoi(fakePoiId, userId);
   * // failResult.isFailure === true
   * // failResult.error === "POI with ID {id} not found"
   * ```
   */
  public removePoi(poiId: PoiId, userId: UserId): Result<void> {
    // Validation: POI exists
    const index = this._pois.findIndex((poi) => poi.id.equals(poiId));
    if (index === -1) {
      return Result.fail(`POI with ID ${poiId.value} not found`);
    }

    // Remove POI (Hard-Delete)
    this._pois.splice(index, 1);

    // Emit PoiRemovedEvent
    this.addDomainEvent(new PoiRemovedEvent(this.id, poiId, userId));

    return Result.ok(undefined as undefined);
  }

  /**
   * Aktualisiert die Position eines POI.
   *
   * Diese Methode speichert die alte Position im Event, damit Event-Handler
   * die Distanzänderung berechnen können (z.B. für Alarmierungsradius).
   * Dadurch werden N+1 Datenbank-Abfragen in Event-Handlern verhindert
   * (Event-Carried State Transfer Pattern).
   *
   * WICHTIG: Wenn newCoordinate als GeoCoordinate übergeben wird, wird
   * automatisch zu MGRS konvertiert (DRK-Standard).
   *
   * **Business Rules:**
   * - POI muss existieren (ID-basierte Suche)
   * - GeoCoordinate wird automatisch zu MGRS konvertiert (5-digit = 1m precision)
   * - Alte Position wird im Event gespeichert (für Distanzberechnung)
   * - PoiPositionUpdatedEvent wird mit old + new coordinates emittiert
   *
   * **Warum alte + neue Position im Event:**
   * - Performance: Handler können Distanz ohne DB-Query berechnen (N+1 Vermeidung)
   * - Audit-Trail: Vollständige Historie der Position (von → zu) für Compliance
   * - Pattern Consistency: Analog zu EinsatzStatusChangedEvent (old + new status)
   * - Event-Carried State Transfer: Handler sind entkoppelt von Domain-DB
   *
   * **Use Cases für Distanzberechnung:**
   * - Alarmierungsradius: "POI moved 500m → re-calculate affected units"
   * - Movement Tracking: "POI moved > 1km → notify Einsatzleitung"
   * - Compliance: "Track all position changes > 100m for audit"
   *
   * @param poiId - ID des zu aktualisierenden POI
   * @param newCoordinate - Neue MGRS oder Lat/Lng Koordinate
   * @param userId - Benutzer-ID des Ändernden (für Audit-Trail)
   * @returns Result mit void oder Fehler
   *
   * @example
   * ```typescript
   * // POI an Berlin erstellen
   * const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.40, 5).getValue();
   * const poiResult = lagekarte.addPoi('Einsatzstelle', berlinMgrs, category, userId);
   * const poi = poiResult.getValue();
   * lagekarte.clearDomainEvents(); // Clear PoiAddedEvent
   *
   * // Position zu Hamburg aktualisieren (MGRS)
   * const hamburgMgrs = MgrsCoordinate.fromLatLng(53.55, 10.00, 5).getValue();
   * const result = lagekarte.updatePoiPosition(poi.id, hamburgMgrs, userId);
   * // result.isSuccess === true
   * // poi.coordinate === hamburgMgrs (Position aktualisiert)
   * // Event: PoiPositionUpdatedEvent mit oldCoordinate=berlinMgrs, newCoordinate=hamburgMgrs
   *
   * // Mit Lat/Lng (auto-convert zu MGRS)
   * const munichGeo = GeoCoordinate.create(48.14, 11.58).getValue();
   * const result2 = lagekarte.updatePoiPosition(poi.id, munichGeo, userId);
   * // munichGeo wurde automatisch zu MGRS konvertiert
   *
   * // Event-Handler Beispiel (Distanzberechnung ohne DB-Query)
   * const event = lagekarte.getDomainEvents()[0] as PoiPositionUpdatedEvent;
   * const distanceM = event.oldCoordinate.distanceTo(event.newCoordinate);
   * console.log(`POI moved ${distanceM}m`); // ~255000m (Berlin → Hamburg)
   *
   * // Validation Fehler: POI nicht gefunden
   * const fakePoiId = PoiId.create().getValue();
   * const failResult = lagekarte.updatePoiPosition(fakePoiId, hamburgMgrs, userId);
   * // failResult.error === "POI with ID {id} not found"
   * ```
   */
  public updatePoiPosition(poiId: PoiId, newCoordinate: MgrsCoordinate | GeoCoordinate, userId: UserId): Result<void> {
    // Validation: POI exists
    const poi = this._pois.find((p) => p.id.equals(poiId));
    if (!poi) {
      return Result.fail(`POI with ID ${poiId.value} not found`);
    }

    // Business Rule: Convert GeoCoordinate to MGRS if needed
    let newMgrs: MgrsCoordinate;
    if (newCoordinate instanceof GeoCoordinate) {
      const conversionResult = MgrsCoordinate.fromLatLng(newCoordinate.latitude, newCoordinate.longitude, 5); // 5 = 1m precision
      if (conversionResult.isFailure) {
        return Result.fail(`Failed to convert coordinate to MGRS: ${conversionResult.error}`);
      }
      newMgrs = conversionResult.value as MgrsCoordinate;
    } else {
      newMgrs = newCoordinate;
    }

    // Store old coordinate for event (Event-Carried State Transfer)
    const oldCoordinate = poi.coordinate;

    // Update POI position
    poi.updatePosition(newMgrs);

    // Emit PoiPositionUpdatedEvent (with old + new coordinates)
    this.addDomainEvent(new PoiPositionUpdatedEvent(this.id, poi.id, oldCoordinate, newMgrs, userId));

    return Result.ok(undefined as undefined);
  }

  /**
   * Filtert POIs nach Kategorie.
   *
   * Diese Methode wird für UI-Filterung verwendet (z.B. "Zeige nur Einsatzstellen").
   * Die Filterung erfolgt im Aggregat, nicht in der Datenbank, da die POI-Liste
   * bereits im Speicher geladen ist (Aggregate Consistency Boundary).
   *
   * **Warum In-Memory Filterung:**
   * - Performance: POI-Liste ist bereits geladen (kein zusätzlicher DB-Query)
   * - Aggregate Boundary: POIs sind Teil des Aggregates (keine separaten Queries)
   * - Simplizität: Keine komplexe Repository-Query-Logik nötig
   * - Konsistenz: Filter arbeitet auf aktuellem Aggregate-State (kein Stale Data)
   *
   * **Use Cases:**
   * - UI-Filterung: "Zeige nur Einsatzstellen auf Karte"
   * - Reporting: "Zähle alle Gefahrenstellen pro Einsatz"
   * - Business Logic: "Finde nächste Wasserentnahmestelle"
   *
   * @param category - POI-Kategorie zum Filtern
   * @returns Array von POIs mit dieser Kategorie (kann leer sein)
   *
   * @example
   * ```typescript
   * // Lagekarte mit mehreren POIs
   * lagekarte.addPoi('POI1', berlinMgrs, PoiCategory.EINSATZSTELLE(), userId);
   * lagekarte.addPoi('POI2', hamburgMgrs, PoiCategory.BEREITSTELLUNGSRAUM(), userId);
   * lagekarte.addPoi('POI3', munichMgrs, PoiCategory.EINSATZSTELLE(), userId);
   *
   * // Filter nach EINSATZSTELLE
   * const einsatzstellen = lagekarte.findPoisByCategory(PoiCategory.EINSATZSTELLE());
   * // einsatzstellen.length === 2 (POI1, POI3)
   * // einsatzstellen[0].name === 'POI1'
   * // einsatzstellen[1].name === 'POI3'
   *
   * // Filter nach BEREITSTELLUNGSRAUM
   * const bereitstellungsraeume = lagekarte.findPoisByCategory(PoiCategory.BEREITSTELLUNGSRAUM());
   * // bereitstellungsraeume.length === 1 (POI2)
   *
   * // Filter nach Kategorie die nicht existiert
   * const gefahrenstellen = lagekarte.findPoisByCategory(PoiCategory.GEFAHRENSTELLE());
   * // gefahrenstellen.length === 0 (leeres Array)
   * ```
   */
  public findPoisByCategory(category: PoiCategory): Poi[] {
    return this._pois.filter((poi) => poi.category.equals(category));
  }
}
