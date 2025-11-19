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
      const einsatzId = 'AZaz09_-0123456789XYZ'; // Valid 21-char nanoid

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
      const undefinedEinsatzId = undefined as any;

      // When/Then
      expect(() => new GetLagekarteQuery(undefinedEinsatzId)).toThrow('einsatzId is required');
    });

    it('should throw when einsatzId is null', () => {
      // Given
      const nullEinsatzId = null as any;

      // When/Then
      expect(() => new GetLagekarteQuery(nullEinsatzId)).toThrow('einsatzId is required');
    });
  });

  describe('Read-Only Property', () => {
    it('should expose einsatzId as readonly property', () => {
      // Given
      const einsatzId = 'AZaz09_-0123456789XYZ'; // Valid 21-char nanoid
      const query = new GetLagekarteQuery(einsatzId);

      // When/Then
      expect(query.einsatzId).toBe(einsatzId);

      // Verify readonly (TypeScript compile-time check)
      // @ts-expect-error - readonly property cannot be reassigned
      query.einsatzId = 'other-id';
    });
  });

  describe('Nanoid Format Validation', () => {
    it('should throw error for invalid nanoid format (too short)', () => {
      // Given
      const invalidId = 'invalid';

      // When/Then
      expect(() => new GetLagekarteQuery(invalidId)).toThrow('valid nanoid format');
    });

    it('should throw error for invalid nanoid format (wrong length)', () => {
      // Given
      const invalidId = 'abc-123-xyz'; // Only 11 chars

      // When/Then
      expect(() => new GetLagekarteQuery(invalidId)).toThrow('valid nanoid format');
    });

    it('should throw error for invalid nanoid format (too long)', () => {
      // Given
      const invalidId = 'toolongnanoidexceedstwentyonecharacters'; // 42 chars

      // When/Then
      expect(() => new GetLagekarteQuery(invalidId)).toThrow('valid nanoid format');
    });

    it('should accept valid 21-character nanoid with all valid characters', () => {
      // Given
      const validNanoid = 'AZaz09_-0123456789XYZ'; // 21 chars, all valid

      // When
      const query = new GetLagekarteQuery(validNanoid);

      // Then
      expect(query.einsatzId).toBe(validNanoid);
    });

    it('should throw error for nanoid with invalid characters', () => {
      // Given
      const invalidId = 'invalid@chars#!21char'; // 21 chars but invalid symbols

      // When/Then
      expect(() => new GetLagekarteQuery(invalidId)).toThrow('valid nanoid format');
    });
  });
});
