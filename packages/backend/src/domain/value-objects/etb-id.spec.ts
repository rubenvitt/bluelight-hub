import { EtbId } from './etb-id';

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

describe('EtbId', () => {
  describe('create', () => {
    it('should auto-generate a valid nanoid when no parameter provided', () => {
      // Given: No ID parameter
      // When: Creating EtbId via create()
      const result = EtbId.create();

      // Then: Success with 21-character nanoid
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toHaveLength(21);
      expect(result.value?.value).toMatch(/^[A-Za-z0-9_-]{21}$/);
    });

    it('should accept a valid nanoid string', () => {
      // Given: Valid 21-character nanoid
      const validId = 'A1B2C3D4E5F6G7H8I9J0K';

      // When: Creating EtbId with valid ID
      const result = EtbId.create(validId);

      // Then: Success with same ID
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe(validId);
    });

    it('should reject invalid nanoid format', () => {
      // Given: Invalid ID (too short)
      const invalidId = 'too-short';

      // When: Creating EtbId with invalid ID
      const result = EtbId.create(invalidId);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid nanoid format');
    });

    it('should support equals() method for identity comparison', () => {
      // Given: Two EtbIds with same nanoid
      const id = 'A1B2C3D4E5F6G7H8I9J0K';
      const id1 = EtbId.create(id).value!;
      const id2 = EtbId.create(id).value!;

      // When: Comparing equality
      // Then: Structural equality (same value)
      expect(id1.equals(id2)).toBe(true);
      expect(id1 === id2).toBe(false); // Different instances
    });
  });
});
