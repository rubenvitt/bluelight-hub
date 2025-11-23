import { GetLagekarteQuery } from '../get-lagekarte.query';

/**
 * Unit Tests für GetLagekarteQuery.
 *
 * Testet die Konstruktor-Validierung gemäß Fail-Fast-Prinzip.
 * Ungültige Queries sollten niemals im System existieren.
 */
describe('GetLagekarteQuery', () => {
  describe('Constructor Validation', () => {
    it('should create Query with valid einsatzId', () => {
      // Given
      const einsatzId = 'clw3h8x9y0000qwertyuiazaz0'; // Valid CUID2 format

      // When
      const query = new GetLagekarteQuery(einsatzId);

      // Then
      expect(query).toBeDefined();
      expect(query.einsatzId).toBe(einsatzId);
    });

    it('should throw when einsatzId is empty string', () => {
      // Given
      const emptyEinsatzId = '';

      // When/Then
      expect(() => new GetLagekarteQuery(emptyEinsatzId)).toThrow('einsatzId is required');
    });

    it('should throw when einsatzId is whitespace only', () => {
      // Given
      const whitespaceEinsatzId = '   ';

      // When/Then
      expect(() => new GetLagekarteQuery(whitespaceEinsatzId)).toThrow('einsatzId is required');
    });

    it('should throw when einsatzId is undefined', () => {
      // Given
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const undefinedEinsatzId = undefined as any;

      // When/Then
      expect(() => new GetLagekarteQuery(undefinedEinsatzId)).toThrow('einsatzId is required');
    });

    it('should throw when einsatzId is null', () => {
      // Given
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const nullEinsatzId = null as any;

      // When/Then
      expect(() => new GetLagekarteQuery(nullEinsatzId)).toThrow('einsatzId is required');
    });
  });

  describe('Read-Only Property', () => {
    it('should expose einsatzId as readonly property', () => {
      // Given
      const einsatzId = 'clw3h8x9y0000qwertyuiazaz0'; // Valid CUID2 format
      const query = new GetLagekarteQuery(einsatzId);

      // When/Then
      expect(query.einsatzId).toBe(einsatzId);

      // Verify readonly (TypeScript compile-time check)
      // @ts-expect-error - readonly property cannot be reassigned
      query.einsatzId = 'other-id';
    });
  });

  describe('CUID2 Format Validation', () => {
    it('should throw error for invalid CUID2 format (too short)', () => {
      // Given
      const invalidId = 'invalid';

      // When/Then
      expect(() => new GetLagekarteQuery(invalidId)).toThrow('valid CUID2 format');
    });

    it('should throw error for invalid CUID2 format (wrong length)', () => {
      // Given
      const invalidId = 'abc123xyz'; // Only 9 chars, needs 20-30

      // When/Then
      expect(() => new GetLagekarteQuery(invalidId)).toThrow('valid CUID2 format');
    });

    it('should throw error for invalid CUID2 format (too long)', () => {
      // Given
      const invalidId = 'clw3h8x9y0000qwertyuiazaz0toolongexceedsthirtycharacters'; // >30 chars

      // When/Then
      expect(() => new GetLagekarteQuery(invalidId)).toThrow('valid CUID2 format');
    });

    it('should accept valid CUID2 format (20-30 lowercase alphanumeric characters starting with letter)', () => {
      // Given
      const validCuid2 = 'clw3h8x9y0000qwertyuiazaz0'; // 26 chars, lowercase, starts with 'c'

      // When
      const query = new GetLagekarteQuery(validCuid2);

      // Then
      expect(query.einsatzId).toBe(validCuid2);
    });

    it('should throw error for CUID2 with invalid characters (uppercase)', () => {
      // Given
      const invalidId = 'CLW3H8X9Y0000QWERTYUIAZAZ'; // Uppercase not allowed

      // When/Then
      expect(() => new GetLagekarteQuery(invalidId)).toThrow('valid CUID2 format');
    });

    it('should throw error for CUID2 with invalid characters (special chars)', () => {
      // Given
      const invalidId = 'clw3h8x9y0000_qwerty-ui00'; // Underscores and hyphens not allowed

      // When/Then
      expect(() => new GetLagekarteQuery(invalidId)).toThrow('valid CUID2 format');
    });

    it('should throw error for CUID2 starting with number', () => {
      // Given
      const invalidId = '9lw3h8x9y0000qwertyuiazaz'; // Must start with letter

      // When/Then
      expect(() => new GetLagekarteQuery(invalidId)).toThrow('valid CUID2 format');
    });
  });
});
