import { EtbSequenceNumber } from './etb-sequence-number';

describe('EtbSequenceNumber', () => {
  describe('create', () => {
    it('should create valid sequence number starting at 1', () => {
      // Given: Sequence number 1
      // When: Creating EtbSequenceNumber
      const result = EtbSequenceNumber.create(1);

      // Then: Success with value 1
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe(1);
    });

    it('should reject sequence number less than 1', () => {
      // Given: Invalid sequence number 0
      // When: Creating EtbSequenceNumber
      const result = EtbSequenceNumber.create(0);

      // Then: Failure with validation error
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('must be');
      expect(result.error).toContain('positive');
    });

    it('should reject negative sequence numbers', () => {
      // Given: Negative sequence number
      const result = EtbSequenceNumber.create(-5);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('positive');
    });

    it('should be immutable (Object.freeze via ValueObject)', () => {
      // Given: Created sequence number
      const seq = EtbSequenceNumber.create(5).value!;

      // When: Attempting to modify (TypeScript would block, but test runtime)
      // Then: Properties are readonly
      expect(() => {
        // biome-ignore lint/suspicious/noExplicitAny: Test verifies immutability
        (seq as any).props.value = 10; // Should fail due to Object.freeze
      }).toThrow();
    });

    it('should support structural equality', () => {
      // Given: Two sequence numbers with same value
      const seq1 = EtbSequenceNumber.create(3).value!;
      const seq2 = EtbSequenceNumber.create(3).value!;
      const seq3 = EtbSequenceNumber.create(5).value!;

      // When: Comparing equality
      // Then: Structural equality (inherited from ValueObject)
      expect(seq1.equals(seq2)).toBe(true);
      expect(seq1.equals(seq3)).toBe(false);
      expect(seq1 === seq2).toBe(false); // Different instances
    });
  });
});
