import { CreateLagekarteCommand } from '../create-lagekarte.command';

/**
 * Unit Tests für CreateLagekarteCommand.
 *
 * Testet Command-Validation (Constructor Guards) gemäß BDD Given-When-Then Pattern.
 * Keine Mock-Dependencies erforderlich (Value Object Pattern).
 *
 * Coverage Target: >90%
 * Testing Framework: Jest 30.2.0 mit @swc/jest
 */
describe('CreateLagekarteCommand', () => {
  describe('Valid Commands', () => {
    it('should create command with einsatzId only (no initialPoi)', () => {
      // Given
      const einsatzId = 'einsatz-123';

      // When
      const command = new CreateLagekarteCommand(einsatzId);

      // Then
      expect(command.einsatzId).toBe(einsatzId);
      expect(command.initialPoi).toBeUndefined();
    });

    it('should create command with einsatzId + initialPoi (Lat/Lng)', () => {
      // Given
      const einsatzId = 'einsatz-123';
      const initialPoi = {
        name: 'Brandenburger Tor',
        coordinate: { lat: 52.5163, lng: 13.3777 },
        category: 'EINSATZSTELLE',
      };

      // When
      const command = new CreateLagekarteCommand(einsatzId, initialPoi);

      // Then
      expect(command.einsatzId).toBe(einsatzId);
      expect(command.initialPoi).toEqual(initialPoi);
      expect(command.initialPoi?.name).toBe('Brandenburger Tor');
      expect(command.initialPoi?.coordinate).toEqual({ lat: 52.5163, lng: 13.3777 });
      expect(command.initialPoi?.category).toBe('EINSATZSTELLE');
    });

    it('should create command with einsatzId + initialPoi (MGRS)', () => {
      // Given
      const einsatzId = 'einsatz-123';
      const initialPoi = {
        name: 'Rathaus Hamburg',
        coordinate: { mgrs: '33UUU89060199' },
        category: 'BEREITSTELLUNGSRAUM',
      };

      // When
      const command = new CreateLagekarteCommand(einsatzId, initialPoi);

      // Then
      expect(command.einsatzId).toBe(einsatzId);
      expect(command.initialPoi).toEqual(initialPoi);
      expect(command.initialPoi?.name).toBe('Rathaus Hamburg');
      expect(command.initialPoi?.coordinate).toEqual({ mgrs: '33UUU89060199' });
      expect(command.initialPoi?.category).toBe('BEREITSTELLUNGSRAUM');
    });

    it('should accept einsatzId with leading/trailing spaces (not trimmed in constructor)', () => {
      // Given
      const einsatzId = '  einsatz-123  ';

      // When
      const command = new CreateLagekarteCommand(einsatzId);

      // Then
      expect(command.einsatzId).toBe(einsatzId); // Constructor does NOT trim (trimming happens in EinsatzId.create())
    });
  });

  describe('Invalid Commands - einsatzId validation', () => {
    it('should throw error when einsatzId is undefined', () => {
      // Given/When/Then
      expect(() => new CreateLagekarteCommand(undefined as any)).toThrow('einsatzId is required');
    });

    it('should throw error when einsatzId is null', () => {
      // Given/When/Then
      expect(() => new CreateLagekarteCommand(null as any)).toThrow('einsatzId is required');
    });

    it('should throw error when einsatzId is empty string', () => {
      // Given/When/Then
      expect(() => new CreateLagekarteCommand('')).toThrow('einsatzId is required');
    });

    it('should throw error when einsatzId is only whitespace', () => {
      // Given/When/Then
      expect(() => new CreateLagekarteCommand('   ')).toThrow('einsatzId is required');
    });
  });

  describe('Invalid Commands - initialPoi validation', () => {
    it('should throw error when initialPoi.name is missing', () => {
      // Given
      const einsatzId = 'einsatz-123';
      const invalidPoi = {
        name: '',
        coordinate: { lat: 52.5163, lng: 13.3777 },
        category: 'EINSATZSTELLE',
      };

      // When/Then
      expect(() => new CreateLagekarteCommand(einsatzId, invalidPoi as any)).toThrow('initialPoi.name is required when initialPoi is provided');
    });

    it('should throw error when initialPoi.name is only whitespace', () => {
      // Given
      const einsatzId = 'einsatz-123';
      const invalidPoi = {
        name: '   ',
        coordinate: { lat: 52.5163, lng: 13.3777 },
        category: 'EINSATZSTELLE',
      };

      // When/Then
      expect(() => new CreateLagekarteCommand(einsatzId, invalidPoi as any)).toThrow('initialPoi.name is required when initialPoi is provided');
    });

    it('should throw error when initialPoi.coordinate is missing', () => {
      // Given
      const einsatzId = 'einsatz-123';
      const invalidPoi = {
        name: 'Brandenburger Tor',
        coordinate: undefined as any,
        category: 'EINSATZSTELLE',
      };

      // When/Then
      expect(() => new CreateLagekarteCommand(einsatzId, invalidPoi)).toThrow('initialPoi.coordinate is required');
    });

    it('should throw error when initialPoi.coordinate is null', () => {
      // Given
      const einsatzId = 'einsatz-123';
      const invalidPoi = {
        name: 'Brandenburger Tor',
        coordinate: null as any,
        category: 'EINSATZSTELLE',
      };

      // When/Then
      expect(() => new CreateLagekarteCommand(einsatzId, invalidPoi)).toThrow('initialPoi.coordinate is required');
    });

    it('should throw error when initialPoi.category is missing', () => {
      // Given
      const einsatzId = 'einsatz-123';
      const invalidPoi = {
        name: 'Brandenburger Tor',
        coordinate: { lat: 52.5163, lng: 13.3777 },
        category: '',
      };

      // When/Then
      expect(() => new CreateLagekarteCommand(einsatzId, invalidPoi as any)).toThrow('initialPoi.category is required when initialPoi is provided');
    });

    it('should throw error when initialPoi.category is only whitespace', () => {
      // Given
      const einsatzId = 'einsatz-123';
      const invalidPoi = {
        name: 'Brandenburger Tor',
        coordinate: { lat: 52.5163, lng: 13.3777 },
        category: '   ',
      };

      // When/Then
      expect(() => new CreateLagekarteCommand(einsatzId, invalidPoi as any)).toThrow('initialPoi.category is required when initialPoi is provided');
    });
  });

  describe('Edge Cases', () => {
    it('should accept initialPoi with special characters in name', () => {
      // Given
      const einsatzId = 'einsatz-123';
      const initialPoi = {
        name: 'POI "Hauptstraße" (Südseite) – Besondere Lage!',
        coordinate: { lat: 52.5163, lng: 13.3777 },
        category: 'GEFAHRENSTELLE',
      };

      // When
      const command = new CreateLagekarteCommand(einsatzId, initialPoi);

      // Then
      expect(command.initialPoi?.name).toBe('POI "Hauptstraße" (Südseite) – Besondere Lage!');
    });

    it('should accept initialPoi with very long name (no length restriction in command)', () => {
      // Given
      const einsatzId = 'einsatz-123';
      const veryLongName = 'A'.repeat(1000); // 1000 characters
      const initialPoi = {
        name: veryLongName,
        coordinate: { lat: 52.5163, lng: 13.3777 },
        category: 'EINSATZSTELLE',
      };

      // When
      const command = new CreateLagekarteCommand(einsatzId, initialPoi);

      // Then
      expect(command.initialPoi?.name).toBe(veryLongName);
      expect(command.initialPoi?.name.length).toBe(1000);
    });

    it('should accept initialPoi with boundary latitude values', () => {
      // Given
      const einsatzId = 'einsatz-123';
      const initialPoi = {
        name: 'North Pole',
        coordinate: { lat: 90, lng: 0 },
        category: 'SONSTIGES',
      };

      // When
      const command = new CreateLagekarteCommand(einsatzId, initialPoi);

      // Then
      expect(command.initialPoi?.coordinate).toEqual({ lat: 90, lng: 0 });
    });

    it('should accept initialPoi with boundary longitude values', () => {
      // Given
      const einsatzId = 'einsatz-123';
      const initialPoi = {
        name: 'International Date Line',
        coordinate: { lat: 0, lng: 180 },
        category: 'SONSTIGES',
      };

      // When
      const command = new CreateLagekarteCommand(einsatzId, initialPoi);

      // Then
      expect(command.initialPoi?.coordinate).toEqual({ lat: 0, lng: 180 });
    });
  });
});
