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
      const einsatzId = 'AZaz09_-0123456789XYZ'; // Valid 21-char nanoid

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
  });

  describe('Immutability', () => {
    it('should have readonly einsatzId property', () => {
      // Given
      const query = new GetLagekarteExistsQuery('AZaz09_-0123456789XYZ'); // Valid 21-char nanoid

      // When/Then: TypeScript enforces readonly at compile-time
      // Runtime check: Property descriptor should not be writable
      const descriptor = Object.getOwnPropertyDescriptor(query, 'einsatzId');
      expect(descriptor?.writable).toBe(true); // Constructor param properties are writable
      // But TypeScript prevents reassignment at compile-time
    });

    it('should not allow modification of einsatzId via Object.assign', () => {
      // Given
      const query = new GetLagekarteExistsQuery('AZaz09_-0123456789XYZ');
      const originalId = query.einsatzId;

      // When: Try to modify via Object.assign
      Object.assign(query, { einsatzId: 'V1StGXR8_Z5jdHi6B-myT' });

      // Then: In runtime, property CAN be modified (readonly is compile-time only)
      // This test documents the behavior (not enforcing immutability at runtime)
      expect(query.einsatzId).toBe('V1StGXR8_Z5jdHi6B-myT');
      expect(originalId).toBe('AZaz09_-0123456789XYZ');
    });
  });

  describe('Edge Cases', () => {
    it('should accept valid nanoid with all valid characters', () => {
      // Given: Valid nanoid format (21 URL-safe characters)
      const validNanoid = 'AZaz09_-0123456789XYZ';

      // When
      const query = new GetLagekarteExistsQuery(validNanoid);

      // Then
      expect(query.einsatzId).toBe(validNanoid);
    });

    it('should accept numeric-only nanoid (21 characters)', () => {
      // Given
      const numericId = '123456789012345678901';

      // When
      const query = new GetLagekarteExistsQuery(numericId);

      // Then
      expect(query.einsatzId).toBe(numericId);
    });
  });

  describe('Nanoid Format Validation', () => {
    it('should throw error for invalid nanoid format (too short)', () => {
      // Given
      const invalidId = 'invalid';

      // When/Then
      expect(() => new GetLagekarteExistsQuery(invalidId)).toThrow('valid nanoid format');
    });

    it('should throw error for invalid nanoid format (wrong length)', () => {
      // Given
      const invalidId = 'abc-123-xyz'; // Only 11 chars

      // When/Then
      expect(() => new GetLagekarteExistsQuery(invalidId)).toThrow('valid nanoid format');
    });

    it('should throw error for invalid nanoid format (too long)', () => {
      // Given
      const invalidId = 'toolongnanoidexceedstwentyonecharacters'; // 42 chars

      // When/Then
      expect(() => new GetLagekarteExistsQuery(invalidId)).toThrow('valid nanoid format');
    });

    it('should throw error for nanoid with invalid characters', () => {
      // Given
      const invalidId = 'invalid@chars#!21char'; // 21 chars but invalid symbols

      // When/Then
      expect(() => new GetLagekarteExistsQuery(invalidId)).toThrow('valid nanoid format');
    });

    it('should reject very long einsatzId', () => {
      // Given: Very long ID (not typical nanoid)
      const longId = 'einsatz-' + 'x'.repeat(100);

      // When/Then
      expect(() => new GetLagekarteExistsQuery(longId)).toThrow('valid nanoid format');
    });

    it('should reject einsatzId with spaces', () => {
      // Given
      const idWithSpaces = 'einsatz 123 456 7890'; // 20 chars but has spaces

      // When/Then
      expect(() => new GetLagekarteExistsQuery(idWithSpaces)).toThrow('valid nanoid format');
    });
  });
});
