import { UpdatePoiPositionCommand } from '../update-poi-position.command';

/**
 * Unit Tests für UpdatePoiPositionCommand.
 *
 * Testet Command-Validation (Constructor Guards) gemäß BDD Given-When-Then Pattern.
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
      const command = new UpdatePoiPositionCommand(lagekarteId, poiId, newCoordinate);

      // Then
      expect(command.lagekarteId).toBe(lagekarteId);
      expect(command.poiId).toBe(poiId);
      expect(command.newCoordinate).toEqual(newCoordinate);
    });

    it('should create command with all required fields (MGRS coordinate)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const poiId = 'poi-456';
      const newCoordinate = { mgrs: '32UNE8934004990' };

      // When
      const command = new UpdatePoiPositionCommand(lagekarteId, poiId, newCoordinate);

      // Then
      expect(command.lagekarteId).toBe(lagekarteId);
      expect(command.poiId).toBe(poiId);
      expect(command.newCoordinate).toEqual(newCoordinate);
    });

    it('should accept lagekarteId with leading/trailing spaces (not trimmed in constructor)', () => {
      // Given
      const lagekarteId = '  lagekarte-123  ';
      const poiId = 'poi-456';
      const newCoordinate = { lat: 52.5163, lng: 13.3777 };

      // When
      const command = new UpdatePoiPositionCommand(lagekarteId, poiId, newCoordinate);

      // Then
      expect(command.lagekarteId).toBe(lagekarteId); // Constructor does NOT trim
    });

    it('should accept poiId with leading/trailing spaces (not trimmed in constructor)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const poiId = '  poi-456  ';
      const newCoordinate = { lat: 52.5163, lng: 13.3777 };

      // When
      const command = new UpdatePoiPositionCommand(lagekarteId, poiId, newCoordinate);

      // Then
      expect(command.poiId).toBe(poiId); // Constructor does NOT trim
    });
  });

  describe('Invalid Commands - lagekarteId validation', () => {
    it('should throw error when lagekarteId is undefined', () => {
      // Given/When/Then
      expect(() => new UpdatePoiPositionCommand(undefined as any, 'poi-456', { lat: 52.5163, lng: 13.3777 })).toThrow('lagekarteId is required');
    });

    it('should throw error when lagekarteId is null', () => {
      // Given/When/Then
      expect(() => new UpdatePoiPositionCommand(null as any, 'poi-456', { lat: 52.5163, lng: 13.3777 })).toThrow('lagekarteId is required');
    });

    it('should throw error when lagekarteId is empty string', () => {
      // Given/When/Then
      expect(() => new UpdatePoiPositionCommand('', 'poi-456', { lat: 52.5163, lng: 13.3777 })).toThrow('lagekarteId is required');
    });

    it('should throw error when lagekarteId is only whitespace', () => {
      // Given/When/Then
      expect(() => new UpdatePoiPositionCommand('   ', 'poi-456', { lat: 52.5163, lng: 13.3777 })).toThrow('lagekarteId is required');
    });
  });

  describe('Invalid Commands - poiId validation', () => {
    it('should throw error when poiId is undefined', () => {
      // Given/When/Then
      expect(() => new UpdatePoiPositionCommand('lagekarte-123', undefined as any, { lat: 52.5163, lng: 13.3777 })).toThrow('poiId is required');
    });

    it('should throw error when poiId is null', () => {
      // Given/When/Then
      expect(() => new UpdatePoiPositionCommand('lagekarte-123', null as any, { lat: 52.5163, lng: 13.3777 })).toThrow('poiId is required');
    });

    it('should throw error when poiId is empty string', () => {
      // Given/When/Then
      expect(() => new UpdatePoiPositionCommand('lagekarte-123', '', { lat: 52.5163, lng: 13.3777 })).toThrow('poiId is required');
    });

    it('should throw error when poiId is only whitespace', () => {
      // Given/When/Then
      expect(() => new UpdatePoiPositionCommand('lagekarte-123', '   ', { lat: 52.5163, lng: 13.3777 })).toThrow('poiId is required');
    });
  });

  describe('Invalid Commands - newCoordinate validation', () => {
    it('should throw error when newCoordinate is undefined', () => {
      // Given/When/Then
      expect(() => new UpdatePoiPositionCommand('lagekarte-123', 'poi-456', undefined as any)).toThrow('newCoordinate is required');
    });

    it('should throw error when newCoordinate is null', () => {
      // Given/When/Then
      expect(() => new UpdatePoiPositionCommand('lagekarte-123', 'poi-456', null as any)).toThrow('newCoordinate is required');
    });
  });

  describe('Edge Cases', () => {
    it('should accept boundary latitude values (North Pole)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const poiId = 'poi-456';
      const newCoordinate = { lat: 90, lng: 0 };

      // When
      const command = new UpdatePoiPositionCommand(lagekarteId, poiId, newCoordinate);

      // Then
      expect(command.newCoordinate).toEqual({ lat: 90, lng: 0 });
    });

    it('should accept boundary latitude values (South Pole)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const poiId = 'poi-456';
      const newCoordinate = { lat: -90, lng: 0 };

      // When
      const command = new UpdatePoiPositionCommand(lagekarteId, poiId, newCoordinate);

      // Then
      expect(command.newCoordinate).toEqual({ lat: -90, lng: 0 });
    });

    it('should accept boundary longitude values (International Date Line)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const poiId = 'poi-456';
      const newCoordinate = { lat: 0, lng: 180 };

      // When
      const command = new UpdatePoiPositionCommand(lagekarteId, poiId, newCoordinate);

      // Then
      expect(command.newCoordinate).toEqual({ lat: 0, lng: 180 });
    });

    it('should accept MGRS string with various precisions', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const poiId = 'poi-456';
      const newCoordinate = { mgrs: '33UUU' }; // Low precision MGRS

      // When
      const command = new UpdatePoiPositionCommand(lagekarteId, poiId, newCoordinate);

      // Then
      expect(command.newCoordinate).toEqual({ mgrs: '33UUU' });
    });

    it('should accept IDs with all valid nanoid characters', () => {
      // Given: Test with all types of valid nanoid characters (A-Za-z0-9_-)
      const lagekarteId = 'AZaz09_-0123456789XYZ'; // Exactly 21 chars
      const poiId = 'aZ09_-9876543210ZYXaz'; // Exactly 21 chars
      const newCoordinate = { lat: 52.5163, lng: 13.3777 };

      // When
      const command = new UpdatePoiPositionCommand(lagekarteId, poiId, newCoordinate);

      // Then
      expect(command.lagekarteId).toBe(lagekarteId);
      expect(command.poiId).toBe(poiId);
    });
  });
});
