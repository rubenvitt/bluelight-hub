import { describe, it, expect, beforeEach } from '@jest/globals';
import { Poi } from './poi.entity';
import { PoiId } from '@domain/value-objects/poi-id';
import { UserId } from '@domain/value-objects/user-id';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { GeoCoordinate } from '@domain/value-objects/geo-coordinate';

// Mock CUID2 for Jest compatibility (ESM module issue)
jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn(() => {
    // Generate valid CUID2 format: starts with lowercase letter, 20-30 lowercase alphanumeric chars
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'c';
    for (let i = 0; i < 24; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
  isCuid: jest.fn((id: string) => {
    if (typeof id !== 'string') return false;
    if (id.length < 20 || id.length > 30) return false;
    return /^[a-z][a-z0-9]+$/.test(id);
  }),
}));

/**
 * Helper function: Erstellt eine deterministische Test-CUID.
 * Nützlich für Tests, die vorhersagbare IDs benötigen.
 *
 * @param suffix - Optionaler Suffix für Eindeutigkeit zwischen Tests
 * @returns Gültige CUID2-formatierte Test-ID
 */
function _generateTestCuid(suffix = ''): string {
  const base = 'clw3h8x9y0000qwertyu';
  const padding = suffix.padEnd(5, '0').slice(0, 5);
  return base + padding;
}

