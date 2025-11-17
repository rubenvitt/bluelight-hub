import { LagekarteAggregate } from '../lagekarte.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { PoiId } from '@domain/value-objects/poi-id';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { GeoCoordinate } from '@domain/value-objects/geo-coordinate';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { Poi } from '@domain/entities/poi.entity';
import { PoiAddedEvent } from '@domain/events/poi-added.event';
import { PoiRemovedEvent } from '@domain/events/poi-removed.event';
import { PoiPositionUpdatedEvent } from '@domain/events/poi-position-updated.event';

// Mock nanoid for Jest compatibility (ESM module issue)
jest.mock('nanoid/non-secure', () => ({
  nanoid: jest.fn(() => {
    // Generate valid nanoid format: 21 URL-safe characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let result = '';
    for (let i = 0; i < 21; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
}));

/**
 * Integration Tests für LagekarteAggregate Full Lifecycle.
 *
 * Diese Tests validieren das vollständige Zusammenspiel aller Komponenten
 * von der Erstellung bis zu komplexen Operationen mit realistischen Szenarien.
 *
 * **Test Coverage:**
 * - Full Lifecycle: Create → Add POIs → Update → Remove
 * - Multiple German MGRS Zones: 32U (Hamburg), 33U (Berlin, Dresden)
 * - MGRS ↔ Lat/Lng Roundtrip accuracy
 * - Event Accumulation & Verification
 * - Cross-Zone POI movements
 * - Distance calculations
 * - Category filtering
 * - Duplicate prevention
 * - Atomic creation with initialPoi
 *
 * **Realistic Test Data:**
 * - Berlin (52.52°N, 13.40°E) → MGRS Zone 33U
 * - Hamburg (53.55°N, 10.00°E) → MGRS Zone 32U
 * - Dresden (51.05°N, 13.74°E) → MGRS Zone 33U (Eastern Germany)
 */
describe('LagekarteAggregate Integration Tests', () => {
  /**
   * Test 1: Full Lifecycle Test
   * Validates complete flow from creation to removal with multiple POIs across zones
   */
  it('should handle complete lifecycle: create → add POIs → update → remove', () => {
    // Given: Einsatz IDs and User
    const einsatzId = EinsatzId.create().value as EinsatzId;
    const userId = UserId.create().value as UserId;

    // When: Create Lagekarte
    const lagekarteResult = LagekarteAggregate.create(einsatzId);
    expect(lagekarteResult.isSuccess).toBe(true);
    const lagekarte = lagekarteResult.value as LagekarteAggregate;

    // When: Add 3 POIs in different German MGRS zones
    const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;
    const hamburgMgrs = MgrsCoordinate.fromLatLng(53.55, 10.0, 5).value as MgrsCoordinate;
    const dresdenMgrs = MgrsCoordinate.fromLatLng(51.05, 13.74, 5).value as MgrsCoordinate;

    const poi1Result = lagekarte.addPoi('Einsatzstelle Berlin', berlinMgrs, PoiCategory.EINSATZSTELLE(), userId);
    const poi2Result = lagekarte.addPoi('Bereitstellungsraum Hamburg', hamburgMgrs, PoiCategory.BEREITSTELLUNGSRAUM(), userId);
    const poi3Result = lagekarte.addPoi('Wasserentnahme Dresden', dresdenMgrs, PoiCategory.WASSERENTNAHMESTELLE(), userId);

    expect(poi1Result.isSuccess).toBe(true);
    expect(poi2Result.isSuccess).toBe(true);
    expect(poi3Result.isSuccess).toBe(true);

    const poi1 = poi1Result.value as Poi;
    const poi2 = poi2Result.value as Poi;
    const poi3 = poi3Result.value as Poi;

    // Then: 3 POIs (2 in zone 33U, 1 in zone 32U)
    expect(lagekarte.pois).toHaveLength(3);
    expect(poi1.coordinate.gridZone).toBe('33U'); // Berlin
    expect(poi2.coordinate.gridZone).toBe('32U'); // Hamburg
    expect(poi3.coordinate.gridZone).toBe('33U'); // Dresden (also 33U, eastern Germany)

    // When: Update position (Berlin → Hamburg zone)
    const updateResult = lagekarte.updatePoiPosition(poi1.id, hamburgMgrs, userId);
    expect(updateResult.isSuccess).toBe(true);
    expect(poi1.coordinate.gridZone).toBe('32U'); // Now Hamburg zone

    // When: Remove one POI
    const removeResult = lagekarte.removePoi(poi2.id, userId);
    expect(removeResult.isSuccess).toBe(true);
    expect(lagekarte.pois).toHaveLength(2);

    // Then: Verify event accumulation (3 added + 1 updated + 1 removed = 5 events)
    const events = lagekarte.getDomainEvents();
    expect(events).toHaveLength(5);
    expect(events[0]).toBeInstanceOf(PoiAddedEvent);
    expect(events[1]).toBeInstanceOf(PoiAddedEvent);
    expect(events[2]).toBeInstanceOf(PoiAddedEvent);
    expect(events[3]).toBeInstanceOf(PoiPositionUpdatedEvent);
    expect(events[4]).toBeInstanceOf(PoiRemovedEvent);

    // Verify event data
    const addedEvent = events[0] as PoiAddedEvent;
    expect(addedEvent.name).toBe('Einsatzstelle Berlin');
    expect(addedEvent.coordinate).toBe(berlinMgrs);

    const updatedEvent = events[3] as PoiPositionUpdatedEvent;
    expect(updatedEvent.oldCoordinate.gridZone).toBe('33U');
    expect(updatedEvent.newCoordinate.gridZone).toBe('32U');

    const removedEvent = events[4] as PoiRemovedEvent;
    expect(removedEvent.poiId).toEqual(poi2.id);
  });

  /**
   * Test 2: MGRS Zone Cross-Over Test
   * Validates POI movements across German MGRS zones (32U ↔ 33U) with event tracking
   */
  it('should handle POI movements across German MGRS zones', () => {
    // Given: Lagekarte with POI in Zone 33U (Berlin)
    const einsatzId = EinsatzId.create().value as EinsatzId;
    const userId = UserId.create().value as UserId;
    const lagekarte = LagekarteAggregate.create(einsatzId).value as LagekarteAggregate;

    const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;
    const poiResult = lagekarte.addPoi('Mobile POI', berlinMgrs, PoiCategory.SONSTIGES(), userId);
    const poi = poiResult.value as Poi;

    expect(poi.coordinate.gridZone).toBe('33U'); // Initially in Berlin zone

    // When: Move to Zone 32U (Hamburg)
    const hamburgMgrs = MgrsCoordinate.fromLatLng(53.55, 10.0, 5).value as MgrsCoordinate;
    const update1 = lagekarte.updatePoiPosition(poi.id, hamburgMgrs, userId);
    expect(update1.isSuccess).toBe(true);

    // Then: Zone changed from 33U → 32U
    expect(poi.coordinate.gridZone).toBe('32U');

    // When: Move back to Zone 33U (Dresden - eastern Germany)
    const dresdenMgrs = MgrsCoordinate.fromLatLng(51.05, 13.74, 5).value as MgrsCoordinate;
    const update2 = lagekarte.updatePoiPosition(poi.id, dresdenMgrs, userId);
    expect(update2.isSuccess).toBe(true);

    // Then: Zone changed from 32U → 33U
    expect(poi.coordinate.gridZone).toBe('33U');

    // Verify event history shows zone transitions
    const events = lagekarte.getDomainEvents();
    const positionEvents = events.filter((e) => e instanceof PoiPositionUpdatedEvent) as PoiPositionUpdatedEvent[];
    expect(positionEvents).toHaveLength(2);

    // First move: 33U → 32U
    expect(positionEvents[0].oldCoordinate.gridZone).toBe('33U');
    expect(positionEvents[0].newCoordinate.gridZone).toBe('32U');

    // Second move: 32U → 33U
    expect(positionEvents[1].oldCoordinate.gridZone).toBe('32U');
    expect(positionEvents[1].newCoordinate.gridZone).toBe('33U');
  });

  /**
   * Test 3: GeoCoordinate Auto-Conversion Test
   * Validates automatic conversion from Lat/Lng to MGRS when adding POI
   */
  it('should auto-convert GeoCoordinate to MGRS when adding POI', () => {
    // Given: Lagekarte and Lat/Lng coordinate
    const einsatzId = EinsatzId.create().value as EinsatzId;
    const userId = UserId.create().value as UserId;
    const lagekarte = LagekarteAggregate.create(einsatzId).value as LagekarteAggregate;

    const berlinGeo = GeoCoordinate.create(52.52, 13.4).value as GeoCoordinate;

    // When: Add POI with GeoCoordinate
    const poiResult = lagekarte.addPoi('POI Lat/Lng', berlinGeo, PoiCategory.EINSATZSTELLE(), userId);
    expect(poiResult.isSuccess).toBe(true);
    const poi = poiResult.value as Poi;

    // Then: Stored as MGRS (auto-converted)
    expect(poi.coordinate).toBeInstanceOf(MgrsCoordinate);
    expect(poi.coordinate.gridZone).toBe('33U');

    // Then: Event contains MGRS (not Lat/Lng)
    const events = lagekarte.getDomainEvents();
    const addedEvent = events[0] as PoiAddedEvent;
    expect(addedEvent.coordinate).toBeInstanceOf(MgrsCoordinate);
    expect(addedEvent.coordinate.gridZone).toBe('33U');
  });

  /**
   * Test 4: Distance Calculation Across Events Test
   * Validates that PoiPositionUpdatedEvent contains sufficient data for distance calculation
   */
  it('should allow distance calculation from PoiPositionUpdatedEvent', () => {
    // Given: Lagekarte with POI in Berlin
    const einsatzId = EinsatzId.create().value as EinsatzId;
    const userId = UserId.create().value as UserId;
    const lagekarte = LagekarteAggregate.create(einsatzId).value as LagekarteAggregate;

    const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;
    const poiResult = lagekarte.addPoi('POI', berlinMgrs, PoiCategory.EINSATZSTELLE(), userId);
    const poi = poiResult.value as Poi;

    lagekarte.clearDomainEvents(); // Clear PoiAddedEvent

    // When: Move POI from Berlin to Hamburg
    const hamburgMgrs = MgrsCoordinate.fromLatLng(53.55, 10.0, 5).value as MgrsCoordinate;
    lagekarte.updatePoiPosition(poi.id, hamburgMgrs, userId);

    // Then: Event contains old + new coordinates for distance calculation
    const events = lagekarte.getDomainEvents();
    expect(events).toHaveLength(1);
    const event = events[0] as PoiPositionUpdatedEvent;

    const distanceKm = event.oldCoordinate.distanceTo(event.newCoordinate) / 1000;

    // Berlin → Hamburg ≈ 255km (with ~10km tolerance for coordinate precision)
    expect(distanceKm).toBeGreaterThan(250);
    expect(distanceKm).toBeLessThan(265);
  });

  /**
   * Test 5: Category Filtering Integration Test
   * Validates filtering POIs by category across multiple operations
   */
  it('should filter POIs by category across multiple operations', () => {
    // Given: Lagekarte with multiple POIs of different categories
    const einsatzId = EinsatzId.create().value as EinsatzId;
    const userId = UserId.create().value as UserId;
    const lagekarte = LagekarteAggregate.create(einsatzId).value as LagekarteAggregate;

    const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;

    lagekarte.addPoi('Einsatzstelle 1', berlinMgrs, PoiCategory.EINSATZSTELLE(), userId);
    lagekarte.addPoi('Bereitstellungsraum', berlinMgrs, PoiCategory.BEREITSTELLUNGSRAUM(), userId);
    lagekarte.addPoi('Einsatzstelle 2', berlinMgrs, PoiCategory.EINSATZSTELLE(), userId);
    lagekarte.addPoi('Gefahrenstelle', berlinMgrs, PoiCategory.GEFAHRENSTELLE(), userId);

    expect(lagekarte.pois).toHaveLength(4);

    // When: Filter by EINSATZSTELLE
    const einsatzstellen = lagekarte.findPoisByCategory(PoiCategory.EINSATZSTELLE());

    // Then: Only 2 EINSATZSTELLE POIs
    expect(einsatzstellen).toHaveLength(2);
    expect(einsatzstellen[0].name).toBe('Einsatzstelle 1');
    expect(einsatzstellen[1].name).toBe('Einsatzstelle 2');

    // When: Filter by BEREITSTELLUNGSRAUM
    const bereitstellungsraeume = lagekarte.findPoisByCategory(PoiCategory.BEREITSTELLUNGSRAUM());

    // Then: Only 1 BEREITSTELLUNGSRAUM POI
    expect(bereitstellungsraeume).toHaveLength(1);
    expect(bereitstellungsraeume[0].name).toBe('Bereitstellungsraum');

    // When: Filter by non-existent category
    const wasserentnahmen = lagekarte.findPoisByCategory(PoiCategory.WASSERENTNAHMESTELLE());

    // Then: Empty array
    expect(wasserentnahmen).toHaveLength(0);
  });

  /**
   * Test 6: Duplicate Name Prevention Test
   * Validates that duplicate POI names are rejected across operations
   */
  it('should prevent duplicate POI names across operations', () => {
    // Given: Lagekarte with POI
    const einsatzId = EinsatzId.create().value as EinsatzId;
    const userId = UserId.create().value as UserId;
    const lagekarte = LagekarteAggregate.create(einsatzId).value as LagekarteAggregate;

    const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;
    const hamburgMgrs = MgrsCoordinate.fromLatLng(53.55, 10.0, 5).value as MgrsCoordinate;

    const result1 = lagekarte.addPoi('Haupteinsatzstelle', berlinMgrs, PoiCategory.EINSATZSTELLE(), userId);
    expect(result1.isSuccess).toBe(true);

    // When: Try to add duplicate name with different category and position
    const result2 = lagekarte.addPoi('Haupteinsatzstelle', hamburgMgrs, PoiCategory.BEREITSTELLUNGSRAUM(), userId);

    // Then: Rejected with error
    expect(result2.isFailure).toBe(true);
    expect(result2.error).toContain('already exists');
    expect(result2.error).toContain('Haupteinsatzstelle');

    // Verify only 1 POI exists
    expect(lagekarte.pois).toHaveLength(1);
  });

  /**
   * Test 7: MGRS Roundtrip Accuracy Test
   * Validates coordinate accuracy through MGRS ↔ Lat/Lng roundtrip conversion
   */
  it('should maintain coordinate accuracy through MGRS ↔ Lat/Lng roundtrip', () => {
    // Given: Original Lat/Lng coordinates
    const originalLat = 52.52;
    const originalLng = 13.4;

    // When: Convert to MGRS
    const mgrsResult = MgrsCoordinate.fromLatLng(originalLat, originalLng, 5);
    expect(mgrsResult.isSuccess).toBe(true);
    const mgrs = mgrsResult.value as MgrsCoordinate;

    // When: Convert back to Lat/Lng
    const latLng = mgrs.toLatLng();

    // Then: Accuracy within ±0.0001° (~11 meters at equator, ~7m at Berlin latitude)
    expect(latLng.latitude).toBeCloseTo(originalLat, 4);
    expect(latLng.longitude).toBeCloseTo(originalLng, 4);

    // Verify it's in expected zone
    expect(mgrs.gridZone).toBe('33U'); // Berlin zone
  });

  /**
   * Test 8: Initial POI Atomic Creation Test
   * Validates atomic creation of Lagekarte with initial POI
   */
  it('should create Lagekarte with initial POI atomically', () => {
    // Given: EinsatzId and initial POI
    const einsatzId = EinsatzId.create().value as EinsatzId;
    const userId = UserId.create().value as UserId;
    const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;
    const initialPoi = Poi.create('Initial POI', berlinMgrs, PoiCategory.EINSATZSTELLE(), userId);

    // When: Create with initialPoi
    const result = LagekarteAggregate.create(einsatzId, initialPoi);
    expect(result.isSuccess).toBe(true);
    const lagekarte = result.value as LagekarteAggregate;

    // Then: POI already in array
    expect(lagekarte.pois).toHaveLength(1);
    expect(lagekarte.pois[0]).toBe(initialPoi);

    // Then: Only one PoiAddedEvent (from factory, not from addPoi)
    const events = lagekarte.getDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(PoiAddedEvent);

    const addedEvent = events[0] as PoiAddedEvent;
    expect(addedEvent.name).toBe('Initial POI');
    expect(addedEvent.coordinate).toBe(berlinMgrs);
    expect(addedEvent.category.value).toBe('EINSATZSTELLE');
  });

  /**
   * Test 9: Empty Name Validation Test
   * Validates that empty POI names are rejected
   */
  it('should reject empty POI names', () => {
    // Given: Lagekarte
    const einsatzId = EinsatzId.create().value as EinsatzId;
    const userId = UserId.create().value as UserId;
    const lagekarte = LagekarteAggregate.create(einsatzId).value as LagekarteAggregate;
    const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;

    // When: Try to add POI with empty name
    const result1 = lagekarte.addPoi('', berlinMgrs, PoiCategory.EINSATZSTELLE(), userId);

    // Then: Rejected
    expect(result1.isFailure).toBe(true);
    expect(result1.error).toContain('cannot be empty');

    // When: Try to add POI with whitespace-only name
    const result2 = lagekarte.addPoi('   ', berlinMgrs, PoiCategory.EINSATZSTELLE(), userId);

    // Then: Rejected
    expect(result2.isFailure).toBe(true);
    expect(result2.error).toContain('cannot be empty');

    // Verify no POIs were added
    expect(lagekarte.pois).toHaveLength(0);
  });

  /**
   * Test 10: Non-Existent POI Update/Remove Test
   * Validates error handling when updating or removing non-existent POIs
   */
  it('should reject operations on non-existent POIs', () => {
    // Given: Lagekarte with one POI
    const einsatzId = EinsatzId.create().value as EinsatzId;
    const userId = UserId.create().value as UserId;
    const lagekarte = LagekarteAggregate.create(einsatzId).value as LagekarteAggregate;

    const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;
    const hamburgMgrs = MgrsCoordinate.fromLatLng(53.55, 10.0, 5).value as MgrsCoordinate;

    lagekarte.addPoi('Test POI', berlinMgrs, PoiCategory.EINSATZSTELLE(), userId);

    // When: Try to update non-existent POI
    const fakePoiId = PoiId.create().value as PoiId;
    const updateResult = lagekarte.updatePoiPosition(fakePoiId, hamburgMgrs, userId);

    // Then: Rejected
    expect(updateResult.isFailure).toBe(true);
    expect(updateResult.error).toContain('not found');

    // When: Try to remove non-existent POI
    const removeResult = lagekarte.removePoi(fakePoiId, userId);

    // Then: Rejected
    expect(removeResult.isFailure).toBe(true);
    expect(removeResult.error).toContain('not found');

    // Verify POI count unchanged
    expect(lagekarte.pois).toHaveLength(1);
  });
});
