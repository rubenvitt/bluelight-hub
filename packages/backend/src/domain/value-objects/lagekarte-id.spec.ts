import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { Result } from '@domain/common/result';

// Mock nanoid for Jest compatibility (ESM module issue)
jest.mock('nanoid/non-secure', () => ({
  nanoid: jest.fn(() => {
    // Generate valid nanoid format: 21 URL-safe characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let result = '';
    for (let i = 0; i < 21; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
}));

// Import after mock setup
const { nanoid } = require('nanoid/non-secure');

describe('LagekarteId', () => {
  describe('create() - Factory Method', () => {
    it('should auto-generate valid nanoid when no id parameter provided', () => {
      // Given: No ID parameter
      const noIdParameter = undefined;

      // When: Creating LagekarteId without parameter
      const result = LagekarteId.create(noIdParameter);

      // Then: Success with auto-generated nanoid
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.value).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(result.value?.value).toHaveLength(21);
    });

    it('should create LagekarteId with valid nanoid string', () => {
      // Given: Valid nanoid format
      const validNanoid = nanoid(); // Generates 21-char nanoid

      // When: Creating LagekarteId with valid nanoid
      const result = LagekarteId.create(validNanoid);

      // Then: Success with provided nanoid
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.value).toBe(validNanoid);
      expect(result.error).toBeUndefined();
    });

    it('should fail with invalid nanoid format (too short)', () => {
      // Given: Invalid nanoid (too short)
      const tooShortId = 'abc123';

      // When: Creating LagekarteId with invalid format
      const result = LagekarteId.create(tooShortId);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
      expect(result.value).toBeUndefined();
      expect(result.error).toBe('Invalid nanoid format: must be 21 URL-safe characters');
    });

    it('should fail with invalid nanoid format (invalid characters)', () => {
      // Given: Invalid characters (special chars not allowed)
      const invalidChars = 'A1B2C3D4E5F6G7H8I9J@!'; // '@' and '!' not allowed

      // When: Creating LagekarteId with invalid characters
      const result = LagekarteId.create(invalidChars);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid nanoid format: must be 21 URL-safe characters');
    });
  });

  describe('equals() - Equality', () => {
    it('should return true for LagekarteIds with same nanoid value', () => {
      // Given: Two LagekarteIds with same nanoid
      const sharedNanoid = nanoid();
      const id1 = LagekarteId.create(sharedNanoid).value as LagekarteId;
      const id2 = LagekarteId.create(sharedNanoid).value as LagekarteId;

      // When: Comparing for equality
      const areEqual = id1.equals(id2);

      // Then: Equals returns true
      expect(areEqual).toBe(true);
      expect(id1).not.toBe(id2); // Different object instances
    });

    it('should return false for LagekarteIds with different nanoid values', () => {
      // Given: Two LagekarteIds with different nanoids
      const id1 = LagekarteId.create(nanoid()).value as LagekarteId;
      const id2 = LagekarteId.create(nanoid()).value as LagekarteId;

      // When: Comparing for equality
      const areEqual = id1.equals(id2);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });
  });

  describe('ValueObject Integration', () => {
    it('should inherit from ValueObject with immutable props', () => {
      // Given: LagekarteId instance
      const id = LagekarteId.create(nanoid()).value as LagekarteId;

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
    it('should return nanoid string for logging', () => {
      // Given: LagekarteId with known nanoid
      const knownNanoid = nanoid();
      const id = LagekarteId.create(knownNanoid).value as LagekarteId;

      // When: Converting to string
      const stringRepresentation = id.toString();

      // Then: Returns nanoid value
      expect(stringRepresentation).toBe(knownNanoid);
    });
  });
});
