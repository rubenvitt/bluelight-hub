import { EinsatzArchivalPolicy } from './einsatz-archival.policy';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import { Address } from '@domain/value-objects/address';
import { UserId } from '@domain/value-objects/user-id';

// Mock nanoid to prevent ESM issues in Jest
jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn(() => {
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

describe('EinsatzArchivalPolicy', () => {
  let policy: EinsatzArchivalPolicy;

  beforeEach(() => {
    policy = new EinsatzArchivalPolicy();
  });

  /**
   * Helper: Create Einsatz and complete it at specific date.
   * This simulates an Einsatz that was completed in the past.
   */
  function createCompletedEinsatz(completedAt: Date): Einsatz {
    const addressResult = Address.create('12345', 'Hauptstraße', '1', 'Berlin');
    const userId = UserId.create().value!;
    const einsatzResult = Einsatz.create({
      alarmstichwort: 'Brand',
      createdBy: userId,
      einsatzort: addressResult.value,
    });
    const einsatz = einsatzResult.value!;

    // Transition to IN_BEARBEITUNG, then ABGESCHLOSSEN
    einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
    einsatz.complete(userId);

    // HACK: Manually set abgeschlossenAt to test date
    // This is necessary for testing time-based policies with fixed dates
    // biome-ignore lint/suspicious/noExplicitAny: Test bypasses factory for date simulation
    (einsatz as any)._abgeschlossenAt = completedAt;

    return einsatz;
  }

  describe('canBeArchived', () => {
    it('should return true when Einsatz is 10 years old and ABGESCHLOSSEN', () => {
      // Given: Einsatz completed 10 years ago
      const completedAt = new Date('2014-11-17T10:00:00Z');
      const einsatz = createCompletedEinsatz(completedAt);
      const currentDate = new Date('2024-11-17T10:00:00Z'); // Exactly 10 years later

      // When: Check if can be archived
      const canArchive = policy.canBeArchived(einsatz, currentDate);

      // Then: Should be archivable
      expect(canArchive).toBe(true);
    });

    it('should return false when Einsatz is 9 years old (not 10 yet)', () => {
      // Given: Einsatz completed 9 years ago
      const completedAt = new Date('2015-11-17T10:00:00Z');
      const einsatz = createCompletedEinsatz(completedAt);
      const currentDate = new Date('2024-11-17T10:00:00Z'); // Only 9 years later

      // When: Check if can be archived
      const canArchive = policy.canBeArchived(einsatz, currentDate);

      // Then: Should NOT be archivable yet
      expect(canArchive).toBe(false);
    });

    it('should return true when Einsatz is more than 10 years old', () => {
      // Given: Einsatz completed 15 years ago
      const completedAt = new Date('2009-11-17T10:00:00Z');
      const einsatz = createCompletedEinsatz(completedAt);
      const currentDate = new Date('2024-11-17T10:00:00Z'); // 15 years later

      // When: Check if can be archived
      const canArchive = policy.canBeArchived(einsatz, currentDate);

      // Then: Should be archivable
      expect(canArchive).toBe(true);
    });

    it('should return false when status is not ABGESCHLOSSEN', () => {
      // Given: Einsatz in IN_BEARBEITUNG status (not completed)
      const addressResult = Address.create('12345', 'Hauptstraße', '1', 'Berlin');
      const userId = UserId.create().value!;
      const einsatzResult = Einsatz.create({
        alarmstichwort: 'Brand',
        createdBy: userId,
        einsatzort: addressResult.value,
      });
      const einsatz = einsatzResult.value!;
      einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

      const currentDate = new Date('2024-11-17');

      // When: Check if can be archived
      const canArchive = policy.canBeArchived(einsatz, currentDate);

      // Then: Should NOT be archivable (wrong status)
      expect(canArchive).toBe(false);
    });

    it('should return false when Einsatz is already ARCHIVIERT', () => {
      // Given: Einsatz already archived
      const completedAt = new Date('2014-11-17T10:00:00Z');
      const einsatz = createCompletedEinsatz(completedAt);
      const userId = UserId.create().value!;
      einsatz.archive(userId); // Transitions to ARCHIVIERT

      const currentDate = new Date('2024-11-17');

      // When: Check if can be archived
      const canArchive = policy.canBeArchived(einsatz, currentDate);

      // Then: Should NOT be archivable (already archived)
      expect(canArchive).toBe(false);
    });

    it('should return false when abgeschlossenAt is missing', () => {
      // Given: Einsatz without abgeschlossenAt (not completed)
      const addressResult = Address.create('12345', 'Hauptstraße', '1', 'Berlin');
      const userId = UserId.create().value!;
      const einsatzResult = Einsatz.create({
        alarmstichwort: 'Brand',
        createdBy: userId,
        einsatzort: addressResult.value,
      });
      const einsatz = einsatzResult.value!;
      // Do NOT call complete() → abgeschlossenAt remains undefined

      const currentDate = new Date('2024-11-17');

      // When: Check if can be archived
      const canArchive = policy.canBeArchived(einsatz, currentDate);

      // Then: Should NOT be archivable (no abgeschlossenAt)
      expect(canArchive).toBe(false);
    });

    it('should handle leap year calculation correctly', () => {
      // Given: Einsatz completed on Feb 29, 2024 (leap year)
      const completedAt = new Date('2024-02-29T12:00:00Z');
      const einsatz = createCompletedEinsatz(completedAt);
      const currentDate = new Date('2034-03-01T12:00:00Z'); // 10 years later (Feb 29 + 10 years = Mar 1, 2034)

      // When: Check if can be archived
      const canArchive = policy.canBeArchived(einsatz, currentDate);

      // Then: Should be archivable (10 years passed, Feb 29 → Mar 1)
      expect(canArchive).toBe(true);
    });

    it('should be deterministic (same inputs → same output)', () => {
      // Given: Fixed dates
      const completedAt = new Date('2014-11-17T10:00:00Z');
      const einsatz = createCompletedEinsatz(completedAt);
      const currentDate = new Date('2024-11-17T10:00:00Z');

      // When: Call multiple times
      const result1 = policy.canBeArchived(einsatz, currentDate);
      const result2 = policy.canBeArchived(einsatz, currentDate);
      const result3 = policy.canBeArchived(einsatz, currentDate);

      // Then: All identical
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
      expect(result1).toBe(true);
    });
  });

  describe('getArchivalDate', () => {
    it('should calculate archival date as abgeschlossenAt + 10 years', () => {
      // Given: Einsatz completed on 2014-11-17
      const completedAt = new Date('2014-11-17T10:30:00Z');
      const einsatz = createCompletedEinsatz(completedAt);

      // When: Get archival date
      const archivalDate = policy.getArchivalDate(einsatz);

      // Then: Should be exactly 10 years later
      const expected = new Date('2024-11-17T10:30:00Z');
      expect(archivalDate.toISOString()).toBe(expected.toISOString());
    });

    it('should handle leap year edge case (Feb 29 → Mar 1)', () => {
      // Given: Einsatz completed on Feb 29, 2024 (leap year)
      const completedAt = new Date('2024-02-29T12:00:00Z');
      const einsatz = createCompletedEinsatz(completedAt);

      // When: Get archival date
      const archivalDate = policy.getArchivalDate(einsatz);

      // Then: Should be Mar 1, 2034 (2034 is NOT a leap year, so Feb 29 + 10 years = Mar 1)
      // JavaScript setFullYear handles this automatically by rolling over to March
      const expected = new Date('2034-03-01T12:00:00Z');
      expect(archivalDate.toISOString()).toBe(expected.toISOString());
    });

    it('should throw error when Einsatz is not completed', () => {
      // Given: Einsatz without abgeschlossenAt
      const addressResult = Address.create('12345', 'Hauptstraße', '1', 'Berlin');
      const userId = UserId.create().value!;
      const einsatzResult = Einsatz.create({
        alarmstichwort: 'Brand',
        createdBy: userId,
        einsatzort: addressResult.value,
      });
      const einsatz = einsatzResult.value!;

      // When/Then: Try to get archival date → should throw error
      expect(() => policy.getArchivalDate(einsatz)).toThrow('nicht abgeschlossen');
    });

    it('should not mutate original abgeschlossenAt date', () => {
      // Given: Einsatz with fixed completedAt
      const completedAt = new Date('2014-11-17T10:00:00Z');
      const einsatz = createCompletedEinsatz(completedAt);
      const originalDateString = einsatz.abgeschlossenAt!.toISOString();

      // When: Get archival date
      policy.getArchivalDate(einsatz);

      // Then: Original date should be unchanged (immutability)
      expect(einsatz.abgeschlossenAt!.toISOString()).toBe(originalDateString);
    });
  });
});
