import { LagekarteAggregate } from './lagekarte.aggregate';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { PoiId } from '@domain/value-objects/poi-id';
import { UserId } from '@domain/value-objects/user-id';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { GeoCoordinate } from '@domain/value-objects/geo-coordinate';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { Poi } from '@domain/entities/poi.entity';
import { PoiAddedEvent } from '@domain/events/poi-added.event';
import { PoiRemovedEvent } from '@domain/events/poi-removed.event';
import { PoiPositionUpdatedEvent } from '@domain/events/poi-position-updated.event';

// Mock CUID2 for Jest compatibility (ESM module issue)
jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn(() => {
    // Generate valid CUID2 format: lowercase alphanumeric
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 24; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
  isCuid: jest.fn((value: string) => {
    // Simple CUID2 validation for tests
    return typeof value === 'string' && value.length >= 20 && /^[a-z0-9]+$/.test(value);
  }),
}));

describe('LagekarteAggregate', () => {
  let testEinsatzId: EinsatzId;
  let testUserId: UserId;
  let berlinMgrs: MgrsCoordinate;
  let berlinGeo: GeoCoordinate;
  let hamburgMgrs: MgrsCoordinate;
  let hamburgGeo: GeoCoordinate;
  let munichMgrs: MgrsCoordinate;
  let testCategory: PoiCategory;

  beforeEach(() => {
    // Setup test data
    testEinsatzId = EinsatzId.create().value as EinsatzId;
    testUserId = UserId.create().value as UserId;

    // Berlin coordinates (Brandenburger Tor)
    berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;
    berlinGeo = GeoCoordinate.create(52.52, 13.4).value as GeoCoordinate;

    // Hamburg coordinates (Rathaus)
    hamburgMgrs = MgrsCoordinate.fromLatLng(53.55, 10.0, 5).value as MgrsCoordinate;
    hamburgGeo = GeoCoordinate.create(53.55, 10.0).value as GeoCoordinate;

    // Munich coordinates (Marienplatz)
    munichMgrs = MgrsCoordinate.fromLatLng(48.14, 11.58, 5).value as MgrsCoordinate;

    testCategory = PoiCategory.EINSATZSTELLE();
  });

  describe('Factory Tests', () => {
    describe('create', () => {
      it('should create Lagekarte with valid einsatzId and createdBy', () => {
        // When: Create Lagekarte
        const result = LagekarteAggregate.create(testEinsatzId, testUserId);

        // Then: Success
        expect(result.isSuccess).toBe(true);
        const lagekarte = result.value as LagekarteAggregate;
        expect(lagekarte).toBeDefined();
        expect(lagekarte.id).toBeInstanceOf(LagekarteId);
        expect(lagekarte.einsatzId).toBe(testEinsatzId);
        expect(lagekarte.pois).toHaveLength(0);
        expect(lagekarte.createdAt).toBeInstanceOf(Date);
        expect(lagekarte.updatedAt).toBeInstanceOf(Date);
      });

      it('should reject missing einsatzId', () => {
        // When: Create without einsatzId
        // biome-ignore lint/suspicious/noExplicitAny: Testing validation with intentionally invalid input
        const result = LagekarteAggregate.create(null as any, testUserId);

        // Then: Failure
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('EinsatzId is required');
      });

      it('should reject missing createdBy', () => {
        // When: Create without createdBy
        // biome-ignore lint/suspicious/noExplicitAny: Testing validation with intentionally invalid input
        const result = LagekarteAggregate.create(testEinsatzId, null as any);

        // Then: Failure
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('CreatedBy (UserId) is required');
      });

      it('should auto-generate LagekarteId', () => {
        // When: Create two Lagekarten
        const result1 = LagekarteAggregate.create(testEinsatzId, testUserId);
        const result2 = LagekarteAggregate.create(testEinsatzId, testUserId);

        // Then: Different IDs
        const lagekarte1 = result1.value as LagekarteAggregate;
        const lagekarte2 = result2.value as LagekarteAggregate;
        expect(lagekarte1.id.equals(lagekarte2.id)).toBe(false);
      });

      it('should create with initialPoi and emit LagekarteCreatedEvent and PoiAddedEvent', () => {
        // Given: Initial POI
        const poi = Poi.create('Einsatzstelle', berlinMgrs, testCategory, testUserId);

        // When: Create with initialPoi
        const result = LagekarteAggregate.create(testEinsatzId, testUserId, poi);

        // Then: POI in array and events emitted
        const lagekarte = result.value as LagekarteAggregate;
        expect(lagekarte.pois).toHaveLength(1);
        expect(lagekarte.pois[0]).toBe(poi);

        const events = lagekarte.getDomainEvents();
        expect(events).toHaveLength(2);
        // First event is LagekarteCreatedEvent
        expect(events[0].constructor.name).toBe('LagekarteCreatedEvent');
        // Second event is PoiAddedEvent
        expect(events[1]).toBeInstanceOf(PoiAddedEvent);

        const poiEvent = events[1] as PoiAddedEvent;
        expect(poiEvent.lagekarteId).toBe(lagekarte.id);
        expect(poiEvent.poiId).toBe(poi.id);
        expect(poiEvent.name).toBe('Einsatzstelle');
        expect(poiEvent.coordinate).toBe(berlinMgrs);
        expect(poiEvent.category).toBe(testCategory);
        expect(poiEvent.createdBy).toBe(testUserId);
      });

      it('should create without initialPoi and have empty pois array', () => {
        // When: Create without initialPoi
        const result = LagekarteAggregate.create(testEinsatzId, testUserId);

        // Then: Empty pois array and LagekarteCreatedEvent emitted
        const lagekarte = result.value as LagekarteAggregate;
        expect(lagekarte.pois).toHaveLength(0);
        // LagekarteCreatedEvent is always emitted on create
        expect(lagekarte.getDomainEvents()).toHaveLength(1);
        expect(lagekarte.getDomainEvents()[0].constructor.name).toBe('LagekarteCreatedEvent');
      });
    });
  });

  describe('addPoi Tests', () => {
    let lagekarte: LagekarteAggregate;

    beforeEach(() => {
      lagekarte = LagekarteAggregate.create(testEinsatzId, testUserId).value as LagekarteAggregate;
      lagekarte.clearDomainEvents(); // Clear LagekarteCreatedEvent for cleaner tests
    });

    it('should add POI with MGRS coordinate', () => {
      // When: Add POI with MGRS
      const result = lagekarte.addPoi('Einsatzstelle', berlinMgrs, testCategory, testUserId);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      const poi = result.value as Poi;
      expect(poi).toBeDefined();
      expect(poi.name).toBe('Einsatzstelle');
      expect(poi.coordinate).toBe(berlinMgrs);
      expect(poi.category).toBe(testCategory);
      expect(poi.createdBy).toBe(testUserId);
      expect(poi.id).toBeInstanceOf(PoiId);

      // POI in lagekarte
      expect(lagekarte.pois).toHaveLength(1);
      expect(lagekarte.pois[0]).toBe(poi);
    });

    it('should add POI with Lat/Lng and auto-convert to MGRS', () => {
      // When: Add POI with GeoCoordinate
      const result = lagekarte.addPoi('Einsatzstelle', berlinGeo, testCategory, testUserId);

      // Then: Success and converted to MGRS
      expect(result.isSuccess).toBe(true);
      const poi = result.value as Poi;
      expect(poi.coordinate).toBeInstanceOf(MgrsCoordinate);
      expect(poi.coordinate.value).toMatch(/^33U/); // Berlin zone

      // POI in lagekarte
      expect(lagekarte.pois).toHaveLength(1);
    });

    it('should emit PoiAddedEvent with MGRS coordinate', () => {
      // When: Add POI
      lagekarte.addPoi('Einsatzstelle', berlinMgrs, testCategory, testUserId);

      // Then: PoiAddedEvent emitted
      const events = lagekarte.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(PoiAddedEvent);

      const event = events[0] as PoiAddedEvent;
      expect(event.coordinate).toBeInstanceOf(MgrsCoordinate);
      expect(event.coordinate).toBe(berlinMgrs);
    });

    it('should reject empty name', () => {
      // When: Add POI with empty name
      const result1 = lagekarte.addPoi('', berlinMgrs, testCategory, testUserId);
      const result2 = lagekarte.addPoi('   ', berlinMgrs, testCategory, testUserId);

      // Then: Failure
      expect(result1.isFailure).toBe(true);
      expect(result1.error).toContain('POI name cannot be empty');
      expect(result2.isFailure).toBe(true);
      expect(result2.error).toContain('POI name cannot be empty');
    });

    it('should reject duplicate POI name', () => {
      // Given: POI already exists
      lagekarte.addPoi('Einsatzstelle', berlinMgrs, testCategory, testUserId);

      // When: Add duplicate name
      const result = lagekarte.addPoi('Einsatzstelle', hamburgMgrs, testCategory, testUserId);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already exists');
      expect(result.error).toContain('Einsatzstelle');

      // POI count unchanged
      expect(lagekarte.pois).toHaveLength(1);
    });

    it('should allow different POI names', () => {
      // When: Add multiple POIs with different names
      const result1 = lagekarte.addPoi('Einsatzstelle', berlinMgrs, testCategory, testUserId);
      const result2 = lagekarte.addPoi('Bereitstellungsraum', hamburgMgrs, testCategory, testUserId);
      const result3 = lagekarte.addPoi('Gefahrenstelle', munichMgrs, testCategory, testUserId);

      // Then: All succeed
      expect(result1.isSuccess).toBe(true);
      expect(result2.isSuccess).toBe(true);
      expect(result3.isSuccess).toBe(true);
      expect(lagekarte.pois).toHaveLength(3);
    });

    it('should return created POI', () => {
      // When: Add POI
      const result = lagekarte.addPoi('Einsatzstelle', berlinMgrs, testCategory, testUserId);

      // Then: Returns POI
      expect(result.isSuccess).toBe(true);
      const poi = result.value as Poi;
      expect(poi).toBeDefined();
      expect(poi.name).toBe('Einsatzstelle');
      expect(poi.coordinate).toBe(berlinMgrs);
    });

    it('should auto-generate PoiId', () => {
      // When: Add POI
      const result = lagekarte.addPoi('Einsatzstelle', berlinMgrs, testCategory, testUserId);

      // Then: POI has PoiId
      const poi = result.value as Poi;
      expect(poi.id).toBeInstanceOf(PoiId);
      expect(poi.id.value).toBeDefined();
      expect(poi.id.value.length).toBeGreaterThan(0);
    });

    it('should increment pois array', () => {
      // When: Add multiple POIs
      expect(lagekarte.pois).toHaveLength(0);

      lagekarte.addPoi('POI1', berlinMgrs, testCategory, testUserId);
      expect(lagekarte.pois).toHaveLength(1);

      lagekarte.addPoi('POI2', hamburgMgrs, testCategory, testUserId);
      expect(lagekarte.pois).toHaveLength(2);

      lagekarte.addPoi('POI3', munichMgrs, testCategory, testUserId);
      expect(lagekarte.pois).toHaveLength(3);
    });

    it('should add POI with optional beschreibung', () => {
      // When: Add POI with beschreibung
      const result = lagekarte.addPoi('Gefahrenstelle', berlinMgrs, testCategory, testUserId, 'Überflutete Straße, nicht befahrbar');

      // Then: Success
      expect(result.isSuccess).toBe(true);
      const poi = result.value as Poi;
      expect(poi.beschreibung).toBe('Überflutete Straße, nicht befahrbar');
      expect(lagekarte.pois).toHaveLength(1);
      expect(lagekarte.pois[0].beschreibung).toBe('Überflutete Straße, nicht befahrbar');
    });

    it('should add POI without beschreibung (undefined)', () => {
      // When: Add POI without beschreibung
      const result = lagekarte.addPoi('Einsatzstelle', berlinMgrs, testCategory, testUserId);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      const poi = result.value as Poi;
      expect(poi.beschreibung).toBeUndefined();
      expect(lagekarte.pois).toHaveLength(1);
    });

    it('should add POI with explicitly passed undefined beschreibung', () => {
      // When: Add POI with explicit undefined
      const result = lagekarte.addPoi('Test POI', berlinMgrs, testCategory, testUserId, undefined);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      const poi = result.value as Poi;
      expect(poi.beschreibung).toBeUndefined();
    });
  });

  describe('removePoi Tests', () => {
    let lagekarte: LagekarteAggregate;
    let poi: Poi;

    beforeEach(() => {
      lagekarte = LagekarteAggregate.create(testEinsatzId, testUserId).value as LagekarteAggregate;
      poi = lagekarte.addPoi('Einsatzstelle', berlinMgrs, testCategory, testUserId).value as Poi;
      lagekarte.clearDomainEvents(); // Clear LagekarteCreatedEvent + PoiAddedEvent
    });

    it('should remove existing POI', () => {
      // Given: POI exists
      expect(lagekarte.pois).toHaveLength(1);

      // When: Remove POI
      const result = lagekarte.removePoi(poi.id, testUserId);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(lagekarte.pois).toHaveLength(0);
    });

    it('should reject non-existent POI', () => {
      // Given: Fake POI ID
      const fakePoiId = PoiId.create().value as PoiId;

      // When: Remove non-existent POI
      const result = lagekarte.removePoi(fakePoiId, testUserId);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not found');

      // POI count unchanged
      expect(lagekarte.pois).toHaveLength(1);
    });

    it('should emit PoiRemovedEvent', () => {
      // When: Remove POI
      lagekarte.removePoi(poi.id, testUserId);

      // Then: PoiRemovedEvent emitted
      const events = lagekarte.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(PoiRemovedEvent);

      const event = events[0] as PoiRemovedEvent;
      expect(event.lagekarteId).toBe(lagekarte.id);
      expect(event.poiId).toBe(poi.id);
      expect(event.removedBy).toBe(testUserId);
    });

    it('should decrement pois array', () => {
      // Given: 3 POIs
      const poi2 = lagekarte.addPoi('POI2', hamburgMgrs, testCategory, testUserId).value as Poi;
      const poi3 = lagekarte.addPoi('POI3', munichMgrs, testCategory, testUserId).value as Poi;
      expect(lagekarte.pois).toHaveLength(3);

      // When: Remove POI2
      lagekarte.removePoi(poi2.id, testUserId);

      // Then: 2 POIs left
      expect(lagekarte.pois).toHaveLength(2);
      expect(lagekarte.pois[0]).toBe(poi);
      expect(lagekarte.pois[1]).toBe(poi3);
    });

    it('should remove correct POI by ID', () => {
      // Given: 3 POIs
      const poi2 = lagekarte.addPoi('POI2', hamburgMgrs, testCategory, testUserId).value as Poi;
      const poi3 = lagekarte.addPoi('POI3', munichMgrs, testCategory, testUserId).value as Poi;

      // When: Remove middle POI
      lagekarte.removePoi(poi2.id, testUserId);

      // Then: POI1 and POI3 remain
      expect(lagekarte.pois).toHaveLength(2);
      expect(lagekarte.pois.find((p) => p.id.equals(poi.id))).toBeDefined();
      expect(lagekarte.pois.find((p) => p.id.equals(poi3.id))).toBeDefined();
      expect(lagekarte.pois.find((p) => p.id.equals(poi2.id))).toBeUndefined();
    });
  });

  describe('updatePoiPosition Tests', () => {
    let lagekarte: LagekarteAggregate;
    let poi: Poi;

    beforeEach(() => {
      lagekarte = LagekarteAggregate.create(testEinsatzId, testUserId).value as LagekarteAggregate;
      poi = lagekarte.addPoi('Einsatzstelle', berlinMgrs, testCategory, testUserId).value as Poi;
      lagekarte.clearDomainEvents(); // Clear LagekarteCreatedEvent + PoiAddedEvent
    });

    it('should update position with MGRS coordinate', () => {
      // When: Update position to Hamburg
      const result = lagekarte.updatePoiPosition(poi.id, hamburgMgrs, testUserId);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(poi.coordinate).toBe(hamburgMgrs);
    });

    it('should update position with Lat/Lng and auto-convert to MGRS', () => {
      // When: Update position with GeoCoordinate
      const result = lagekarte.updatePoiPosition(poi.id, hamburgGeo, testUserId);

      // Then: Success and converted to MGRS
      expect(result.isSuccess).toBe(true);
      expect(poi.coordinate).toBeInstanceOf(MgrsCoordinate);
      expect(poi.coordinate.value).toMatch(/^32U/); // Hamburg zone
    });

    it('should emit PoiPositionUpdatedEvent with old + new coordinates', () => {
      // When: Update position
      lagekarte.updatePoiPosition(poi.id, hamburgMgrs, testUserId);

      // Then: PoiPositionUpdatedEvent emitted
      const events = lagekarte.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(PoiPositionUpdatedEvent);

      const event = events[0] as PoiPositionUpdatedEvent;
      expect(event.lagekarteId).toBe(lagekarte.id);
      expect(event.poiId).toBe(poi.id);
      expect(event.oldCoordinate).toBe(berlinMgrs);
      expect(event.newCoordinate).toBe(hamburgMgrs);
      expect(event.updatedBy).toBe(testUserId);
    });

    it('should reject non-existent POI', () => {
      // Given: Fake POI ID
      const fakePoiId = PoiId.create().value as PoiId;

      // When: Update non-existent POI
      const result = lagekarte.updatePoiPosition(fakePoiId, hamburgMgrs, testUserId);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not found');

      // Original position unchanged
      expect(poi.coordinate).toBe(berlinMgrs);
    });

    it('should reflect coordinate change in POI entity', () => {
      // Given: POI at Berlin
      expect(poi.coordinate).toBe(berlinMgrs);

      // When: Update to Hamburg
      lagekarte.updatePoiPosition(poi.id, hamburgMgrs, testUserId);

      // Then: Coordinate updated
      expect(poi.coordinate).toBe(hamburgMgrs);
      expect(poi.coordinate).not.toBe(berlinMgrs);
    });

    it('should handle multiple position updates', () => {
      // When: Update position multiple times
      lagekarte.updatePoiPosition(poi.id, hamburgMgrs, testUserId);
      lagekarte.updatePoiPosition(poi.id, munichMgrs, testUserId);

      // Then: Final position is Munich
      expect(poi.coordinate).toBe(munichMgrs);

      // Then: 2 events emitted
      const events = lagekarte.getDomainEvents();
      expect(events).toHaveLength(2);

      const event1 = events[0] as PoiPositionUpdatedEvent;
      expect(event1.oldCoordinate).toBe(berlinMgrs);
      expect(event1.newCoordinate).toBe(hamburgMgrs);

      const event2 = events[1] as PoiPositionUpdatedEvent;
      expect(event2.oldCoordinate).toBe(hamburgMgrs);
      expect(event2.newCoordinate).toBe(munichMgrs);
    });

    it('should capture old coordinate correctly before update', () => {
      // Given: POI at Berlin
      const oldCoord = poi.coordinate;

      // When: Update position
      lagekarte.updatePoiPosition(poi.id, hamburgMgrs, testUserId);

      // Then: Event has old coordinate
      const event = lagekarte.getDomainEvents()[0] as PoiPositionUpdatedEvent;
      expect(event.oldCoordinate).toBe(oldCoord);
      expect(event.oldCoordinate).toBe(berlinMgrs);
    });
  });

  describe('findPoisByCategory Tests', () => {
    let lagekarte: LagekarteAggregate;

    beforeEach(() => {
      lagekarte = LagekarteAggregate.create(testEinsatzId, testUserId).value as LagekarteAggregate;
      lagekarte.clearDomainEvents(); // Clear LagekarteCreatedEvent for cleaner tests
    });

    it('should filter POIs by category correctly', () => {
      // Given: POIs with different categories
      lagekarte.addPoi('POI1', berlinMgrs, PoiCategory.EINSATZSTELLE(), testUserId);
      lagekarte.addPoi('POI2', hamburgMgrs, PoiCategory.BEREITSTELLUNGSRAUM(), testUserId);
      lagekarte.addPoi('POI3', munichMgrs, PoiCategory.EINSATZSTELLE(), testUserId);

      // When: Filter by EINSATZSTELLE
      const filtered = lagekarte.findPoisByCategory(PoiCategory.EINSATZSTELLE());

      // Then: Only EINSATZSTELLE POIs
      expect(filtered).toHaveLength(2);
      expect(filtered[0].name).toBe('POI1');
      expect(filtered[1].name).toBe('POI3');
      expect(filtered[0].category.value).toBe('EINSATZSTELLE');
      expect(filtered[1].category.value).toBe('EINSATZSTELLE');
    });

    it('should return empty array if no matches', () => {
      // Given: POIs with EINSATZSTELLE only
      lagekarte.addPoi('POI1', berlinMgrs, PoiCategory.EINSATZSTELLE(), testUserId);
      lagekarte.addPoi('POI2', hamburgMgrs, PoiCategory.EINSATZSTELLE(), testUserId);

      // When: Filter by GEFAHRENSTELLE
      const filtered = lagekarte.findPoisByCategory(PoiCategory.GEFAHRENSTELLE());

      // Then: Empty array
      expect(filtered).toHaveLength(0);
      expect(filtered).toEqual([]);
    });

    it('should return all matches for category', () => {
      // Given: 5 POIs with 3 BEREITSTELLUNGSRAUM
      lagekarte.addPoi('POI1', berlinMgrs, PoiCategory.BEREITSTELLUNGSRAUM(), testUserId);
      lagekarte.addPoi('POI2', hamburgMgrs, PoiCategory.EINSATZSTELLE(), testUserId);
      lagekarte.addPoi('POI3', munichMgrs, PoiCategory.BEREITSTELLUNGSRAUM(), testUserId);
      lagekarte.addPoi('POI4', berlinMgrs, PoiCategory.GEFAHRENSTELLE(), testUserId);
      lagekarte.addPoi('POI5', hamburgMgrs, PoiCategory.BEREITSTELLUNGSRAUM(), testUserId);

      // When: Filter by BEREITSTELLUNGSRAUM
      const filtered = lagekarte.findPoisByCategory(PoiCategory.BEREITSTELLUNGSRAUM());

      // Then: 3 matches
      expect(filtered).toHaveLength(3);
      expect(filtered[0].name).toBe('POI1');
      expect(filtered[1].name).toBe('POI3');
      expect(filtered[2].name).toBe('POI5');
    });

    it('should work with all 5 categories', () => {
      // Given: POIs with all categories
      lagekarte.addPoi('POI1', berlinMgrs, PoiCategory.EINSATZSTELLE(), testUserId);
      lagekarte.addPoi('POI2', hamburgMgrs, PoiCategory.BEREITSTELLUNGSRAUM(), testUserId);
      lagekarte.addPoi('POI3', munichMgrs, PoiCategory.GEFAHRENSTELLE(), testUserId);
      lagekarte.addPoi('POI4', berlinMgrs, PoiCategory.WASSERENTNAHMESTELLE(), testUserId);
      lagekarte.addPoi('POI5', hamburgMgrs, PoiCategory.SONSTIGES(), testUserId);

      // When: Filter by each category
      const einsatzstellen = lagekarte.findPoisByCategory(PoiCategory.EINSATZSTELLE());
      const bereitstellungsraeume = lagekarte.findPoisByCategory(PoiCategory.BEREITSTELLUNGSRAUM());
      const gefahrenstellen = lagekarte.findPoisByCategory(PoiCategory.GEFAHRENSTELLE());
      const wasserentnahmestellen = lagekarte.findPoisByCategory(PoiCategory.WASSERENTNAHMESTELLE());
      const sonstiges = lagekarte.findPoisByCategory(PoiCategory.SONSTIGES());

      // Then: Each category has 1 POI
      expect(einsatzstellen).toHaveLength(1);
      expect(bereitstellungsraeume).toHaveLength(1);
      expect(gefahrenstellen).toHaveLength(1);
      expect(wasserentnahmestellen).toHaveLength(1);
      expect(sonstiges).toHaveLength(1);

      expect(einsatzstellen[0].name).toBe('POI1');
      expect(bereitstellungsraeume[0].name).toBe('POI2');
      expect(gefahrenstellen[0].name).toBe('POI3');
      expect(wasserentnahmestellen[0].name).toBe('POI4');
      expect(sonstiges[0].name).toBe('POI5');
    });
  });

  describe('Event Emission Tests', () => {
    let lagekarte: LagekarteAggregate;

    beforeEach(() => {
      lagekarte = LagekarteAggregate.create(testEinsatzId, testUserId).value as LagekarteAggregate;
      lagekarte.clearDomainEvents(); // Clear LagekarteCreatedEvent for cleaner event counting
    });

    it('should accumulate events from multiple operations', () => {
      // When: Perform multiple operations
      const poi1 = lagekarte.addPoi('POI1', berlinMgrs, testCategory, testUserId).value as Poi;
      const poi2 = lagekarte.addPoi('POI2', hamburgMgrs, testCategory, testUserId).value as Poi;
      lagekarte.updatePoiPosition(poi1.id, munichMgrs, testUserId);
      lagekarte.removePoi(poi2.id, testUserId);

      // Then: 4 events accumulated
      const events = lagekarte.getDomainEvents();
      expect(events).toHaveLength(4);
      expect(events[0]).toBeInstanceOf(PoiAddedEvent); // poi1
      expect(events[1]).toBeInstanceOf(PoiAddedEvent); // poi2
      expect(events[2]).toBeInstanceOf(PoiPositionUpdatedEvent); // poi1 update
      expect(events[3]).toBeInstanceOf(PoiRemovedEvent); // poi2 remove
    });

    it('should return all domain events via getDomainEvents', () => {
      // Given: Multiple operations
      const poi = lagekarte.addPoi('POI', berlinMgrs, testCategory, testUserId).value as Poi;
      lagekarte.updatePoiPosition(poi.id, hamburgMgrs, testUserId);

      // When: Get domain events
      const events = lagekarte.getDomainEvents();

      // Then: All events returned
      expect(events).toHaveLength(2);
      expect(events[0]).toBeInstanceOf(PoiAddedEvent);
      expect(events[1]).toBeInstanceOf(PoiPositionUpdatedEvent);
    });

    it('should clear all events via clearDomainEvents', () => {
      // Given: Multiple events
      lagekarte.addPoi('POI1', berlinMgrs, testCategory, testUserId);
      lagekarte.addPoi('POI2', hamburgMgrs, testCategory, testUserId);
      expect(lagekarte.getDomainEvents()).toHaveLength(2);

      // When: Clear events
      lagekarte.clearDomainEvents();

      // Then: No events
      expect(lagekarte.getDomainEvents()).toHaveLength(0);

      // New operations emit events again
      lagekarte.addPoi('POI3', munichMgrs, testCategory, testUserId);
      expect(lagekarte.getDomainEvents()).toHaveLength(1);
    });
  });
});
