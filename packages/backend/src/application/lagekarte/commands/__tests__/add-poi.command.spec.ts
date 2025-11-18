import { AddPoiCommand } from '../add-poi.command';

/**
 * Unit Tests für AddPoiCommand.
 *
 * Testet Command-Validation (Constructor Guards) gemäß BDD Given-When-Then Pattern.
 * Keine Mock-Dependencies erforderlich (Value Object Pattern).
 *
 * Coverage Target: >90%
 * Testing Framework: Jest 30.2.0 mit @swc/jest
 */
describe('AddPoiCommand', () => {
  describe('Valid Commands', () => {
    it('should create command with all required fields (Lat/Lng coordinate)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const name = 'Brandenburger Tor';
      const coordinate = { lat: 52.5163, lng: 13.3777 };
      const category = 'EINSATZSTELLE';

      // When
      const command = new AddPoiCommand(lagekarteId, name, coordinate, category);

      // Then
      expect(command.lagekarteId).toBe(lagekarteId);
      expect(command.name).toBe(name);
      expect(command.coordinate).toEqual(coordinate);
      expect(command.category).toBe(category);
      expect(command.beschreibung).toBeUndefined();
    });

    it('should create command with all required fields (MGRS coordinate)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const name = 'Rathaus Hamburg';
      const coordinate = { mgrs: '32UNE8934004990' };
      const category = 'BEREITSTELLUNGSRAUM';

      // When
      const command = new AddPoiCommand(lagekarteId, name, coordinate, category);

      // Then
      expect(command.lagekarteId).toBe(lagekarteId);
      expect(command.name).toBe(name);
      expect(command.coordinate).toEqual(coordinate);
      expect(command.category).toBe(category);
      expect(command.beschreibung).toBeUndefined();
    });

    it('should create command with optional beschreibung', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const name = 'Gefahrenstelle';
      const coordinate = { lat: 52.5163, lng: 13.3777 };
      const category = 'GEFAHRENSTELLE';
      const beschreibung = 'Überflutete Straße, nicht befahrbar';

      // When
      const command = new AddPoiCommand(lagekarteId, name, coordinate, category, beschreibung);

      // Then
      expect(command.lagekarteId).toBe(lagekarteId);
      expect(command.name).toBe(name);
      expect(command.coordinate).toEqual(coordinate);
      expect(command.category).toBe(category);
      expect(command.beschreibung).toBe(beschreibung);
    });

    it('should accept lagekarteId with leading/trailing spaces (not trimmed in constructor)', () => {
      // Given
      const lagekarteId = '  lagekarte-123  ';
      const name = 'Test POI';
      const coordinate = { lat: 52.5163, lng: 13.3777 };
      const category = 'SONSTIGES';

      // When
      const command = new AddPoiCommand(lagekarteId, name, coordinate, category);

      // Then
      expect(command.lagekarteId).toBe(lagekarteId); // Constructor does NOT trim
    });
  });

  describe('Invalid Commands - lagekarteId validation', () => {
    it('should throw error when lagekarteId is undefined', () => {
      // Given/When/Then
      expect(() => new AddPoiCommand(undefined as any, 'Test POI', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE')).toThrow('lagekarteId is required');
    });

    it('should throw error when lagekarteId is null', () => {
      // Given/When/Then
      expect(() => new AddPoiCommand(null as any, 'Test POI', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE')).toThrow('lagekarteId is required');
    });

    it('should throw error when lagekarteId is empty string', () => {
      // Given/When/Then
      expect(() => new AddPoiCommand('', 'Test POI', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE')).toThrow('lagekarteId is required');
    });

    it('should throw error when lagekarteId is only whitespace', () => {
      // Given/When/Then
      expect(() => new AddPoiCommand('   ', 'Test POI', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE')).toThrow('lagekarteId is required');
    });
  });

  describe('Invalid Commands - name validation', () => {
    it('should throw error when name is undefined', () => {
      // Given/When/Then
      expect(() => new AddPoiCommand('lagekarte-123', undefined as any, { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE')).toThrow('name is required');
    });

    it('should throw error when name is null', () => {
      // Given/When/Then
      expect(() => new AddPoiCommand('lagekarte-123', null as any, { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE')).toThrow('name is required');
    });

    it('should throw error when name is empty string', () => {
      // Given/When/Then
      expect(() => new AddPoiCommand('lagekarte-123', '', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE')).toThrow('name is required');
    });

    it('should throw error when name is only whitespace', () => {
      // Given/When/Then
      expect(() => new AddPoiCommand('lagekarte-123', '   ', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE')).toThrow('name is required');
    });
  });

  describe('Invalid Commands - coordinate validation', () => {
    it('should throw error when coordinate is undefined', () => {
      // Given/When/Then
      expect(() => new AddPoiCommand('lagekarte-123', 'Test POI', undefined as any, 'EINSATZSTELLE')).toThrow('coordinate is required');
    });

    it('should throw error when coordinate is null', () => {
      // Given/When/Then
      expect(() => new AddPoiCommand('lagekarte-123', 'Test POI', null as any, 'EINSATZSTELLE')).toThrow('coordinate is required');
    });
  });

  describe('Invalid Commands - category validation', () => {
    it('should throw error when category is undefined', () => {
      // Given/When/Then
      expect(() => new AddPoiCommand('lagekarte-123', 'Test POI', { lat: 52.5163, lng: 13.3777 }, undefined as any)).toThrow('category is required');
    });

    it('should throw error when category is null', () => {
      // Given/When/Then
      expect(() => new AddPoiCommand('lagekarte-123', 'Test POI', { lat: 52.5163, lng: 13.3777 }, null as any)).toThrow('category is required');
    });

    it('should throw error when category is empty string', () => {
      // Given/When/Then
      expect(() => new AddPoiCommand('lagekarte-123', 'Test POI', { lat: 52.5163, lng: 13.3777 }, '')).toThrow('category is required');
    });

    it('should throw error when category is only whitespace', () => {
      // Given/When/Then
      expect(() => new AddPoiCommand('lagekarte-123', 'Test POI', { lat: 52.5163, lng: 13.3777 }, '   ')).toThrow('category is required');
    });
  });

  describe('Edge Cases', () => {
    it('should accept POI name with special characters', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const name = 'POI "Hauptstraße" (Südseite) – Besondere Lage!';
      const coordinate = { lat: 52.5163, lng: 13.3777 };
      const category = 'GEFAHRENSTELLE';

      // When
      const command = new AddPoiCommand(lagekarteId, name, coordinate, category);

      // Then
      expect(command.name).toBe(name);
    });

    it('should accept very long POI name (no length restriction in command)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const veryLongName = 'A'.repeat(1000);
      const coordinate = { lat: 52.5163, lng: 13.3777 };
      const category = 'EINSATZSTELLE';

      // When
      const command = new AddPoiCommand(lagekarteId, veryLongName, coordinate, category);

      // Then
      expect(command.name.length).toBe(1000);
    });

    it('should accept boundary latitude values (North Pole)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const name = 'North Pole';
      const coordinate = { lat: 90, lng: 0 };
      const category = 'SONSTIGES';

      // When
      const command = new AddPoiCommand(lagekarteId, name, coordinate, category);

      // Then
      expect(command.coordinate).toEqual({ lat: 90, lng: 0 });
    });

    it('should accept boundary latitude values (South Pole)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const name = 'South Pole';
      const coordinate = { lat: -90, lng: 0 };
      const category = 'SONSTIGES';

      // When
      const command = new AddPoiCommand(lagekarteId, name, coordinate, category);

      // Then
      expect(command.coordinate).toEqual({ lat: -90, lng: 0 });
    });

    it('should accept boundary longitude values (International Date Line)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const name = 'International Date Line';
      const coordinate = { lat: 0, lng: 180 };
      const category = 'SONSTIGES';

      // When
      const command = new AddPoiCommand(lagekarteId, name, coordinate, category);

      // Then
      expect(command.coordinate).toEqual({ lat: 0, lng: 180 });
    });

    it('should accept negative longitude (Western Hemisphere)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const name = 'Western Hemisphere';
      const coordinate = { lat: 0, lng: -180 };
      const category = 'SONSTIGES';

      // When
      const command = new AddPoiCommand(lagekarteId, name, coordinate, category);

      // Then
      expect(command.coordinate).toEqual({ lat: 0, lng: -180 });
    });

    it('should accept MGRS string with various precisions', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const name = 'MGRS Test';
      const coordinate = { mgrs: '33UUU' }; // Low precision MGRS
      const category = 'SONSTIGES';

      // When
      const command = new AddPoiCommand(lagekarteId, name, coordinate, category);

      // Then
      expect(command.coordinate).toEqual({ mgrs: '33UUU' });
    });
  });
});
