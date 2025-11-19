import { RemovePoiCommand } from '../remove-poi.command';

/**
 * Unit Tests für RemovePoiCommand.
 *
 * Testet Command-Validation (Factory Pattern) gemäß BDD Given-When-Then Pattern.
 * Keine Mock-Dependencies erforderlich (Value Object Pattern).
 *
 * Coverage Target: >90%
 * Testing Framework: Jest 30.2.0 mit @swc/jest
 */
describe('RemovePoiCommand', () => {
  describe('Valid Commands', () => {
    it('should create command with all required fields', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const poiId = 'poi-456';

      // When
      const result = RemovePoiCommand.create(lagekarteId, poiId);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.lagekarteId).toBe(lagekarteId);
      expect(result.value!.poiId).toBe(poiId);
    });

    it('should accept lagekarteId with leading/trailing spaces (not trimmed in factory)', () => {
      // Given
      const lagekarteId = '  lagekarte-123  ';
      const poiId = 'poi-456';

      // When
      const result = RemovePoiCommand.create(lagekarteId, poiId);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.lagekarteId).toBe(lagekarteId); // Factory does NOT trim
    });

    it('should accept poiId with leading/trailing spaces (not trimmed in factory)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const poiId = '  poi-456  ';

      // When
      const result = RemovePoiCommand.create(lagekarteId, poiId);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.poiId).toBe(poiId); // Factory does NOT trim
    });

    it('should accept UUID-format IDs', () => {
      // Given
      const lagekarteId = '550e8400-e29b-41d4-a716-446655440000';
      const poiId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

      // When
      const result = RemovePoiCommand.create(lagekarteId, poiId);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.lagekarteId).toBe(lagekarteId);
      expect(result.value!.poiId).toBe(poiId);
    });

    it('should accept nanoid-format IDs (21 chars)', () => {
      // Given
      const lagekarteId = 'V1StGXR8_Z5jdHi6B-myT';
      const poiId = 'K3pQx9_a2NyRv8ZwL4mFB';

      // When
      const result = RemovePoiCommand.create(lagekarteId, poiId);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.lagekarteId).toBe(lagekarteId);
      expect(result.value!.poiId).toBe(poiId);
    });
  });

  describe('Invalid Commands - lagekarteId validation', () => {
    it('should return failure when lagekarteId is undefined', () => {
      // Given/When
      const result = RemovePoiCommand.create(undefined as any, 'poi-456');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('lagekarteId is required');
    });

    it('should return failure when lagekarteId is null', () => {
      // Given/When
      const result = RemovePoiCommand.create(null as any, 'poi-456');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('lagekarteId is required');
    });

    it('should return failure when lagekarteId is empty string', () => {
      // Given/When
      const result = RemovePoiCommand.create('', 'poi-456');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('lagekarteId is required');
    });

    it('should return failure when lagekarteId is only whitespace', () => {
      // Given/When
      const result = RemovePoiCommand.create('   ', 'poi-456');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('lagekarteId is required');
    });
  });

  describe('Invalid Commands - poiId validation', () => {
    it('should return failure when poiId is undefined', () => {
      // Given/When
      const result = RemovePoiCommand.create('lagekarte-123', undefined as any);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('poiId is required');
    });

    it('should return failure when poiId is null', () => {
      // Given/When
      const result = RemovePoiCommand.create('lagekarte-123', null as any);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('poiId is required');
    });

    it('should return failure when poiId is empty string', () => {
      // Given/When
      const result = RemovePoiCommand.create('lagekarte-123', '');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('poiId is required');
    });

    it('should return failure when poiId is only whitespace', () => {
      // Given/When
      const result = RemovePoiCommand.create('lagekarte-123', '   ');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('poiId is required');
    });
  });

  describe('Edge Cases', () => {
    it('should accept very long IDs (no length restriction in command)', () => {
      // Given
      const lagekarteId = 'A'.repeat(1000);
      const poiId = 'B'.repeat(1000);

      // When
      const result = RemovePoiCommand.create(lagekarteId, poiId);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.lagekarteId.length).toBe(1000);
      expect(result.value!.poiId.length).toBe(1000);
    });

    it('should accept IDs with special characters', () => {
      // Given
      const lagekarteId = 'lagekarte-123_test-id';
      const poiId = 'poi_456-test-id';

      // When
      const result = RemovePoiCommand.create(lagekarteId, poiId);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.lagekarteId).toBe(lagekarteId);
      expect(result.value!.poiId).toBe(poiId);
    });

    it('should accept IDs with all valid nanoid characters', () => {
      // Given: Test with all types of valid nanoid characters (A-Za-z0-9_-)
      const lagekarteId = 'AZaz09_-0123456789XYZ'; // Exactly 21 chars
      const poiId = 'aZ09_-9876543210ZYXaz'; // Exactly 21 chars

      // When
      const result = RemovePoiCommand.create(lagekarteId, poiId);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.lagekarteId).toBe(lagekarteId);
      expect(result.value!.poiId).toBe(poiId);
    });
  });
});
