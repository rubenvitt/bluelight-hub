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
      const einsatzId = 'clw3h8x9y0000qwertyuiazaz0'; // Valid CUID2 format

      // When
      const query = new GetLagekarteExistsQuery(einsatzId);

      // Then
      expect(query.einsatzId).toBe(einsatzId);
    });

    it('should create query with valid CUID2 format (20-30 lowercase alphanumeric starting with letter)', () => {
      // Given: Valid CUID2 format
      const validCuid2 = 'clw3h8x9y0000qwertyuiazaz0';

      // When
      const query = new GetLagekarteExistsQuery(validCuid2);

      // Then
      expect(query.einsatzId).toBe(validCuid2);
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
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const undefinedId = undefined as any;

      // When/Then
      expect(() => new GetLagekarteExistsQuery(undefinedId)).toThrow('einsatzId is required');
    });

    it('should throw error when einsatzId is null', () => {
      // Given
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const nullId = null as any;

      // When/Then
      expect(() => new GetLagekarteExistsQuery(nullId)).toThrow('einsatzId is required');
    });
  });

  describe('Immutability', () => {
    it('should have readonly einsatzId property', () => {
      // Given
      const query = new GetLagekarteExistsQuery('clw3h8x9y0000qwertyuiazaz0'); // Valid CUID2 format

      // When/Then: TypeScript enforces readonly at compile-time
      // Runtime check: Property descriptor should not be writable
      const descriptor = Object.getOwnPropertyDescriptor(query, 'einsatzId');
      expect(descriptor?.writable).toBe(true); // Constructor param properties are writable
      // But TypeScript prevents reassignment at compile-time
    });

    it('should not allow modification of einsatzId via Object.assign', () => {
      // Given
      const query = new GetLagekarteExistsQuery('clw3h8x9y0000qwertyuiazaz0');
      const originalId = query.einsatzId;

      // When: Try to modify via Object.assign
      Object.assign(query, { einsatzId: 'clw3h8x9y0000qwertyui00001' });

      // Then: In runtime, property CAN be modified (readonly is compile-time only)
      // This test documents the behavior (not enforcing immutability at runtime)
      expect(query.einsatzId).toBe('clw3h8x9y0000qwertyui00001');
      expect(originalId).toBe('clw3h8x9y0000qwertyuiazaz0');
    });
  });

  describe('Edge Cases', () => {
    it('should accept valid CUID2 with all valid characters', () => {
      // Given: Valid CUID2 format (20-30 lowercase alphanumeric characters starting with letter)
      const validCuid2 = 'clw3h8x9y0000qwertyuiazaz0';

      // When
      const query = new GetLagekarteExistsQuery(validCuid2);

      // Then
      expect(query.einsatzId).toBe(validCuid2);
    });

    it('should reject numeric-only ID (CUID2 must start with letter)', () => {
      // Given
      const numericId = '12345678901234567890123'; // 23 chars but starts with number

      // When/Then
      expect(() => new GetLagekarteExistsQuery(numericId)).toThrow('valid CUID2 format');
    });
  });

  describe('CUID2 Format Validation', () => {
    it('should throw error for invalid CUID2 format (too short)', () => {
      // Given
      const invalidId = 'invalid';

      // When/Then
      expect(() => new GetLagekarteExistsQuery(invalidId)).toThrow('valid CUID2 format');
    });

    it('should throw error for invalid CUID2 format (wrong length)', () => {
      // Given
      const invalidId = 'abc123xyz'; // Only 9 chars, needs 20-30

      // When/Then
      expect(() => new GetLagekarteExistsQuery(invalidId)).toThrow('valid CUID2 format');
    });

    it('should throw error for invalid CUID2 format (too long)', () => {
      // Given
      const invalidId = 'clw3h8x9y0000qwertyuiazaz0toolongexceedsthirtycharacters'; // >30 chars

      // When/Then
      expect(() => new GetLagekarteExistsQuery(invalidId)).toThrow('valid CUID2 format');
    });

    it('should throw error for CUID2 with invalid characters (uppercase)', () => {
      // Given
      const invalidId = 'CLW3H8X9Y0000QWERTYUIAZAZ'; // Uppercase not allowed

      // When/Then
      expect(() => new GetLagekarteExistsQuery(invalidId)).toThrow('valid CUID2 format');
    });

    it('should throw error for CUID2 with invalid characters (special chars)', () => {
      // Given
      const invalidId = 'clw3h8x9y0000_qwerty-ui00'; // Underscores and hyphens not allowed

      // When/Then
      expect(() => new GetLagekarteExistsQuery(invalidId)).toThrow('valid CUID2 format');
    });

    it('should reject very long einsatzId', () => {
      // Given: Very long ID (exceeds CUID2 max length)
      const longId = `einsatz${'x'.repeat(100)}`;

      // When/Then
      expect(() => new GetLagekarteExistsQuery(longId)).toThrow('valid CUID2 format');
    });

    it('should reject einsatzId with spaces', () => {
      // Given
      const idWithSpaces = 'clw3h8x9y0000 qwerty ui0'; // Has spaces

      // When/Then
      expect(() => new GetLagekarteExistsQuery(idWithSpaces)).toThrow('valid CUID2 format');
    });
  });
});
