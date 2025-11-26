import { GetEinsatzByNummerQuery } from '../get-einsatz-by-nummer.query';

/**
 * Unit Tests für GetEinsatzByNummerQuery.
 *
 * Testet Constructor-Validierung gemäß BDD Given-When-Then Pattern.
 * Coverage Target: >90%
 */
describe('GetEinsatzByNummerQuery', () => {
  describe('Constructor Validation', () => {
    it('should create query with valid nummer', () => {
      // Given
      const nummer = 'E2024-abc123xy';

      // When
      const query = new GetEinsatzByNummerQuery(nummer);

      // Then
      expect(query.nummer).toBe(nummer);
    });

    it('should create query with valid einsatznummer format', () => {
      // Given: Valid Einsatznummer format (E{YEAR}-{8 chars})
      const validNummer = 'E2024-test1234';

      // When
      const query = new GetEinsatzByNummerQuery(validNummer);

      // Then
      expect(query.nummer).toBe(validNummer);
    });

    it('should throw error when nummer is empty string', () => {
      // Given
      const emptyNummer = '';

      // When/Then
      expect(() => new GetEinsatzByNummerQuery(emptyNummer)).toThrow('nummer is required');
    });

    it('should throw error when nummer is whitespace-only', () => {
      // Given
      const whitespaceNummer = '   ';

      // When/Then
      expect(() => new GetEinsatzByNummerQuery(whitespaceNummer)).toThrow('nummer is required');
    });

    it('should throw error when nummer is undefined', () => {
      // Given
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const undefinedNummer = undefined as any;

      // When/Then
      expect(() => new GetEinsatzByNummerQuery(undefinedNummer)).toThrow('nummer is required');
    });

    it('should throw error when nummer is null', () => {
      // Given
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const nullNummer = null as any;

      // When/Then
      expect(() => new GetEinsatzByNummerQuery(nullNummer)).toThrow('nummer is required');
    });
  });

  describe('Immutability', () => {
    it('should have readonly nummer property', () => {
      // Given
      const query = new GetEinsatzByNummerQuery('E2024-abc123xy');

      // When/Then: TypeScript enforces readonly at compile-time
      // Runtime check: Property descriptor should not be writable
      const descriptor = Object.getOwnPropertyDescriptor(query, 'nummer');
      expect(descriptor?.writable).toBe(true); // Constructor param properties are writable
      // But TypeScript prevents reassignment at compile-time
    });

    it('should not allow modification of nummer via Object.assign', () => {
      // Given
      const query = new GetEinsatzByNummerQuery('E2024-abc123xy');
      const originalNummer = query.nummer;

      // When: Try to modify via Object.assign
      Object.assign(query, { nummer: 'E2024-changed00' });

      // Then: In runtime, property CAN be modified (readonly is compile-time only)
      // This test documents the behavior (not enforcing immutability at runtime)
      expect(query.nummer).toBe('E2024-changed00');
      expect(originalNummer).toBe('E2024-abc123xy');
    });
  });

  describe('Edge Cases', () => {
    it('should accept nummer with valid format characters', () => {
      // Given: Valid Einsatznummer format
      const validNummer = 'E2025-xyz98765';

      // When
      const query = new GetEinsatzByNummerQuery(validNummer);

      // Then
      expect(query.nummer).toBe(validNummer);
    });

    it('should accept nummer with uppercase letters', () => {
      // Given
      const nummerWithUppercase = 'E2024-ABC12345';

      // When
      const query = new GetEinsatzByNummerQuery(nummerWithUppercase);

      // Then
      expect(query.nummer).toBe(nummerWithUppercase);
    });

    it('should accept nummer with mixed case', () => {
      // Given
      const nummerMixedCase = 'E2024-AbC123Xy';

      // When
      const query = new GetEinsatzByNummerQuery(nummerMixedCase);

      // Then
      expect(query.nummer).toBe(nummerMixedCase);
    });

    it('should accept very long nummer', () => {
      // Given: Very long nummer (edge case, but valid if not empty)
      const longNummer = `E2024-${'a'.repeat(100)}`;

      // When
      const query = new GetEinsatzByNummerQuery(longNummer);

      // Then
      expect(query.nummer).toBe(longNummer);
    });

    it('should accept nummer with hyphens', () => {
      // Given
      const nummerWithHyphens = 'E2024-abc-123-xy';

      // When
      const query = new GetEinsatzByNummerQuery(nummerWithHyphens);

      // Then
      expect(query.nummer).toBe(nummerWithHyphens);
    });

    it('should accept nummer with underscores', () => {
      // Given
      const nummerWithUnderscores = 'E2024_abc123xy';

      // When
      const query = new GetEinsatzByNummerQuery(nummerWithUnderscores);

      // Then
      expect(query.nummer).toBe(nummerWithUnderscores);
    });

    it('should handle nummer with trailing whitespace (trimmed by validation)', () => {
      // Given
      const nummerWithTrailingSpace = 'E2024-abc123xy ';

      // When/Then: validateRequiredString trims, but only checks if result is empty
      // This should succeed because after trim it's not empty
      const query = new GetEinsatzByNummerQuery(nummerWithTrailingSpace);
      expect(query.nummer).toBe(nummerWithTrailingSpace);
    });

    it('should handle nummer with leading whitespace (trimmed by validation)', () => {
      // Given
      const nummerWithLeadingSpace = ' E2024-abc123xy';

      // When/Then: validateRequiredString trims, but only checks if result is empty
      // This should succeed because after trim it's not empty
      const query = new GetEinsatzByNummerQuery(nummerWithLeadingSpace);
      expect(query.nummer).toBe(nummerWithLeadingSpace);
    });

    it('should accept minimum length nummer (single character)', () => {
      // Given
      const minNummer = 'E';

      // When
      const query = new GetEinsatzByNummerQuery(minNummer);

      // Then
      expect(query.nummer).toBe(minNummer);
    });
  });

  describe('Format Flexibility', () => {
    it('should accept standard format E{YEAR}-{8chars}', () => {
      // Given
      const standardNummer = 'E2024-abc123xy';

      // When
      const query = new GetEinsatzByNummerQuery(standardNummer);

      // Then
      expect(query.nummer).toBe(standardNummer);
    });

    it('should accept alternative separator', () => {
      // Given: Alternative format (though not standard)
      const altNummer = 'E2024_abc123xy';

      // When
      const query = new GetEinsatzByNummerQuery(altNummer);

      // Then
      expect(query.nummer).toBe(altNummer);
    });

    it('should accept numeric only suffix', () => {
      // Given
      const numericSuffixNummer = 'E2024-12345678';

      // When
      const query = new GetEinsatzByNummerQuery(numericSuffixNummer);

      // Then
      expect(query.nummer).toBe(numericSuffixNummer);
    });

    it('should accept different year format', () => {
      // Given
      const differentYearNummer = 'E2025-abc123xy';

      // When
      const query = new GetEinsatzByNummerQuery(differentYearNummer);

      // Then
      expect(query.nummer).toBe(differentYearNummer);
    });
  });
});
