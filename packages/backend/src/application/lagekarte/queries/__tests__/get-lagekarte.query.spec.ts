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
      const einsatzId = 'valid-einsatz-id-123';

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
      const einsatzId = 'test-einsatz-id';
      const query = new GetLagekarteQuery(einsatzId);

      // When/Then
      expect(query.einsatzId).toBe(einsatzId);

      // Verify readonly (TypeScript compile-time check)
      // @ts-expect-error - readonly property cannot be reassigned
      query.einsatzId = 'other-id';
    });
  });
});
