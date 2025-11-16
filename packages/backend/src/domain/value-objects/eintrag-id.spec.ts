import { EintragId } from './eintrag-id';

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

describe('EintragId', () => {
  describe('create', () => {
    it('should auto-generate a valid nanoid when no parameter provided', () => {
      // Given: No ID parameter
      // When: Creating EintragId via create()
      const result = EintragId.create();

      // Then: Success with 21-character nanoid
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toHaveLength(21);
      expect(result.value?.value).toMatch(/^[A-Za-z0-9_-]{21}$/);
    });

    it('should accept a valid nanoid string', () => {
      // Given: Valid 21-character nanoid
      const validId = 'X1Y2Z3A4B5C6D7E8F9G0H';

      // When: Creating EintragId with valid ID
      const result = EintragId.create(validId);

      // Then: Success with same ID
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe(validId);
    });

    it('should reject invalid nanoid format', () => {
      // Given: Invalid ID (contains invalid characters)
      const invalidId = 'invalid@id#with$special';

      // When: Creating EintragId with invalid ID
      const result = EintragId.create(invalidId);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid nanoid format');
    });

    it('should support equals() method for identity comparison', () => {
      // Given: Two EintragIds with same nanoid
      const id = 'X1Y2Z3A4B5C6D7E8F9G0H';
      const id1 = EintragId.create(id).value!;
      const id2 = EintragId.create(id).value!;
      const id3 = EintragId.create('A1B2C3D4E5F6G7H8I9J0K').value!;

      // When: Comparing equality
      // Then: Structural equality (same value)
      expect(id1.equals(id2)).toBe(true);
      expect(id1.equals(id3)).toBe(false);
      expect(id1 === id2).toBe(false); // Different instances
    });
  });
});
