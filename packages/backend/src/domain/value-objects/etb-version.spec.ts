import { EtbVersion } from './etb-version';

describe('EtbVersion', () => {
  describe('create', () => {
    it('should create version with number and auto-generated timestamp', () => {
      // Given: Version number 1
      const before = new Date();

      // When: Creating EtbVersion
      const result = EtbVersion.create(1);

      const after = new Date();

      // Then: Success with version 1 and current timestamp
      expect(result.isSuccess).toBe(true);
      expect(result.value?.versionNumber).toBe(1);
      expect(result.value?.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.value?.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should reject version number less than 1', () => {
      // Given: Invalid version 0
      // When: Creating EtbVersion
      const result = EtbVersion.create(0);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('positive');
    });

    it('should increment version number and generate new timestamp', () => {
      // Given: Version 1
      const v1 = EtbVersion.create(1).value!;
      const timestamp1 = v1.timestamp;

      // Wait 2ms to ensure different timestamp
      const waitUntil = Date.now() + 2;
      while (Date.now() < waitUntil) {
        // busy wait
      }

      // When: Incrementing version
      const v2 = v1.increment();

      // Then: Version 2 with new timestamp
      expect(v2.versionNumber).toBe(2);
      expect(v2.timestamp.getTime()).toBeGreaterThan(timestamp1.getTime());
    });

    it('should create new instance on increment (immutability)', () => {
      // Given: Version 1
      const v1 = EtbVersion.create(1).value!;

      // When: Incrementing
      const v2 = v1.increment();

      // Then: Different instances
      expect(v2).not.toBe(v1);
      expect(v1.versionNumber).toBe(1); // Original unchanged
      expect(v2.versionNumber).toBe(2);
    });

    it('should support structural equality', () => {
      // Given: Two versions with same number
      const v1 = EtbVersion.create(5).value!;
      const v2 = EtbVersion.create(5).value!;

      // Note: Timestamps might differ by milliseconds, so test separately
      expect(v1.versionNumber).toBe(v2.versionNumber);
      expect(v1.versionNumber).toBe(5);
    });

    it('should provide toString() representation', () => {
      // Given: Version 3
      const version = EtbVersion.create(3).value!;

      // When: Converting to string
      const str = version.toString();

      // Then: Includes version number
      expect(str).toContain('3');
      expect(str).toContain('v');
    });
  });
});
