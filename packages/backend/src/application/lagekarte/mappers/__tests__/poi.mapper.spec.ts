import { PoiMapper } from '../poi.mapper';
import { Poi } from '@domain/entities/poi.entity';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { UserId } from '@domain/value-objects/user-id';

// Mock CUID2 for deterministic test IDs (CUID2 format: 20-30 chars, lowercase a-z0-9, starts with letter)
jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn(() => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'c'; // CUID2 always starts with a letter
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

describe('PoiMapper', () => {
  describe('toDto', () => {
    it('should convert Poi entity to PoiDto with MGRS and Lat/Lng', () => {
      // Arrange: Berlin coordinates (52.52°N, 13.40°E)
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;
      const category = PoiCategory.EINSATZSTELLE();
      const userId = UserId.create().value as UserId;

      const poi = Poi.create('Brandenburger Tor', berlinMgrs, category, userId);

      // Act
      const dto = PoiMapper.toDto(poi);

      // Assert: Basic properties
      expect(dto.id).toBe(poi.id.value);
      expect(dto.name).toBe('Brandenburger Tor');
      expect(dto.category).toBe('EINSATZSTELLE');

      // Assert: MGRS coordinate
      expect(dto.coordinate.mgrs).toBe(berlinMgrs.value);

      // Assert: Lat/Lng conversion accuracy (±0.0001° tolerance = ~11m)
      expect(dto.coordinate.lat).toBeCloseTo(52.52, 4);
      expect(dto.coordinate.lng).toBeCloseTo(13.4, 4);

      // Assert: No beschreibung
      expect(dto.beschreibung).toBeUndefined();
    });

    it('should convert MGRS to Lat/Lng accurately for Hamburg', () => {
      // Arrange: Hamburg coordinates (53.55°N, 10.00°E)
      const hamburgMgrs = MgrsCoordinate.fromLatLng(53.55, 10.0, 5).value as MgrsCoordinate;
      const category = PoiCategory.BEREITSTELLUNGSRAUM();
      const userId = UserId.create().value as UserId;

      const poi = Poi.create('Rathaus Hamburg', hamburgMgrs, category, userId);

      // Act
      const dto = PoiMapper.toDto(poi);

      // Assert: Both formats present
      expect(dto.coordinate.mgrs).toBe(hamburgMgrs.value);
      expect(dto.coordinate.lat).toBeCloseTo(53.55, 4);
      expect(dto.coordinate.lng).toBeCloseTo(10.0, 4);
    });

    it('should include beschreibung when present', () => {
      // Arrange
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;
      const category = PoiCategory.GEFAHRENSTELLE();
      const userId = UserId.create().value as UserId;

      const poi = Poi.create('Gefahrenstelle', berlinMgrs, category, userId, 'Überflutete Straße - Zugang gesperrt');

      // Act
      const dto = PoiMapper.toDto(poi);

      // Assert
      expect(dto.beschreibung).toBe('Überflutete Straße - Zugang gesperrt');
    });

    it('should map all POI categories correctly', () => {
      const testCases = [
        { category: PoiCategory.EINSATZSTELLE(), expectedValue: 'EINSATZSTELLE' },
        { category: PoiCategory.BEREITSTELLUNGSRAUM(), expectedValue: 'BEREITSTELLUNGSRAUM' },
        { category: PoiCategory.GEFAHRENSTELLE(), expectedValue: 'GEFAHRENSTELLE' },
        { category: PoiCategory.WASSERENTNAHMESTELLE(), expectedValue: 'WASSERENTNAHMESTELLE' },
        { category: PoiCategory.SONSTIGES(), expectedValue: 'SONSTIGES' },
      ];

      const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;
      const userId = UserId.create().value as UserId;

      for (const testCase of testCases) {
        const poi = Poi.create('Test POI', berlinMgrs, testCase.category, userId);
        const dto = PoiMapper.toDto(poi);

        expect(dto.category).toBe(testCase.expectedValue);
      }
    });

    it('should handle POI without beschreibung', () => {
      // Arrange: Create POI with undefined beschreibung
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;
      const category = PoiCategory.EINSATZSTELLE();
      const userId = UserId.create().value as UserId;

      const poi = Poi.create('Test POI', berlinMgrs, category, userId); // No beschreibung

      // Act
      const dto = PoiMapper.toDto(poi);

      // Assert: beschreibung should be undefined
      expect(dto.beschreibung).toBeUndefined();
      expect('beschreibung' in dto).toBe(true); // Property exists
    });

    it('should preserve POI ID in DTO', () => {
      // Arrange
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;
      const category = PoiCategory.EINSATZSTELLE();
      const userId = UserId.create().value as UserId;

      const poi = Poi.create('Test POI', berlinMgrs, category, userId);

      // Act
      const dto = PoiMapper.toDto(poi);

      // Assert: ID is string (CUID format)
      expect(typeof dto.id).toBe('string');
      expect(dto.id.length).toBeGreaterThan(0);
      expect(dto.id).toBe(poi.id.value);
    });

    it('should produce consistent output for same POI', () => {
      // Arrange
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;
      const category = PoiCategory.EINSATZSTELLE();
      const userId = UserId.create().value as UserId;

      const poi = Poi.create('Test POI', berlinMgrs, category, userId, 'Test Description');

      // Act: Convert same POI twice
      const dto1 = PoiMapper.toDto(poi);
      const dto2 = PoiMapper.toDto(poi);

      // Assert: Results should be identical
      expect(dto1).toEqual(dto2);
    });
  });
});
