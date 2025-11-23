import { UpdatePoiPositionCommand } from '../update-poi-position.command';

/**
 * Unit Tests für UpdatePoiPositionCommand.
 *
 * Testet Command-Validation (Factory Pattern) gemäß BDD Given-When-Then Pattern.
 * Keine Mock-Dependencies erforderlich (Value Object Pattern).
 *
 * Coverage Target: >90%
 * Testing Framework: Jest 30.2.0 mit @swc/jest
 */
describe('UpdatePoiPositionCommand', () => {
  describe('Valid Commands', () => {
    it('should create command with all required fields (Lat/Lng coordinate)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const poiId = 'poi-456';
      const newCoordinate = { lat: 52.5163, lng: 13.3777 };

      // When
      const result = UpdatePoiPositionCommand.create(lagekarteId, poiId, newCoordinate);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.lagekarteId).toBe(lagekarteId);
      expect(result.value!.poiId).toBe(poiId);
      expect(result.value!.newCoordinate).toEqual(newCoordinate);
    });

    it('should create command with all required fields (MGRS coordinate)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const poiId = 'poi-456';
      const newCoordinate = { mgrs: '32UNE8934004990' };

      // When
      const result = UpdatePoiPositionCommand.create(lagekarteId, poiId, newCoordinate);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.lagekarteId).toBe(lagekarteId);
      expect(result.value!.poiId).toBe(poiId);
      expect(result.value!.newCoordinate).toEqual(newCoordinate);
    });

    it('should accept lagekarteId with leading/trailing spaces (not trimmed in factory)', () => {
      // Given
      const lagekarteId = '  lagekarte-123  ';
      const poiId = 'poi-456';
      const newCoordinate = { lat: 52.5163, lng: 13.3777 };

      // When
      const result = UpdatePoiPositionCommand.create(lagekarteId, poiId, newCoordinate);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.lagekarteId).toBe(lagekarteId); // Factory does NOT trim
    });

    it('should accept poiId with leading/trailing spaces (not trimmed in factory)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const poiId = '  poi-456  ';
      const newCoordinate = { lat: 52.5163, lng: 13.3777 };

      // When
      const result = UpdatePoiPositionCommand.create(lagekarteId, poiId, newCoordinate);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.poiId).toBe(poiId); // Factory does NOT trim
    });
  });

  describe('Invalid Commands - lagekarteId validation', () => {
    it('should return failure when lagekarteId is undefined', () => {
      // Given/When
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const result = UpdatePoiPositionCommand.create(undefined as any, 'poi-456', { lat: 52.5163, lng: 13.3777 });

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('lagekarteId is required');
    });

    it('should return failure when lagekarteId is null', () => {
      // Given/When
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const result = UpdatePoiPositionCommand.create(null as any, 'poi-456', { lat: 52.5163, lng: 13.3777 });

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('lagekarteId is required');
    });

    it('should return failure when lagekarteId is empty string', () => {
      // Given/When
      const result = UpdatePoiPositionCommand.create('', 'poi-456', { lat: 52.5163, lng: 13.3777 });

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('lagekarteId is required');
    });

    it('should return failure when lagekarteId is only whitespace', () => {
      // Given/When
      const result = UpdatePoiPositionCommand.create('   ', 'poi-456', { lat: 52.5163, lng: 13.3777 });

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('lagekarteId is required');
    });
  });

  describe('Invalid Commands - poiId validation', () => {
    it('should return failure when poiId is undefined', () => {
      // Given/When
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const result = UpdatePoiPositionCommand.create('lagekarte-123', undefined as any, { lat: 52.5163, lng: 13.3777 });

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('poiId is required');
    });

    it('should return failure when poiId is null', () => {
      // Given/When
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const result = UpdatePoiPositionCommand.create('lagekarte-123', null as any, { lat: 52.5163, lng: 13.3777 });

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('poiId is required');
    });

    it('should return failure when poiId is empty string', () => {
      // Given/When
      const result = UpdatePoiPositionCommand.create('lagekarte-123', '', { lat: 52.5163, lng: 13.3777 });

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('poiId is required');
    });

    it('should return failure when poiId is only whitespace', () => {
      // Given/When
      const result = UpdatePoiPositionCommand.create('lagekarte-123', '   ', { lat: 52.5163, lng: 13.3777 });

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('poiId is required');
    });
  });

  describe('Invalid Commands - newCoordinate validation', () => {
    it('should return failure when newCoordinate is undefined', () => {
      // Given/When
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const result = UpdatePoiPositionCommand.create('lagekarte-123', 'poi-456', undefined as any);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('newCoordinate is required');
    });

    it('should return failure when newCoordinate is null', () => {
      // Given/When
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const result = UpdatePoiPositionCommand.create('lagekarte-123', 'poi-456', null as any);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('newCoordinate is required');
    });
  });

  describe('Edge Cases', () => {
    it('should accept boundary latitude values (North Pole)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const poiId = 'poi-456';
      const newCoordinate = { lat: 90, lng: 0 };

      // When
      const result = UpdatePoiPositionCommand.create(lagekarteId, poiId, newCoordinate);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.newCoordinate).toEqual({ lat: 90, lng: 0 });
    });

    it('should accept boundary latitude values (South Pole)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const poiId = 'poi-456';
      const newCoordinate = { lat: -90, lng: 0 };

      // When
      const result = UpdatePoiPositionCommand.create(lagekarteId, poiId, newCoordinate);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.newCoordinate).toEqual({ lat: -90, lng: 0 });
    });

    it('should accept boundary longitude values (International Date Line)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const poiId = 'poi-456';
      const newCoordinate = { lat: 0, lng: 180 };

      // When
      const result = UpdatePoiPositionCommand.create(lagekarteId, poiId, newCoordinate);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.newCoordinate).toEqual({ lat: 0, lng: 180 });
    });

    it('should accept MGRS string with various precisions', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const poiId = 'poi-456';
      const newCoordinate = { mgrs: '33UUU' }; // Low precision MGRS

      // When
      const result = UpdatePoiPositionCommand.create(lagekarteId, poiId, newCoordinate);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.newCoordinate).toEqual({ mgrs: '33UUU' });
    });

    it('should accept IDs with all valid nanoid characters', () => {
      // Given: Test with all types of valid nanoid characters (A-Za-z0-9_-)
      const lagekarteId = 'AZaz09_-0123456789XYZ'; // Exactly 21 chars
      const poiId = 'aZ09_-9876543210ZYXaz'; // Exactly 21 chars
      const newCoordinate = { lat: 52.5163, lng: 13.3777 };

      // When
      const result = UpdatePoiPositionCommand.create(lagekarteId, poiId, newCoordinate);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.lagekarteId).toBe(lagekarteId);
      expect(result.value!.poiId).toBe(poiId);
    });
  });
});
