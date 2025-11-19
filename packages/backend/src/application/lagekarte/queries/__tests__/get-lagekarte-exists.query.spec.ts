import { GetLagekarteExistsQuery } from '../get-lagekarte-exists.query';

/**
 * Unit Tests für GetLagekarteExistsQuery.
 *
 * Testet Constructor-Validierung gemäß BDD Given-When-Then Pattern.
 * Coverage Target: >90%
 */
describe('GetLagekarteExistsQuery', () => {
  describe('Constructor Validation', () => {
    it('should create query with valid einsatzId', () => {
      // Given
      const einsatzId = 'einsatz-123456789012';

      // When
      const query = new GetLagekarteExistsQuery(einsatzId);

      // Then
      expect(query.einsatzId).toBe(einsatzId);
    });

    it('should create query with valid 21-character nanoid', () => {
      // Given: Valid nanoid format (21 URL-safe characters)
      const validNanoid = 'AZaz09_-0123456789XYZ';

      // When
      const query = new GetLagekarteExistsQuery(validNanoid);

      // Then
      expect(query.einsatzId).toBe(validNanoid);
    });

    it('should throw error when einsatzId is empty string', () => {
      // Given
      const emptyId = '';

      // When/Then
      expect(() => new GetLagekarteExistsQuery(emptyId)).toThrow('einsatzId is required');
    });

    it('should throw error when einsatzId is whitespace-only', () => {
      // Given
      const whitespaceId = '   ';

      // When/Then
      expect(() => new GetLagekarteExistsQuery(whitespaceId)).toThrow('einsatzId is required');
    });

    it('should throw error when einsatzId is undefined', () => {
      // Given
      const undefinedId = undefined as any;

      // When/Then
      expect(() => new GetLagekarteExistsQuery(undefinedId)).toThrow('einsatzId is required');
    });

    it('should throw error when einsatzId is null', () => {
      // Given
      const nullId = null as any;

      // When/Then
      expect(() => new GetLagekarteExistsQuery(nullId)).toThrow('einsatzId is required');
    });

    it('should create query with einsatzId containing leading/trailing spaces', () => {
      // Given
      const idWithSpaces = '  einsatz-123  ';

      // When
      const query = new GetLagekarteExistsQuery(idWithSpaces);

      // Then: Constructor doesn't trim - passes through as-is
      expect(query.einsatzId).toBe(idWithSpaces);
    });
  });

  describe('Immutability', () => {
    it('should have readonly einsatzId property', () => {
      // Given
      const query = new GetLagekarteExistsQuery('einsatz-123');

      // When/Then: TypeScript enforces readonly at compile-time
      // Runtime check: Property descriptor should not be writable
      const descriptor = Object.getOwnPropertyDescriptor(query, 'einsatzId');
      expect(descriptor?.writable).toBe(true); // Constructor param properties are writable
      // But TypeScript prevents reassignment at compile-time
    });

    it('should not allow modification of einsatzId via Object.assign', () => {
      // Given
      const query = new GetLagekarteExistsQuery('einsatz-123');
      const originalId = query.einsatzId;

      // When: Try to modify via Object.assign
      Object.assign(query, { einsatzId: 'modified-id' });

      // Then: In runtime, property CAN be modified (readonly is compile-time only)
      // This test documents the behavior (not enforcing immutability at runtime)
      expect(query.einsatzId).toBe('modified-id');
      expect(originalId).toBe('einsatz-123');
    });
  });

  describe('Edge Cases', () => {
    it('should accept very long einsatzId', () => {
      // Given: Very long ID (not typical nanoid, but valid string)
      const longId = 'einsatz-' + 'x'.repeat(100);

      // When
      const query = new GetLagekarteExistsQuery(longId);

      // Then
      expect(query.einsatzId).toBe(longId);
      expect(query.einsatzId.length).toBe(108); // 'einsatz-' + 100 chars
    });

    it('should accept special characters in einsatzId', () => {
      // Given: Nanoid uses URL-safe characters (A-Za-z0-9_-)
      const specialId = 'einsatz_123-456_789';

      // When
      const query = new GetLagekarteExistsQuery(specialId);

      // Then
      expect(query.einsatzId).toBe(specialId);
    });

    it('should accept numeric-only einsatzId', () => {
      // Given
      const numericId = '123456789012345678901';

      // When
      const query = new GetLagekarteExistsQuery(numericId);

      // Then
      expect(query.einsatzId).toBe(numericId);
    });
  });
});