describe('Poi Entity', () => {
  let testUserId: UserId;
  let testCategory: PoiCategory;
  let berlinMgrs: MgrsCoordinate;

  beforeEach(() => {
    // Setup: Create test data
    testUserId = UserId.create().value as UserId;
    testCategory = PoiCategory.EINSATZSTELLE();
    berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;
  });

  describe('Factory Pattern', () => {
    describe('create', () => {
      it('should create POI with all required properties', () => {
        // Given: POI data
        const name = 'Einsatzstelle Brandenburger Tor';
        const beschreibung = 'Haupteinsatzort';

        // When: Create POI
        const poi = Poi.create(name, berlinMgrs, testCategory, testUserId, beschreibung);

        // Then: All properties set correctly
        expect(poi.id).toBeInstanceOf(PoiId);
        expect(poi.name).toBe(name);
        expect(poi.coordinate).toBe(berlinMgrs);
        expect(poi.category).toBe(testCategory);
        expect(poi.createdBy).toBe(testUserId);
        expect(poi.beschreibung).toBe(beschreibung);
        expect(poi.createdAt).toBeInstanceOf(Date);
      });

      it('should auto-generate unique PoiId', () => {
        // Given: Same data
        const name = 'POI 1';

        // When: Create two POIs
        const poi1 = Poi.create(name, berlinMgrs, testCategory, testUserId);
        const poi2 = Poi.create(name, berlinMgrs, testCategory, testUserId);

        // Then: IDs are different
        expect(poi1.id.equals(poi2.id)).toBe(false);
        expect(poi1.id.toString()).not.toBe(poi2.id.toString());
      });

      it('should set createdAt to current date', () => {
        // Given: Current time
        const before = new Date();

        // When: Create POI (wait 1ms to ensure time difference)
        const poi = Poi.create('POI', berlinMgrs, testCategory, testUserId);

        // Then: createdAt is within last second
        const after = new Date();
        expect(poi.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(poi.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      });

      it('should store optional beschreibung', () => {
        // Given: POI with beschreibung
        const beschreibung = 'Wichtige Details zum Einsatzort';

        // When: Create POI
        const poi = Poi.create('POI', berlinMgrs, testCategory, testUserId, beschreibung);

        // Then: Beschreibung stored
        expect(poi.beschreibung).toBe(beschreibung);
      });

      it('should create POI without beschreibung', () => {
        // When: Create POI without beschreibung
        const poi = Poi.create('POI', berlinMgrs, testCategory, testUserId);

        // Then: Beschreibung is undefined
        expect(poi.beschreibung).toBeUndefined();
      });
    });
  });

  describe('Properties (Getters)', () => {
    it('should return all properties via getters', () => {
      // Given: POI data
      const name = 'Test POI';
      const beschreibung = 'Test Description';

      // When: Create POI
      const poi = Poi.create(name, berlinMgrs, testCategory, testUserId, beschreibung);

      // Then: All getters return correct values
      expect(poi.id).toBeInstanceOf(PoiId);
      expect(poi.name).toBe(name);
      expect(poi.coordinate).toBe(berlinMgrs);
      expect(poi.category).toBe(testCategory);
      expect(poi.beschreibung).toBe(beschreibung);
      expect(poi.createdBy).toBe(testUserId);
      expect(poi.createdAt).toBeInstanceOf(Date);
    });

    it('should store coordinate as MGRS (not Lat/Lng)', () => {
      // Given: MGRS coordinate
      const mgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;

      // When: Create POI
      const poi = Poi.create('POI', mgrs, testCategory, testUserId);

      // Then: Coordinate is MGRS
      expect(poi.coordinate).toBeInstanceOf(MgrsCoordinate);
      expect(poi.coordinate).toBe(mgrs);
      expect(poi.coordinate.value).toBe(mgrs.value);
      expect(poi.coordinate.gridZone).toBe('33U'); // Berlin is in Zone 33U
    });

    it('should return readonly properties (immutability check)', () => {
      // Given: POI
      const name = 'Original Name';
      const poi = Poi.create(name, berlinMgrs, testCategory, testUserId);

      // Then: Properties are readonly (TypeScript prevents direct assignment)
      // Note: TypeScript compile-time check, no runtime test needed
      expect(poi.name).toBe(name);
      expect(poi.createdBy).toBe(testUserId);
      expect(poi.category).toBe(testCategory);
    });
  });

  describe('Business Methods', () => {
    describe('updatePosition', () => {
      it('should update coordinate to new MGRS position', () => {
        // Given: POI at Berlin
        const poi = Poi.create('POI', berlinMgrs, testCategory, testUserId);
        const originalMgrs = poi.coordinate;

        // Given: New coordinate (Hamburg)
        const hamburgMgrs = MgrsCoordinate.fromLatLng(53.55, 10.0, 5).value as MgrsCoordinate;

        // When: Update position
        poi.updatePosition(hamburgMgrs);

        // Then: Coordinate updated
        expect(poi.coordinate).toBe(hamburgMgrs);
        expect(poi.coordinate.value).toBe(hamburgMgrs.value);
        expect(poi.coordinate).not.toBe(originalMgrs);
      });

      it('should preserve other properties after position update', () => {
        // Given: POI with beschreibung
        const name = 'Test POI';
        const beschreibung = 'Important Description';
        const poi = Poi.create(name, berlinMgrs, testCategory, testUserId, beschreibung);
        const originalId = poi.id;
        const originalName = poi.name;
        const originalCategory = poi.category;
        const originalCreatedBy = poi.createdBy;
        const originalCreatedAt = poi.createdAt;

        // When: Update position
        const newMgrs = MgrsCoordinate.fromLatLng(50.0, 12.0, 5).value as MgrsCoordinate;
        poi.updatePosition(newMgrs);

        // Then: Other properties unchanged
        expect(poi.id).toBe(originalId);
        expect(poi.name).toBe(originalName);
        expect(poi.category).toBe(originalCategory);
        expect(poi.beschreibung).toBe(beschreibung);
        expect(poi.createdBy).toBe(originalCreatedBy);
        expect(poi.createdAt).toBe(originalCreatedAt);
      });

      it('should allow multiple position updates', () => {
        // Given: POI at Berlin
        const poi = Poi.create('POI', berlinMgrs, testCategory, testUserId);

        // When: Update position multiple times
        const hamburgResult = MgrsCoordinate.fromLatLng(53.55, 10.0, 5);
        const munichResult = MgrsCoordinate.fromLatLng(48.13, 11.57, 5);
        const leipzigResult = MgrsCoordinate.fromLatLng(51.34, 12.37, 5); // Leipzig instead of Cologne (33U zone)

        expect(hamburgResult.isSuccess).toBe(true);
        expect(munichResult.isSuccess).toBe(true);
        expect(leipzigResult.isSuccess).toBe(true);

        const hamburg = hamburgResult.value as MgrsCoordinate;
        const munich = munichResult.value as MgrsCoordinate;
        const leipzig = leipzigResult.value as MgrsCoordinate;

        poi.updatePosition(hamburg);
        expect(poi.coordinate).toBe(hamburg);

        poi.updatePosition(munich);
        expect(poi.coordinate).toBe(munich);

        poi.updatePosition(leipzig);
        expect(poi.coordinate).toBe(leipzig);

        // Then: Final position is Leipzig
        expect(poi.coordinate.value).toBe(leipzig.value);
      });
    });

    describe('getLatLng', () => {
      it('should convert MGRS to GeoCoordinate', () => {
        // Given: POI at Berlin MGRS
        const poi = Poi.create('POI', berlinMgrs, testCategory, testUserId);

        // When: Get Lat/Lng
        const latLng = poi.getLatLng();

        // Then: Returns GeoCoordinate near Berlin
        expect(latLng).toBeInstanceOf(GeoCoordinate);
        expect(latLng.latitude).toBeCloseTo(52.52, 1); // ±0.1°
        expect(latLng.longitude).toBeCloseTo(13.4, 1); // ±0.1°
      });

      it('should return accurate Lat/Lng for Berlin MGRS', () => {
        // Given: Berlin coordinates
        const berlinLat = 52.52;
        const berlinLng = 13.4;
        const mgrs = MgrsCoordinate.fromLatLng(berlinLat, berlinLng, 5).value as MgrsCoordinate;
        const poi = Poi.create('Berlin POI', mgrs, testCategory, testUserId);

        // When: Convert back to Lat/Lng
        const latLng = poi.getLatLng();

        // Then: Should be very close to original (within MGRS precision)
        expect(latLng.latitude).toBeCloseTo(berlinLat, 4); // Within 0.0001° (~11m)
        expect(latLng.longitude).toBeCloseTo(berlinLng, 4);
      });

      it('should return accurate Lat/Lng for Hamburg MGRS', () => {
        // Given: Hamburg coordinates
        const hamburgLat = 53.55;
        const hamburgLng = 10.0;
        const mgrs = MgrsCoordinate.fromLatLng(hamburgLat, hamburgLng, 5).value as MgrsCoordinate;
        const poi = Poi.create('Hamburg POI', mgrs, testCategory, testUserId);

        // When: Convert back to Lat/Lng
        const latLng = poi.getLatLng();

        // Then: Should be very close to original
        expect(latLng.latitude).toBeCloseTo(hamburgLat, 4);
        expect(latLng.longitude).toBeCloseTo(hamburgLng, 4);
      });

      it('should return accurate Lat/Lng for Munich MGRS', () => {
        // Given: Munich coordinates
        const munichLat = 48.13;
        const munichLng = 11.57;
        const mgrs = MgrsCoordinate.fromLatLng(munichLat, munichLng, 5).value as MgrsCoordinate;
        const poi = Poi.create('Munich POI', mgrs, testCategory, testUserId);

        // When: Convert back to Lat/Lng
        const latLng = poi.getLatLng();

        // Then: Should be very close to original
        expect(latLng.latitude).toBeCloseTo(munichLat, 4);
        expect(latLng.longitude).toBeCloseTo(munichLng, 4);
      });

      it('should reflect updated position in getLatLng', () => {
        // Given: POI at Berlin
        const poi = Poi.create('POI', berlinMgrs, testCategory, testUserId);
        const berlinLatLng = poi.getLatLng();

        // When: Update to Hamburg
        const hamburgMgrs = MgrsCoordinate.fromLatLng(53.55, 10.0, 5).value as MgrsCoordinate;
        poi.updatePosition(hamburgMgrs);
        const hamburgLatLng = poi.getLatLng();

        // Then: Lat/Lng reflects new position
        expect(hamburgLatLng.latitude).toBeCloseTo(53.55, 1);
        expect(hamburgLatLng.longitude).toBeCloseTo(10.0, 1);
        expect(hamburgLatLng.latitude).not.toBeCloseTo(berlinLatLng.latitude, 1);
      });
    });

    describe('equals', () => {
      it('should return true for same POI instance', () => {
        // Given: POI
        const poi = Poi.create('POI', berlinMgrs, testCategory, testUserId);

        // When/Then: Compare with self
        expect(poi.equals(poi)).toBe(true);
      });

      it('should return true for POIs with same ID', () => {
        // Given: Two POI instances with same ID (via protected constructor)
        const id = PoiId.create().value as PoiId;
        // biome-ignore lint/suspicious/noExplicitAny: Test needs to bypass protected constructor
        const poi1 = new (Poi as any)(id, 'POI 1', berlinMgrs, testCategory, testUserId);
        // biome-ignore lint/suspicious/noExplicitAny: Test needs to bypass protected constructor
        const poi2 = new (Poi as any)(id, 'POI 2', berlinMgrs, testCategory, testUserId);

        // When/Then: Should be equal (ID-based equality)
        expect(poi1.equals(poi2)).toBe(true);
        expect(poi2.equals(poi1)).toBe(true);
      });

      it('should return false for POIs with different IDs', () => {
        // Given: Two POIs with different IDs
        const poi1 = Poi.create('POI 1', berlinMgrs, testCategory, testUserId);
        const poi2 = Poi.create('POI 2', berlinMgrs, testCategory, testUserId);

        // When/Then: Should not be equal
        expect(poi1.equals(poi2)).toBe(false);
        expect(poi2.equals(poi1)).toBe(false);
      });

      it('should return false for null/undefined', () => {
        // Given: POI
        const poi = Poi.create('POI', berlinMgrs, testCategory, testUserId);

        // When/Then: Compare with null/undefined
        // biome-ignore lint/suspicious/noExplicitAny: Test explicitly checks null handling
        expect(poi.equals(null as any)).toBe(false);
        expect(poi.equals(undefined)).toBe(false);
      });

      it('should ignore other properties (position, category, name)', () => {
        // Given: Two POIs with same ID but different properties
        const id = PoiId.create().value as PoiId;
        const hamburg = MgrsCoordinate.fromLatLng(53.55, 10.0, 5).value as MgrsCoordinate;
        const bereitstellungsraum = PoiCategory.BEREITSTELLUNGSRAUM();

        // biome-ignore lint/suspicious/noExplicitAny: Test needs to bypass protected constructor
        const poi1 = new (Poi as any)(id, 'POI 1', berlinMgrs, testCategory, testUserId);
        // biome-ignore lint/suspicious/noExplicitAny: Test needs to bypass protected constructor
        const poi2 = new (Poi as any)(id, 'POI 2', hamburg, bereitstellungsraum, testUserId);

        // When/Then: Should be equal despite different properties (ID-based equality)
        expect(poi1.equals(poi2)).toBe(true);
      });
    });
  });

  describe('Integration with Value Objects', () => {
    it('should work with different POI categories', () => {
      // Given: Different categories
      const einsatzstelle = PoiCategory.EINSATZSTELLE();
      const bereitstellungsraum = PoiCategory.BEREITSTELLUNGSRAUM();
      const gefahrenstelle = PoiCategory.GEFAHRENSTELLE();
      const wasserentnahmestelle = PoiCategory.WASSERENTNAHMESTELLE();
      const sonstiges = PoiCategory.SONSTIGES();

      // When: Create POIs with different categories
      const poi1 = Poi.create('POI 1', berlinMgrs, einsatzstelle, testUserId);
      const poi2 = Poi.create('POI 2', berlinMgrs, bereitstellungsraum, testUserId);
      const poi3 = Poi.create('POI 3', berlinMgrs, gefahrenstelle, testUserId);
      const poi4 = Poi.create('POI 4', berlinMgrs, wasserentnahmestelle, testUserId);
      const poi5 = Poi.create('POI 5', berlinMgrs, sonstiges, testUserId);

      // Then: Categories stored correctly
      expect(poi1.category.value).toBe('EINSATZSTELLE');
      expect(poi2.category.value).toBe('BEREITSTELLUNGSRAUM');
      expect(poi3.category.value).toBe('GEFAHRENSTELLE');
      expect(poi4.category.value).toBe('WASSERENTNAHMESTELLE');
      expect(poi5.category.value).toBe('SONSTIGES');
    });

    it('should work with MGRS coordinates in different German zones', () => {
      // Given: Coordinates in different German MGRS zones
      const berlinMgrs33U = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate; // Zone 33U (East)
      const hamburgMgrs32U = MgrsCoordinate.fromLatLng(53.55, 10.0, 5).value as MgrsCoordinate; // Zone 32U (West)
      const dresdenMgrs33U = MgrsCoordinate.fromLatLng(51.05, 13.74, 5).value as MgrsCoordinate; // Zone 33U (East)

      // When: Create POIs with different zones
      const poi1 = Poi.create('Berlin', berlinMgrs33U, testCategory, testUserId);
      const poi2 = Poi.create('Hamburg', hamburgMgrs32U, testCategory, testUserId);
      const poi3 = Poi.create('Dresden', dresdenMgrs33U, testCategory, testUserId);

      // Then: Zones stored correctly (Germany mainly uses 32U and 33U)
      expect(poi1.coordinate.gridZone).toBe('33U');
      expect(poi2.coordinate.gridZone).toBe('32U');
      expect(poi3.coordinate.gridZone).toBe('33U');
    });

    it('should preserve MGRS precision', () => {
      // Given: MGRS coordinate with 1m precision (precision=5)
      const highPrecisionMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;

      // When: Create POI
      const poi = Poi.create('Precise POI', highPrecisionMgrs, testCategory, testUserId);

      // Then: Precision preserved
      expect(poi.coordinate.precision).toBe(1); // 1 meter
      expect(poi.coordinate.value.length).toBe(15); // 3 chars zone + 2 chars square + 10 digits coords
    });
  });

  describe('Edge Cases', () => {
    it('should handle POI with empty beschreibung string', () => {
      // When: Create POI with empty string
      const poi = Poi.create('POI', berlinMgrs, testCategory, testUserId, '');

      // Then: Empty string stored (not undefined)
      expect(poi.beschreibung).toBe('');
    });

    it('should handle POI with very long name', () => {
      // Given: Very long name
      const longName = 'A'.repeat(500);

      // When: Create POI
      const poi = Poi.create(longName, berlinMgrs, testCategory, testUserId);

      // Then: Name stored completely
      expect(poi.name).toBe(longName);
      expect(poi.name.length).toBe(500);
    });

    it('should handle POI with special characters in name', () => {
      // Given: Name with special characters
      const specialName = 'Einsatzstelle äöü ß @ #1 - "Brandenburger Tor"';

      // When: Create POI
      const poi = Poi.create(specialName, berlinMgrs, testCategory, testUserId);

      // Then: Special characters preserved
      expect(poi.name).toBe(specialName);
    });

    it('should handle rapid position updates', () => {
      // Given: POI
      const poi = Poi.create('POI', berlinMgrs, testCategory, testUserId);

      // When: Update position 100 times rapidly
      for (let i = 0; i < 100; i++) {
        const lat = 48.0 + i * 0.01; // Incrementing latitude
        const lng = 11.0 + i * 0.01; // Incrementing longitude
        const newMgrs = MgrsCoordinate.fromLatLng(lat, lng, 5).value as MgrsCoordinate;
        poi.updatePosition(newMgrs);
      }

      // Then: Final position is correct
      const finalLatLng = poi.getLatLng();
      expect(finalLatLng.latitude).toBeCloseTo(48.0 + 99 * 0.01, 1);
      expect(finalLatLng.longitude).toBeCloseTo(11.0 + 99 * 0.01, 1);
    });
  });
});
