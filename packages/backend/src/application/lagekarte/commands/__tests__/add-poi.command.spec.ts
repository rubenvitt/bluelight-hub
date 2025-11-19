import { AddPoiCommand } from '../add-poi.command';

/**
 * Unit Tests für AddPoiCommand.
 *
 * Testet Command-Validation (Factory Pattern) gemäß BDD Given-When-Then Pattern.
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
      const result = AddPoiCommand.create(lagekarteId, name, coordinate, category);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.lagekarteId).toBe(lagekarteId);
      expect(result.value!.name).toBe(name);
      expect(result.value!.coordinate).toEqual(coordinate);
      expect(result.value!.category).toBe(category);
      expect(result.value!.beschreibung).toBeUndefined();
    });

    it('should create command with all required fields (MGRS coordinate)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const name = 'Rathaus Hamburg';
      const coordinate = { mgrs: '32UNE8934004990' };
      const category = 'BEREITSTELLUNGSRAUM';

      // When
      const result = AddPoiCommand.create(lagekarteId, name, coordinate, category);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.lagekarteId).toBe(lagekarteId);
      expect(result.value!.name).toBe(name);
      expect(result.value!.coordinate).toEqual(coordinate);
      expect(result.value!.category).toBe(category);
      expect(result.value!.beschreibung).toBeUndefined();
    });

    it('should create command with optional beschreibung', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const name = 'Gefahrenstelle';
      const coordinate = { lat: 52.5163, lng: 13.3777 };
      const category = 'GEFAHRENSTELLE';
      const beschreibung = 'Überflutete Straße, nicht befahrbar';

      // When
      const result = AddPoiCommand.create(lagekarteId, name, coordinate, category, beschreibung);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.lagekarteId).toBe(lagekarteId);
      expect(result.value!.name).toBe(name);
      expect(result.value!.coordinate).toEqual(coordinate);
      expect(result.value!.category).toBe(category);
      expect(result.value!.beschreibung).toBe(beschreibung);
    });

    it('should accept lagekarteId with leading/trailing spaces (not trimmed in factory)', () => {
      // Given
      const lagekarteId = '  lagekarte-123  ';
      const name = 'Test POI';
      const coordinate = { lat: 52.5163, lng: 13.3777 };
      const category = 'SONSTIGES';

      // When
      const result = AddPoiCommand.create(lagekarteId, name, coordinate, category);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.lagekarteId).toBe(lagekarteId); // Factory does NOT trim
    });
  });

  describe('Invalid Commands - lagekarteId validation', () => {
    it('should return failure when lagekarteId is undefined', () => {
      // Given/When
      const result = AddPoiCommand.create(undefined as any, 'Test POI', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('lagekarteId is required');
    });

    it('should return failure when lagekarteId is null', () => {
      // Given/When
      const result = AddPoiCommand.create(null as any, 'Test POI', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('lagekarteId is required');
    });

    it('should return failure when lagekarteId is empty string', () => {
      // Given/When
      const result = AddPoiCommand.create('', 'Test POI', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('lagekarteId is required');
    });

    it('should return failure when lagekarteId is only whitespace', () => {
      // Given/When
      const result = AddPoiCommand.create('   ', 'Test POI', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('lagekarteId is required');
    });
  });

  describe('Invalid Commands - name validation', () => {
    it('should return failure when name is undefined', () => {
      // Given/When
      const result = AddPoiCommand.create('lagekarte-123', undefined as any, { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('name is required');
    });

    it('should return failure when name is null', () => {
      // Given/When
      const result = AddPoiCommand.create('lagekarte-123', null as any, { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('name is required');
    });

    it('should return failure when name is empty string', () => {
      // Given/When
      const result = AddPoiCommand.create('lagekarte-123', '', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('name is required');
    });

    it('should return failure when name is only whitespace', () => {
      // Given/When
      const result = AddPoiCommand.create('lagekarte-123', '   ', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('name is required');
    });
  });

  describe('Invalid Commands - coordinate validation', () => {
    it('should return failure when coordinate is undefined', () => {
      // Given/When
      const result = AddPoiCommand.create('lagekarte-123', 'Test POI', undefined as any, 'EINSATZSTELLE');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('coordinate is required');
    });

    it('should return failure when coordinate is null', () => {
      // Given/When
      const result = AddPoiCommand.create('lagekarte-123', 'Test POI', null as any, 'EINSATZSTELLE');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('coordinate is required');
    });
  });

  describe('Invalid Commands - category validation', () => {
    it('should return failure when category is undefined', () => {
      // Given/When
      const result = AddPoiCommand.create('lagekarte-123', 'Test POI', { lat: 52.5163, lng: 13.3777 }, undefined as any);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('category is required');
    });

    it('should return failure when category is null', () => {
      // Given/When
      const result = AddPoiCommand.create('lagekarte-123', 'Test POI', { lat: 52.5163, lng: 13.3777 }, null as any);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('category is required');
    });

    it('should return failure when category is empty string', () => {
      // Given/When
      const result = AddPoiCommand.create('lagekarte-123', 'Test POI', { lat: 52.5163, lng: 13.3777 }, '');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('category is required');
    });

    it('should return failure when category is only whitespace', () => {
      // Given/When
      const result = AddPoiCommand.create('lagekarte-123', 'Test POI', { lat: 52.5163, lng: 13.3777 }, '   ');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('category is required');
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
      const result = AddPoiCommand.create(lagekarteId, name, coordinate, category);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.name).toBe(name);
    });

    it('should accept very long POI name (no length restriction in command)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const veryLongName = 'A'.repeat(1000);
      const coordinate = { lat: 52.5163, lng: 13.3777 };
      const category = 'EINSATZSTELLE';

      // When
      const result = AddPoiCommand.create(lagekarteId, veryLongName, coordinate, category);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.name.length).toBe(1000);
    });

    it('should accept boundary latitude values (North Pole)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const name = 'North Pole';
      const coordinate = { lat: 90, lng: 0 };
      const category = 'SONSTIGES';

      // When
      const result = AddPoiCommand.create(lagekarteId, name, coordinate, category);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.coordinate).toEqual({ lat: 90, lng: 0 });
    });

    it('should accept boundary latitude values (South Pole)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const name = 'South Pole';
      const coordinate = { lat: -90, lng: 0 };
      const category = 'SONSTIGES';

      // When
      const result = AddPoiCommand.create(lagekarteId, name, coordinate, category);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.coordinate).toEqual({ lat: -90, lng: 0 });
    });

    it('should accept boundary longitude values (International Date Line)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const name = 'International Date Line';
      const coordinate = { lat: 0, lng: 180 };
      const category = 'SONSTIGES';

      // When
      const result = AddPoiCommand.create(lagekarteId, name, coordinate, category);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.coordinate).toEqual({ lat: 0, lng: 180 });
    });

    it('should accept negative longitude (Western Hemisphere)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const name = 'Western Hemisphere';
      const coordinate = { lat: 0, lng: -180 };
      const category = 'SONSTIGES';

      // When
      const result = AddPoiCommand.create(lagekarteId, name, coordinate, category);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.coordinate).toEqual({ lat: 0, lng: -180 });
    });

    it('should accept MGRS string with various precisions', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const name = 'MGRS Test';
      const coordinate = { mgrs: '33UUU' }; // Low precision MGRS
      const category = 'SONSTIGES';

      // When
      const result = AddPoiCommand.create(lagekarteId, name, coordinate, category);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.coordinate).toEqual({ mgrs: '33UUU' });
    });
  });
});
