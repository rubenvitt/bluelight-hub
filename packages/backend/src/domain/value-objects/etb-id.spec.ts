import { EtbId } from './etb-id';

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

describe('EtbId', () => {
  describe('create', () => {
    it('should auto-generate a valid CUID when no parameter provided', () => {
      // Given: No ID parameter
      // When: Creating EtbId via create()
      const result = EtbId.create();

      // Then: Success with valid CUID format
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toMatch(/^[a-z][a-z0-9]+$/);
      expect(result.value?.value.length).toBeGreaterThanOrEqual(20);
      expect(result.value?.value.length).toBeLessThanOrEqual(30);
    });

    it('should accept a valid CUID string', () => {
      // Given: Valid CUID
      const validId = generateTestCuid('test1');

      // When: Creating EtbId with valid ID
      const result = EtbId.create(validId);

      // Then: Success with same ID
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe(validId);
    });

    it('should reject invalid CUID format', () => {
      // Given: Invalid ID (too short)
      const invalidId = 'too-short';

      // When: Creating EtbId with invalid ID
      const result = EtbId.create(invalidId);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid CUID format');
    });

    it('should support equals() method for identity comparison', () => {
      // Given: Two EtbIds with same CUID
      const id = generateTestCuid('equal');
      const id1 = EtbId.create(id).value!;
      const id2 = EtbId.create(id).value!;

      // When: Comparing equality
      // Then: Structural equality (same value)
      expect(id1.equals(id2)).toBe(true);
      expect(id1 === id2).toBe(false); // Different instances
    });
  });
});
