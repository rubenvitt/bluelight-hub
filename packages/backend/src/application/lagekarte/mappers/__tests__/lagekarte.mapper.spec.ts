import { LagekarteMapper } from '../lagekarte.mapper';
import { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';

// Mock nanoid for deterministic test IDs
jest.mock('nanoid/non-secure', () => ({
  nanoid: jest.fn((length?: number) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    const targetLength = length || 21;
    let result = '';
    for (let i = 0; i < targetLength; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
}));

describe('LagekarteMapper', () => {
  describe('toDto', () => {
    it('should convert LagekarteAggregate with no POIs to LagekarteDto', () => {
      // Arrange
      const einsatzId = EinsatzId.create().value as EinsatzId;
      const lagekarte = LagekarteAggregate.create(einsatzId).value as LagekarteAggregate;

      // Act
      const dto = LagekarteMapper.toDto(lagekarte);

      // Assert
      expect(dto.id).toBe(lagekarte.id.value);
      expect(dto.einsatzId).toBe(einsatzId.value);
      expect(dto.pois).toEqual([]);
      expect(dto.createdAt).toBeInstanceOf(Date);
      expect(dto.createdAt).toBe(lagekarte.createdAt);
    });

    it('should convert LagekarteAggregate with single POI', () => {
      // Arrange
      const einsatzId = EinsatzId.create().value as EinsatzId;
      const userId = UserId.create().value as UserId;
      const lagekarte = LagekarteAggregate.create(einsatzId).value as LagekarteAggregate;

      const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;
      const category = PoiCategory.EINSATZSTELLE();
      lagekarte.addPoi('Brandenburger Tor', berlinMgrs, category, userId);

      // Act
      const dto = LagekarteMapper.toDto(lagekarte);

      // Assert
      expect(dto.pois).toHaveLength(1);
      expect(dto.pois[0]?.name).toBe('Brandenburger Tor');
      expect(dto.pois[0]?.category).toBe('EINSATZSTELLE');
      expect(dto.pois[0]?.coordinate.mgrs).toBe(berlinMgrs.value);
      expect(dto.pois[0]?.coordinate.lat).toBeCloseTo(52.52, 4);
      expect(dto.pois[0]?.coordinate.lng).toBeCloseTo(13.4, 4);
    });

    it('should convert LagekarteAggregate with multiple POIs', () => {
      // Arrange
      const einsatzId = EinsatzId.create().value as EinsatzId;
      const userId = UserId.create().value as UserId;
      const lagekarte = LagekarteAggregate.create(einsatzId).value as LagekarteAggregate;

      const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;
      const hamburgMgrs = MgrsCoordinate.fromLatLng(53.55, 10.0, 5).value as MgrsCoordinate;
      const munichMgrs = MgrsCoordinate.fromLatLng(48.14, 11.58, 5).value as MgrsCoordinate;

      lagekarte.addPoi('Brandenburger Tor', berlinMgrs, PoiCategory.EINSATZSTELLE(), userId);
      lagekarte.addPoi('Rathaus Hamburg', hamburgMgrs, PoiCategory.BEREITSTELLUNGSRAUM(), userId);
      lagekarte.addPoi('Marienplatz', munichMgrs, PoiCategory.GEFAHRENSTELLE(), userId, 'Menschenansammlung');

      // Act
      const dto = LagekarteMapper.toDto(lagekarte);

      // Assert: All POIs mapped
      expect(dto.pois).toHaveLength(3);

      // Assert: First POI
      expect(dto.pois[0]?.name).toBe('Brandenburger Tor');
      expect(dto.pois[0]?.category).toBe('EINSATZSTELLE');
      expect(dto.pois[0]?.coordinate.lat).toBeCloseTo(52.52, 4);

      // Assert: Second POI
      expect(dto.pois[1]?.name).toBe('Rathaus Hamburg');
      expect(dto.pois[1]?.category).toBe('BEREITSTELLUNGSRAUM');
      expect(dto.pois[1]?.coordinate.lat).toBeCloseTo(53.55, 4);

      // Assert: Third POI with beschreibung
      expect(dto.pois[2]?.name).toBe('Marienplatz');
      expect(dto.pois[2]?.category).toBe('GEFAHRENSTELLE');
      expect(dto.pois[2]?.coordinate.lat).toBeCloseTo(48.14, 4);
      expect(dto.pois[2]?.beschreibung).toBe('Menschenansammlung');
    });

    it('should preserve all POI properties during mapping', () => {
      // Arrange
      const einsatzId = EinsatzId.create().value as EinsatzId;
      const userId = UserId.create().value as UserId;
      const lagekarte = LagekarteAggregate.create(einsatzId).value as LagekarteAggregate;

      const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;
      const poiResult = lagekarte.addPoi('Test POI', berlinMgrs, PoiCategory.WASSERENTNAHMESTELLE(), userId, 'Test Description');
      const poi = poiResult.value;

      // Act
      const dto = LagekarteMapper.toDto(lagekarte);

      // Assert: All POI properties mapped correctly
      expect(dto.pois[0]?.id).toBe(poi?.id.value);
      expect(dto.pois[0]?.name).toBe('Test POI');
      expect(dto.pois[0]?.category).toBe('WASSERENTNAHMESTELLE');
      expect(dto.pois[0]?.coordinate.mgrs).toBe(berlinMgrs.value);
      expect(dto.pois[0]?.coordinate.lat).toBeCloseTo(52.52, 4);
      expect(dto.pois[0]?.coordinate.lng).toBeCloseTo(13.4, 4);
      expect(dto.pois[0]?.beschreibung).toBe('Test Description');
    });

    it('should not expose domain events in DTO', () => {
      // Arrange
      const einsatzId = EinsatzId.create().value as EinsatzId;
      const userId = UserId.create().value as UserId;
      const lagekarte = LagekarteAggregate.create(einsatzId).value as LagekarteAggregate;

      const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;
      lagekarte.addPoi('Test POI', berlinMgrs, PoiCategory.EINSATZSTELLE(), userId);

      // Verify aggregate has events
      expect(lagekarte.getDomainEvents()).toHaveLength(1);

      // Act
      const dto = LagekarteMapper.toDto(lagekarte);

      // Assert: DTO should NOT have domain events
      expect('getDomainEvents' in dto).toBe(false);
      expect(Object.keys(dto)).not.toContain('domainEvents');
      expect(Object.keys(dto)).toEqual(['id', 'einsatzId', 'pois', 'createdAt']);
    });

    it('should produce consistent output for same aggregate', () => {
      // Arrange
      const einsatzId = EinsatzId.create().value as EinsatzId;
      const userId = UserId.create().value as UserId;
      const lagekarte = LagekarteAggregate.create(einsatzId).value as LagekarteAggregate;

      const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;
      lagekarte.addPoi('Test POI', berlinMgrs, PoiCategory.EINSATZSTELLE(), userId);

      // Act: Convert same aggregate twice
      const dto1 = LagekarteMapper.toDto(lagekarte);
      const dto2 = LagekarteMapper.toDto(lagekarte);

      // Assert: Results should be identical
      expect(dto1).toEqual(dto2);
    });

    it('should handle POIs with all categories', () => {
      // Arrange
      const einsatzId = EinsatzId.create().value as EinsatzId;
      const userId = UserId.create().value as UserId;
      const lagekarte = LagekarteAggregate.create(einsatzId).value as LagekarteAggregate;

      const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate;

      // Add POIs of each category
      lagekarte.addPoi('POI 1', berlinMgrs, PoiCategory.EINSATZSTELLE(), userId);
      lagekarte.addPoi('POI 2', berlinMgrs, PoiCategory.BEREITSTELLUNGSRAUM(), userId);
      lagekarte.addPoi('POI 3', berlinMgrs, PoiCategory.GEFAHRENSTELLE(), userId);
      lagekarte.addPoi('POI 4', berlinMgrs, PoiCategory.WASSERENTNAHMESTELLE(), userId);
      lagekarte.addPoi('POI 5', berlinMgrs, PoiCategory.SONSTIGES(), userId);

      // Act
      const dto = LagekarteMapper.toDto(lagekarte);

      // Assert: All categories mapped correctly
      expect(dto.pois).toHaveLength(5);
      expect(dto.pois[0]?.category).toBe('EINSATZSTELLE');
      expect(dto.pois[1]?.category).toBe('BEREITSTELLUNGSRAUM');
      expect(dto.pois[2]?.category).toBe('GEFAHRENSTELLE');
      expect(dto.pois[3]?.category).toBe('WASSERENTNAHMESTELLE');
      expect(dto.pois[4]?.category).toBe('SONSTIGES');
    });
  });
});
