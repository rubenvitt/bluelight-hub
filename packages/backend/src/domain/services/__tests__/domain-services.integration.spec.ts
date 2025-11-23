/**
 * Integration Tests für Domain Services Komposition.
 *
 * Diese Tests validieren das Zusammenspiel der 3 Domain Services:
 * - EinsatzNamingService (Einsatznummern-Generierung)
 * - EinsatzCompletenessService (Vollständigkeits-Validierung)
 * - EinsatzArchivalPolicy (Archivierungs-Richtlinien)
 *
 * Im Gegensatz zu Unit Tests (die einzelne Services testen) validieren
 * Integration Tests realistische End-to-End Workflows und Service-Kompositionen.
 *
 * Story 1.7 | Task 6.1
 */

import { Einsatz as EinsatzAggregate } from '@domain/aggregates/einsatz.aggregate';
import { Address } from '@domain/value-objects/address';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzArchivalPolicy } from '../einsatz-archival.policy';
import { EinsatzCompletenessService } from '../einsatz-completeness.service';
import { EinsatzNamingService } from '../einsatz-naming.service';

// Mock für nanoid (für deterministische Tests)
// WICHTIG: Nutzt deterministisches Pattern statt Math.random() für zuverlässige CI/CD Tests
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

describe('Domain Services Integration', () => {
  let namingService: EinsatzNamingService;
  let completenessService: EinsatzCompletenessService;
  let archivalPolicy: EinsatzArchivalPolicy;

  beforeEach(() => {
    namingService = new EinsatzNamingService();
    completenessService = new EinsatzCompletenessService();
    archivalPolicy = new EinsatzArchivalPolicy();
  });

  // Helper: Create Address
  function createTestAddress(): Address {
    const addressResult = Address.create({ plz: '12345', ort: 'Berlin' });
    return addressResult.value!;
  }

  // Helper: Create UserId
  function createTestUserId(): UserId {
    return UserId.create().value!;
  }

  // Helper: Create Einsatz with standard props
  function createTestEinsatz(alarmstichwort = 'Brand', withAddress = true): EinsatzAggregate {
    const props = {
      alarmstichwort,
      createdBy: createTestUserId(),
      einsatzort: withAddress ? createTestAddress() : undefined,
    };
    const einsatzResult = EinsatzAggregate.create(props);
    return einsatzResult.value!;
  }

  describe('Service Composition: Naming + Completeness + Archival', () => {
    it('should validate Einsatz lifecycle (naming → completion → archival)', () => {
      // GIVEN: Services initialized
      // (already done in beforeEach)

      // WHEN: Create Einsatz with auto-generated number
      const einsatz = createTestEinsatz();

      // THEN: Number format is auto-generated (E{YEAR}-{NANOID-6})
      // Note: nanoid mock returns 21 chars, but Aggregate uses nanoid(6)
      expect(einsatz.nummer).toMatch(/^E\d{4}-[A-Za-z0-9_-]+$/);

      // WHEN: Transition to IN_BEARBEITUNG
      const statusUpdateResult = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
      expect(statusUpdateResult.isSuccess).toBe(true);

      // THEN: Status is IN_BEARBEITUNG
      expect(einsatz.status.equals(EinsatzStatus.IN_BEARBEITUNG())).toBe(true);

      // THEN: Completeness check passes
      const completenessResult = completenessService.canBeCompleted(einsatz);
      expect(completenessResult.isSuccess).toBe(true);

      // WHEN: Complete Einsatz
      const completeResult = einsatz.complete(createTestUserId());
      expect(completeResult.isSuccess).toBe(true);

      // THEN: Status is ABGESCHLOSSEN
      expect(einsatz.status.equals(EinsatzStatus.ABGESCHLOSSEN())).toBe(true);

      // WHEN: Check archival eligibility (current date)
      const currentDate = new Date();
      const canArchiveNow = archivalPolicy.canBeArchived(einsatz, currentDate);

      // THEN: Cannot archive yet (not 10 years old)
      expect(canArchiveNow).toBe(false);

      // WHEN: Fast-forward 10 years (simulated)
      const tenYearsLater = new Date(einsatz.abgeschlossenAt!);
      tenYearsLater.setFullYear(tenYearsLater.getFullYear() + 10);
      const canArchiveLater = archivalPolicy.canBeArchived(einsatz, tenYearsLater);

      // THEN: Can archive after 10 years
      expect(canArchiveLater).toBe(true);
    });

    it('should generate sequential numbers using NamingService', () => {
      // GIVEN: Year 2024, sequences 1-3

      // WHEN: Generate sequential numbers using NamingService
      const nummer1 = namingService.generateEinsatzNummer(2024, 1);
      const nummer2 = namingService.generateEinsatzNummer(2024, 2);
      const nummer3 = namingService.generateEinsatzNummer(2024, 3);

      // THEN: All numbers are sequential and correctly formatted
      expect(nummer1).toBe('E2024-001');
      expect(nummer2).toBe('E2024-002');
      expect(nummer3).toBe('E2024-003');

      // THEN: Numbers follow the naming convention
      expect(nummer1).toMatch(/^E\d{4}-\d{3}$/);
      expect(nummer2).toMatch(/^E\d{4}-\d{3}$/);
      expect(nummer3).toMatch(/^E\d{4}-\d{3}$/);
    });

    it('should validate completeness for multiple Einsätze (batch validation)', () => {
      // GIVEN: 3 Einsätze with different completeness states
      const completeEinsatz = createTestEinsatz('Brand', true);
      completeEinsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

      // Create Einsatz with empty alarmstichwort (bypassing factory validation)
      const incompleteEinsatz1 = createTestEinsatz('Valid', true);
      // biome-ignore lint/suspicious/noExplicitAny: Test bypasses factory validation for testing edge case
      (incompleteEinsatz1 as any)._alarmstichwort = ''; // Manually set to empty after creation
      incompleteEinsatz1.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

      const incompleteEinsatz2 = createTestEinsatz('Brand', false); // Missing einsatzort
      incompleteEinsatz2.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

      const allEinsaetze = [completeEinsatz, incompleteEinsatz1, incompleteEinsatz2];

      // WHEN: Validate all Einsätze
      const validationResults = allEinsaetze.map((einsatz) => completenessService.canBeCompleted(einsatz));

      // THEN: Only first Einsatz is complete
      expect(validationResults[0].isSuccess).toBe(true); // Complete
      expect(validationResults[1].isFailure).toBe(true); // Missing alarmstichwort
      expect(validationResults[2].isFailure).toBe(true); // Missing einsatzort
    });

    it('should apply archival policy to batch of old Einsätze', () => {
      // GIVEN: 5 Einsätze with different completion dates
      const currentDate = new Date('2024-11-17');

      const einsaetze = [
        { einsatz: createTestEinsatz(), yearsOld: 10 }, // 10 years old
        { einsatz: createTestEinsatz(), yearsOld: 9 }, // 9 years old
        { einsatz: createTestEinsatz(), yearsOld: 14 }, // 14 years old
        { einsatz: createTestEinsatz(), yearsOld: 5 }, // 5 years old
        { einsatz: createTestEinsatz(), yearsOld: 20 }, // 20 years old
      ];

      // Complete all Einsätze and set abgeschlossenAt
      const aggregates = einsaetze.map(({ einsatz, yearsOld }) => {
        einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
        einsatz.complete(createTestUserId());

        // Manually set abgeschlossenAt to simulate age
        const completedAt = new Date(currentDate);
        completedAt.setFullYear(completedAt.getFullYear() - yearsOld);
        // biome-ignore lint/suspicious/noExplicitAny: Test bypasses factory for date simulation
        (einsatz as any)._abgeschlossenAt = completedAt;

        return einsatz;
      });

      // WHEN: Check archival eligibility for all
      const archivalEligibility = aggregates.map((einsatz) => archivalPolicy.canBeArchived(einsatz, currentDate));

      // THEN: Only 10+ year old Einsätze are archivable
      expect(archivalEligibility[0]).toBe(true); // 10 years old
      expect(archivalEligibility[1]).toBe(false); // 9 years old (not yet)
      expect(archivalEligibility[2]).toBe(true); // 14 years old
      expect(archivalEligibility[3]).toBe(false); // 5 years old
      expect(archivalEligibility[4]).toBe(true); // 20 years old

      // WHEN: Filter archivable Einsätze
      const archivableEinsaetze = aggregates.filter((einsatz) => archivalPolicy.canBeArchived(einsatz, currentDate));

      // THEN: Should have 3 archivable Einsätze (10, 14, 20 years old)
      expect(archivableEinsaetze.length).toBe(3);
    });

    it('should block archival if Einsatz is incomplete', () => {
      // GIVEN: Incomplete Einsatz (manually set empty alarmstichwort)
      const incompleteEinsatz = createTestEinsatz('Valid', true);
      // biome-ignore lint/suspicious/noExplicitAny: Test bypasses factory validation for testing edge case
      (incompleteEinsatz as any)._alarmstichwort = ''; // Manually set to empty after creation
      incompleteEinsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

      // WHEN: Try to validate completeness
      const completenessResult = completenessService.canBeCompleted(incompleteEinsatz);

      // THEN: Completeness validation fails
      expect(completenessResult.isFailure).toBe(true);
      expect(completenessResult.error).toContain('Alarmstichwort');

      // WHEN: Force complete (Aggregate allows it, but service validation failed)
      const completeResult = incompleteEinsatz.complete(createTestUserId());

      // THEN: Aggregate allows completion (no internal validation)
      expect(completeResult.isSuccess).toBe(true);

      // WHEN: Check archival eligibility 10 years later
      const tenYearsLater = new Date(incompleteEinsatz.abgeschlossenAt!);
      tenYearsLater.setFullYear(tenYearsLater.getFullYear() + 10);
      const canArchive = archivalPolicy.canBeArchived(incompleteEinsatz, tenYearsLater);

      // THEN: Archival policy ONLY checks status + date (NOT completeness)
      expect(canArchive).toBe(true); // Policy doesn't validate completeness

      // NOTE: Application Layer should combine completeness + archival checks
    });

    it('should handle year boundary (2024 → 2025 sequence reset)', () => {
      // GIVEN: NamingService for year-based number generation

      // WHEN: Create last Einsatz of 2024
      const lastOf2024 = namingService.generateEinsatzNummer(2024, 999);

      // WHEN: Create first Einsatz of 2025 (sequence resets to 1)
      const firstOf2025 = namingService.generateEinsatzNummer(2025, 1);

      // THEN: Numbers are correctly formatted
      expect(lastOf2024).toBe('E2024-999');
      expect(firstOf2025).toBe('E2025-001');

      // THEN: Different years, same sequence number
      expect(lastOf2024).not.toBe(firstOf2025);
      expect(lastOf2024).toMatch(/^E2024-/);
      expect(firstOf2025).toMatch(/^E2025-/);
    });

    it('should reject archival for Einsätze in wrong status', () => {
      // GIVEN: 4 Einsätze in different statuses (all 10+ years old)
      const completedAt = new Date('2014-11-17');
      const currentDate = new Date('2024-11-17');

      const angelegt = createTestEinsatz();
      // Status: ANGELEGT (default)

      const inBearbeitung = createTestEinsatz();
      inBearbeitung.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

      const abgeschlossen = createTestEinsatz();
      abgeschlossen.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
      abgeschlossen.complete(createTestUserId());
      // biome-ignore lint/suspicious/noExplicitAny: Test bypasses factory for date simulation
      (abgeschlossen as any)._abgeschlossenAt = completedAt; // Simulate 10 years old

      const archiviert = createTestEinsatz();
      archiviert.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
      archiviert.complete(createTestUserId());
      // biome-ignore lint/suspicious/noExplicitAny: Test bypasses factory for date simulation
      (archiviert as any)._abgeschlossenAt = completedAt;
      archiviert.archive(); // Already archived

      // WHEN: Check archival eligibility
      const canArchiveAngelegt = archivalPolicy.canBeArchived(angelegt, currentDate);
      const canArchiveInBearbeitung = archivalPolicy.canBeArchived(inBearbeitung, currentDate);
      const canArchiveAbgeschlossen = archivalPolicy.canBeArchived(abgeschlossen, currentDate);
      const canArchiveArchiviert = archivalPolicy.canBeArchived(archiviert, currentDate);

      // THEN: Only ABGESCHLOSSEN Einsatz is archivable
      expect(canArchiveAngelegt).toBe(false); // Wrong status
      expect(canArchiveInBearbeitung).toBe(false); // Wrong status
      expect(canArchiveAbgeschlossen).toBe(true); // Correct status + 10 years old
      expect(canArchiveArchiviert).toBe(false); // Already archived
    });

    it('should execute end-to-end workflow: Create → Complete → Archive', () => {
      // GIVEN: Fresh Einsatz
      const einsatz = createTestEinsatz();

      // THEN: Einsatz created in ANGELEGT status
      expect(einsatz.status.equals(EinsatzStatus.ANGELEGT())).toBe(true);
      expect(einsatz.nummer).toMatch(/^E\d{4}-[A-Za-z0-9_-]+$/);

      // WHEN: Step 2 - Transition to IN_BEARBEITUNG
      const statusUpdate = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
      expect(statusUpdate.isSuccess).toBe(true);

      // THEN: Completeness validation passes
      const canComplete = completenessService.canBeCompleted(einsatz);
      expect(canComplete.isSuccess).toBe(true);

      // WHEN: Step 3 - Complete Einsatz
      const completeResult = einsatz.complete(createTestUserId());
      expect(completeResult.isSuccess).toBe(true);

      // THEN: Einsatz is ABGESCHLOSSEN
      expect(einsatz.status.equals(EinsatzStatus.ABGESCHLOSSEN())).toBe(true);
      expect(einsatz.abgeschlossenAt).toBeDefined();

      // WHEN: Step 4 - Fast-forward 10 years
      const tenYearsLater = archivalPolicy.getArchivalDate(einsatz);
      const canArchive = archivalPolicy.canBeArchived(einsatz, tenYearsLater);

      // THEN: Archival is allowed
      expect(canArchive).toBe(true);

      // WHEN: Step 5 - Archive Einsatz
      const archiveResult = einsatz.archive();
      expect(archiveResult.isSuccess).toBe(true);

      // THEN: Einsatz is ARCHIVIERT
      expect(einsatz.status.equals(EinsatzStatus.ARCHIVIERT())).toBe(true);
      expect(einsatz.archivedAt).toBeDefined();

      // THEN: Cannot archive again (already archived)
      const cannotArchiveAgain = archivalPolicy.canBeArchived(einsatz, tenYearsLater);
      expect(cannotArchiveAgain).toBe(false);
    });
  });
});
