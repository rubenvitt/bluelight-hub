import { GetPoisQuery } from '../get-pois.query';

/**
 * Unit Tests für GetPoisQuery.
 *
 * Testet Query-Validierung gemäß BDD Given-When-Then Pattern.
 * Coverage Target: >90%
 */
describe('GetPoisQuery', () => {
  describe('Constructor Validation', () => {
    it('should create query with lagekarteId only', () => {
      // Given
      const lagekarteId = 'clw3h8x9y0000qwertyui00001'; // Valid CUID2 format

      // When
      const query = new GetPoisQuery(lagekarteId);

      // Then
      expect(query.lagekarteId).toBe(lagekarteId);
      expect(query.category).toBeUndefined();
    });

    it('should create query with lagekarteId and category', () => {
      // Given
      const lagekarteId = 'clw3h8x9y0000qwertyui00001'; // Valid CUID2 format
      const category = 'EINSATZSTELLE';

      // When
      const query = new GetPoisQuery(lagekarteId, category);

      // Then
      expect(query.lagekarteId).toBe(lagekarteId);
      expect(query.category).toBe(category);
    });

    it('should throw error when lagekarteId is empty string', () => {
      // Given
      const emptyLagekarteId = '';

      // When & Then
      expect(() => new GetPoisQuery(emptyLagekarteId)).toThrow('lagekarteId is required');
    });

    it('should throw error when lagekarteId is whitespace only', () => {
      // Given
      const whitespaceLagekarteId = '   ';

      // When & Then
      expect(() => new GetPoisQuery(whitespaceLagekarteId)).toThrow('lagekarteId is required');
    });

    it('should throw error when lagekarteId is undefined', () => {
      // Given
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const undefinedLagekarteId = undefined as any;

      // When & Then
      expect(() => new GetPoisQuery(undefinedLagekarteId)).toThrow('lagekarteId is required');
    });

    it('should throw error when lagekarteId is null', () => {
      // Given
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const nullLagekarteId = null as any;

      // When & Then
      expect(() => new GetPoisQuery(nullLagekarteId)).toThrow('lagekarteId is required');
    });

    it('should accept valid CUID2 as lagekarteId', () => {
      // Given
      const validCuid2 = 'clw3h8x9y0000qwertyui00001'; // 25 chars, lowercase

      // When
      const query = new GetPoisQuery(validCuid2);

      // Then
      expect(query.lagekarteId).toBe(validCuid2);
    });

    it('should accept category with all valid POI categories', () => {
      // Given
      const lagekarteId = 'clw3h8x9y0000qwertyui00001'; // Valid CUID2 format
      const categories = ['EINSATZSTELLE', 'BEREITSTELLUNGSRAUM', 'GEFAHRENSTELLE', 'WASSERENTNAHMESTELLE', 'SONSTIGES'];

      // When & Then
      for (const category of categories) {
        const query = new GetPoisQuery(lagekarteId, category);
        expect(query.category).toBe(category);
      }
    });

    it('should allow undefined category (no filtering)', () => {
      // Given
      const lagekarteId = 'clw3h8x9y0000qwertyui00001'; // Valid CUID2 format
      const category = undefined;

      // When
      const query = new GetPoisQuery(lagekarteId, category);

      // Then
      expect(query.category).toBeUndefined();
    });

    it('should store category as-is without validation (Handler responsibility)', () => {
      // Given
      const lagekarteId = 'clw3h8x9y0000qwertyui00001'; // Valid CUID2 format
      const invalidCategory = 'INVALID_CATEGORY';

      // When
      const query = new GetPoisQuery(lagekarteId, invalidCategory);

      // Then
      // Query should accept any string - Handler will validate against PoiCategory VO
      expect(query.category).toBe(invalidCategory);
    });
  });

  describe('Immutability', () => {
    it('should have readonly lagekarteId property (compile-time check)', () => {
      // Given
      const query = new GetPoisQuery('clw3h8x9y0000qwertyui00001'); // Valid CUID2 format

      // Then - TypeScript prevents assignment at compile-time
      // Runtime: readonly is advisory, not enforced (JavaScript limitation)
      expect(query.lagekarteId).toBe('clw3h8x9y0000qwertyui00001');

      // This would fail TypeScript compilation:
      // @ts-expect-error - readonly property cannot be reassigned
      query.lagekarteId = 'new-id';
    });

    it('should have readonly category property (compile-time check)', () => {
      // Given
      const query = new GetPoisQuery('clw3h8x9y0000qwertyui00001', 'EINSATZSTELLE');

      // Then - TypeScript prevents assignment at compile-time
      expect(query.category).toBe('EINSATZSTELLE');

      // This would fail TypeScript compilation:
      // @ts-expect-error - readonly property cannot be reassigned
      query.category = 'BEREITSTELLUNGSRAUM';
    });
  });

  describe('CUID2 Format Validation', () => {
    it('should throw error for invalid CUID2 format (too short)', () => {
      // Given
      const invalidId = 'invalid';

      // When/Then
      expect(() => new GetPoisQuery(invalidId)).toThrow('valid CUID2 format');
    });

    it('should throw error for invalid CUID2 format (wrong length)', () => {
      // Given
      const invalidId = 'abc123xyz'; // Only 9 chars, needs 20-30

      // When/Then
      expect(() => new GetPoisQuery(invalidId)).toThrow('valid CUID2 format');
    });

    it('should throw error for invalid CUID2 format (too long)', () => {
      // Given
      const invalidId = 'clw3h8x9y0000qwertyuiazaz0toolongexceedsthirtycharacters'; // >30 chars

      // When/Then
      expect(() => new GetPoisQuery(invalidId)).toThrow('valid CUID2 format');
    });

    it('should accept valid CUID2 format (20-30 lowercase alphanumeric characters starting with letter)', () => {
      // Given
      const validCuid2 = 'clw3h8x9y0000qwertyuiazaz0'; // 26 chars, lowercase, starts with 'c'

      // When
      const query = new GetPoisQuery(validCuid2);

      // Then
      expect(query.lagekarteId).toBe(validCuid2);
    });

    it('should throw error for CUID2 with invalid characters (uppercase)', () => {
      // Given
      const invalidId = 'CLW3H8X9Y0000QWERTYUIAZAZ'; // Uppercase not allowed

      // When/Then
      expect(() => new GetPoisQuery(invalidId)).toThrow('valid CUID2 format');
    });

    it('should allow category parameter with valid CUID2', () => {
      // Given
      const validCuid2 = 'clw3h8x9y0000qwertyui00001'; // 25 chars

      // When
      const query = new GetPoisQuery(validCuid2, 'EINSATZSTELLE');

      // Then
      expect(query.lagekarteId).toBe(validCuid2);
      expect(query.category).toBe('EINSATZSTELLE');
    });
  });
});
