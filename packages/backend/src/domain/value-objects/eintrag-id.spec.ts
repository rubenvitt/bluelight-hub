import { EintragId } from './eintrag-id';

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

describe('EintragId', () => {
  describe('create', () => {
    it('should auto-generate a valid CUID when no parameter provided', () => {
      // Given: No ID parameter
      // When: Creating EintragId via create()
      const result = EintragId.create();

      // Then: Success with valid CUID format
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toMatch(/^[a-z][a-z0-9]+$/);
      expect(result.value?.value.length).toBeGreaterThanOrEqual(20);
      expect(result.value?.value.length).toBeLessThanOrEqual(30);
    });

    it('should accept a valid CUID string', () => {
      // Given: Valid CUID
      const validId = generateTestCuid('test1');

      // When: Creating EintragId with valid ID
      const result = EintragId.create(validId);

      // Then: Success with same ID
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe(validId);
    });

    it('should reject invalid CUID format', () => {
      // Given: Invalid ID (contains invalid characters)
      const invalidId = 'invalid@id#with$special';

      // When: Creating EintragId with invalid ID
      const result = EintragId.create(invalidId);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid CUID format');
    });

    it('should support equals() method for identity comparison', () => {
      // Given: Two EintragIds with same CUID
      const id = generateTestCuid('equal');
      const id1 = EintragId.create(id).value!;
      const id2 = EintragId.create(id).value!;
      const id3 = EintragId.create(generateTestCuid('other')).value!;

      // When: Comparing equality
      // Then: Structural equality (same value)
      expect(id1.equals(id2)).toBe(true);
      expect(id1.equals(id3)).toBe(false);
      expect(id1 === id2).toBe(false); // Different instances
    });
  });
});
