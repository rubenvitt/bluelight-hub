import { Erinnerung, type CreateErinnerungProps } from '@domain/entities/erinnerung.entity';
import { ErinnerungErstelltEvent } from '@domain/events/erinnerung-erstellt.event';
import { ErinnerungGeloeschtEvent } from '@domain/events/erinnerung-geloescht.event';
import { ErinnerungAusgeloestEvent } from '@domain/events/erinnerung-ausgeloest.event';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import { ErinnerungStatus } from '@domain/value-objects/erinnerung-status';
import { ErinnerungTitel } from '@domain/value-objects/erinnerung-titel';
import { UserId } from '@domain/value-objects/user-id';

// Mock CUID2 for Jest compatibility
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

describe('Erinnerung Entity', () => {
  // Helper to create valid props
  const createValidProps = (): CreateErinnerungProps => ({
    einsatzId: EinsatzId.create().value!,
    titel: 'Lagebesprechung',
    faelligAm: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
    erstelltVon: UserId.create().value!,
  });

  describe('create() - Factory Method', () => {
    it('should create Erinnerung with valid props', () => {
      // Given: Valid creation props
      const props = createValidProps();

      // When: Creating Erinnerung
      const result = Erinnerung.create(props);

      // Then: Success with correct values
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.titel.value).toBe('Lagebesprechung');
      expect(result.value?.status.isGeplant()).toBe(true);
      expect(result.value?.einsatzId).toBe(props.einsatzId);
      expect(result.value?.erstelltVon).toBe(props.erstelltVon);
    });

    it('should set initial status to GEPLANT', () => {
      // Given: Valid props
      const props = createValidProps();

      // When: Creating Erinnerung
      const result = Erinnerung.create(props);

      // Then: Status is GEPLANT
      expect(result.value?.status.value).toBe('GEPLANT');
      expect(result.value?.status.isGeplant()).toBe(true);
    });

    it('should emit ErinnerungErstelltEvent', () => {
      // Given: Valid props
      const props = createValidProps();

      // When: Creating Erinnerung
      const result = Erinnerung.create(props);

      // Then: Event is emitted
      const events = result.value?.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events?.[0]).toBeInstanceOf(ErinnerungErstelltEvent);

      const event = events?.[0] as ErinnerungErstelltEvent;
      expect(event.titel).toBe('Lagebesprechung');
      expect(event.einsatzId).toBe(props.einsatzId);
      expect(event.erstelltVon).toBe(props.erstelltVon);
    });

    it('should fail with empty titel', () => {
      // Given: Props with empty titel
      const props = { ...createValidProps(), titel: '' };

      // When: Creating Erinnerung
      const result = Erinnerung.create(props);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('ERINNERUNG_TITEL_REQUIRED');
    });

    it('should fail with titel exceeding 100 characters', () => {
      // Given: Props with too long titel
      const props = { ...createValidProps(), titel: 'a'.repeat(101) };

      // When: Creating Erinnerung
      const result = Erinnerung.create(props);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('ERINNERUNG_TITEL_TOO_LONG');
    });

    it('should fail with faelligAm in the past', () => {
      // Given: Props with faelligAm in the past
      const props = {
        ...createValidProps(),
        faelligAm: new Date(Date.now() - 1000), // 1 second ago
      };

      // When: Creating Erinnerung
      const result = Erinnerung.create(props);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('ERINNERUNG_FAELLIG_AM_IN_PAST');
    });

    it('should allow beschreibung up to 500 characters', () => {
      // Given: Props with beschreibung
      const props = {
        ...createValidProps(),
        beschreibung: 'Diese Lagebesprechung ist wichtig',
      };

      // When: Creating Erinnerung
      const result = Erinnerung.create(props);

      // Then: Success with beschreibung
      expect(result.isSuccess).toBe(true);
      expect(result.value?.beschreibung).toBe('Diese Lagebesprechung ist wichtig');
    });

    it('should fail with beschreibung exceeding 500 characters', () => {
      // Given: Props with too long beschreibung
      const props = {
        ...createValidProps(),
        beschreibung: 'a'.repeat(501),
      };

      // When: Creating Erinnerung
      const result = Erinnerung.create(props);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('ERINNERUNG_BESCHREIBUNG_TOO_LONG');
    });

    it('should trim whitespace from beschreibung', () => {
      // Given: Props with whitespace beschreibung
      const props = {
        ...createValidProps(),
        beschreibung: '  Wichtige Info  ',
      };

      // When: Creating Erinnerung
      const result = Erinnerung.create(props);

      // Then: Whitespace trimmed
      expect(result.value?.beschreibung).toBe('Wichtige Info');
    });

    it('should set beschreibung to null when only whitespace', () => {
      // Given: Props with whitespace-only beschreibung
      const props = {
        ...createValidProps(),
        beschreibung: '   ',
      };

      // When: Creating Erinnerung
      const result = Erinnerung.create(props);

      // Then: beschreibung is null
      expect(result.isSuccess).toBe(true);
      expect(result.value?.beschreibung).toBeNull();
    });
  });

  describe('reconstruct() - Database Reconstruction', () => {
    it('should reconstruct Erinnerung from database data', () => {
      // Given: Database reconstruction props
      const props = {
        id: ErinnerungId.create().value!,
        einsatzId: EinsatzId.create().value!,
        titel: ErinnerungTitel.create('Test Titel').value!,
        beschreibung: 'Test Beschreibung',
        faelligAm: new Date(),
        status: ErinnerungStatus.AUSGELOEST(),
        erstelltVon: UserId.create().value!,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
      };

      // When: Reconstructing
      const erinnerung = Erinnerung.reconstruct(props);

      // Then: All values restored
      expect(erinnerung.id).toBe(props.id);
      expect(erinnerung.titel).toBe(props.titel);
      expect(erinnerung.status.isAusgeloest()).toBe(true);
      expect(erinnerung.beschreibung).toBe('Test Beschreibung');
      expect(erinnerung.createdAt).toEqual(props.createdAt);
      expect(erinnerung.updatedAt).toEqual(props.updatedAt);
    });

    it('should not emit events on reconstruction', () => {
      // Given: Reconstruction props
      const props = {
        id: ErinnerungId.create().value!,
        einsatzId: EinsatzId.create().value!,
        titel: ErinnerungTitel.create('Test').value!,
        beschreibung: null,
        faelligAm: new Date(),
        status: ErinnerungStatus.GEPLANT(),
        erstelltVon: UserId.create().value!,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // When: Reconstructing
      const erinnerung = Erinnerung.reconstruct(props);

      // Then: No events
      expect(erinnerung.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('Business Methods', () => {
    describe('istFaellig()', () => {
      it('should return false when faelligAm is in future', () => {
        // Given: Erinnerung with future faelligAm
        const props = {
          ...createValidProps(),
          faelligAm: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        };
        const erinnerung = Erinnerung.create(props).value!;

        // When/Then
        expect(erinnerung.istFaellig()).toBe(false);
      });

      it('should return true when faelligAm is in past', () => {
        // Given: Reconstructed Erinnerung with past faelligAm
        const props = {
          id: ErinnerungId.create().value!,
          einsatzId: EinsatzId.create().value!,
          titel: ErinnerungTitel.create('Test').value!,
          beschreibung: null,
          faelligAm: new Date(Date.now() - 1000), // 1 second ago
          status: ErinnerungStatus.GEPLANT(),
          erstelltVon: UserId.create().value!,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const erinnerung = Erinnerung.reconstruct(props);

        // When/Then
        expect(erinnerung.istFaellig()).toBe(true);
      });
    });

    describe('istAktiv()', () => {
      it('should return true for GEPLANT status', () => {
        const erinnerung = Erinnerung.create(createValidProps()).value!;
        expect(erinnerung.istAktiv()).toBe(true);
      });

      it('should return false for ERLEDIGT status', () => {
        const props = {
          id: ErinnerungId.create().value!,
          einsatzId: EinsatzId.create().value!,
          titel: ErinnerungTitel.create('Test').value!,
          beschreibung: null,
          faelligAm: new Date(),
          status: ErinnerungStatus.ERLEDIGT(),
          erstelltVon: UserId.create().value!,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const erinnerung = Erinnerung.reconstruct(props);

        expect(erinnerung.istAktiv()).toBe(false);
      });
    });

    describe('verbleibendeZeitMs()', () => {
      it('should return positive value for future faelligAm', () => {
        const props = {
          ...createValidProps(),
          faelligAm: new Date(Date.now() + 60000), // 1 minute from now
        };
        const erinnerung = Erinnerung.create(props).value!;

        const remaining = erinnerung.verbleibendeZeitMs();
        expect(remaining).toBeGreaterThan(0);
        expect(remaining).toBeLessThanOrEqual(60000);
      });

      it('should return 0 for past faelligAm', () => {
        const props = {
          id: ErinnerungId.create().value!,
          einsatzId: EinsatzId.create().value!,
          titel: ErinnerungTitel.create('Test').value!,
          beschreibung: null,
          faelligAm: new Date(Date.now() - 1000),
          status: ErinnerungStatus.GEPLANT(),
          erstelltVon: UserId.create().value!,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const erinnerung = Erinnerung.reconstruct(props);

        expect(erinnerung.verbleibendeZeitMs()).toBe(0);
      });
    });
  });

  describe('MAX_BESCHREIBUNG_LENGTH constant', () => {
    it('should be 500', () => {
      expect(Erinnerung.MAX_BESCHREIBUNG_LENGTH).toBe(500);
    });
  });

  describe('AggregateRoot inheritance', () => {
    it('should have generated id', () => {
      const erinnerung = Erinnerung.create(createValidProps()).value!;
      expect(erinnerung.id).toBeInstanceOf(ErinnerungId);
    });

    it('should have createdAt and updatedAt', () => {
      const erinnerung = Erinnerung.create(createValidProps()).value!;
      expect(erinnerung.createdAt).toBeInstanceOf(Date);
      expect(erinnerung.updatedAt).toBeInstanceOf(Date);
    });

    it('should clear domain events', () => {
      const erinnerung = Erinnerung.create(createValidProps()).value!;
      expect(erinnerung.getDomainEvents()).toHaveLength(1);

      erinnerung.clearDomainEvents();
      expect(erinnerung.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('delete() - Soft Delete Method', () => {
    // Helper für Soft-Delete Tests
    const createDeleteTestErinnerung = (status: ErinnerungStatus, isDeleted = false): Erinnerung => {
      return Erinnerung.reconstruct({
        id: ErinnerungId.create().value!,
        einsatzId: EinsatzId.create().value!,
        titel: ErinnerungTitel.create('Test Erinnerung').value!,
        beschreibung: null,
        faelligAm: new Date(Date.now() + 60000),
        status,
        erstelltVon: UserId.create().value!,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted,
        deletedAt: isDeleted ? new Date() : null,
        deletedBy: isDeleted ? UserId.create().value! : null,
      });
    };

    describe('Success Cases - Deletable Status', () => {
      it('should delete erinnerung with GEPLANT status successfully', () => {
        // Given: Erinnerung with GEPLANT status
        const erinnerung = createDeleteTestErinnerung(ErinnerungStatus.GEPLANT());
        const userId = UserId.create().value!;

        // When: Deleting
        const result = erinnerung.delete(userId);

        // Then: Success
        expect(result.isSuccess).toBe(true);
      });

      it('should delete erinnerung with AUSGELOEST status successfully', () => {
        // Given: Erinnerung with AUSGELOEST status
        const erinnerung = createDeleteTestErinnerung(ErinnerungStatus.AUSGELOEST());
        const userId = UserId.create().value!;

        // When: Deleting
        const result = erinnerung.delete(userId);

        // Then: Success
        expect(result.isSuccess).toBe(true);
      });

      it('should set isDeleted to true after delete', () => {
        // Given: Erinnerung with GEPLANT status
        const erinnerung = createDeleteTestErinnerung(ErinnerungStatus.GEPLANT());
        const userId = UserId.create().value!;
        expect(erinnerung.isDeleted).toBe(false);

        // When: Deleting
        erinnerung.delete(userId);

        // Then: isDeleted is true
        expect(erinnerung.isDeleted).toBe(true);
      });

      it('should set deletedAt to current timestamp after delete', () => {
        // Given: Erinnerung with GEPLANT status
        const erinnerung = createDeleteTestErinnerung(ErinnerungStatus.GEPLANT());
        const userId = UserId.create().value!;
        const beforeDelete = new Date();

        // When: Deleting
        erinnerung.delete(userId);
        const afterDelete = new Date();

        // Then: deletedAt is set to current time
        expect(erinnerung.deletedAt).toBeInstanceOf(Date);
        expect(erinnerung.deletedAt!.getTime()).toBeGreaterThanOrEqual(beforeDelete.getTime());
        expect(erinnerung.deletedAt!.getTime()).toBeLessThanOrEqual(afterDelete.getTime());
      });

      it('should set deletedBy to provided userId after delete', () => {
        // Given: Erinnerung with GEPLANT status
        const erinnerung = createDeleteTestErinnerung(ErinnerungStatus.GEPLANT());
        const userId = UserId.create().value!;

        // When: Deleting
        erinnerung.delete(userId);

        // Then: deletedBy is set to userId
        expect(erinnerung.deletedBy).toBe(userId);
      });

      it('should emit ErinnerungGeloeschtEvent after delete', () => {
        // Given: Erinnerung with GEPLANT status
        const erinnerung = createDeleteTestErinnerung(ErinnerungStatus.GEPLANT());
        const userId = UserId.create().value!;

        // When: Deleting
        erinnerung.delete(userId);

        // Then: Event is emitted
        const events = erinnerung.getDomainEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toBeInstanceOf(ErinnerungGeloeschtEvent);
      });
    });

    describe('Failure Cases - Non-Deletable Status', () => {
      it('should fail to delete erinnerung with ACKNOWLEDGED status', () => {
        // Given: Erinnerung with ACKNOWLEDGED status
        const erinnerung = createDeleteTestErinnerung(ErinnerungStatus.ACKNOWLEDGED());
        const userId = UserId.create().value!;

        // When: Deleting
        const result = erinnerung.delete(userId);

        // Then: Failure
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_DELETABLE');
      });

      it('should fail to delete erinnerung with SNOOZED status', () => {
        // Given: Erinnerung with SNOOZED status
        const erinnerung = createDeleteTestErinnerung(ErinnerungStatus.SNOOZED());
        const userId = UserId.create().value!;

        // When: Deleting
        const result = erinnerung.delete(userId);

        // Then: Failure
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_DELETABLE');
      });

      it('should fail to delete erinnerung with ESKALIERT status', () => {
        // Given: Erinnerung with ESKALIERT status
        const erinnerung = createDeleteTestErinnerung(ErinnerungStatus.ESKALIERT());
        const userId = UserId.create().value!;

        // When: Deleting
        const result = erinnerung.delete(userId);

        // Then: Failure
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_DELETABLE');
      });

      it('should fail to delete erinnerung with ERLEDIGT status', () => {
        // Given: Erinnerung with ERLEDIGT status
        const erinnerung = createDeleteTestErinnerung(ErinnerungStatus.ERLEDIGT());
        const userId = UserId.create().value!;

        // When: Deleting
        const result = erinnerung.delete(userId);

        // Then: Failure
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_DELETABLE');
      });

      it('should return ERINNERUNG_NOT_DELETABLE error for non-deletable status', () => {
        // Given: Erinnerung with non-deletable status (ACKNOWLEDGED)
        const erinnerung = createDeleteTestErinnerung(ErinnerungStatus.ACKNOWLEDGED());
        const userId = UserId.create().value!;

        // When: Deleting
        const result = erinnerung.delete(userId);

        // Then: Correct error code
        expect(result.error).toBe('ERINNERUNG_NOT_DELETABLE');
      });
    });

    describe('Idempotenz', () => {
      it('should fail when erinnerung is already deleted', () => {
        // Given: Already deleted Erinnerung
        const erinnerung = createDeleteTestErinnerung(ErinnerungStatus.GEPLANT(), true);
        const userId = UserId.create().value!;

        // When: Trying to delete again
        const result = erinnerung.delete(userId);

        // Then: Failure
        expect(result.isFailure).toBe(true);
      });

      it('should return ERINNERUNG_ALREADY_DELETED error', () => {
        // Given: Already deleted Erinnerung
        const erinnerung = createDeleteTestErinnerung(ErinnerungStatus.GEPLANT(), true);
        const userId = UserId.create().value!;

        // When: Trying to delete again
        const result = erinnerung.delete(userId);

        // Then: Correct error code
        expect(result.error).toBe('ERINNERUNG_ALREADY_DELETED');
      });
    });

    describe('Event Data', () => {
      it('should include correct data in ErinnerungGeloeschtEvent', () => {
        // Given: Erinnerung with GEPLANT status
        const erinnerung = createDeleteTestErinnerung(ErinnerungStatus.GEPLANT());
        const userId = UserId.create().value!;

        // When: Deleting
        erinnerung.delete(userId);

        // Then: Event has correct data
        const events = erinnerung.getDomainEvents();
        const event = events[0] as ErinnerungGeloeschtEvent;

        expect(event.erinnerungId).toBe(erinnerung.id);
        expect(event.einsatzId).toBe(erinnerung.einsatzId);
        expect(event.titel).toBe('Test Erinnerung');
        expect(event.geloeschtVon).toBe(userId);
      });

      it('should have erinnerungId, einsatzId, titel, geloeschtVon in event', () => {
        // Given: Erinnerung with specific values
        const einsatzId = EinsatzId.create().value!;
        const erinnerungId = ErinnerungId.create().value!;
        const titel = ErinnerungTitel.create('Spezifische Erinnerung').value!;
        const userId = UserId.create().value!;

        const erinnerung = Erinnerung.reconstruct({
          id: erinnerungId,
          einsatzId,
          titel,
          beschreibung: null,
          faelligAm: new Date(Date.now() + 60000),
          status: ErinnerungStatus.GEPLANT(),
          erstelltVon: UserId.create().value!,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // When: Deleting
        erinnerung.delete(userId);

        // Then: All required fields present in event
        const events = erinnerung.getDomainEvents();
        expect(events).toHaveLength(1);

        const event = events[0] as ErinnerungGeloeschtEvent;
        expect(event).toHaveProperty('erinnerungId');
        expect(event).toHaveProperty('einsatzId');
        expect(event).toHaveProperty('titel');
        expect(event).toHaveProperty('geloeschtVon');

        expect(event.erinnerungId).toBe(erinnerungId);
        expect(event.einsatzId).toBe(einsatzId);
        expect(event.titel).toBe('Spezifische Erinnerung');
        expect(event.geloeschtVon).toBe(userId);
      });
    });
  });

  describe('ausloesen() - Trigger Method (Story 1.5)', () => {
    // Helper to create Erinnerung with specific status for trigger tests
    const createTriggerTestErinnerung = (status: ErinnerungStatus): Erinnerung => {
      const erinnerungId = ErinnerungId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const titel = ErinnerungTitel.create('Test Erinnerung').value!;

      return Erinnerung.reconstruct({
        id: erinnerungId,
        einsatzId,
        titel,
        beschreibung: null,
        faelligAm: new Date(Date.now() + 60000),
        status,
        erstelltVon: UserId.create().value!,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    };

    describe('Status Validation', () => {
      it('should trigger erinnerung with GEPLANT status successfully', () => {
        // Given: Erinnerung with GEPLANT status
        const erinnerung = createTriggerTestErinnerung(ErinnerungStatus.GEPLANT());

        // When: Triggering
        const result = erinnerung.ausloesen();

        // Then: Success
        expect(result.isSuccess).toBe(true);
      });

      it('should fail to trigger erinnerung with AUSGELOEST status', () => {
        // Given: Erinnerung with AUSGELOEST status (already triggered)
        const erinnerung = createTriggerTestErinnerung(ErinnerungStatus.AUSGELOEST());

        // When: Triggering
        const result = erinnerung.ausloesen();

        // Then: Failure
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_TRIGGERABLE');
      });

      it('should fail to trigger erinnerung with ACKNOWLEDGED status', () => {
        // Given: Erinnerung with ACKNOWLEDGED status
        const erinnerung = createTriggerTestErinnerung(ErinnerungStatus.ACKNOWLEDGED());

        // When: Triggering
        const result = erinnerung.ausloesen();

        // Then: Failure
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_TRIGGERABLE');
      });

      it('should allow trigger for erinnerung with SNOOZED status (Story 2.2 Re-Trigger)', () => {
        // Given: Erinnerung with SNOOZED status (nach snooze Zeit abgelaufen)
        const erinnerung = createTriggerTestErinnerung(ErinnerungStatus.SNOOZED());

        // When: Triggering (Re-Trigger nach Snooze)
        const result = erinnerung.ausloesen();

        // Then: Success - Story 2.2 erlaubt Re-Trigger von SNOOZED
        expect(result.isSuccess).toBe(true);
        expect(erinnerung.status.isAusgeloest()).toBe(true);
      });

      it('should fail to trigger erinnerung with ESKALIERT status', () => {
        // Given: Erinnerung with ESKALIERT status
        const erinnerung = createTriggerTestErinnerung(ErinnerungStatus.ESKALIERT());

        // When: Triggering
        const result = erinnerung.ausloesen();

        // Then: Failure
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_TRIGGERABLE');
      });

      it('should fail to trigger erinnerung with ERLEDIGT status', () => {
        // Given: Erinnerung with ERLEDIGT status
        const erinnerung = createTriggerTestErinnerung(ErinnerungStatus.ERLEDIGT());

        // When: Triggering
        const result = erinnerung.ausloesen();

        // Then: Failure
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_TRIGGERABLE');
      });

      it('should succeed to trigger soft-deleted erinnerung (Repository should filter)', () => {
        // Given: Soft-deleted Erinnerung with GEPLANT status
        // HINWEIS: Domain-Entity erlaubt das technisch (keine isDeleted Prüfung in ausloesen()),
        // aber das Repository sollte gelöschte Erinnerungen NICHT zurückgeben.
        // Dieser Test dokumentiert das gewünschte Verhalten: Repository-Filter > Entity-Guard
        const erinnerung = Erinnerung.reconstruct({
          id: ErinnerungId.create().value!,
          einsatzId: EinsatzId.create().value!,
          titel: ErinnerungTitel.create('Test Erinnerung').value!,
          beschreibung: null,
          faelligAm: new Date(Date.now() + 60000),
          status: ErinnerungStatus.GEPLANT(),
          erstelltVon: UserId.create().value!,
          createdAt: new Date(),
          updatedAt: new Date(),
          isDeleted: true, // Soft-deleted
          deletedAt: new Date(),
          deletedBy: UserId.create().value!,
        });

        // When: Triggering (Domain Entity erlaubt es technisch)
        const result = erinnerung.ausloesen();

        // Then: Success (Entity prüft nicht isDeleted, Repository sollte filtern)
        expect(result.isSuccess).toBe(true);
        expect(erinnerung.status.isAusgeloest()).toBe(true);
      });
    });

    describe('State Changes', () => {
      it('should change status to AUSGELOEST after trigger', () => {
        // Given: Erinnerung with GEPLANT status
        const erinnerung = createTriggerTestErinnerung(ErinnerungStatus.GEPLANT());

        // When: Triggering
        erinnerung.ausloesen();

        // Then: Status is AUSGELOEST
        expect(erinnerung.status.isAusgeloest()).toBe(true);
        expect(erinnerung.status.value).toBe('AUSGELOEST');
      });

      it('should set ausgeloestAm to current timestamp after trigger', () => {
        // Given: Erinnerung with GEPLANT status
        const erinnerung = createTriggerTestErinnerung(ErinnerungStatus.GEPLANT());
        const beforeTrigger = new Date();

        // When: Triggering
        erinnerung.ausloesen();
        const afterTrigger = new Date();

        // Then: ausgeloestAm is set to current time
        expect(erinnerung.ausgeloestAm).toBeInstanceOf(Date);
        expect(erinnerung.ausgeloestAm!.getTime()).toBeGreaterThanOrEqual(beforeTrigger.getTime());
        expect(erinnerung.ausgeloestAm!.getTime()).toBeLessThanOrEqual(afterTrigger.getTime());
      });

      it('should have null ausgeloestAm before trigger', () => {
        // Given: Erinnerung with GEPLANT status (not triggered yet)
        const erinnerung = createTriggerTestErinnerung(ErinnerungStatus.GEPLANT());

        // Then: ausgeloestAm is null
        expect(erinnerung.ausgeloestAm).toBeNull();
      });
    });

    describe('Domain Event', () => {
      it('should emit ErinnerungAusgeloestEvent after trigger', () => {
        // Given: Erinnerung with GEPLANT status
        const erinnerung = createTriggerTestErinnerung(ErinnerungStatus.GEPLANT());

        // When: Triggering
        erinnerung.ausloesen();

        // Then: Event is emitted
        const events = erinnerung.getDomainEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toBeInstanceOf(ErinnerungAusgeloestEvent);
      });

      it('should include correct data in ErinnerungAusgeloestEvent', () => {
        // Given: Erinnerung with GEPLANT status
        const erinnerung = createTriggerTestErinnerung(ErinnerungStatus.GEPLANT());

        // When: Triggering
        erinnerung.ausloesen();

        // Then: Event has correct data
        const events = erinnerung.getDomainEvents();
        const event = events[0] as ErinnerungAusgeloestEvent;

        expect(event.erinnerungId).toBe(erinnerung.id);
        expect(event.einsatzId).toBe(erinnerung.einsatzId);
        expect(event.titel).toBe('Test Erinnerung');
        expect(event.ausgeloestAm).toBeInstanceOf(Date);
      });

      it('should have erinnerungId, einsatzId, ausgeloestAm, titel in event', () => {
        // Given: Erinnerung with specific values
        const einsatzId = EinsatzId.create().value!;
        const erinnerungId = ErinnerungId.create().value!;
        const titel = ErinnerungTitel.create('Spezifische Erinnerung').value!;

        const erinnerung = Erinnerung.reconstruct({
          id: erinnerungId,
          einsatzId,
          titel,
          beschreibung: null,
          faelligAm: new Date(Date.now() + 60000),
          status: ErinnerungStatus.GEPLANT(),
          erstelltVon: UserId.create().value!,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // When: Triggering
        erinnerung.ausloesen();

        // Then: All required fields present in event
        const events = erinnerung.getDomainEvents();
        expect(events).toHaveLength(1);

        const event = events[0] as ErinnerungAusgeloestEvent;
        expect(event).toHaveProperty('erinnerungId');
        expect(event).toHaveProperty('einsatzId');
        expect(event).toHaveProperty('ausgeloestAm');
        expect(event).toHaveProperty('titel');

        expect(event.erinnerungId).toBe(erinnerungId);
        expect(event.einsatzId).toBe(einsatzId);
        expect(event.titel).toBe('Spezifische Erinnerung');
        expect(event.ausgeloestAm).toBeInstanceOf(Date);
      });

      it('should not emit event when trigger fails', () => {
        // Given: Erinnerung with AUSGELOEST status (already triggered)
        const erinnerung = createTriggerTestErinnerung(ErinnerungStatus.AUSGELOEST());

        // When: Trying to trigger
        erinnerung.ausloesen();

        // Then: No event emitted
        const events = erinnerung.getDomainEvents();
        expect(events).toHaveLength(0);
      });
    });

    describe('ausgeloestAm Immutability', () => {
      it('should return copy of ausgeloestAm date', () => {
        // Given: Triggered Erinnerung
        const erinnerung = createTriggerTestErinnerung(ErinnerungStatus.GEPLANT());
        erinnerung.ausloesen();

        // When: Getting ausgeloestAm twice
        const date1 = erinnerung.ausgeloestAm;
        const date2 = erinnerung.ausgeloestAm;

        // Then: Different Date objects (copy)
        expect(date1).not.toBe(date2);
        expect(date1!.getTime()).toBe(date2!.getTime());
      });

      it('should not be mutable from outside', () => {
        // Given: Triggered Erinnerung
        const erinnerung = createTriggerTestErinnerung(ErinnerungStatus.GEPLANT());
        erinnerung.ausloesen();
        const originalTime = erinnerung.ausgeloestAm!.getTime();

        // When: Trying to mutate the returned date
        const dateRef = erinnerung.ausgeloestAm;
        dateRef!.setTime(0);

        // Then: Internal state unchanged
        expect(erinnerung.ausgeloestAm!.getTime()).toBe(originalTime);
      });
    });
  });
});
