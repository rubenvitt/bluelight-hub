import { ErinnerungStatus } from '@domain/value-objects/erinnerung-status';

describe('ErinnerungStatus', () => {
  describe('create() - Factory Method', () => {
    it('should create ErinnerungStatus with valid GEPLANT value', () => {
      // Given: Valid status value
      const validStatus = 'GEPLANT';

      // When: Creating ErinnerungStatus
      const result = ErinnerungStatus.create(validStatus);

      // Then: Success with correct value
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe('GEPLANT');
    });

    it('should create ErinnerungStatus for all valid status values', () => {
      // Given: All valid status values
      const validValues = ['GEPLANT', 'AUSGELOEST', 'ACKNOWLEDGED', 'SNOOZED', 'ESKALIERT', 'ERLEDIGT'];

      // When/Then: All should succeed
      for (const value of validValues) {
        const result = ErinnerungStatus.create(value);
        expect(result.isSuccess).toBe(true);
        expect(result.value?.value).toBe(value);
      }
    });

    it('should fail with invalid status value', () => {
      // Given: Invalid status
      const invalidStatus = 'INVALID';

      // When: Creating ErinnerungStatus
      const result = ErinnerungStatus.create(invalidStatus);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Ungültiger Status: INVALID');
    });

    it('should fail with lowercase status value', () => {
      // Given: Lowercase status (not allowed)
      const lowercaseStatus = 'geplant';

      // When: Creating ErinnerungStatus
      const result = ErinnerungStatus.create(lowercaseStatus);

      // Then: Failure
      expect(result.isFailure).toBe(true);
    });
  });

  describe('Static Convenience Factories', () => {
    it('should create GEPLANT status via factory', () => {
      // When: Using static factory
      const status = ErinnerungStatus.GEPLANT();

      // Then: Correct value
      expect(status.value).toBe('GEPLANT');
    });

    it('should create AUSGELOEST status via factory', () => {
      const status = ErinnerungStatus.AUSGELOEST();
      expect(status.value).toBe('AUSGELOEST');
    });

    it('should create ACKNOWLEDGED status via factory', () => {
      const status = ErinnerungStatus.ACKNOWLEDGED();
      expect(status.value).toBe('ACKNOWLEDGED');
    });

    it('should create SNOOZED status via factory', () => {
      const status = ErinnerungStatus.SNOOZED();
      expect(status.value).toBe('SNOOZED');
    });

    it('should create ESKALIERT status via factory', () => {
      const status = ErinnerungStatus.ESKALIERT();
      expect(status.value).toBe('ESKALIERT');
    });

    it('should create ERLEDIGT status via factory', () => {
      const status = ErinnerungStatus.ERLEDIGT();
      expect(status.value).toBe('ERLEDIGT');
    });
  });

  describe('canTransitionTo() - State Machine', () => {
    describe('From GEPLANT', () => {
      it('should allow transition GEPLANT → AUSGELOEST', () => {
        // Given: GEPLANT status
        const current = ErinnerungStatus.GEPLANT();
        const target = ErinnerungStatus.AUSGELOEST();

        // When/Then: Transition should be valid
        expect(current.canTransitionTo(target)).toBe(true);
      });

      it('should not allow transition GEPLANT → ACKNOWLEDGED', () => {
        const current = ErinnerungStatus.GEPLANT();
        const target = ErinnerungStatus.ACKNOWLEDGED();

        expect(current.canTransitionTo(target)).toBe(false);
      });

      it('should not allow transition GEPLANT → ERLEDIGT', () => {
        const current = ErinnerungStatus.GEPLANT();
        const target = ErinnerungStatus.ERLEDIGT();

        expect(current.canTransitionTo(target)).toBe(false);
      });
    });

    describe('From AUSGELOEST', () => {
      it('should allow transition AUSGELOEST → ACKNOWLEDGED', () => {
        const current = ErinnerungStatus.AUSGELOEST();
        const target = ErinnerungStatus.ACKNOWLEDGED();

        expect(current.canTransitionTo(target)).toBe(true);
      });

      it('should allow transition AUSGELOEST → SNOOZED', () => {
        const current = ErinnerungStatus.AUSGELOEST();
        const target = ErinnerungStatus.SNOOZED();

        expect(current.canTransitionTo(target)).toBe(true);
      });

      it('should allow transition AUSGELOEST → ESKALIERT', () => {
        const current = ErinnerungStatus.AUSGELOEST();
        const target = ErinnerungStatus.ESKALIERT();

        expect(current.canTransitionTo(target)).toBe(true);
      });

      it('should not allow transition AUSGELOEST → GEPLANT', () => {
        const current = ErinnerungStatus.AUSGELOEST();
        const target = ErinnerungStatus.GEPLANT();

        expect(current.canTransitionTo(target)).toBe(false);
      });
    });

    describe('From ACKNOWLEDGED', () => {
      it('should allow transition ACKNOWLEDGED → ERLEDIGT', () => {
        const current = ErinnerungStatus.ACKNOWLEDGED();
        const target = ErinnerungStatus.ERLEDIGT();

        expect(current.canTransitionTo(target)).toBe(true);
      });

      it('should not allow transition ACKNOWLEDGED → GEPLANT', () => {
        const current = ErinnerungStatus.ACKNOWLEDGED();
        const target = ErinnerungStatus.GEPLANT();

        expect(current.canTransitionTo(target)).toBe(false);
      });
    });

    describe('From SNOOZED', () => {
      it('should allow transition SNOOZED → AUSGELOEST', () => {
        const current = ErinnerungStatus.SNOOZED();
        const target = ErinnerungStatus.AUSGELOEST();

        expect(current.canTransitionTo(target)).toBe(true);
      });

      it('should allow transition SNOOZED → ESKALIERT', () => {
        const current = ErinnerungStatus.SNOOZED();
        const target = ErinnerungStatus.ESKALIERT();

        expect(current.canTransitionTo(target)).toBe(true);
      });
    });

    describe('From ESKALIERT', () => {
      it('should allow transition ESKALIERT → ACKNOWLEDGED', () => {
        const current = ErinnerungStatus.ESKALIERT();
        const target = ErinnerungStatus.ACKNOWLEDGED();

        expect(current.canTransitionTo(target)).toBe(true);
      });

      it('should allow transition ESKALIERT → ERLEDIGT', () => {
        const current = ErinnerungStatus.ESKALIERT();
        const target = ErinnerungStatus.ERLEDIGT();

        expect(current.canTransitionTo(target)).toBe(true);
      });
    });

    describe('From ERLEDIGT (final state)', () => {
      it('should not allow any transitions from ERLEDIGT', () => {
        const current = ErinnerungStatus.ERLEDIGT();

        expect(current.canTransitionTo(ErinnerungStatus.GEPLANT())).toBe(false);
        expect(current.canTransitionTo(ErinnerungStatus.AUSGELOEST())).toBe(false);
        expect(current.canTransitionTo(ErinnerungStatus.ACKNOWLEDGED())).toBe(false);
        expect(current.canTransitionTo(ErinnerungStatus.SNOOZED())).toBe(false);
        expect(current.canTransitionTo(ErinnerungStatus.ESKALIERT())).toBe(false);
      });
    });
  });

  describe('Helper Methods', () => {
    it('isGeplant() should return true for GEPLANT status', () => {
      expect(ErinnerungStatus.GEPLANT().isGeplant()).toBe(true);
      expect(ErinnerungStatus.AUSGELOEST().isGeplant()).toBe(false);
    });

    it('isAusgeloest() should return true for AUSGELOEST status', () => {
      expect(ErinnerungStatus.AUSGELOEST().isAusgeloest()).toBe(true);
      expect(ErinnerungStatus.GEPLANT().isAusgeloest()).toBe(false);
    });

    it('isErledigt() should return true for ERLEDIGT status', () => {
      expect(ErinnerungStatus.ERLEDIGT().isErledigt()).toBe(true);
      expect(ErinnerungStatus.GEPLANT().isErledigt()).toBe(false);
    });

    it('isActive() should return true for all non-ERLEDIGT statuses', () => {
      expect(ErinnerungStatus.GEPLANT().isActive()).toBe(true);
      expect(ErinnerungStatus.AUSGELOEST().isActive()).toBe(true);
      expect(ErinnerungStatus.ACKNOWLEDGED().isActive()).toBe(true);
      expect(ErinnerungStatus.SNOOZED().isActive()).toBe(true);
      expect(ErinnerungStatus.ESKALIERT().isActive()).toBe(true);
      expect(ErinnerungStatus.ERLEDIGT().isActive()).toBe(false);
    });
  });

  describe('toString() - String Representation', () => {
    it('should return status value as string', () => {
      const status = ErinnerungStatus.GEPLANT();
      expect(status.toString()).toBe('GEPLANT');
    });
  });

  describe('equals() - Equality', () => {
    it('should return true for same status values', () => {
      const status1 = ErinnerungStatus.GEPLANT();
      const status2 = ErinnerungStatus.GEPLANT();

      expect(status1.equals(status2)).toBe(true);
    });

    it('should return false for different status values', () => {
      const status1 = ErinnerungStatus.GEPLANT();
      const status2 = ErinnerungStatus.AUSGELOEST();

      expect(status1.equals(status2)).toBe(false);
    });
  });
});
