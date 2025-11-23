import { LagekarteId } from '@domain/value-objects/lagekarte-id';

// Mock CUID2 for Jest compatibility (ESM module issue)
jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn(() => {
    // Generate valid CUID2 format: starts with 'c', 20-30 lowercase alphanumeric characters
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'c';
    for (let i = 0; i < 24; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
  isCuid: jest.fn((id: string) => {
    if (typeof id !== 'string') return false;
    if (id.length < 20 || id.length > 30) return false;
    return /^[a-z][a-z0-9]+$/.test(id);
  }),
}));

function generateTestCuid(suffix = ''): string {
  const base = 'clw3h8x9y0000qwertyu';
  const padding = suffix.padEnd(5, '0').slice(0, 5);
  return base + padding;
}

describe('LagekarteId', () => {
  describe('create() - Factory Method', () => {
    it('should auto-generate valid CUID when no id parameter provided', () => {
      // Given: No ID parameter
      const noIdParameter = undefined;

      // When: Creating LagekarteId without parameter
      const result = LagekarteId.create(noIdParameter);

      // Then: Success with auto-generated CUID
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.value).toMatch(/^[a-z][a-z0-9]+$/);
      expect(result.value?.value.length).toBeGreaterThanOrEqual(20);
      expect(result.value?.value.length).toBeLessThanOrEqual(30);
    });

    it('should create LagekarteId with valid CUID string', () => {
      // Given: Valid CUID format
      const validCuid = generateTestCuid('test1');

      // When: Creating LagekarteId with valid CUID
      const result = LagekarteId.create(validCuid);

      // Then: Success with provided CUID
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.value).toBe(validCuid);
      expect(result.error).toBeUndefined();
    });

    it('should fail with invalid CUID format (too short)', () => {
      // Given: Invalid CUID (too short)
      const tooShortId = 'abc123';

      // When: Creating LagekarteId with invalid format
      const result = LagekarteId.create(tooShortId);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
      expect(result.value).toBeUndefined();
      expect(result.error).toBe('Invalid CUID format');
    });

    it('should fail with invalid CUID format (invalid characters)', () => {
      // Given: Invalid characters (uppercase and special chars not allowed)
      const invalidChars = 'cABCDEFGHIJKLMNOPQRSTU'; // Uppercase not allowed

      // When: Creating LagekarteId with invalid characters
      const result = LagekarteId.create(invalidChars);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid CUID format');
    });
  });

  describe('equals() - Equality', () => {
    it('should return true for LagekarteIds with same CUID value', () => {
      // Given: Two LagekarteIds with same CUID
      const sharedCuid = generateTestCuid('equal');
      const id1 = LagekarteId.create(sharedCuid).value as LagekarteId;
      const id2 = LagekarteId.create(sharedCuid).value as LagekarteId;

      // When: Comparing for equality
      const areEqual = id1.equals(id2);

      // Then: Equals returns true
      expect(areEqual).toBe(true);
      expect(id1).not.toBe(id2); // Different object instances
    });

    it('should return false for LagekarteIds with different CUID values', () => {
      // Given: Two LagekarteIds with different CUIDs
      const id1 = LagekarteId.create(generateTestCuid('diff1')).value as LagekarteId;
      const id2 = LagekarteId.create(generateTestCuid('diff2')).value as LagekarteId;

      // When: Comparing for equality
      const areEqual = id1.equals(id2);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });
  });

  describe('ValueObject Integration', () => {
    it('should inherit from ValueObject with immutable props', () => {
      // Given: LagekarteId instance
      const id = LagekarteId.create(generateTestCuid('immut')).value as LagekarteId;

      // When: Accessing props
      const props = id.props;

      // Then: Props are readonly and frozen
      expect(Object.isFrozen(props)).toBe(true);
      expect(() => {
        // @ts-expect-error - Testing runtime immutability
        props.value = 'should-not-change';
      }).toThrow();
    });
  });

  describe('toString() - String Representation', () => {
    it('should return CUID string for logging', () => {
      // Given: LagekarteId with known CUID
      const knownCuid = generateTestCuid('logme');
      const id = LagekarteId.create(knownCuid).value as LagekarteId;

      // When: Converting to string
      const stringRepresentation = id.toString();

      // Then: Returns CUID value
      expect(stringRepresentation).toBe(knownCuid);
    });
  });
});
