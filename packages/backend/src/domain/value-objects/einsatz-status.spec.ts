import { EinsatzStatus } from './einsatz-status';

describe('EinsatzStatus', () => {
  describe('create() - Factory Method', () => {
    it('should create EinsatzStatus with valid value ANGELEGT', () => {
      // Given: Valid status value ANGELEGT
      const value = 'ANGELEGT';

      // When: Creating EinsatzStatus via factory method
      const result = EinsatzStatus.create(value);

      // Then: Result is successful with correct value
      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(result.value).toBeDefined();
      expect(result.value?.value).toBe('ANGELEGT');
      expect(result.error).toBeUndefined();
    });

    it('should create EinsatzStatus with valid value IN_BEARBEITUNG', () => {
      // Given: Valid status value IN_BEARBEITUNG
      const value = 'IN_BEARBEITUNG';

      // When: Creating EinsatzStatus via factory method
      const result = EinsatzStatus.create(value);

      // Then: Result is successful with correct value
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe('IN_BEARBEITUNG');
    });

    it('should create EinsatzStatus with valid value ABGESCHLOSSEN', () => {
      // Given: Valid status value ABGESCHLOSSEN
      const value = 'ABGESCHLOSSEN';

      // When: Creating EinsatzStatus via factory method
      const result = EinsatzStatus.create(value);

      // Then: Result is successful with correct value
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe('ABGESCHLOSSEN');
    });

    it('should create EinsatzStatus with valid value ARCHIVIERT', () => {
      // Given: Valid status value ARCHIVIERT
      const value = 'ARCHIVIERT';

      // When: Creating EinsatzStatus via factory method
      const result = EinsatzStatus.create(value);

      // Then: Result is successful with correct value
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe('ARCHIVIERT');
    });

    it('should fail with invalid status value', () => {
      // Given: Invalid status value not in ALLOWED_VALUES
      const invalidValue = 'INVALID_STATUS';

      // When: Creating EinsatzStatus with invalid value
      const result = EinsatzStatus.create(invalidValue);

      // Then: Result fails with descriptive error message
      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
      expect(result.value).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Ungültiger Status');
      expect(result.error).toContain('INVALID_STATUS');
      expect(result.error).toContain('ANGELEGT');
      expect(result.error).toContain('IN_BEARBEITUNG');
      expect(result.error).toContain('ABGESCHLOSSEN');
      expect(result.error).toContain('ARCHIVIERT');
    });

    it('should fail with empty string', () => {
      // Given: Empty string as status value
      const emptyValue = '';

      // When: Creating EinsatzStatus with empty value
      const result = EinsatzStatus.create(emptyValue);

      // Then: Result fails with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Ungültiger Status');
    });

    it('should fail with lowercase status value', () => {
      // Given: Lowercase version of valid status (case-sensitive)
      const lowercaseValue = 'angelegt';

      // When: Creating EinsatzStatus with lowercase value
      const result = EinsatzStatus.create(lowercaseValue);

      // Then: Result fails (status values are case-sensitive)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Ungültiger Status');
      expect(result.error).toContain('angelegt');
    });

    it('should fail with partial match status value', () => {
      // Given: Partial match of valid status value
      const partialValue = 'ANGEL';

      // When: Creating EinsatzStatus with partial value
      const result = EinsatzStatus.create(partialValue);

      // Then: Result fails (no partial matching)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Ungültiger Status');
    });
  });

  describe('Static Convenience Factories', () => {
    it('should create ANGELEGT status via static factory', () => {
      // Given: Static factory method ANGELEGT()
      // When: Creating status via static factory
      const status = EinsatzStatus.ANGELEGT();

      // Then: Returns EinsatzStatus with value ANGELEGT
      expect(status).toBeDefined();
      expect(status.value).toBe('ANGELEGT');
    });

    it('should create IN_BEARBEITUNG status via static factory', () => {
      // Given: Static factory method IN_BEARBEITUNG()
      // When: Creating status via static factory
      const status = EinsatzStatus.IN_BEARBEITUNG();

      // Then: Returns EinsatzStatus with value IN_BEARBEITUNG
      expect(status).toBeDefined();
      expect(status.value).toBe('IN_BEARBEITUNG');
    });

    it('should create ABGESCHLOSSEN status via static factory', () => {
      // Given: Static factory method ABGESCHLOSSEN()
      // When: Creating status via static factory
      const status = EinsatzStatus.ABGESCHLOSSEN();

      // Then: Returns EinsatzStatus with value ABGESCHLOSSEN
      expect(status).toBeDefined();
      expect(status.value).toBe('ABGESCHLOSSEN');
    });

    it('should create ARCHIVIERT status via static factory', () => {
      // Given: Static factory method ARCHIVIERT()
      // When: Creating status via static factory
      const status = EinsatzStatus.ARCHIVIERT();

      // Then: Returns EinsatzStatus with value ARCHIVIERT
      expect(status).toBeDefined();
      expect(status.value).toBe('ARCHIVIERT');
    });

    it('should create different instances via static factories', () => {
      // Given: Multiple calls to static factory
      // When: Creating multiple instances
      const status1 = EinsatzStatus.ANGELEGT();
      const status2 = EinsatzStatus.ANGELEGT();

      // Then: Different instances but structurally equal
      expect(status1).not.toBe(status2); // Different references
      expect(status1.equals(status2)).toBe(true); // Structural equality
    });
  });

  describe('canTransitionTo() - State Machine Logic', () => {
    describe('Valid Transitions from ANGELEGT', () => {
      it('should allow ANGELEGT → IN_BEARBEITUNG', () => {
        // Given: Current status ANGELEGT
        const current = EinsatzStatus.ANGELEGT();
        const target = EinsatzStatus.IN_BEARBEITUNG();

        // When: Checking transition to IN_BEARBEITUNG
        const canTransition = current.canTransitionTo(target);

        // Then: Transition is allowed
        expect(canTransition).toBe(true);
      });

      it('should allow ANGELEGT → ABGESCHLOSSEN', () => {
        // Given: Current status ANGELEGT
        const current = EinsatzStatus.ANGELEGT();
        const target = EinsatzStatus.ABGESCHLOSSEN();

        // When: Checking transition to ABGESCHLOSSEN
        const canTransition = current.canTransitionTo(target);

        // Then: Transition is allowed (direct closing without processing)
        expect(canTransition).toBe(true);
      });

      it('should allow ANGELEGT → ARCHIVIERT', () => {
        // Given: Current status ANGELEGT
        const current = EinsatzStatus.ANGELEGT();
        const target = EinsatzStatus.ARCHIVIERT();

        // When: Checking transition to ARCHIVIERT
        const canTransition = current.canTransitionTo(target);

        // Then: Transition is allowed (direct archiving)
        expect(canTransition).toBe(true);
      });

      it('should block ANGELEGT → ANGELEGT (same state)', () => {
        // Given: Current status ANGELEGT
        const current = EinsatzStatus.ANGELEGT();
        const target = EinsatzStatus.ANGELEGT();

        // When: Checking transition to same state
        const canTransition = current.canTransitionTo(target);

        // Then: Transition is blocked (self-transition not allowed)
        expect(canTransition).toBe(false);
      });
    });

    describe('Valid Transitions from IN_BEARBEITUNG', () => {
      it('should allow IN_BEARBEITUNG → ABGESCHLOSSEN', () => {
        // Given: Current status IN_BEARBEITUNG
        const current = EinsatzStatus.IN_BEARBEITUNG();
        const target = EinsatzStatus.ABGESCHLOSSEN();

        // When: Checking transition to ABGESCHLOSSEN
        const canTransition = current.canTransitionTo(target);

        // Then: Transition is allowed (normal flow)
        expect(canTransition).toBe(true);
      });

      it('should allow IN_BEARBEITUNG → ARCHIVIERT', () => {
        // Given: Current status IN_BEARBEITUNG
        const current = EinsatzStatus.IN_BEARBEITUNG();
        const target = EinsatzStatus.ARCHIVIERT();

        // When: Checking transition to ARCHIVIERT
        const canTransition = current.canTransitionTo(target);

        // Then: Transition is allowed (direct archiving)
        expect(canTransition).toBe(true);
      });
    });

    describe('Valid Transitions from ABGESCHLOSSEN', () => {
      it('should allow ABGESCHLOSSEN → ARCHIVIERT', () => {
        // Given: Current status ABGESCHLOSSEN
        const current = EinsatzStatus.ABGESCHLOSSEN();
        const target = EinsatzStatus.ARCHIVIERT();

        // When: Checking transition to ARCHIVIERT
        const canTransition = current.canTransitionTo(target);

        // Then: Transition is allowed (final archiving step)
        expect(canTransition).toBe(true);
      });
    });

    describe('Invalid Transitions - Backward from IN_BEARBEITUNG', () => {
      it('should block IN_BEARBEITUNG → ANGELEGT (backward)', () => {
        // Given: Current status IN_BEARBEITUNG
        const current = EinsatzStatus.IN_BEARBEITUNG();
        const target = EinsatzStatus.ANGELEGT();

        // When: Checking backward transition to ANGELEGT
        const canTransition = current.canTransitionTo(target);

        // Then: Transition is blocked (no backward transitions allowed)
        expect(canTransition).toBe(false);
      });

      it('should block IN_BEARBEITUNG → IN_BEARBEITUNG (same state)', () => {
        // Given: Current status IN_BEARBEITUNG
        const current = EinsatzStatus.IN_BEARBEITUNG();
        const target = EinsatzStatus.IN_BEARBEITUNG();

        // When: Checking transition to same state
        const canTransition = current.canTransitionTo(target);

        // Then: Transition is blocked (self-transition not allowed)
        expect(canTransition).toBe(false);
      });
    });

    describe('Invalid Transitions - Backward from ABGESCHLOSSEN', () => {
      it('should block ABGESCHLOSSEN → ANGELEGT (backward)', () => {
        // Given: Current status ABGESCHLOSSEN
        const current = EinsatzStatus.ABGESCHLOSSEN();
        const target = EinsatzStatus.ANGELEGT();

        // When: Checking backward transition to ANGELEGT
        const canTransition = current.canTransitionTo(target);

        // Then: Transition is blocked (no backward transitions allowed)
        expect(canTransition).toBe(false);
      });

      it('should block ABGESCHLOSSEN → IN_BEARBEITUNG (backward)', () => {
        // Given: Current status ABGESCHLOSSEN
        const current = EinsatzStatus.ABGESCHLOSSEN();
        const target = EinsatzStatus.IN_BEARBEITUNG();

        // When: Checking backward transition to IN_BEARBEITUNG
        const canTransition = current.canTransitionTo(target);

        // Then: Transition is blocked (no backward transitions allowed)
        expect(canTransition).toBe(false);
      });

      it('should block ABGESCHLOSSEN → ABGESCHLOSSEN (same state)', () => {
        // Given: Current status ABGESCHLOSSEN
        const current = EinsatzStatus.ABGESCHLOSSEN();
        const target = EinsatzStatus.ABGESCHLOSSEN();

        // When: Checking transition to same state
        const canTransition = current.canTransitionTo(target);

        // Then: Transition is blocked (self-transition not allowed)
        expect(canTransition).toBe(false);
      });
    });

    describe('Invalid Transitions - Final State ARCHIVIERT', () => {
      it('should block all transitions from ARCHIVIERT (final state) - to ANGELEGT', () => {
        // Given: Current status ARCHIVIERT (final state)
        const current = EinsatzStatus.ARCHIVIERT();
        const target = EinsatzStatus.ANGELEGT();

        // When: Checking transition from final state
        const canTransition = current.canTransitionTo(target);

        // Then: Transition is blocked (ARCHIVIERT is final state)
        expect(canTransition).toBe(false);
      });

      it('should block all transitions from ARCHIVIERT (final state) - to IN_BEARBEITUNG', () => {
        // Given: Current status ARCHIVIERT (final state)
        const current = EinsatzStatus.ARCHIVIERT();
        const target = EinsatzStatus.IN_BEARBEITUNG();

        // When: Checking transition from final state
        const canTransition = current.canTransitionTo(target);

        // Then: Transition is blocked (ARCHIVIERT is final state)
        expect(canTransition).toBe(false);
      });

      it('should block all transitions from ARCHIVIERT (final state) - to ABGESCHLOSSEN', () => {
        // Given: Current status ARCHIVIERT (final state)
        const current = EinsatzStatus.ARCHIVIERT();
        const target = EinsatzStatus.ABGESCHLOSSEN();

        // When: Checking transition from final state
        const canTransition = current.canTransitionTo(target);

        // Then: Transition is blocked (ARCHIVIERT is final state)
        expect(canTransition).toBe(false);
      });

      it('should block all transitions from ARCHIVIERT (final state) - to ARCHIVIERT (same state)', () => {
        // Given: Current status ARCHIVIERT (final state)
        const current = EinsatzStatus.ARCHIVIERT();
        const target = EinsatzStatus.ARCHIVIERT();

        // When: Checking transition to same state
        const canTransition = current.canTransitionTo(target);

        // Then: Transition is blocked (ARCHIVIERT is final state, no transitions allowed)
        expect(canTransition).toBe(false);
      });

      it('should block all transitions from ARCHIVIERT - comprehensive test', () => {
        // Given: Current status ARCHIVIERT (final state)
        const current = EinsatzStatus.ARCHIVIERT();

        // When: Checking transitions to all possible states
        const toAngelegt = current.canTransitionTo(EinsatzStatus.ANGELEGT());
        const toInBearbeitung = current.canTransitionTo(EinsatzStatus.IN_BEARBEITUNG());
        const toAbgeschlossen = current.canTransitionTo(EinsatzStatus.ABGESCHLOSSEN());
        const toArchiviert = current.canTransitionTo(EinsatzStatus.ARCHIVIERT());

        // Then: All transitions are blocked (ARCHIVIERT is final state)
        expect(toAngelegt).toBe(false);
        expect(toInBearbeitung).toBe(false);
        expect(toAbgeschlossen).toBe(false);
        expect(toArchiviert).toBe(false);
      });
    });

    describe('Complete State Machine Flow', () => {
      it('should support full forward flow: ANGELEGT → IN_BEARBEITUNG → ABGESCHLOSSEN → ARCHIVIERT', () => {
        // Given: Status instances for complete flow
        const angelegt = EinsatzStatus.ANGELEGT();
        const inBearbeitung = EinsatzStatus.IN_BEARBEITUNG();
        const abgeschlossen = EinsatzStatus.ABGESCHLOSSEN();
        const archiviert = EinsatzStatus.ARCHIVIERT();

        // When/Then: Each step in the flow is valid
        expect(angelegt.canTransitionTo(inBearbeitung)).toBe(true);
        expect(inBearbeitung.canTransitionTo(abgeschlossen)).toBe(true);
        expect(abgeschlossen.canTransitionTo(archiviert)).toBe(true);

        // Then: No backward transitions allowed
        expect(inBearbeitung.canTransitionTo(angelegt)).toBe(false);
        expect(abgeschlossen.canTransitionTo(inBearbeitung)).toBe(false);
        expect(archiviert.canTransitionTo(abgeschlossen)).toBe(false);
      });

      it('should support skip flow: ANGELEGT → ARCHIVIERT', () => {
        // Given: Status instances for skip flow (direct archiving)
        const angelegt = EinsatzStatus.ANGELEGT();
        const archiviert = EinsatzStatus.ARCHIVIERT();

        // When: Checking direct transition to final state
        const canTransition = angelegt.canTransitionTo(archiviert);

        // Then: Direct archiving is allowed
        expect(canTransition).toBe(true);
      });
    });
  });

  describe('equals() - Structural Equality', () => {
    it('should return true for statuses with same value', () => {
      // Given: Two EinsatzStatus instances with same value
      const status1 = EinsatzStatus.ANGELEGT();
      const status2 = EinsatzStatus.ANGELEGT();

      // When: Comparing via equals()
      const areEqual = status1.equals(status2);

      // Then: Structurally equal (same value)
      expect(areEqual).toBe(true);
      expect(status1).not.toBe(status2); // Different instances
    });

    it('should return false for statuses with different values', () => {
      // Given: Two EinsatzStatus instances with different values
      const status1 = EinsatzStatus.ANGELEGT();
      const status2 = EinsatzStatus.IN_BEARBEITUNG();

      // When: Comparing via equals()
      const areEqual = status1.equals(status2);

      // Then: Not equal (different values)
      expect(areEqual).toBe(false);
    });

    it('should return false when comparing with undefined', () => {
      // Given: EinsatzStatus instance and undefined
      const status = EinsatzStatus.ANGELEGT();

      // When: Comparing with undefined
      const areEqual = status.equals(undefined);

      // Then: Not equal
      expect(areEqual).toBe(false);
    });

    it('should return true when comparing same instance', () => {
      // Given: Single EinsatzStatus instance
      const status = EinsatzStatus.ANGELEGT();

      // When: Comparing with itself
      const areEqual = status.equals(status);

      // Then: Equal (same reference)
      expect(areEqual).toBe(true);
    });

    it('should support structural equality across all status values', () => {
      // Given: Multiple pairs of identical status values
      const pairs = [
        [EinsatzStatus.ANGELEGT(), EinsatzStatus.ANGELEGT()],
        [EinsatzStatus.IN_BEARBEITUNG(), EinsatzStatus.IN_BEARBEITUNG()],
        [EinsatzStatus.ABGESCHLOSSEN(), EinsatzStatus.ABGESCHLOSSEN()],
        [EinsatzStatus.ARCHIVIERT(), EinsatzStatus.ARCHIVIERT()],
      ];

      // When/Then: All pairs are structurally equal
      for (const [status1, status2] of pairs) {
        expect(status1.equals(status2)).toBe(true);
        expect(status1).not.toBe(status2); // Different instances
      }
    });

    it('should return false for all cross-value comparisons', () => {
      // Given: All possible status values
      const statuses = [EinsatzStatus.ANGELEGT(), EinsatzStatus.IN_BEARBEITUNG(), EinsatzStatus.ABGESCHLOSSEN(), EinsatzStatus.ARCHIVIERT()];

      // When/Then: Cross-comparisons are not equal
      for (let i = 0; i < statuses.length; i++) {
        for (let j = 0; j < statuses.length; j++) {
          if (i !== j) {
            expect(statuses[i].equals(statuses[j])).toBe(false);
          }
        }
      }
    });
  });

  describe('hashCode() - Hash Generation', () => {
    it('should generate same hashCode for equal statuses', () => {
      // Given: Two EinsatzStatus instances with same value
      const status1 = EinsatzStatus.ANGELEGT();
      const status2 = EinsatzStatus.ANGELEGT();

      // When: Generating hashCodes
      const hash1 = status1.hashCode();
      const hash2 = status2.hashCode();

      // Then: HashCodes are identical (structural equality)
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashCodes for different statuses', () => {
      // Given: Two EinsatzStatus instances with different values
      const status1 = EinsatzStatus.ANGELEGT();
      const status2 = EinsatzStatus.IN_BEARBEITUNG();

      // When: Generating hashCodes
      const hash1 = status1.hashCode();
      const hash2 = status2.hashCode();

      // Then: HashCodes are different (different values)
      expect(hash1).not.toBe(hash2);
    });

    it('should generate numeric hashCodes', () => {
      // Given: EinsatzStatus instance
      const status = EinsatzStatus.ANGELEGT();

      // When: Generating hashCode
      const hash = status.hashCode();

      // Then: HashCode is a number
      expect(typeof hash).toBe('number');
      expect(Number.isFinite(hash)).toBe(true);
    });

    it('should generate consistent hashCodes across multiple calls', () => {
      // Given: EinsatzStatus instance
      const status = EinsatzStatus.ANGELEGT();

      // When: Generating hashCode multiple times
      const hash1 = status.hashCode();
      const hash2 = status.hashCode();
      const hash3 = status.hashCode();

      // Then: All hashCodes are identical (deterministic)
      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });
  });

  describe('Immutability', () => {
    it('should freeze props object', () => {
      // Given: EinsatzStatus instance
      const status = EinsatzStatus.ANGELEGT();

      // When: Checking if props are frozen
      const isFrozen = Object.isFrozen(status.props);

      // Then: Props are immutable
      expect(isFrozen).toBe(true);
    });

    it('should prevent modification of value via props', () => {
      // Given: EinsatzStatus instance
      const status = EinsatzStatus.ANGELEGT();

      // When: Attempting to modify props
      const attemptModification = () => {
        // @ts-expect-error - Testing runtime immutability
        status.props.value = 'MODIFIED';
      };

      // Then: Modification is prevented (throws in strict mode)
      expect(attemptModification).toThrow();
      expect(status.value).toBe('ANGELEGT'); // Value unchanged
    });

    it('should maintain immutability across all static factories', () => {
      // Given: All possible status instances
      const statuses = [EinsatzStatus.ANGELEGT(), EinsatzStatus.IN_BEARBEITUNG(), EinsatzStatus.ABGESCHLOSSEN(), EinsatzStatus.ARCHIVIERT()];

      // When/Then: All instances have frozen props
      for (const status of statuses) {
        expect(Object.isFrozen(status.props)).toBe(true);
      }
    });
  });

  describe('toString() - String Representation', () => {
    it('should return status value for ANGELEGT', () => {
      // Given: ANGELEGT status
      const status = EinsatzStatus.ANGELEGT();

      // When: Converting to string
      const stringValue = status.toString();

      // Then: Returns status value
      expect(stringValue).toBe('ANGELEGT');
    });

    it('should return status value for IN_BEARBEITUNG', () => {
      // Given: IN_BEARBEITUNG status
      const status = EinsatzStatus.IN_BEARBEITUNG();

      // When: Converting to string
      const stringValue = status.toString();

      // Then: Returns status value
      expect(stringValue).toBe('IN_BEARBEITUNG');
    });

    it('should return status value for ABGESCHLOSSEN', () => {
      // Given: ABGESCHLOSSEN status
      const status = EinsatzStatus.ABGESCHLOSSEN();

      // When: Converting to string
      const stringValue = status.toString();

      // Then: Returns status value
      expect(stringValue).toBe('ABGESCHLOSSEN');
    });

    it('should return status value for ARCHIVIERT', () => {
      // Given: ARCHIVIERT status
      const status = EinsatzStatus.ARCHIVIERT();

      // When: Converting to string
      const stringValue = status.toString();

      // Then: Returns status value
      expect(stringValue).toBe('ARCHIVIERT');
    });

    it('should match value getter', () => {
      // Given: EinsatzStatus instance
      const status = EinsatzStatus.IN_BEARBEITUNG();

      // When: Comparing toString() and value getter
      const stringValue = status.toString();
      const valueProperty = status.value;

      // Then: Both return the same value
      expect(stringValue).toBe(valueProperty);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid factory calls correctly', () => {
      // Given: Multiple rapid factory calls
      const statuses = Array.from({ length: 100 }, () => EinsatzStatus.ANGELEGT());

      // When: Checking all instances
      // Then: All are valid and equal
      for (const status of statuses) {
        expect(status.value).toBe('ANGELEGT');
        expect(status.equals(statuses[0])).toBe(true);
      }
    });

    it('should maintain type safety with static factories', () => {
      // Given: Static factory methods
      const angelegt = EinsatzStatus.ANGELEGT();
      const inBearbeitung = EinsatzStatus.IN_BEARBEITUNG();

      // When: Using instanceof
      const isInstance1 = angelegt instanceof EinsatzStatus;
      const isInstance2 = inBearbeitung instanceof EinsatzStatus;

      // Then: Both are EinsatzStatus instances
      expect(isInstance1).toBe(true);
      expect(isInstance2).toBe(true);
    });

    it('should create via factory method with exact ALLOWED_VALUES string', () => {
      // Given: Exact string from ALLOWED_VALUES
      const allowedValues = ['ANGELEGT', 'IN_BEARBEITUNG', 'ABGESCHLOSSEN', 'ARCHIVIERT'];

      // When: Creating via create() for each allowed value
      const results = allowedValues.map((value) => EinsatzStatus.create(value));

      // Then: All creations succeed
      for (const result of results) {
        expect(result.isSuccess).toBe(true);
      }
    });
  });
});
