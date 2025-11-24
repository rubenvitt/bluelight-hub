import { UserId } from '@domain/value-objects/user-id';
import { Result } from '@domain/common/result';

// Mock nanoid for consistent test IDs
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => {
    // Generate valid Nanoid format: 21 characters, alphanumeric with mixed case
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let result = '';
    for (let i = 0; i < 21; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
}));

function generateTestNanoid(suffix = ''): string {
  // Generate a valid 21-character Nanoid
  const base = 'WvmYHlIYRWUhVZTt';
  const padding = suffix.padEnd(5, 'X').slice(0, 5);
  return base + padding;
}

describe('UserId', () => {
  describe('create() - Factory Method', () => {
    it('should auto-generate valid Nanoid when no id parameter provided', () => {
      // Given: No ID parameter
      const noIdParameter = undefined;

      // When: Creating UserId without parameter
      const result = UserId.create(noIdParameter);

      // Then: Success with auto-generated Nanoid
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.value).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(result.value?.value.length).toBe(21);
    });

    it('should create UserId with valid Nanoid string', () => {
      // Given: Valid Nanoid format (21 characters)
      const validNanoid = generateTestNanoid('test1');

      // When: Creating UserId with valid Nanoid
      const result = UserId.create(validNanoid);

      // Then: Success with provided Nanoid
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.value).toBe(validNanoid);
      expect(result.error).toBeUndefined();
    });

    it('should create UserId with actual User ID from database', () => {
      // Given: Real User ID from Prisma (Nanoid format)
      const realUserId = 'WvmYHlIYRWUhVZTt1aRng';

      // When: Creating UserId
      const result = UserId.create(realUserId);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe(realUserId);
    });

    it('should fail with invalid Nanoid format (too short)', () => {
      // Given: Invalid Nanoid (too short)
      const tooShortId = 'abc123';

      // When: Creating UserId with invalid format
      const result = UserId.create(tooShortId);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
      expect(result.value).toBeUndefined();
      expect(result.error).toBe('Invalid Nanoid format for UserId');
    });

    it('should fail with invalid Nanoid format (too long)', () => {
      // Given: Invalid Nanoid (too long - 25 chars)
      const tooLongId = 'WvmYHlIYRWUhVZTt1aRngXXXX';

      // When: Creating UserId with invalid format
      const result = UserId.create(tooLongId);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid Nanoid format for UserId');
    });

    it('should accept all valid Nanoid characters (A-Za-z0-9_-)', () => {
      // Given: Nanoid with all valid character types
      const validMixedChars = 'ABCabc123_-XYZxyz789';

      // When: Creating UserId with valid mixed characters
      const result = UserId.create(validMixedChars);

      // Then: Success (21 chars)
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe(validMixedChars);
    });

    it('should fail with invalid characters in Nanoid', () => {
      // Given: Invalid characters (special chars not in _-)
      const invalidChars = 'WvmYHlIYRWUhV!@#$%^&*';

      // When: Creating UserId with invalid characters
      const result = UserId.create(invalidChars);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid Nanoid format for UserId');
    });
  });

  describe('value - Getter', () => {
    it('should return the Nanoid string via value getter', () => {
      // Given: UserId with known Nanoid
      const knownNanoid = generateTestNanoid('getvl');
      const result = UserId.create(knownNanoid);

      // When: Accessing value getter
      const userId = result.value as UserId;
      const idValue = userId.value;

      // Then: Returns Nanoid string
      expect(idValue).toBe(knownNanoid);
      expect(typeof idValue).toBe('string');
    });
  });

  describe('equals() - Equality', () => {
    it('should return true for UserIds with same Nanoid value', () => {
      // Given: Two UserIds with same Nanoid
      const sharedNanoid = generateTestNanoid('equal');
      const id1 = UserId.create(sharedNanoid).value as UserId;
      const id2 = UserId.create(sharedNanoid).value as UserId;

      // When: Comparing for equality
      const areEqual = id1.equals(id2);

      // Then: Equals returns true
      expect(areEqual).toBe(true);
      expect(id1).not.toBe(id2); // Different object instances
    });

    it('should return false for UserIds with different Nanoid values', () => {
      // Given: Two UserIds with different Nanoids
      const id1 = UserId.create(generateTestNanoid('diff1')).value as UserId;
      const id2 = UserId.create(generateTestNanoid('diff2')).value as UserId;

      // When: Comparing for equality
      const areEqual = id1.equals(id2);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });

    it('should return true when comparing same instance', () => {
      // Given: Same UserId instance
      const id = UserId.create(generateTestNanoid('same0')).value as UserId;

      // When: Comparing with itself
      const areEqual = id.equals(id);

      // Then: Equals returns true
      expect(areEqual).toBe(true);
    });

    it('should return false when comparing with undefined', () => {
      // Given: UserId and undefined
      const id = UserId.create(generateTestNanoid('undef')).value as UserId;
      const undefinedId = undefined;

      // When: Comparing with undefined
      const areEqual = id.equals(undefinedId);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });

    it('should return false when comparing with null', () => {
      // Given: UserId and null
      const id = UserId.create(generateTestNanoid('nullv')).value as UserId;
      const nullId = null as unknown as UserId;

      // When: Comparing with null
      const areEqual = id.equals(nullId);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });
  });

  describe('toString() - String Representation', () => {
    it('should return Nanoid string for logging', () => {
      // Given: UserId with known Nanoid
      const knownNanoid = generateTestNanoid('logme');
      const id = UserId.create(knownNanoid).value as UserId;

      // When: Converting to string
      const stringRepresentation = id.toString();

      // Then: Returns Nanoid value
      expect(stringRepresentation).toBe(knownNanoid);
    });

    it('should work in template literals for logging', () => {
      // Given: UserId
      const id = UserId.create(generateTestNanoid('templ')).value as UserId;

      // When: Using in template literal
      const logMessage = `User ID: ${id}`;

      // Then: Contains Nanoid value
      expect(logMessage).toContain('User ID: ');
      expect(logMessage.replace('User ID: ', '')).toMatch(/^[A-Za-z0-9_-]{21}$/);
    });
  });

  describe('Type-Safety (compile-time)', () => {
    it('should create UserId type distinct from other EntityId types', () => {
      // Given: UserId
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
    });
  });

  describe('Result<T> Pattern Integration', () => {
    it('should return Result<UserId> with success state', () => {
      // Given: Valid Nanoid
      const validNanoid = generateTestNanoid('reslt');

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
      // Given: Invalid Nanoid
      const invalidNanoid = 'invalid';

      // When: Creating UserId
      const result = UserId.create(invalidNanoid);

      // Then: Result object with failure state
      expect(result).toBeInstanceOf(Result);
      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
      expect(result.value).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error).toBe('Invalid Nanoid format for UserId');
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
      const id = UserId.create(generateTestNanoid('immut')).value as UserId;

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
      const id = UserId.create(generateTestNanoid('hashc')).value as UserId;

      // When: Generating hashCode
      const hash = id.hashCode();

      // Then: Returns numeric hash
      expect(typeof hash).toBe('number');
      expect(hash).toBeGreaterThanOrEqual(0);
    });

    it('should produce same hashCode for equal UserIds', () => {
      // Given: Two UserIds with same Nanoid
      const sharedNanoid = generateTestNanoid('shash');
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

      // Then: Failure (spaces not allowed in Nanoid)
      expect(result.isFailure).toBe(true);
    });

    it('should handle valid length Nanoid with valid chars', () => {
      // Given: Valid Nanoid
      const validNanoid = generateTestNanoid('exact');

      // When: Creating UserId
      const result = UserId.create(validNanoid);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe(validNanoid);
    });

    it('should consistently generate different Nanoids on each call', () => {
      // Given: Multiple auto-generations
      const id1 = UserId.create().value as UserId;
      const id2 = UserId.create().value as UserId;
      const id3 = UserId.create().value as UserId;

      // When: Comparing generated values
      const allUnique = id1.value !== id2.value && id2.value !== id3.value && id1.value !== id3.value;

      // Then: All different (extremely high probability with Nanoid)
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
      const originalNanoid = generateTestNanoid('immut');
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
