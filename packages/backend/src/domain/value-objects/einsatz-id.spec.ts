import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { Result } from '@domain/common/result';

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

describe('EinsatzId', () => {
  describe('create() - Factory Method', () => {
    it('should auto-generate valid CUID when no id parameter provided', () => {
      // Given: No ID parameter
      const noIdParameter = undefined;

      // When: Creating EinsatzId without parameter
      const result = EinsatzId.create(noIdParameter);

      // Then: Success with auto-generated CUID
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.value).toMatch(/^[a-z][a-z0-9]+$/);
      expect(result.value?.value.length).toBeGreaterThanOrEqual(20);
      expect(result.value?.value.length).toBeLessThanOrEqual(30);
    });

    it('should create EinsatzId with valid CUID string', () => {
      // Given: Valid CUID format
      const validCuid = generateTestCuid('test1');

      // When: Creating EinsatzId with valid CUID
      const result = EinsatzId.create(validCuid);

      // Then: Success with provided CUID
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.value).toBe(validCuid);
      expect(result.error).toBeUndefined();
    });

    it('should fail with invalid CUID format (too short)', () => {
      // Given: Invalid CUID (too short)
      const tooShortId = 'abc123';

      // When: Creating EinsatzId with invalid format
      const result = EinsatzId.create(tooShortId);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
      expect(result.value).toBeUndefined();
      expect(result.error).toBe('Invalid CUID format');
    });

    it('should fail with invalid CUID format (too long)', () => {
      // Given: Invalid CUID (too long)
      const tooLongId = 'cabcdefghijklmnopqrstuvwxyz12345678';

      // When: Creating EinsatzId with invalid format
      const result = EinsatzId.create(tooLongId);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid CUID format');
    });

    it('should fail with invalid characters in CUID', () => {
      // Given: Invalid characters (uppercase and special chars not allowed)
      const invalidChars = 'cABCDEFGHIJKLMNOPQRSTU'; // Uppercase not allowed

      // When: Creating EinsatzId with invalid characters
      const result = EinsatzId.create(invalidChars);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid CUID format');
    });

    it('should accept all valid CUID characters (a-z0-9, starting with letter)', () => {
      // Given: CUID with all valid character types
      const validMixedChars = generateTestCuid('valid');

      // When: Creating EinsatzId with valid mixed characters
      const result = EinsatzId.create(validMixedChars);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe(validMixedChars);
    });
  });

  describe('value - Getter', () => {
    it('should return the CUID string via value getter', () => {
      // Given: EinsatzId with known CUID
      const knownCuid = generateTestCuid('getvl');
      const result = EinsatzId.create(knownCuid);

      // When: Accessing value getter
      const einsatzId = result.value as EinsatzId;
      const idValue = einsatzId.value;

      // Then: Returns CUID string
      expect(idValue).toBe(knownCuid);
      expect(typeof idValue).toBe('string');
    });
  });

  describe('equals() - Equality', () => {
    it('should return true for EinsatzIds with same CUID value', () => {
      // Given: Two EinsatzIds with same CUID
      const sharedCuid = generateTestCuid('equal');
      const id1 = EinsatzId.create(sharedCuid).value as EinsatzId;
      const id2 = EinsatzId.create(sharedCuid).value as EinsatzId;

      // When: Comparing for equality
      const areEqual = id1.equals(id2);

      // Then: Equals returns true
      expect(areEqual).toBe(true);
      expect(id1).not.toBe(id2); // Different object instances
    });

    it('should return false for EinsatzIds with different CUID values', () => {
      // Given: Two EinsatzIds with different CUIDs
      const id1 = EinsatzId.create(generateTestCuid('diff1')).value as EinsatzId;
      const id2 = EinsatzId.create(generateTestCuid('diff2')).value as EinsatzId;

      // When: Comparing for equality
      const areEqual = id1.equals(id2);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });

    it('should return true when comparing same instance', () => {
      // Given: Same EinsatzId instance
      const id = EinsatzId.create(generateTestCuid('same0')).value as EinsatzId;

      // When: Comparing with itself
      const areEqual = id.equals(id);

      // Then: Equals returns true
      expect(areEqual).toBe(true);
    });

    it('should return false when comparing with undefined', () => {
      // Given: EinsatzId and undefined
      const id = EinsatzId.create(generateTestCuid('undef')).value as EinsatzId;
      const undefinedId = undefined;

      // When: Comparing with undefined
      const areEqual = id.equals(undefinedId);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });

    it('should return false when comparing with null', () => {
      // Given: EinsatzId and null
      const id = EinsatzId.create(generateTestCuid('nullv')).value as EinsatzId;
      const nullId = null as unknown as EinsatzId;

      // When: Comparing with null
      const areEqual = id.equals(nullId);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });
  });

  describe('toString() - String Representation', () => {
    it('should return CUID string for logging', () => {
      // Given: EinsatzId with known CUID
      const knownCuid = generateTestCuid('logme');
      const id = EinsatzId.create(knownCuid).value as EinsatzId;

      // When: Converting to string
      const stringRepresentation = id.toString();

      // Then: Returns CUID value
      expect(stringRepresentation).toBe(knownCuid);
    });

    it('should work in template literals for logging', () => {
      // Given: EinsatzId
      const id = EinsatzId.create(generateTestCuid('templ')).value as EinsatzId;

      // When: Using in template literal
      const logMessage = `Einsatz ID: ${id}`;

      // Then: Contains CUID value
      expect(logMessage).toContain('Einsatz ID: ');
      expect(logMessage.replace('Einsatz ID: ', '')).toMatch(/^[a-z][a-z0-9]+$/);
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
    class _UserId extends EinsatzId.prototype.constructor<'User'> {}

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
      // processEinsatz(userId); // Compile Error: Argument of type 'UserId' is not assignable to parameter of type 'EinsatzId'
    });
  });

  describe('Result<T> Pattern Integration', () => {
    it('should return Result<EinsatzId> with success state', () => {
      // Given: Valid CUID
      const validCuid = generateTestCuid('reslt');

      // When: Creating EinsatzId
      const result = EinsatzId.create(validCuid);

      // Then: Result object with success state
      expect(result).toBeInstanceOf(Result);
      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(result.value).toBeInstanceOf(EinsatzId);
      expect(result.error).toBeUndefined();
    });

    it('should return Result<EinsatzId> with failure state', () => {
      // Given: Invalid CUID
      const invalidCuid = 'invalid';

      // When: Creating EinsatzId
      const result = EinsatzId.create(invalidCuid);

      // Then: Result object with failure state
      expect(result).toBeInstanceOf(Result);
      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
      expect(result.value).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error).toBe('Invalid CUID format');
    });

    it('should allow safe access via isSuccess check', () => {
      // Given: EinsatzId creation
      const result = EinsatzId.create();

      // When: Checking success before accessing value
      if (result.isSuccess) {
        const id = result.value;

        // Then: Safe access to value
        expect(id).toBeDefined();
        expect(id?.value).toMatch(/^[a-z][a-z0-9]+$/);
      } else {
        // This branch should not execute for auto-generated IDs
        fail('Auto-generated ID should always succeed');
      }
    });
  });

  describe('ValueObject Integration', () => {
    it('should inherit from ValueObject with immutable props', () => {
      // Given: EinsatzId instance
      const id = EinsatzId.create(generateTestCuid('immut')).value as EinsatzId;

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
      const id = EinsatzId.create(generateTestCuid('hashc')).value as EinsatzId;

      // When: Generating hashCode
      const hash = id.hashCode();

      // Then: Returns numeric hash
      expect(typeof hash).toBe('number');
      expect(hash).toBeGreaterThanOrEqual(0);
    });

    it('should produce same hashCode for equal EinsatzIds', () => {
      // Given: Two EinsatzIds with same CUID
      const sharedCuid = generateTestCuid('shash');
      const id1 = EinsatzId.create(sharedCuid).value as EinsatzId;
      const id2 = EinsatzId.create(sharedCuid).value as EinsatzId;

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
      // Given: Whitespace string (25 spaces)
      const whitespace = '                         '; // 25 spaces

      // When: Creating EinsatzId
      const result = EinsatzId.create(whitespace);

      // Then: Failure (spaces not allowed in CUID)
      expect(result.isFailure).toBe(true);
    });

    it('should handle valid length CUID with valid chars', () => {
      // Given: Valid CUID
      const validCuid = generateTestCuid('exact');

      // When: Creating EinsatzId
      const result = EinsatzId.create(validCuid);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe(validCuid);
    });

    it('should consistently generate different CUIDs on each call', () => {
      // Given: Multiple auto-generations
      const id1 = EinsatzId.create().value as EinsatzId;
      const id2 = EinsatzId.create().value as EinsatzId;
      const id3 = EinsatzId.create().value as EinsatzId;

      // When: Comparing generated values
      const allUnique = id1.value !== id2.value && id2.value !== id3.value && id1.value !== id3.value;

      // Then: All different (extremely high probability with CUID)
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
      expect(reference).toMatch(/^EINSATZ-[a-z][a-z0-9]+$/);
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
      const originalCuid = generateTestCuid('immut');
      const einsatzId = EinsatzId.create(originalCuid).value as EinsatzId;

      // When: Attempting to access internal value
      const retrievedValue = einsatzId.value;

      // Then: Value remains unchanged and immutable
      expect(retrievedValue).toBe(originalCuid);
      expect(einsatzId.value).toBe(originalCuid); // Still the same
    });
  });
});
