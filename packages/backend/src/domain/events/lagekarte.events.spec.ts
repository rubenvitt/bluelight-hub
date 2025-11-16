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

import { PoiAddedEvent } from './poi-added.event';
import { PoiRemovedEvent } from './poi-removed.event';
import { PoiPositionUpdatedEvent } from './poi-position-updated.event';
import { DomainEvent } from '@domain/common/domain-event';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { PoiId } from '@domain/value-objects/poi-id';
import { UserId } from '@domain/value-objects/user-id';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { PoiCategory } from '@domain/value-objects/poi-category';

describe('Lagekarte Domain Events', () => {
  let testLagekarteId: LagekarteId;
  let testPoiId: PoiId;
  let testUserId: UserId;
  let testCategory: PoiCategory;
  let berlinMgrs: MgrsCoordinate;
  let hamburgMgrs: MgrsCoordinate;

  beforeEach(() => {
    // Create test fixtures
    testLagekarteId = LagekarteId.create().value!;
    testPoiId = PoiId.create().value!;
    testUserId = UserId.create().value!;
    testCategory = PoiCategory.EINSATZSTELLE();

    // Create MGRS coordinates for Berlin and Hamburg
    // Berlin: 52.52°N, 13.40°E → Zone 33U
    berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value!;

    // Hamburg: 53.55°N, 10.00°E → Zone 32U
    hamburgMgrs = MgrsCoordinate.fromLatLng(53.55, 10.0, 5).value!;
  });

  describe('PoiAddedEvent', () => {
    it('should create event with all properties', () => {
      // Given: Event data
      const name = 'Einsatzstelle Hauptbahnhof';

      // When: Create event
      const event = new PoiAddedEvent(testLagekarteId, testPoiId, name, berlinMgrs, testCategory, testUserId);

      // Then: All properties set correctly
      expect(event.lagekarteId).toBe(testLagekarteId);
      expect(event.poiId).toBe(testPoiId);
      expect(event.name).toBe(name);
      expect(event.coordinate).toBe(berlinMgrs);
      expect(event.category).toBe(testCategory);
      expect(event.createdBy).toBe(testUserId);
      expect(event.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(event.occurredAt).toBeInstanceOf(Date);
    });

    it('should auto-generate eventId (nanoid)', () => {
      // Given/When: Create event
      const event = new PoiAddedEvent(testLagekarteId, testPoiId, 'POI', berlinMgrs, testCategory, testUserId);

      // Then: eventId is auto-generated nanoid (21 chars)
      expect(event.eventId).toBeDefined();
      expect(event.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(event.eventId.length).toBe(21);
    });

    it('should auto-generate occurredAt timestamp', () => {
      // Given: Time window
      const before = new Date();

      // When: Create event
      const event = new PoiAddedEvent(testLagekarteId, testPoiId, 'POI', berlinMgrs, testCategory, testUserId);

      // Then: occurredAt is recent (within 1 second)
      const after = new Date();
      expect(event.occurredAt).toBeInstanceOf(Date);
      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should have correct eventName', () => {
      // Given/When: Event class
      // Then: Event name is correct (lowercase dot-separated, past tense)
      expect(PoiAddedEvent.eventName()).toBe('lagekarte.poi_added');
    });

    it('should store MGRS coordinate (not Lat/Lng)', () => {
      // Given: Event with MGRS coordinate
      const event = new PoiAddedEvent(testLagekarteId, testPoiId, 'POI', berlinMgrs, testCategory, testUserId);

      // Then: Coordinate is MGRS (Berlin is in Zone 33U)
      expect(event.coordinate).toBeInstanceOf(MgrsCoordinate);
      expect(event.coordinate.value).toMatch(/^33U/); // Berlin zone
      expect(event.coordinate.gridZone).toBe('33U');
    });

    it('should generate unique eventIds for different events', () => {
      // Given: Two events created sequentially
      const event1 = new PoiAddedEvent(testLagekarteId, testPoiId, 'POI1', berlinMgrs, testCategory, testUserId);
      const event2 = new PoiAddedEvent(testLagekarteId, testPoiId, 'POI2', berlinMgrs, testCategory, testUserId);

      // When/Then: All eventIds are unique
      expect(event1.eventId).not.toBe(event2.eventId);
      expect(event1.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(event2.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
    });

    it('should have readonly properties (immutability)', () => {
      // Given: Event instance
      const event = new PoiAddedEvent(testLagekarteId, testPoiId, 'POI', berlinMgrs, testCategory, testUserId);

      // When/Then: Properties are accessible (TypeScript enforces readonly at compile-time)
      expect(event.lagekarteId).toBeDefined();
      expect(event.poiId).toBeDefined();
      expect(event.name).toBeDefined();
      expect(event.coordinate).toBeDefined();
      expect(event.category).toBeDefined();
      expect(event.createdBy).toBeDefined();
      expect(event.eventId).toBeDefined();
      expect(event.occurredAt).toBeDefined();
    });

    it('should work with typed value objects', () => {
      // Given: Event with typed value objects
      const event = new PoiAddedEvent(testLagekarteId, testPoiId, 'POI', berlinMgrs, testCategory, testUserId);

      // When/Then: Types are preserved
      expect(event.lagekarteId).toBeInstanceOf(LagekarteId);
      expect(event.poiId).toBeInstanceOf(PoiId);
      expect(event.coordinate).toBeInstanceOf(MgrsCoordinate);
      expect(event.category).toBeInstanceOf(PoiCategory);
      expect(event.createdBy).toBeInstanceOf(UserId);
    });

    it('should support all POI categories', () => {
      // Given: Different POI categories
      const categories = [PoiCategory.EINSATZSTELLE(), PoiCategory.BEREITSTELLUNGSRAUM(), PoiCategory.GEFAHRENSTELLE(), PoiCategory.WASSERENTNAHMESTELLE(), PoiCategory.SONSTIGES()];

      // When: Create events for each category
      const events = categories.map((cat) => new PoiAddedEvent(testLagekarteId, testPoiId, 'POI', berlinMgrs, cat, testUserId));

      // Then: All categories are supported
      expect(events[0].category.value).toBe('EINSATZSTELLE');
      expect(events[1].category.value).toBe('BEREITSTELLUNGSRAUM');
      expect(events[2].category.value).toBe('GEFAHRENSTELLE');
      expect(events[3].category.value).toBe('WASSERENTNAHMESTELLE');
      expect(events[4].category.value).toBe('SONSTIGES');
    });
  });

  describe('PoiRemovedEvent', () => {
    it('should create event with required properties', () => {
      // When: Create event
      const event = new PoiRemovedEvent(testLagekarteId, testPoiId, testUserId);

      // Then: Properties set correctly
      expect(event.lagekarteId).toBe(testLagekarteId);
      expect(event.poiId).toBe(testPoiId);
      expect(event.removedBy).toBe(testUserId);
      expect(event.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(event.occurredAt).toBeInstanceOf(Date);
    });

    it('should auto-generate eventId and occurredAt', () => {
      // Given: Time window
      const before = new Date();

      // When: Create event
      const event = new PoiRemovedEvent(testLagekarteId, testPoiId, testUserId);

      // Then: Auto-generated fields are set
      const after = new Date();
      expect(event.eventId).toBeDefined();
      expect(event.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(event.occurredAt).toBeInstanceOf(Date);
      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should have correct eventName', () => {
      // Given/When: Event class
      // Then: Event name is correct
      expect(PoiRemovedEvent.eventName()).toBe('lagekarte.poi_removed');
    });

    it('should NOT contain deleted POI data (name, coordinate)', () => {
      // When: Create event
      const event = new PoiRemovedEvent(testLagekarteId, testPoiId, testUserId);

      // Then: Event only has minimal data (IDs + removedBy)
      // No name, coordinate, or category properties
      expect(event).not.toHaveProperty('name');
      expect(event).not.toHaveProperty('coordinate');
      expect(event).not.toHaveProperty('category');

      // Only essential properties exist
      expect(event.lagekarteId).toBeDefined();
      expect(event.poiId).toBeDefined();
      expect(event.removedBy).toBeDefined();
      expect(event.eventId).toBeDefined();
      expect(event.occurredAt).toBeDefined();
    });

    it('should generate unique eventIds for different events', () => {
      // Given: Two events created sequentially
      const event1 = new PoiRemovedEvent(testLagekarteId, testPoiId, testUserId);
      const event2 = new PoiRemovedEvent(testLagekarteId, testPoiId, testUserId);

      // When/Then: All eventIds are unique
      expect(event1.eventId).not.toBe(event2.eventId);
      expect(event1.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(event2.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
    });

    it('should work with typed value objects', () => {
      // Given: Event with typed value objects
      const event = new PoiRemovedEvent(testLagekarteId, testPoiId, testUserId);

      // When/Then: Types are preserved
      expect(event.lagekarteId).toBeInstanceOf(LagekarteId);
      expect(event.poiId).toBeInstanceOf(PoiId);
      expect(event.removedBy).toBeInstanceOf(UserId);
    });
  });

  describe('PoiPositionUpdatedEvent', () => {
    it('should create event with old and new coordinates', () => {
      // Given: Position change Berlin → Hamburg
      const event = new PoiPositionUpdatedEvent(testLagekarteId, testPoiId, berlinMgrs, hamburgMgrs, testUserId);

      // Then: Both coordinates stored
      expect(event.lagekarteId).toBe(testLagekarteId);
      expect(event.poiId).toBe(testPoiId);
      expect(event.oldCoordinate).toBe(berlinMgrs);
      expect(event.newCoordinate).toBe(hamburgMgrs);
      expect(event.updatedBy).toBe(testUserId);
      expect(event.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(event.occurredAt).toBeInstanceOf(Date);
    });

    it('should auto-generate eventId and occurredAt', () => {
      // Given: Time window
      const before = new Date();

      // When: Create event
      const event = new PoiPositionUpdatedEvent(testLagekarteId, testPoiId, berlinMgrs, hamburgMgrs, testUserId);

      // Then: Auto-generated fields are set
      const after = new Date();
      expect(event.eventId).toBeDefined();
      expect(event.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(event.occurredAt).toBeInstanceOf(Date);
      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should have correct eventName', () => {
      // Given/When: Event class
      // Then: Event name is correct
      expect(PoiPositionUpdatedEvent.eventName()).toBe('lagekarte.poi_position_updated');
    });

    it('should store both coordinates as MGRS (not Lat/Lng)', () => {
      // Given: Event with position change
      const event = new PoiPositionUpdatedEvent(testLagekarteId, testPoiId, berlinMgrs, hamburgMgrs, testUserId);

      // Then: Both coordinates are MGRS
      expect(event.oldCoordinate).toBeInstanceOf(MgrsCoordinate);
      expect(event.newCoordinate).toBeInstanceOf(MgrsCoordinate);

      // Old coordinate is Berlin (Zone 33U)
      expect(event.oldCoordinate.value).toMatch(/^33U/);
      expect(event.oldCoordinate.gridZone).toBe('33U');

      // New coordinate is Hamburg (Zone 32U)
      expect(event.newCoordinate.value).toMatch(/^32U/);
      expect(event.newCoordinate.gridZone).toBe('32U');
    });

    it('should allow distance calculation from event data (no DB query needed)', () => {
      // Given: Event with position change Berlin → Hamburg
      const event = new PoiPositionUpdatedEvent(testLagekarteId, testPoiId, berlinMgrs, hamburgMgrs, testUserId);

      // When: Calculate distance directly from event
      const distanceM = event.oldCoordinate.distanceTo(event.newCoordinate);
      const distanceKm = distanceM / 1000;

      // Then: Distance ≈ 255km (Berlin to Hamburg)
      // No database query needed - event contains all data!
      expect(distanceKm).toBeGreaterThan(250);
      expect(distanceKm).toBeLessThan(260);
    });

    it('should generate unique eventIds for different events', () => {
      // Given: Two events created sequentially
      const event1 = new PoiPositionUpdatedEvent(testLagekarteId, testPoiId, berlinMgrs, hamburgMgrs, testUserId);
      const event2 = new PoiPositionUpdatedEvent(testLagekarteId, testPoiId, berlinMgrs, hamburgMgrs, testUserId);

      // When/Then: All eventIds are unique
      expect(event1.eventId).not.toBe(event2.eventId);
      expect(event1.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(event2.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
    });

    it('should work with typed value objects', () => {
      // Given: Event with typed value objects
      const event = new PoiPositionUpdatedEvent(testLagekarteId, testPoiId, berlinMgrs, hamburgMgrs, testUserId);

      // When/Then: Types are preserved
      expect(event.lagekarteId).toBeInstanceOf(LagekarteId);
      expect(event.poiId).toBeInstanceOf(PoiId);
      expect(event.oldCoordinate).toBeInstanceOf(MgrsCoordinate);
      expect(event.newCoordinate).toBeInstanceOf(MgrsCoordinate);
      expect(event.updatedBy).toBeInstanceOf(UserId);
    });

    it('should preserve coordinate transition information', () => {
      // Given: Position change Berlin → Hamburg
      const event = new PoiPositionUpdatedEvent(testLagekarteId, testPoiId, berlinMgrs, hamburgMgrs, testUserId);

      // When/Then: Transition is preserved (old ≠ new)
      expect(event.oldCoordinate.equals(event.newCoordinate)).toBe(false);
      expect(event.oldCoordinate.gridZone).not.toBe(event.newCoordinate.gridZone); // Different zones
    });

    it('should allow old and new coordinates to be in same grid zone', () => {
      // Given: Two different coordinates in same zone (both Berlin area, Zone 33U)
      const berlin1 = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value!; // Central Berlin
      const berlin2 = MgrsCoordinate.fromLatLng(52.55, 13.45, 5).value!; // North Berlin

      // When: Create event
      const event = new PoiPositionUpdatedEvent(testLagekarteId, testPoiId, berlin1, berlin2, testUserId);

      // Then: Both in same zone but different positions
      expect(event.oldCoordinate.gridZone).toBe('33U');
      expect(event.newCoordinate.gridZone).toBe('33U');
      expect(event.oldCoordinate.equals(event.newCoordinate)).toBe(false);

      // Distance calculation still works
      const distanceM = event.oldCoordinate.distanceTo(event.newCoordinate);
      expect(distanceM).toBeGreaterThan(0);
      expect(distanceM).toBeLessThan(10000); // Less than 10km (both in Berlin)
    });
  });

  describe('Cross-Event Tests', () => {
    it('should generate unique eventIds across all event types', () => {
      // Given: Multiple events of different types
      const event1 = new PoiAddedEvent(testLagekarteId, testPoiId, 'POI1', berlinMgrs, testCategory, testUserId);
      const event2 = new PoiRemovedEvent(testLagekarteId, testPoiId, testUserId);
      const event3 = new PoiPositionUpdatedEvent(testLagekarteId, testPoiId, berlinMgrs, hamburgMgrs, testUserId);

      // Then: All eventIds are unique
      expect(event1.eventId).not.toBe(event2.eventId);
      expect(event1.eventId).not.toBe(event3.eventId);
      expect(event2.eventId).not.toBe(event3.eventId);
    });

    it('should extend DomainEvent base class', () => {
      // Given: Events of all types
      const event1 = new PoiAddedEvent(testLagekarteId, testPoiId, 'POI', berlinMgrs, testCategory, testUserId);
      const event2 = new PoiRemovedEvent(testLagekarteId, testPoiId, testUserId);
      const event3 = new PoiPositionUpdatedEvent(testLagekarteId, testPoiId, berlinMgrs, hamburgMgrs, testUserId);

      // Then: All extend DomainEvent
      expect(event1).toBeInstanceOf(DomainEvent);
      expect(event2).toBeInstanceOf(DomainEvent);
      expect(event3).toBeInstanceOf(DomainEvent);
    });

    it('should have unique event names', () => {
      // Given/When: Event classes
      // Then: All event names are unique
      const names = [PoiAddedEvent.eventName(), PoiRemovedEvent.eventName(), PoiPositionUpdatedEvent.eventName()];

      expect(names[0]).toBe('lagekarte.poi_added');
      expect(names[1]).toBe('lagekarte.poi_removed');
      expect(names[2]).toBe('lagekarte.poi_position_updated');

      // All names are unique
      expect(new Set(names).size).toBe(3);
    });

    it('should follow naming convention (namespace.action_past_tense)', () => {
      // Given: All event names
      const names = [PoiAddedEvent.eventName(), PoiRemovedEvent.eventName(), PoiPositionUpdatedEvent.eventName()];

      // Then: All follow convention: lowercase dot-separated, past tense
      for (const name of names) {
        expect(name).toMatch(/^lagekarte\.[a-z_]+$/); // namespace.action
        expect(name.startsWith('lagekarte.')).toBe(true); // Namespace
        expect(name).not.toContain(' '); // No spaces
        expect(name).toBe(name.toLowerCase()); // Lowercase
      }
    });

    it('should return default event version (1)', () => {
      // Given/When: Event classes
      // Then: All return default version 1
      expect(PoiAddedEvent.eventVersion()).toBe(1);
      expect(PoiRemovedEvent.eventVersion()).toBe(1);
      expect(PoiPositionUpdatedEvent.eventVersion()).toBe(1);
    });
  });
});
