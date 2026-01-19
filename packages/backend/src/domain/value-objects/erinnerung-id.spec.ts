import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
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

describe('ErinnerungId', () => {
  describe('create() - Factory Method', () => {
    it('should auto-generate valid CUID when no id parameter provided', () => {
      // Given: No ID parameter
      const noIdParameter = undefined;

      // When: Creating ErinnerungId without parameter
      const result = ErinnerungId.create(noIdParameter);

      // Then: Success with auto-generated CUID
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.value).toMatch(/^[a-z][a-z0-9]+$/);
    });

    it('should create ErinnerungId with valid CUID string', () => {
      // Given: Valid CUID format
      const validCuid = generateTestCuid('test1');

      // When: Creating ErinnerungId with valid CUID
      const result = ErinnerungId.create(validCuid);

      // Then: Success with provided CUID
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe(validCuid);
    });

    it('should fail with invalid CUID format', () => {
      // Given: Invalid CUID (too short)
      const invalidCuid = 'abc123';

      // When: Creating ErinnerungId with invalid format
      const result = ErinnerungId.create(invalidCuid);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid CUID format');
    });
  });

  describe('equals() - Equality', () => {
    it('should return true for ErinnerungIds with same CUID value', () => {
      // Given: Two ErinnerungIds with same CUID
      const sharedCuid = generateTestCuid('equal');
      const id1 = ErinnerungId.create(sharedCuid).value as ErinnerungId;
      const id2 = ErinnerungId.create(sharedCuid).value as ErinnerungId;

      // When: Comparing for equality
      const areEqual = id1.equals(id2);

      // Then: Equals returns true
      expect(areEqual).toBe(true);
      expect(id1).not.toBe(id2); // Different object instances
    });

    it('should return false for ErinnerungIds with different values', () => {
      // Given: Two ErinnerungIds with different CUIDs
      const id1 = ErinnerungId.create(generateTestCuid('diff1')).value as ErinnerungId;
      const id2 = ErinnerungId.create(generateTestCuid('diff2')).value as ErinnerungId;

      // When: Comparing for equality
      const areEqual = id1.equals(id2);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });
  });

  describe('toString() - String Representation', () => {
    it('should return CUID string for logging', () => {
      // Given: ErinnerungId with known CUID
      const knownCuid = generateTestCuid('logme');
      const id = ErinnerungId.create(knownCuid).value as ErinnerungId;

      // When: Converting to string
      const stringRepresentation = id.toString();

      // Then: Returns CUID value
      expect(stringRepresentation).toBe(knownCuid);
    });
  });

  describe('Result<T> Pattern Integration', () => {
    it('should return Result<ErinnerungId> with proper types', () => {
      // Given: Valid CUID
      const validCuid = generateTestCuid('reslt');

      // When: Creating ErinnerungId
      const result = ErinnerungId.create(validCuid);

      // Then: Result object with success state
      expect(result).toBeInstanceOf(Result);
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(ErinnerungId);
    });
  });

  describe('Type-Safety', () => {
    it('should have correct constructor name', () => {
      // Given: ErinnerungId instance
      const erinnerungId = ErinnerungId.create().value as ErinnerungId;

      // When: Checking types at runtime
      const constructorName = erinnerungId.constructor.name;

      // Then: Correct class name
      expect(constructorName).toBe('ErinnerungId');
    });

    it('should work in domain-specific functions', () => {
      // Given: Function that expects ErinnerungId
      function processErinnerung(id: ErinnerungId): string {
        return `Erinnerung: ${id.toString()}`;
      }

      // When: Calling with correct type
      const erinnerungId = ErinnerungId.create().value as ErinnerungId;
      const result = processErinnerung(erinnerungId);

      // Then: Function executes successfully
      expect(result).toContain('Erinnerung:');
    });
  });
});
