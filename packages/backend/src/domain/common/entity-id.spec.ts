import { EntityId } from '@domain/common/entity-id';
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

/**
 * Test-Implementierung einer konkreten EntityId Klasse.
 * Simuliert eine reale Aggregate ID für Testing-Zwecke.
 */
class TestEntityId extends EntityId<'TestEntity'> {}

describe('EntityId<TAggregateType>', () => {
  describe('create() - Factory Method', () => {
    it('should auto-generate valid nanoid when no id parameter provided', () => {
      // Given: No ID parameter
      const noIdParameter = undefined;

      // When: Creating EntityId without parameter
      const result = TestEntityId.create(noIdParameter);

      // Then: Success with auto-generated nanoid
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.value).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(result.value?.value).toHaveLength(21);
    });

    it('should create EntityId with valid nanoid string', () => {
      // Given: Valid nanoid format
      const validNanoid = nanoid(); // Generates 21-char nanoid

      // When: Creating EntityId with valid nanoid
      const result = TestEntityId.create(validNanoid);

      // Then: Success with provided nanoid
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.value).toBe(validNanoid);
      expect(result.error).toBeUndefined();
    });

    it('should fail with invalid nanoid format (too short)', () => {
      // Given: Invalid nanoid (too short)
      const tooShortId = 'abc123';

      // When: Creating EntityId with invalid format
      const result = TestEntityId.create(tooShortId);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
      expect(result.value).toBeUndefined();
      expect(result.error).toBe('Invalid nanoid format: must be 21 URL-safe characters');
    });

    it('should fail with invalid nanoid format (too long)', () => {
      // Given: Invalid nanoid (too long)
      const tooLongId = 'A1B2C3D4E5F6G7H8I9J0K_EXTRA';

      // When: Creating EntityId with invalid format
      const result = TestEntityId.create(tooLongId);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid nanoid format: must be 21 URL-safe characters');
    });

    it('should fail with invalid characters in nanoid', () => {
      // Given: Invalid characters (special chars not allowed)
      const invalidChars = 'A1B2C3D4E5F6G7H8I9J@!'; // '@' and '!' not allowed

      // When: Creating EntityId with invalid characters
      const result = TestEntityId.create(invalidChars);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid nanoid format: must be 21 URL-safe characters');
    });

    it('should accept all valid nanoid characters (A-Za-z0-9_-)', () => {
      // Given: Nanoid with all valid character types
      const validMixedChars = 'ABCxyz123_-4567890123'; // 21 chars with A-Z, a-z, 0-9, _, -

      // When: Creating EntityId with valid mixed characters
      const result = TestEntityId.create(validMixedChars);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe(validMixedChars);
    });
  });

  describe('value - Getter', () => {
    it('should return the nanoid string via value getter', () => {
      // Given: EntityId with known nanoid
      const knownNanoid = nanoid();
      const result = TestEntityId.create(knownNanoid);

      // When: Accessing value getter
      const entityId = result.value as TestEntityId;
      const idValue = entityId.value;

      // Then: Returns nanoid string
      expect(idValue).toBe(knownNanoid);
      expect(typeof idValue).toBe('string');
    });
  });

  describe('equals() - Equality', () => {
    it('should return true for EntityIds with same nanoid value', () => {
      // Given: Two EntityIds with same nanoid
      const sharedNanoid = nanoid();
      const id1 = TestEntityId.create(sharedNanoid).value as TestEntityId;
      const id2 = TestEntityId.create(sharedNanoid).value as TestEntityId;

      // When: Comparing for equality
      const areEqual = id1.equals(id2);

      // Then: Equals returns true
      expect(areEqual).toBe(true);
      expect(id1).not.toBe(id2); // Different object instances
    });

    it('should return false for EntityIds with different nanoid values', () => {
      // Given: Two EntityIds with different nanoids
      const id1 = TestEntityId.create(nanoid()).value as TestEntityId;
      const id2 = TestEntityId.create(nanoid()).value as TestEntityId;

      // When: Comparing for equality
      const areEqual = id1.equals(id2);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });

    it('should return true when comparing same instance', () => {
      // Given: Same EntityId instance
      const id = TestEntityId.create(nanoid()).value as TestEntityId;

      // When: Comparing with itself
      const areEqual = id.equals(id);

      // Then: Equals returns true
      expect(areEqual).toBe(true);
    });

    it('should return false when comparing with undefined', () => {
      // Given: EntityId and undefined
      const id = TestEntityId.create(nanoid()).value as TestEntityId;
      const undefinedId = undefined;

      // When: Comparing with undefined
      const areEqual = id.equals(undefinedId);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });

    it('should return false when comparing with null', () => {
      // Given: EntityId and null
      const id = TestEntityId.create(nanoid()).value as TestEntityId;
      const nullId = null as unknown as TestEntityId;

      // When: Comparing with null
      const areEqual = id.equals(nullId);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });
  });

  describe('toString() - String Representation', () => {
    it('should return nanoid string for logging', () => {
      // Given: EntityId with known nanoid
      const knownNanoid = nanoid();
      const id = TestEntityId.create(knownNanoid).value as TestEntityId;

      // When: Converting to string
      const stringRepresentation = id.toString();

      // Then: Returns nanoid value
      expect(stringRepresentation).toBe(knownNanoid);
    });

    it('should work in template literals for logging', () => {
      // Given: EntityId
      const id = TestEntityId.create(nanoid()).value as TestEntityId;

      // When: Using in template literal
      const logMessage = `Entity ID: ${id}`;

      // Then: Contains nanoid value
      expect(logMessage).toContain('Entity ID: ');
      expect(logMessage.replace('Entity ID: ', '')).toMatch(/^[A-Za-z0-9_-]{21}$/);
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

    class EinsatzId extends EntityId<'Einsatz'> {}
    class UserId extends EntityId<'User'> {}

    it('should create different types for different aggregates', () => {
      // Given: Different aggregate types
      const einsatzId = EinsatzId.create().value as EinsatzId;
      const userId = UserId.create().value as UserId;

      // When: Checking types at runtime
      const einsatzConstructorName = einsatzId.constructor.name;
      const userConstructorName = userId.constructor.name;

      // Then: Different class names
      expect(einsatzConstructorName).toBe('EinsatzId');
      expect(userConstructorName).toBe('UserId');
      expect(einsatzConstructorName).not.toBe(userConstructorName);
    });

    it('should demonstrate compile-time type safety via function signature', () => {
      // Given: Function that expects specific EntityId type
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
    it('should return Result<EntityId> with success state', () => {
      // Given: Valid nanoid
      const validNanoid = nanoid();

      // When: Creating EntityId
      const result = TestEntityId.create(validNanoid);

      // Then: Result object with success state
      expect(result).toBeInstanceOf(Result);
      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(result.value).toBeInstanceOf(TestEntityId);
      expect(result.error).toBeUndefined();
    });

    it('should return Result<EntityId> with failure state', () => {
      // Given: Invalid nanoid
      const invalidNanoid = 'invalid';

      // When: Creating EntityId
      const result = TestEntityId.create(invalidNanoid);

      // Then: Result object with failure state
      expect(result).toBeInstanceOf(Result);
      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
      expect(result.value).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error).toBe('Invalid nanoid format: must be 21 URL-safe characters');
    });

    it('should allow safe access via isSuccess check', () => {
      // Given: EntityId creation
      const result = TestEntityId.create();

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
      // Given: EntityId instance
      const id = TestEntityId.create(nanoid()).value as TestEntityId;

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
      // Given: EntityId instance
      const id = TestEntityId.create(nanoid()).value as TestEntityId;

      // When: Generating hashCode
      const hash = id.hashCode();

      // Then: Returns numeric hash
      expect(typeof hash).toBe('number');
      expect(hash).toBeGreaterThanOrEqual(0);
    });

    it('should produce same hashCode for equal EntityIds', () => {
      // Given: Two EntityIds with same nanoid
      const sharedNanoid = nanoid();
      const id1 = TestEntityId.create(sharedNanoid).value as TestEntityId;
      const id2 = TestEntityId.create(sharedNanoid).value as TestEntityId;

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

      // When: Creating EntityId
      const result = TestEntityId.create(emptyString);

      // Then: Failure
      expect(result.isFailure).toBe(true);
    });

    it('should handle whitespace-only string as invalid', () => {
      // Given: Whitespace string (21 spaces)
      const whitespace = '                     '; // 21 spaces

      // When: Creating EntityId
      const result = TestEntityId.create(whitespace);

      // Then: Failure (spaces not allowed in nanoid)
      expect(result.isFailure).toBe(true);
    });

    it('should handle exact 21 characters with valid chars', () => {
      // Given: Exactly 21 valid characters
      const exactLength = 'A1B2C3D4E5F6G7H8I9J0K';

      // When: Creating EntityId
      const result = TestEntityId.create(exactLength);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe(exactLength);
    });

    it('should consistently generate different nanoids on each call', () => {
      // Given: Multiple auto-generations
      const id1 = TestEntityId.create().value as TestEntityId;
      const id2 = TestEntityId.create().value as TestEntityId;
      const id3 = TestEntityId.create().value as TestEntityId;

      // When: Comparing generated values
      const allUnique = id1.value !== id2.value && id2.value !== id3.value && id1.value !== id3.value;

      // Then: All different (extremely high probability with nanoid)
      expect(allUnique).toBe(true);
    });
  });
});
