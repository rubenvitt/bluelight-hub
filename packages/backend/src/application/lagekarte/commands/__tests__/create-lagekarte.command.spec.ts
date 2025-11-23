import { CreateLagekarteCommand } from '../create-lagekarte.command';

/**
 * Unit Tests für CreateLagekarteCommand.
 *
 * Testet Command-Validation (Factory Pattern) gemäß BDD Given-When-Then Pattern.
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
      const result = CreateLagekarteCommand.create(einsatzId);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.einsatzId).toBe(einsatzId);
      expect(result.value!.initialPoi).toBeUndefined();
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
      const result = CreateLagekarteCommand.create(einsatzId, initialPoi);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.einsatzId).toBe(einsatzId);
      expect(result.value!.initialPoi).toEqual(initialPoi);
      expect(result.value!.initialPoi?.name).toBe('Brandenburger Tor');
      expect(result.value!.initialPoi?.coordinate).toEqual({ lat: 52.5163, lng: 13.3777 });
      expect(result.value!.initialPoi?.category).toBe('EINSATZSTELLE');
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
      const result = CreateLagekarteCommand.create(einsatzId, initialPoi);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.einsatzId).toBe(einsatzId);
      expect(result.value!.initialPoi).toEqual(initialPoi);
      expect(result.value!.initialPoi?.name).toBe('Rathaus Hamburg');
      expect(result.value!.initialPoi?.coordinate).toEqual({ mgrs: '33UUU89060199' });
      expect(result.value!.initialPoi?.category).toBe('BEREITSTELLUNGSRAUM');
    });

    it('should accept einsatzId with leading/trailing spaces (not trimmed in factory)', () => {
      // Given
      const einsatzId = '  einsatz-123  ';

      // When
      const result = CreateLagekarteCommand.create(einsatzId);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.einsatzId).toBe(einsatzId); // Factory does NOT trim (trimming happens in EinsatzId.create())
    });
  });

  describe('Invalid Commands - einsatzId validation', () => {
    it('should return failure when einsatzId is undefined', () => {
      // Given/When
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const result = CreateLagekarteCommand.create(undefined as any);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('einsatzId is required');
    });

    it('should return failure when einsatzId is null', () => {
      // Given/When
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const result = CreateLagekarteCommand.create(null as any);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('einsatzId is required');
    });

    it('should return failure when einsatzId is empty string', () => {
      // Given/When
      const result = CreateLagekarteCommand.create('');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('einsatzId is required');
    });

    it('should return failure when einsatzId is only whitespace', () => {
      // Given/When
      const result = CreateLagekarteCommand.create('   ');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('einsatzId is required');
    });
  });

  describe('Invalid Commands - initialPoi validation', () => {
    it('should return failure when initialPoi.name is missing', () => {
      // Given
      const einsatzId = 'einsatz-123';
      const invalidPoi = {
        name: '',
        coordinate: { lat: 52.5163, lng: 13.3777 },
        category: 'EINSATZSTELLE',
      };

      // When
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const result = CreateLagekarteCommand.create(einsatzId, invalidPoi as any);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('initialPoi.name is required when initialPoi is provided');
    });

    it('should return failure when initialPoi.name is only whitespace', () => {
      // Given
      const einsatzId = 'einsatz-123';
      const invalidPoi = {
        name: '   ',
        coordinate: { lat: 52.5163, lng: 13.3777 },
        category: 'EINSATZSTELLE',
      };

      // When
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const result = CreateLagekarteCommand.create(einsatzId, invalidPoi as any);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('initialPoi.name is required when initialPoi is provided');
    });

    it('should return failure when initialPoi.coordinate is missing', () => {
      // Given
      const einsatzId = 'einsatz-123';
      const invalidPoi = {
        name: 'Brandenburger Tor',
        // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
        coordinate: undefined as any,
        category: 'EINSATZSTELLE',
      };

      // When
      const result = CreateLagekarteCommand.create(einsatzId, invalidPoi);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('initialPoi.coordinate is required');
    });

    it('should return failure when initialPoi.coordinate is null', () => {
      // Given
      const einsatzId = 'einsatz-123';
      const invalidPoi = {
        name: 'Brandenburger Tor',
        // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
        coordinate: null as any,
        category: 'EINSATZSTELLE',
      };

      // When
      const result = CreateLagekarteCommand.create(einsatzId, invalidPoi);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('initialPoi.coordinate is required');
    });

    it('should return failure when initialPoi.category is missing', () => {
      // Given
      const einsatzId = 'einsatz-123';
      const invalidPoi = {
        name: 'Brandenburger Tor',
        coordinate: { lat: 52.5163, lng: 13.3777 },
        category: '',
      };

      // When
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const result = CreateLagekarteCommand.create(einsatzId, invalidPoi as any);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('initialPoi.category is required when initialPoi is provided');
    });

    it('should return failure when initialPoi.category is only whitespace', () => {
      // Given
      const einsatzId = 'einsatz-123';
      const invalidPoi = {
        name: 'Brandenburger Tor',
        coordinate: { lat: 52.5163, lng: 13.3777 },
        category: '   ',
      };

      // When
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const result = CreateLagekarteCommand.create(einsatzId, invalidPoi as any);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('initialPoi.category is required when initialPoi is provided');
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
      const result = CreateLagekarteCommand.create(einsatzId, initialPoi);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.initialPoi?.name).toBe('POI "Hauptstraße" (Südseite) – Besondere Lage!');
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
      const result = CreateLagekarteCommand.create(einsatzId, initialPoi);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.initialPoi?.name).toBe(veryLongName);
      expect(result.value!.initialPoi?.name.length).toBe(1000);
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
      const result = CreateLagekarteCommand.create(einsatzId, initialPoi);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.initialPoi?.coordinate).toEqual({ lat: 90, lng: 0 });
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
      const result = CreateLagekarteCommand.create(einsatzId, initialPoi);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.initialPoi?.coordinate).toEqual({ lat: 0, lng: 180 });
    });
  });
});
