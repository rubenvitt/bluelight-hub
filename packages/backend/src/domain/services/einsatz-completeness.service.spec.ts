import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import { UserId } from '@domain/value-objects/user-id';
import { Address } from '@domain/value-objects/address';
import { EinsatzCompletenessService } from './einsatz-completeness.service';

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

describe('EinsatzCompletenessService', () => {
  let service: EinsatzCompletenessService;

  beforeEach(() => {
    service = new EinsatzCompletenessService();
  });

  // Helper: Create complete Einsatz in IN_BEARBEITUNG status
  function createCompleteEinsatz(): Einsatz {
    const userId = UserId.create().value as UserId;
    const addressResult = Address.create({
      strasse: 'Hauptstraße',
      hausnummer: '1',
      plz: '12345',
      ort: 'Berlin',
    });

    const einsatzResult = Einsatz.create({
      alarmstichwort: 'Brand',
      createdBy: userId,
      einsatzort: addressResult.value,
    });

    const einsatz = einsatzResult.value as Einsatz;
    // Transition to IN_BEARBEITUNG (required status)
    einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

    return einsatz;
  }

  // Helper: Create Einsatz without Einsatzort
  function createEinsatzWithoutOrt(): Einsatz {
    const userId = UserId.create().value as UserId;
    const einsatzResult = Einsatz.create({
      alarmstichwort: 'Brand',
      createdBy: userId,
    });

    const einsatz = einsatzResult.value as Einsatz;
    einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
    return einsatz;
  }

  describe('canBeCompleted', () => {
    it('should return success for complete Einsatz in IN_BEARBEITUNG status', () => {
      // Given: Complete Einsatz with all required fields
      const einsatz = createCompleteEinsatz();

      // When: Check if can be completed
      const result = service.canBeCompleted(einsatz);

      // Then: Should be successful
      expect(result.isSuccess).toBe(true);
    });

    it('should fail when alarmstichwort is missing', () => {
      // Given: Valid Einsatz first created
      const einsatz = createCompleteEinsatz();
      einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

      // When: Manually set alarmstichwort to empty (bypassing factory validation)
      // This tests the Service's validation logic directly
      // biome-ignore lint/suspicious/noExplicitAny: Test bypasses factory validation for testing edge case
      (einsatz as any)._alarmstichwort = '';

      // When: Check completeness
      const result = service.canBeCompleted(einsatz);

      // Then: Service validation should fail
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Alarmstichwort');
    });

    it('should fail when einsatzort is missing (if required)', () => {
      // Given: Einsatz without einsatzort
      const einsatz = createEinsatzWithoutOrt();

      // When: Check if can be completed (requireOrt = true)
      const result = service.canBeCompleted(einsatz, true);

      // Then: Should fail with specific error
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Einsatzort');
    });

    it('should succeed when einsatzort is missing but not required', () => {
      // Given: Einsatz without einsatzort
      const einsatz = createEinsatzWithoutOrt();

      // When: Check if can be completed (requireOrt = false)
      const result = service.canBeCompleted(einsatz, false);

      // Then: Should be successful
      expect(result.isSuccess).toBe(true);
    });

    it('should fail when status is ANGELEGT (not started yet)', () => {
      // Given: Einsatz in ANGELEGT status (default from create())
      const userId = UserId.create().value as UserId;
      const addressResult = Address.create({
        strasse: 'Hauptstraße',
        hausnummer: '1',
        plz: '12345',
        ort: 'Berlin',
      });
      const einsatzResult = Einsatz.create({
        alarmstichwort: 'Brand',
        createdBy: userId,
        einsatzort: addressResult.value,
      });
      const einsatz = einsatzResult.value as Einsatz;
      // Do NOT call updateStatus() → stays in ANGELEGT

      // When: Check if can be completed
      const result = service.canBeCompleted(einsatz);

      // Then: Should fail with status error
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Status');
      expect(result.error).toContain('IN_BEARBEITUNG');
    });

    it('should fail when status is ABGESCHLOSSEN (already completed)', () => {
      // Given: Einsatz in ABGESCHLOSSEN status
      const einsatz = createCompleteEinsatz();
      const userId = UserId.create().value as UserId;
      einsatz.complete(userId); // Transitions to ABGESCHLOSSEN

      // When: Check if can be completed
      const result = service.canBeCompleted(einsatz);

      // Then: Should fail (already completed)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Status');
    });

    it('should fail when status is ARCHIVIERT (archived)', () => {
      // Given: Einsatz in ARCHIVIERT status
      const einsatz = createCompleteEinsatz();
      const userId = UserId.create().value as UserId;
      einsatz.complete(userId);
      einsatz.archive(userId);

      // When: Check if can be completed
      const result = service.canBeCompleted(einsatz);

      // Then: Should fail (cannot complete archived Einsatz)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Status');
    });
  });

  describe('getMissingRequirements', () => {
    it('should return empty array for complete Einsatz', () => {
      // Given: Complete Einsatz
      const einsatz = createCompleteEinsatz();

      // When: Get missing requirements
      const missing = service.getMissingRequirements(einsatz);

      // Then: Should be empty
      expect(missing).toEqual([]);
    });

    it('should return ["einsatzort"] when einsatzort is missing and required', () => {
      // Given: Einsatz without einsatzort
      const einsatz = createEinsatzWithoutOrt();

      // When: Get missing requirements (requireOrt = true)
      const missing = service.getMissingRequirements(einsatz, true);

      // Then: Should include einsatzort
      expect(missing).toContain('einsatzort');
    });

    it('should return empty array when einsatzort is missing but not required', () => {
      // Given: Einsatz without einsatzort
      const einsatz = createEinsatzWithoutOrt();

      // When: Get missing requirements (requireOrt = false)
      const missing = service.getMissingRequirements(einsatz, false);

      // Then: Should be empty
      expect(missing).toEqual([]);
    });

    it('should return ["status"] when status is not IN_BEARBEITUNG', () => {
      // Given: Einsatz in ANGELEGT status
      const userId = UserId.create().value as UserId;
      const addressResult = Address.create({
        strasse: 'Hauptstraße',
        hausnummer: '1',
        plz: '12345',
        ort: 'Berlin',
      });
      const einsatzResult = Einsatz.create({
        alarmstichwort: 'Brand',
        createdBy: userId,
        einsatzort: addressResult.value,
      });
      const einsatz = einsatzResult.value as Einsatz;

      // When: Get missing requirements
      const missing = service.getMissingRequirements(einsatz);

      // Then: Should include status
      expect(missing).toContain('status (muss IN_BEARBEITUNG sein)');
    });

    it('should return multiple missing requirements when multiple fields are missing', () => {
      // Given: Incomplete Einsatz (no ort, wrong status)
      const userId = UserId.create().value as UserId;
      const einsatzResult = Einsatz.create({
        alarmstichwort: 'Brand',
        createdBy: userId,
      });
      const einsatz = einsatzResult.value as Einsatz;
      // Do NOT update status → stays ANGELEGT

      // When: Get missing requirements
      const missing = service.getMissingRequirements(einsatz, true);

      // Then: Should include missing fields
      expect(missing).toContain('einsatzort');
      expect(missing).toContain('status (muss IN_BEARBEITUNG sein)');
      expect(missing.length).toBe(2);
    });

    it('should handle optional parameter requireOrt = false', () => {
      // Given: Einsatz without einsatzort
      const einsatz = createEinsatzWithoutOrt();

      // When: Get missing requirements with default requireOrt (true)
      const missingWithOrt = service.getMissingRequirements(einsatz);

      // Then: Should include einsatzort
      expect(missingWithOrt).toContain('einsatzort');

      // When: Get missing requirements with requireOrt = false
      const missingWithoutOrt = service.getMissingRequirements(einsatz, false);

      // Then: Should NOT include einsatzort
      expect(missingWithoutOrt).not.toContain('einsatzort');
    });

    it('should handle all fields set but wrong status', () => {
      // Given: Einsatz with all fields but status ABGESCHLOSSEN
      const einsatz = createCompleteEinsatz();
      const userId = UserId.create().value as UserId;
      einsatz.complete(userId); // Status → ABGESCHLOSSEN

      // When: Get missing requirements
      const missing = service.getMissingRequirements(einsatz);

      // Then: Should only include status
      expect(missing).toContain('status (muss IN_BEARBEITUNG sein)');
      expect(missing.length).toBe(1);
    });
  });
});
