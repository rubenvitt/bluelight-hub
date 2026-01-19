import { Erinnerung, type CreateErinnerungProps } from '@domain/entities/erinnerung.entity';
import { ErinnerungErstelltEvent } from '@domain/events/erinnerung-erstellt.event';
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
});
