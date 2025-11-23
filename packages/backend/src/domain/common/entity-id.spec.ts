import { EntityId } from '@domain/common/entity-id';
import { Result } from '@domain/common/result';

// Mock CUID2 for Jest compatibility (ESM module issue)
// CUID2 generiert ~25 Zeichen, beginnt mit Kleinbuchstabe, nur [a-z0-9]
jest.mock('@paralleldrive/cuid2', () => {
  // Counter für deterministische Test-IDs
  let _counter = 0;
  return {
    createId: jest.fn(() => {
      // Generate valid CUID2 format: starts with lowercase letter, then alphanumeric
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let result = 'c'; // CUID2 startet typischerweise mit 'c'
      for (let i = 0; i < 24; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      _counter++;
      return result;
    }),
    isCuid: jest.fn((id: string) => {
      // CUID2 validation: starts with lowercase letter, only [a-z0-9], ~24-25 chars
      if (typeof id !== 'string') return false;
      if (id.length < 20 || id.length > 30) return false;
      return /^[a-z][a-z0-9]+$/.test(id);
    }),
  };
});

/**
 * Helper function to generate valid test CUIDs.
 * Generates deterministic CUID-like IDs for testing.
 */
function generateTestCuid(suffix = ''): string {
  const base = 'clw3h8x9y0000qwertyu';
  const padding = suffix.padEnd(5, '0').slice(0, 5);
  return base + padding;
}

/**
 * Test-Implementierung einer konkreten EntityId Klasse.
 * Simuliert eine reale Aggregate ID für Testing-Zwecke.
 */
class TestEntityId extends EntityId<'TestEntity'> {}

describe('EntityId<TAggregateType>', () => {
  describe('create() - Factory Method', () => {
    it('should auto-generate valid CUID when no id parameter provided', () => {
      // Given: No ID parameter
      const noIdParameter = undefined;

      // When: Creating EntityId without parameter
      const result = TestEntityId.create(noIdParameter);

      // Then: Success with auto-generated CUID
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      // CUID2 format: starts with lowercase letter, only [a-z0-9], ~25 chars
      expect(result.value?.value).toMatch(/^[a-z][a-z0-9]+$/);
      expect(result.value?.value.length).toBeGreaterThanOrEqual(20);
      expect(result.value?.value.length).toBeLessThanOrEqual(30);
    });

    it('should create EntityId with valid CUID string', () => {
      // Given: Valid CUID format
      const validCuid = generateTestCuid('abcde');

      // When: Creating EntityId with valid CUID
      const result = TestEntityId.create(validCuid);

      // Then: Success with provided CUID
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.value).toBe(validCuid);
      expect(result.error).toBeUndefined();
    });

    it('should fail with invalid CUID format (too short)', () => {
      // Given: Invalid CUID (too short)
      const tooShortId = 'abc123';

      // When: Creating EntityId with invalid format
      const result = TestEntityId.create(tooShortId);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
      expect(result.value).toBeUndefined();
      expect(result.error).toBe('Invalid CUID format');
    });

    it('should fail with invalid CUID format (too long)', () => {
      // Given: Invalid CUID (too long - more than 30 chars)
      const tooLongId = 'clw3h8x9y0000qwertyuiopasdfghjklmnopqrstuvwxyz';

      // When: Creating EntityId with invalid format
      const result = TestEntityId.create(tooLongId);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid CUID format');
    });

    it('should fail with invalid characters in CUID', () => {
      // Given: Invalid characters (uppercase, special chars not allowed in CUID2)
      const invalidChars = 'ABC123DEF456GHI789JKL0'; // Uppercase not allowed

      // When: Creating EntityId with invalid characters
      const result = TestEntityId.create(invalidChars);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid CUID format');
    });

    it('should fail when CUID starts with a digit', () => {
      // Given: CUID starting with digit (invalid)
      const startsWithDigit = '1lw3h8x9y0000qwertyuiop';

      // When: Creating EntityId
      const result = TestEntityId.create(startsWithDigit);

      // Then: Failure - CUID must start with lowercase letter
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid CUID format');
    });

    it('should accept valid CUID format (lowercase alphanumeric)', () => {
      // Given: CUID with all valid character types
      const validCuid = 'clw3h8x9y0000qwertyuiopa'; // 25 chars, starts with 'c', all lowercase/digits

      // When: Creating EntityId with valid CUID
      const result = TestEntityId.create(validCuid);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe(validCuid);
    });
  });

  describe('value - Getter', () => {
    it('should return the CUID string via value getter', () => {
      // Given: EntityId with known CUID
      const knownCuid = generateTestCuid('value');
      const result = TestEntityId.create(knownCuid);

      // When: Accessing value getter
      const entityId = result.value as TestEntityId;
      const idValue = entityId.value;

      // Then: Returns CUID string
      expect(idValue).toBe(knownCuid);
      expect(typeof idValue).toBe('string');
    });
  });

  describe('equals() - Equality', () => {
    it('should return true for EntityIds with same CUID value', () => {
      // Given: Two EntityIds with same CUID
      const sharedCuid = generateTestCuid('equal');
      const id1 = TestEntityId.create(sharedCuid).value as TestEntityId;
      const id2 = TestEntityId.create(sharedCuid).value as TestEntityId;

      // When: Comparing for equality
      const areEqual = id1.equals(id2);

      // Then: Equals returns true
      expect(areEqual).toBe(true);
      expect(id1).not.toBe(id2); // Different object instances
    });

    it('should return false for EntityIds with different CUID values', () => {
      // Given: Two EntityIds with different CUIDs
      const id1 = TestEntityId.create(generateTestCuid('diff1')).value as TestEntityId;
      const id2 = TestEntityId.create(generateTestCuid('diff2')).value as TestEntityId;

      // When: Comparing for equality
      const areEqual = id1.equals(id2);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });

    it('should return true when comparing same instance', () => {
      // Given: Same EntityId instance
      const id = TestEntityId.create(generateTestCuid('same1')).value as TestEntityId;

      // When: Comparing with itself
      const areEqual = id.equals(id);

      // Then: Equals returns true
      expect(areEqual).toBe(true);
    });

    it('should return false when comparing with undefined', () => {
      // Given: EntityId and undefined
      const id = TestEntityId.create(generateTestCuid('undef')).value as TestEntityId;
      const undefinedId = undefined;

      // When: Comparing with undefined
      const areEqual = id.equals(undefinedId);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });

    it('should return false when comparing with null', () => {
      // Given: EntityId and null
      const id = TestEntityId.create(generateTestCuid('nulll')).value as TestEntityId;
      const nullId = null as unknown as TestEntityId;

      // When: Comparing with null
      const areEqual = id.equals(nullId);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });
  });

  describe('toString() - String Representation', () => {
    it('should return CUID string for logging', () => {
      // Given: EntityId with known CUID
      const knownCuid = generateTestCuid('log01');
      const id = TestEntityId.create(knownCuid).value as TestEntityId;

      // When: Converting to string
      const stringRepresentation = id.toString();

      // Then: Returns CUID value
      expect(stringRepresentation).toBe(knownCuid);
    });

    it('should work in template literals for logging', () => {
      // Given: EntityId
      const id = TestEntityId.create(generateTestCuid('templ')).value as TestEntityId;

      // When: Using in template literal
      const logMessage = `Entity ID: ${id}`;

      // Then: Contains CUID value
      expect(logMessage).toContain('Entity ID: ');
      // CUID format: starts with lowercase, only [a-z0-9]
      expect(logMessage.replace('Entity ID: ', '')).toMatch(/^[a-z][a-z0-9]+$/);
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
      // Given: Valid CUID
      const validCuid = generateTestCuid('resok');

      // When: Creating EntityId
      const result = TestEntityId.create(validCuid);

      // Then: Result object with success state
      expect(result).toBeInstanceOf(Result);
      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(result.value).toBeInstanceOf(TestEntityId);
      expect(result.error).toBeUndefined();
    });

    it('should return Result<EntityId> with failure state', () => {
      // Given: Invalid CUID
      const invalidCuid = 'invalid';

      // When: Creating EntityId
      const result = TestEntityId.create(invalidCuid);

      // Then: Result object with failure state
      expect(result).toBeInstanceOf(Result);
      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
      expect(result.value).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error).toBe('Invalid CUID format');
    });

    it('should allow safe access via isSuccess check', () => {
      // Given: EntityId creation
      const result = TestEntityId.create();

      // When: Checking success before accessing value
      if (result.isSuccess) {
        const id = result.value;

        // Then: Safe access to value
        expect(id).toBeDefined();
        // CUID format: starts with lowercase, only [a-z0-9]
        expect(id?.value).toMatch(/^[a-z][a-z0-9]+$/);
      } else {
        // This branch should not execute for auto-generated IDs
        fail('Auto-generated ID should always succeed');
      }
    });
  });

  describe('ValueObject Integration', () => {
    it('should inherit from ValueObject with immutable props', () => {
      // Given: EntityId instance
      const id = TestEntityId.create(generateTestCuid('immut')).value as TestEntityId;

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
      const id = TestEntityId.create(generateTestCuid('hash1')).value as TestEntityId;

      // When: Generating hashCode
      const hash = id.hashCode();

      // Then: Returns numeric hash
      expect(typeof hash).toBe('number');
      expect(hash).toBeGreaterThanOrEqual(0);
    });

    it('should produce same hashCode for equal EntityIds', () => {
      // Given: Two EntityIds with same CUID
      const sharedCuid = generateTestCuid('hash2');
      const id1 = TestEntityId.create(sharedCuid).value as TestEntityId;
      const id2 = TestEntityId.create(sharedCuid).value as TestEntityId;

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
      // Given: Whitespace string (25 spaces)
      const whitespace = '                         '; // 25 spaces

      // When: Creating EntityId
      const result = TestEntityId.create(whitespace);

      // Then: Failure (spaces not allowed in CUID)
      expect(result.isFailure).toBe(true);
    });

    it('should handle valid CUID with exactly 25 characters', () => {
      // Given: Exactly 25 valid CUID characters
      const exactLength = 'clw3h8x9y0000qwertyuiopa';

      // When: Creating EntityId
      const result = TestEntityId.create(exactLength);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe(exactLength);
    });

    it('should consistently generate different CUIDs on each call', () => {
      // Given: Multiple auto-generations
      const id1 = TestEntityId.create().value as TestEntityId;
      const id2 = TestEntityId.create().value as TestEntityId;
      const id3 = TestEntityId.create().value as TestEntityId;

      // When: Comparing generated values
      const allUnique = id1.value !== id2.value && id2.value !== id3.value && id1.value !== id3.value;

      // Then: All different (extremely high probability with CUID2)
      expect(allUnique).toBe(true);
    });

    it('should reject underscore and hyphen (valid in nanoid but not CUID2)', () => {
      // Given: String with underscore and hyphen (nanoid chars, not CUID2)
      const nanoidStyle = 'a1b2c3d4e5f6g7h8i9j_k-l';

      // When: Creating EntityId
      const result = TestEntityId.create(nanoidStyle);

      // Then: Failure - underscore and hyphen not allowed in CUID2
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid CUID format');
    });
  });
});
