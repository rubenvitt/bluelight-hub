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
      const lagekarteId = 'lagekarte-123';

      // When
      const query = new GetPoisQuery(lagekarteId);

      // Then
      expect(query.lagekarteId).toBe(lagekarteId);
      expect(query.category).toBeUndefined();
    });

    it('should create query with lagekarteId and category', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
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
      const undefinedLagekarteId = undefined as any;

      // When & Then
      expect(() => new GetPoisQuery(undefinedLagekarteId)).toThrow('lagekarteId is required');
    });

    it('should throw error when lagekarteId is null', () => {
      // Given
      const nullLagekarteId = null as any;

      // When & Then
      expect(() => new GetPoisQuery(nullLagekarteId)).toThrow('lagekarteId is required');
    });

    it('should accept valid nanoid as lagekarteId', () => {
      // Given
      const validNanoid = 'V1StGXR8_Z5jdHi6B-myT'; // 21 chars

      // When
      const query = new GetPoisQuery(validNanoid);

      // Then
      expect(query.lagekarteId).toBe(validNanoid);
    });

    it('should accept category with all valid POI categories', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const categories = ['EINSATZSTELLE', 'BEREITSTELLUNGSRAUM', 'GEFAHRENSTELLE', 'WASSERENTNAHMESTELLE', 'SONSTIGES'];

      // When & Then
      for (const category of categories) {
        const query = new GetPoisQuery(lagekarteId, category);
        expect(query.category).toBe(category);
      }
    });

    it('should allow undefined category (no filtering)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
      const category = undefined;

      // When
      const query = new GetPoisQuery(lagekarteId, category);

      // Then
      expect(query.category).toBeUndefined();
    });

    it('should store category as-is without validation (Handler responsibility)', () => {
      // Given
      const lagekarteId = 'lagekarte-123';
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
      const query = new GetPoisQuery('lagekarte-123');

      // Then - TypeScript prevents assignment at compile-time
      // Runtime: readonly is advisory, not enforced (JavaScript limitation)
      expect(query.lagekarteId).toBe('lagekarte-123');

      // This would fail TypeScript compilation:
      // @ts-expect-error - readonly property cannot be reassigned
      query.lagekarteId = 'new-id';
    });

    it('should have readonly category property (compile-time check)', () => {
      // Given
      const query = new GetPoisQuery('lagekarte-123', 'EINSATZSTELLE');

      // Then - TypeScript prevents assignment at compile-time
      expect(query.category).toBe('EINSATZSTELLE');

      // This would fail TypeScript compilation:
      // @ts-expect-error - readonly property cannot be reassigned
      query.category = 'BEREITSTELLUNGSRAUM';
    });
  });
});
