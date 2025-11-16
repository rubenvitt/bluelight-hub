import { EinsatzId } from '@domain/value-objects/einsatz-id';
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

describe('EinsatzId', () => {
  describe('create() - Factory Method', () => {
    it('should auto-generate valid nanoid when no id parameter provided', () => {
      // Given: No ID parameter
      const noIdParameter = undefined;

      // When: Creating EinsatzId without parameter
      const result = EinsatzId.create(noIdParameter);

      // Then: Success with auto-generated nanoid
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.value).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(result.value?.value).toHaveLength(21);
    });

    it('should create EinsatzId with valid nanoid string', () => {
      // Given: Valid nanoid format
      const validNanoid = nanoid(); // Generates 21-char nanoid

      // When: Creating EinsatzId with valid nanoid
      const result = EinsatzId.create(validNanoid);

      // Then: Success with provided nanoid
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.value).toBe(validNanoid);
      expect(result.error).toBeUndefined();
    });

    it('should fail with invalid nanoid format (too short)', () => {
      // Given: Invalid nanoid (too short)
      const tooShortId = 'abc123';

      // When: Creating EinsatzId with invalid format
      const result = EinsatzId.create(tooShortId);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
      expect(result.value).toBeUndefined();
      expect(result.error).toBe('Invalid nanoid format: must be 21 URL-safe characters');
    });

    it('should fail with invalid nanoid format (too long)', () => {
      // Given: Invalid nanoid (too long)
      const tooLongId = 'A1B2C3D4E5F6G7H8I9J0K_EXTRA';

      // When: Creating EinsatzId with invalid format
      const result = EinsatzId.create(tooLongId);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid nanoid format: must be 21 URL-safe characters');
    });

    it('should fail with invalid characters in nanoid', () => {
      // Given: Invalid characters (special chars not allowed)
      const invalidChars = 'A1B2C3D4E5F6G7H8I9J@!'; // '@' and '!' not allowed

      // When: Creating EinsatzId with invalid characters
      const result = EinsatzId.create(invalidChars);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid nanoid format: must be 21 URL-safe characters');
    });

    it('should accept all valid nanoid characters (A-Za-z0-9_-)', () => {
      // Given: Nanoid with all valid character types
      const validMixedChars = 'ABCxyz123_-4567890123'; // 21 chars with A-Z, a-z, 0-9, _, -

      // When: Creating EinsatzId with valid mixed characters
      const result = EinsatzId.create(validMixedChars);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe(validMixedChars);
    });
  });

  describe('value - Getter', () => {
    it('should return the nanoid string via value getter', () => {
      // Given: EinsatzId with known nanoid
      const knownNanoid = nanoid();
      const result = EinsatzId.create(knownNanoid);

      // When: Accessing value getter
      const einsatzId = result.value as EinsatzId;
      const idValue = einsatzId.value;

      // Then: Returns nanoid string
      expect(idValue).toBe(knownNanoid);
      expect(typeof idValue).toBe('string');
    });
  });

  describe('equals() - Equality', () => {
    it('should return true for EinsatzIds with same nanoid value', () => {
      // Given: Two EinsatzIds with same nanoid
      const sharedNanoid = nanoid();
      const id1 = EinsatzId.create(sharedNanoid).value as EinsatzId;
      const id2 = EinsatzId.create(sharedNanoid).value as EinsatzId;

      // When: Comparing for equality
      const areEqual = id1.equals(id2);

      // Then: Equals returns true
      expect(areEqual).toBe(true);
      expect(id1).not.toBe(id2); // Different object instances
    });

    it('should return false for EinsatzIds with different nanoid values', () => {
      // Given: Two EinsatzIds with different nanoids
      const id1 = EinsatzId.create(nanoid()).value as EinsatzId;
      const id2 = EinsatzId.create(nanoid()).value as EinsatzId;

      // When: Comparing for equality
      const areEqual = id1.equals(id2);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });

    it('should return true when comparing same instance', () => {
      // Given: Same EinsatzId instance
      const id = EinsatzId.create(nanoid()).value as EinsatzId;

      // When: Comparing with itself
      const areEqual = id.equals(id);

      // Then: Equals returns true
      expect(areEqual).toBe(true);
    });

    it('should return false when comparing with undefined', () => {
      // Given: EinsatzId and undefined
      const id = EinsatzId.create(nanoid()).value as EinsatzId;
      const undefinedId = undefined;

      // When: Comparing with undefined
      const areEqual = id.equals(undefinedId);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });

    it('should return false when comparing with null', () => {
      // Given: EinsatzId and null
      const id = EinsatzId.create(nanoid()).value as EinsatzId;
      const nullId = null as unknown as EinsatzId;

      // When: Comparing with null
      const areEqual = id.equals(nullId);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });
  });

  describe('toString() - String Representation', () => {
    it('should return nanoid string for logging', () => {
      // Given: EinsatzId with known nanoid
      const knownNanoid = nanoid();
      const id = EinsatzId.create(knownNanoid).value as EinsatzId;

      // When: Converting to string
      const stringRepresentation = id.toString();

      // Then: Returns nanoid value
      expect(stringRepresentation).toBe(knownNanoid);
    });

    it('should work in template literals for logging', () => {
      // Given: EinsatzId
      const id = EinsatzId.create(nanoid()).value as EinsatzId;

      // When: Using in template literal
      const logMessage = `Einsatz ID: ${id}`;

      // Then: Contains nanoid value
      expect(logMessage).toContain('Einsatz ID: ');
      expect(logMessage.replace('Einsatz ID: ', '')).toMatch(/^[A-Za-z0-9_-]{21}$/);
    });
  });

  describe('Type-Safety (compile-time)', () => {
    /**
     * Type-Safety Demonstration: Compile-time type checking.
     * Diese Tests demonstrieren, dass TypeScript verhindert,
     * dass EinsatzId und UserId vertauscht werden können.
     *
     * Hinweis: Diese Tests prüfen Runtime-Verhalten, aber die
     * eigentliche Type-Safety wird durch TypeScript zur Compile-Time erzwungen.
     */

    // Mock UserId for type-safety demonstration
    class UserId extends EinsatzId.prototype.constructor<'User'> {}

    it('should create EinsatzId type distinct from other EntityId types', () => {
      // Given: Different aggregate types
      const einsatzId = EinsatzId.create().value as EinsatzId;

      // When: Checking types at runtime
      const constructorName = einsatzId.constructor.name;

      // Then: Correct class name
      expect(constructorName).toBe('EinsatzId');
    });

    it('should demonstrate compile-time type safety via function signature', () => {
      // Given: Function that expects specific EinsatzId type
      function processEinsatz(id: EinsatzId): string {
        return `Processing Einsatz: ${id.toString()}`;
      }

      // When: Calling with correct type
      const einsatzId = EinsatzId.create().value as EinsatzId;
      const result = processEinsatz(einsatzId);

      // Then: Function executes successfully
      expect(result).toContain('Processing Einsatz:');

      // Note: The following would cause a TypeScript compile error:
      // const userId = UserId.create().value as UserId;
      // processEinsatz(userId); // ❌ Compile Error: Argument of type 'UserId' is not assignable to parameter of type 'EinsatzId'
    });
  });

  describe('Result<T> Pattern Integration', () => {
    it('should return Result<EinsatzId> with success state', () => {
      // Given: Valid nanoid
      const validNanoid = nanoid();

      // When: Creating EinsatzId
      const result = EinsatzId.create(validNanoid);

      // Then: Result object with success state
      expect(result).toBeInstanceOf(Result);
      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(result.value).toBeInstanceOf(EinsatzId);
      expect(result.error).toBeUndefined();
    });

    it('should return Result<EinsatzId> with failure state', () => {
      // Given: Invalid nanoid
      const invalidNanoid = 'invalid';

      // When: Creating EinsatzId
      const result = EinsatzId.create(invalidNanoid);

      // Then: Result object with failure state
      expect(result).toBeInstanceOf(Result);
      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
      expect(result.value).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error).toBe('Invalid nanoid format: must be 21 URL-safe characters');
    });

    it('should allow safe access via isSuccess check', () => {
      // Given: EinsatzId creation
      const result = EinsatzId.create();

      // When: Checking success before accessing value
      if (result.isSuccess) {
        const id = result.value;

        // Then: Safe access to value
        expect(id).toBeDefined();
        expect(id?.value).toMatch(/^[A-Za-z0-9_-]{21}$/);
      } else {
        // This branch should not execute for auto-generated IDs
        fail('Auto-generated ID should always succeed');
      }
    });
  });

  describe('ValueObject Integration', () => {
    it('should inherit from ValueObject with immutable props', () => {
      // Given: EinsatzId instance
      const id = EinsatzId.create(nanoid()).value as EinsatzId;

      // When: Accessing props
      const props = id.props;

      // Then: Props are readonly and frozen
      expect(Object.isFrozen(props)).toBe(true);
      expect(() => {
        // @ts-expect-error - Testing runtime immutability
        props.value = 'should-not-change';
      }).toThrow();
    });

    it('should have hashCode for Set/Map compatibility', () => {
      // Given: EinsatzId instance
      const id = EinsatzId.create(nanoid()).value as EinsatzId;

      // When: Generating hashCode
      const hash = id.hashCode();

      // Then: Returns numeric hash
      expect(typeof hash).toBe('number');
      expect(hash).toBeGreaterThanOrEqual(0);
    });

    it('should produce same hashCode for equal EinsatzIds', () => {
      // Given: Two EinsatzIds with same nanoid
      const sharedNanoid = nanoid();
      const id1 = EinsatzId.create(sharedNanoid).value as EinsatzId;
      const id2 = EinsatzId.create(sharedNanoid).value as EinsatzId;

      // When: Generating hashCodes
      const hash1 = id1.hashCode();
      const hash2 = id2.hashCode();

      // Then: Same hash for equal values
      expect(hash1).toBe(hash2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string as invalid', () => {
      // Given: Empty string
      const emptyString = '';

      // When: Creating EinsatzId
      const result = EinsatzId.create(emptyString);

      // Then: Failure
      expect(result.isFailure).toBe(true);
    });

    it('should handle whitespace-only string as invalid', () => {
      // Given: Whitespace string (21 spaces)
      const whitespace = '                     '; // 21 spaces

      // When: Creating EinsatzId
      const result = EinsatzId.create(whitespace);

      // Then: Failure (spaces not allowed in nanoid)
      expect(result.isFailure).toBe(true);
    });

    it('should handle exact 21 characters with valid chars', () => {
      // Given: Exactly 21 valid characters
      const exactLength = 'A1B2C3D4E5F6G7H8I9J0K';

      // When: Creating EinsatzId
      const result = EinsatzId.create(exactLength);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe(exactLength);
    });

    it('should consistently generate different nanoids on each call', () => {
      // Given: Multiple auto-generations
      const id1 = EinsatzId.create().value as EinsatzId;
      const id2 = EinsatzId.create().value as EinsatzId;
      const id3 = EinsatzId.create().value as EinsatzId;

      // When: Comparing generated values
      const allUnique = id1.value !== id2.value && id2.value !== id3.value && id1.value !== id3.value;

      // Then: All different (extremely high probability with nanoid)
      expect(allUnique).toBe(true);
    });
  });

  describe('Einsatz-Specific Behavior', () => {
    it('should work correctly when used in Einsatz domain operations', () => {
      // Given: Einsatz ID for domain operation
      const einsatzId = EinsatzId.create().value as EinsatzId;

      // When: Using in domain context
      function createEinsatzReference(id: EinsatzId): string {
        return `EINSATZ-${id.toString()}`;
      }
      const reference = createEinsatzReference(einsatzId);

      // Then: Correctly generates reference
      expect(reference).toMatch(/^EINSATZ-[A-Za-z0-9_-]{21}$/);
    });

    it('should support multiple EinsatzId instances in collections', () => {
      // Given: Multiple Einsatz IDs
      const id1 = EinsatzId.create().value as EinsatzId;
      const id2 = EinsatzId.create().value as EinsatzId;
      const id3 = EinsatzId.create().value as EinsatzId;

      // When: Storing in Set (requires hashCode)
      const einsatzSet = new Set([id1, id2, id3]);

      // Then: All unique IDs stored
      expect(einsatzSet.size).toBe(3);
      expect(einsatzSet.has(id1)).toBe(true);
      expect(einsatzSet.has(id2)).toBe(true);
      expect(einsatzSet.has(id3)).toBe(true);
    });

    it('should support EinsatzId as Map keys', () => {
      // Given: EinsatzIds used as Map keys
      const id1 = EinsatzId.create().value as EinsatzId;
      const id2 = EinsatzId.create().value as EinsatzId;

      // When: Creating Map with EinsatzId keys
      const einsatzMap = new Map<EinsatzId, string>();
      einsatzMap.set(id1, 'Einsatz Alpha');
      einsatzMap.set(id2, 'Einsatz Beta');

      // Then: Map operations work correctly
      expect(einsatzMap.size).toBe(2);
      expect(einsatzMap.get(id1)).toBe('Einsatz Alpha');
      expect(einsatzMap.get(id2)).toBe('Einsatz Beta');
    });

    it('should maintain immutability for Einsatz aggregate consistency', () => {
      // Given: EinsatzId instance
      const originalNanoid = nanoid();
      const einsatzId = EinsatzId.create(originalNanoid).value as EinsatzId;

      // When: Attempting to access internal value
      const retrievedValue = einsatzId.value;

      // Then: Value remains unchanged and immutable
      expect(retrievedValue).toBe(originalNanoid);
      expect(einsatzId.value).toBe(originalNanoid); // Still the same
    });
  });
});
