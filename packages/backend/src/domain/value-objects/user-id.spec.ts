import { UserId } from '@domain/value-objects/user-id';
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

describe('UserId', () => {
  describe('create() - Factory Method', () => {
    it('should auto-generate valid nanoid when no id parameter provided', () => {
      // Given: No ID parameter
      const noIdParameter = undefined;

      // When: Creating UserId without parameter
      const result = UserId.create(noIdParameter);

      // Then: Success with auto-generated nanoid
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.value).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(result.value?.value).toHaveLength(21);
    });

    it('should create UserId with valid nanoid string', () => {
      // Given: Valid nanoid format
      const validNanoid = nanoid(); // Generates 21-char nanoid

      // When: Creating UserId with valid nanoid
      const result = UserId.create(validNanoid);

      // Then: Success with provided nanoid
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.value).toBe(validNanoid);
      expect(result.error).toBeUndefined();
    });

    it('should fail with invalid nanoid format (too short)', () => {
      // Given: Invalid nanoid (too short)
      const tooShortId = 'abc123';

      // When: Creating UserId with invalid format
      const result = UserId.create(tooShortId);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
      expect(result.value).toBeUndefined();
      expect(result.error).toBe('Invalid nanoid format: must be 21 URL-safe characters');
    });

    it('should fail with invalid nanoid format (too long)', () => {
      // Given: Invalid nanoid (too long)
      const tooLongId = 'A1B2C3D4E5F6G7H8I9J0K_EXTRA';

      // When: Creating UserId with invalid format
      const result = UserId.create(tooLongId);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid nanoid format: must be 21 URL-safe characters');
    });

    it('should fail with invalid characters in nanoid', () => {
      // Given: Invalid characters (special chars not allowed)
      const invalidChars = 'A1B2C3D4E5F6G7H8I9J@!'; // '@' and '!' not allowed

      // When: Creating UserId with invalid characters
      const result = UserId.create(invalidChars);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid nanoid format: must be 21 URL-safe characters');
    });

    it('should accept all valid nanoid characters (A-Za-z0-9_-)', () => {
      // Given: Nanoid with all valid character types
      const validMixedChars = 'ABCxyz123_-4567890123'; // 21 chars with A-Z, a-z, 0-9, _, -

      // When: Creating UserId with valid mixed characters
      const result = UserId.create(validMixedChars);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe(validMixedChars);
    });
  });

  describe('value - Getter', () => {
    it('should return the nanoid string via value getter', () => {
      // Given: UserId with known nanoid
      const knownNanoid = nanoid();
      const result = UserId.create(knownNanoid);

      // When: Accessing value getter
      const userId = result.value as UserId;
      const idValue = userId.value;

      // Then: Returns nanoid string
      expect(idValue).toBe(knownNanoid);
      expect(typeof idValue).toBe('string');
    });
  });

  describe('equals() - Equality', () => {
    it('should return true for UserIds with same nanoid value', () => {
      // Given: Two UserIds with same nanoid
      const sharedNanoid = nanoid();
      const id1 = UserId.create(sharedNanoid).value as UserId;
      const id2 = UserId.create(sharedNanoid).value as UserId;

      // When: Comparing for equality
      const areEqual = id1.equals(id2);

      // Then: Equals returns true
      expect(areEqual).toBe(true);
      expect(id1).not.toBe(id2); // Different object instances
    });

    it('should return false for UserIds with different nanoid values', () => {
      // Given: Two UserIds with different nanoids
      const id1 = UserId.create(nanoid()).value as UserId;
      const id2 = UserId.create(nanoid()).value as UserId;

      // When: Comparing for equality
      const areEqual = id1.equals(id2);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });

    it('should return true when comparing same instance', () => {
      // Given: Same UserId instance
      const id = UserId.create(nanoid()).value as UserId;

      // When: Comparing with itself
      const areEqual = id.equals(id);

      // Then: Equals returns true
      expect(areEqual).toBe(true);
    });

    it('should return false when comparing with undefined', () => {
      // Given: UserId and undefined
      const id = UserId.create(nanoid()).value as UserId;
      const undefinedId = undefined;

      // When: Comparing with undefined
      const areEqual = id.equals(undefinedId);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });

    it('should return false when comparing with null', () => {
      // Given: UserId and null
      const id = UserId.create(nanoid()).value as UserId;
      const nullId = null as unknown as UserId;

      // When: Comparing with null
      const areEqual = id.equals(nullId);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });
  });

  describe('toString() - String Representation', () => {
    it('should return nanoid string for logging', () => {
      // Given: UserId with known nanoid
      const knownNanoid = nanoid();
      const id = UserId.create(knownNanoid).value as UserId;

      // When: Converting to string
      const stringRepresentation = id.toString();

      // Then: Returns nanoid value
      expect(stringRepresentation).toBe(knownNanoid);
    });

    it('should work in template literals for logging', () => {
      // Given: UserId
      const id = UserId.create(nanoid()).value as UserId;

      // When: Using in template literal
      const logMessage = `User ID: ${id}`;

      // Then: Contains nanoid value
      expect(logMessage).toContain('User ID: ');
      expect(logMessage.replace('User ID: ', '')).toMatch(/^[A-Za-z0-9_-]{21}$/);
    });
  });

  describe('Type-Safety (compile-time)', () => {
    /**
     * Type-Safety Demonstration: Compile-time type checking.
     * Diese Tests demonstrieren, dass TypeScript verhindert,
     * dass UserId und EinsatzId vertauscht werden können.
     *
     * Hinweis: Diese Tests prüfen Runtime-Verhalten, aber die
     * eigentliche Type-Safety wird durch TypeScript zur Compile-Time erzwungen.
     */

    // Mock EinsatzId for type-safety demonstration
    class EinsatzId extends UserId.prototype.constructor<'Einsatz'> {}

    it('should create UserId type distinct from other EntityId types', () => {
      // Given: Different aggregate types
      const userId = UserId.create().value as UserId;

      // When: Checking types at runtime
      const constructorName = userId.constructor.name;

      // Then: Correct class name
      expect(constructorName).toBe('UserId');
    });

    it('should demonstrate compile-time type safety via function signature', () => {
      // Given: Function that expects specific UserId type
      function processUser(id: UserId): string {
        return `Processing User: ${id.toString()}`;
      }

      // When: Calling with correct type
      const userId = UserId.create().value as UserId;
      const result = processUser(userId);

      // Then: Function executes successfully
      expect(result).toContain('Processing User:');

      // Note: The following would cause a TypeScript compile error:
      // const einsatzId = EinsatzId.create().value as EinsatzId;
      // processUser(einsatzId); // ❌ Compile Error: Argument of type 'EinsatzId' is not assignable to parameter of type 'UserId'
    });
  });

  describe('Result<T> Pattern Integration', () => {
    it('should return Result<UserId> with success state', () => {
      // Given: Valid nanoid
      const validNanoid = nanoid();

      // When: Creating UserId
      const result = UserId.create(validNanoid);

      // Then: Result object with success state
      expect(result).toBeInstanceOf(Result);
      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(result.value).toBeInstanceOf(UserId);
      expect(result.error).toBeUndefined();
    });

    it('should return Result<UserId> with failure state', () => {
      // Given: Invalid nanoid
      const invalidNanoid = 'invalid';

      // When: Creating UserId
      const result = UserId.create(invalidNanoid);

      // Then: Result object with failure state
      expect(result).toBeInstanceOf(Result);
      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
      expect(result.value).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error).toBe('Invalid nanoid format: must be 21 URL-safe characters');
    });

    it('should allow safe access via isSuccess check', () => {
      // Given: UserId creation
      const result = UserId.create();

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
      // Given: UserId instance
      const id = UserId.create(nanoid()).value as UserId;

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
      // Given: UserId instance
      const id = UserId.create(nanoid()).value as UserId;

      // When: Generating hashCode
      const hash = id.hashCode();

      // Then: Returns numeric hash
      expect(typeof hash).toBe('number');
      expect(hash).toBeGreaterThanOrEqual(0);
    });

    it('should produce same hashCode for equal UserIds', () => {
      // Given: Two UserIds with same nanoid
      const sharedNanoid = nanoid();
      const id1 = UserId.create(sharedNanoid).value as UserId;
      const id2 = UserId.create(sharedNanoid).value as UserId;

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

      // When: Creating UserId
      const result = UserId.create(emptyString);

      // Then: Failure
      expect(result.isFailure).toBe(true);
    });

    it('should handle whitespace-only string as invalid', () => {
      // Given: Whitespace string (21 spaces)
      const whitespace = '                     '; // 21 spaces

      // When: Creating UserId
      const result = UserId.create(whitespace);

      // Then: Failure (spaces not allowed in nanoid)
      expect(result.isFailure).toBe(true);
    });

    it('should handle exact 21 characters with valid chars', () => {
      // Given: Exactly 21 valid characters
      const exactLength = 'A1B2C3D4E5F6G7H8I9J0K';

      // When: Creating UserId
      const result = UserId.create(exactLength);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe(exactLength);
    });

    it('should consistently generate different nanoids on each call', () => {
      // Given: Multiple auto-generations
      const id1 = UserId.create().value as UserId;
      const id2 = UserId.create().value as UserId;
      const id3 = UserId.create().value as UserId;

      // When: Comparing generated values
      const allUnique = id1.value !== id2.value && id2.value !== id3.value && id1.value !== id3.value;

      // Then: All different (extremely high probability with nanoid)
      expect(allUnique).toBe(true);
    });
  });

  describe('User-Specific Behavior', () => {
    it('should work correctly when used in User domain operations', () => {
      // Given: User ID for domain operation
      const userId = UserId.create().value as UserId;

      // When: Using in domain context
      function assignUserRole(id: UserId, role: string): string {
        return `User ${id.toString()} assigned role: ${role}`;
      }
      const result = assignUserRole(userId, 'Admin');

      // Then: Correctly generates role assignment
      expect(result).toMatch(/^User [A-Za-z0-9_-]{21} assigned role: Admin$/);
      expect(result).toContain('assigned role: Admin');
    });

    it('should support multiple UserId instances in collections', () => {
      // Given: Multiple User IDs
      const id1 = UserId.create().value as UserId;
      const id2 = UserId.create().value as UserId;
      const id3 = UserId.create().value as UserId;

      // When: Storing in Set (requires hashCode)
      const userSet = new Set([id1, id2, id3]);

      // Then: All unique IDs stored
      expect(userSet.size).toBe(3);
      expect(userSet.has(id1)).toBe(true);
      expect(userSet.has(id2)).toBe(true);
      expect(userSet.has(id3)).toBe(true);
    });

    it('should support UserId as Map keys', () => {
      // Given: UserIds used as Map keys
      const id1 = UserId.create().value as UserId;
      const id2 = UserId.create().value as UserId;

      // When: Creating Map with UserId keys
      const userMap = new Map<UserId, string>();
      userMap.set(id1, 'Alice Smith');
      userMap.set(id2, 'Bob Jones');

      // Then: Map operations work correctly
      expect(userMap.size).toBe(2);
      expect(userMap.get(id1)).toBe('Alice Smith');
      expect(userMap.get(id2)).toBe('Bob Jones');
    });

    it('should maintain immutability for User aggregate consistency', () => {
      // Given: UserId instance
      const originalNanoid = nanoid();
      const userId = UserId.create(originalNanoid).value as UserId;

      // When: Attempting to access internal value
      const retrievedValue = userId.value;

      // Then: Value remains unchanged and immutable
      expect(retrievedValue).toBe(originalNanoid);
      expect(userId.value).toBe(originalNanoid); // Still the same
    });

    it('should support User authentication scenarios', () => {
      // Given: UserId for authentication
      const userId = UserId.create().value as UserId;

      // When: Simulating authentication check
      function authenticateUser(id: UserId): string {
        return `Authenticated: ${id.toString()}`;
      }
      const authResult = authenticateUser(userId);

      // Then: Authentication context uses correct type
      expect(authResult).toContain('Authenticated:');
      expect(authResult.replace('Authenticated: ', '')).toMatch(/^[A-Za-z0-9_-]{21}$/);
    });

    it('should support User permission checks', () => {
      // Given: Multiple UserIds with permissions
      const adminId = UserId.create().value as UserId;
      const readerId = UserId.create().value as UserId;

      // When: Creating permission map
      const permissions = new Map<UserId, string[]>();
      permissions.set(adminId, ['read', 'write', 'delete']);
      permissions.set(readerId, ['read']);

      // Then: Permissions correctly associated
      expect(permissions.get(adminId)).toEqual(['read', 'write', 'delete']);
      expect(permissions.get(readerId)).toEqual(['read']);
    });
  });
});
