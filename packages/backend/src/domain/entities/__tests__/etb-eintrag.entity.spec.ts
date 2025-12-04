import { EtbEintrag } from '@domain/entities/etb-eintrag.entity';
import { EintragId } from '@domain/value-objects/eintrag-id';
import { EtbKategorie } from '@domain/value-objects/etb-kategorie';
import { EtbSequenceNumber } from '@domain/value-objects/etb-sequence-number';
import { UserId } from '@domain/value-objects/user-id';

// Mock cuid2 for Jest compatibility (ESM module issue)
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
    return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id);
  }),
}));

describe('EtbEintrag Entity', () => {
  let eintragId: EintragId;
  let sequenceNumber: EtbSequenceNumber;
  let userId: UserId;
  const testText = 'Fahrzeug W1 am Einsatzort eingetroffen';

  beforeEach(() => {
    eintragId = EintragId.create().value!;
    sequenceNumber = EtbSequenceNumber.create(1).value!;
    userId = UserId.create().value!;
  });

  describe('constructor', () => {
    it('should create valid EtbEintrag with required fields', () => {
      // When: Creating entity with required fields
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);

      // Then: Entity is created with correct properties
      expect(eintrag.id.equals(eintragId)).toBe(true);
      expect(eintrag.sequenceNumber.equals(sequenceNumber)).toBe(true);
      expect(eintrag.text).toBe(testText);
      expect(eintrag.createdBy.equals(userId)).toBe(true);
      expect(eintrag.isDeleted).toBe(false);
    });

    it('should initialize with LAGE kategorie as default', () => {
      // When: Creating entity without kategorie
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);

      // Then: Kategorie defaults to LAGE
      expect(eintrag.kategorie.equals(EtbKategorie.LAGE())).toBe(true);
    });

    it('should accept custom kategorie', () => {
      // Given: Custom kategorie
      const kategorie = EtbKategorie.MASSNAHME();

      // When: Creating entity with kategorie
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId, undefined, kategorie);

      // Then: Kategorie is set correctly
      expect(eintrag.kategorie.equals(kategorie)).toBe(true);
    });

    it('should use provided createdAt or default to new Date()', () => {
      // Given: Custom createdAt
      const customDate = new Date('2024-01-01T12:00:00.000Z');

      // When: Creating entity with custom createdAt
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId, customDate);

      // Then: createdAt is set correctly
      expect(eintrag.createdAt).toEqual(customDate);
    });

    it('should initialize updatedAt as undefined', () => {
      // When: Creating new entity
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);

      // Then: updatedAt is undefined
      expect(eintrag.updatedAt).toBeUndefined();
    });

    it('should accept optional metadata', () => {
      // Given: Custom metadata
      const metadata = { screenshot: 'path/to/image.png', coordinates: { lat: 51.5, lon: 7.5 } };

      // When: Creating entity with metadata
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId, undefined, undefined, metadata);

      // Then: Metadata is set correctly
      expect(eintrag.metadata).toEqual(metadata);
    });
  });

  describe('readonly properties (Immutability)', () => {
    it('should have immutable id', () => {
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);
      const originalId = eintrag.id;

      // Attempt to modify id should fail (TypeScript prevents this)
      expect(eintrag.id).toBe(originalId);
      expect(eintrag.id.equals(eintragId)).toBe(true);
    });

    it('should have immutable sequenceNumber', () => {
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);
      const originalSeq = eintrag.sequenceNumber;

      // Sequence number is readonly via getter
      expect(eintrag.sequenceNumber).toBe(originalSeq);
      expect(eintrag.sequenceNumber.value).toBe(1);
    });

    it('should have immutable createdBy', () => {
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);
      const originalCreatedBy = eintrag.createdBy;

      expect(eintrag.createdBy).toBe(originalCreatedBy);
      expect(eintrag.createdBy.equals(userId)).toBe(true);
    });

    it('should have immutable createdAt', () => {
      const customDate = new Date('2024-01-01T12:00:00.000Z');
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId, customDate);

      expect(eintrag.createdAt).toEqual(customDate);
    });

    it('should have immutable kategorie', () => {
      const kategorie = EtbKategorie.BEFEHL();
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId, undefined, kategorie);

      expect(eintrag.kategorie.equals(kategorie)).toBe(true);
    });
  });

  describe('update() method', () => {
    it('should update text and set updatedAt timestamp', () => {
      // Given: Existing entry
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);
      const newText = 'Fahrzeug W1 am Einsatzort eingetroffen um 14:30 Uhr';

      // When: Updating text
      eintrag.update(newText);

      // Then: Text is updated and updatedAt is set
      expect(eintrag.text).toBe(newText);
      expect(eintrag.updatedAt).toBeDefined();
      expect(eintrag.updatedAt).toBeInstanceOf(Date);
    });

    it('should update updatedAt timestamp on each update', () => {
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);

      // First update
      eintrag.update('Updated text 1');
      const firstUpdateTime = eintrag.updatedAt!;

      // Wait 2ms
      const waitUntil = Date.now() + 2;
      while (Date.now() < waitUntil) {
        // busy wait
      }

      // Second update
      eintrag.update('Updated text 2');
      const secondUpdateTime = eintrag.updatedAt!;

      // Then: Timestamp is updated
      expect(secondUpdateTime.getTime()).toBeGreaterThan(firstUpdateTime.getTime());
    });

    it('should allow multiple updates', () => {
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);

      eintrag.update('Update 1');
      expect(eintrag.text).toBe('Update 1');

      eintrag.update('Update 2');
      expect(eintrag.text).toBe('Update 2');

      eintrag.update('Update 3');
      expect(eintrag.text).toBe('Update 3');
    });

    it('should not change other properties when updating text', () => {
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);
      const originalId = eintrag.id;
      const originalSeq = eintrag.sequenceNumber;
      const originalCreatedBy = eintrag.createdBy;
      const originalCreatedAt = eintrag.createdAt;
      const originalIsDeleted = eintrag.isDeleted;

      eintrag.update('New text');

      expect(eintrag.id).toBe(originalId);
      expect(eintrag.sequenceNumber).toBe(originalSeq);
      expect(eintrag.createdBy).toBe(originalCreatedBy);
      expect(eintrag.createdAt).toBe(originalCreatedAt);
      expect(eintrag.isDeleted).toBe(originalIsDeleted);
    });
  });

  describe('markAsDeleted() method (Soft-Delete)', () => {
    it('should mark entry as deleted', () => {
      // Given: Active entry
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);
      expect(eintrag.isDeleted).toBe(false);

      // When: Marking as deleted
      eintrag.markAsDeleted();

      // Then: isDeleted flag is set
      expect(eintrag.isDeleted).toBe(true);
    });

    it('should set updatedAt timestamp when marking as deleted', () => {
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);
      expect(eintrag.updatedAt).toBeUndefined();

      eintrag.markAsDeleted();

      expect(eintrag.updatedAt).toBeDefined();
      expect(eintrag.updatedAt).toBeInstanceOf(Date);
    });

    it('should be idempotent (marking deleted entry as deleted again)', () => {
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);

      // First deletion
      eintrag.markAsDeleted();
      expect(eintrag.isDeleted).toBe(true);
      const firstUpdateTime = eintrag.updatedAt!;

      // Wait 2ms
      const waitUntil = Date.now() + 2;
      while (Date.now() < waitUntil) {
        // busy wait
      }

      // Second deletion
      eintrag.markAsDeleted();
      expect(eintrag.isDeleted).toBe(true);

      // updatedAt should be updated again
      expect(eintrag.updatedAt!.getTime()).toBeGreaterThan(firstUpdateTime.getTime());
    });

    it('should not change other properties when marking as deleted', () => {
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);
      const originalId = eintrag.id;
      const originalSeq = eintrag.sequenceNumber;
      const originalText = eintrag.text;
      const originalCreatedBy = eintrag.createdBy;
      const originalCreatedAt = eintrag.createdAt;

      eintrag.markAsDeleted();

      expect(eintrag.id).toBe(originalId);
      expect(eintrag.sequenceNumber).toBe(originalSeq);
      expect(eintrag.text).toBe(originalText);
      expect(eintrag.createdBy).toBe(originalCreatedBy);
      expect(eintrag.createdAt).toBe(originalCreatedAt);
    });

    it('should preserve text after soft-delete (DRK Compliance)', () => {
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);

      eintrag.markAsDeleted();

      // Text is still accessible (audit trail)
      expect(eintrag.text).toBe(testText);
      expect(eintrag.isDeleted).toBe(true);
    });

    it('should preserve sequence number after soft-delete (no gaps)', () => {
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);

      eintrag.markAsDeleted();

      // Sequence number remains unchanged
      expect(eintrag.sequenceNumber.value).toBe(1);
      expect(eintrag.isDeleted).toBe(true);
    });
  });

  describe('equals() method (ID-based Equality)', () => {
    it('should return true for same ID', () => {
      const eintrag1 = new EtbEintrag(eintragId, sequenceNumber, testText, userId);
      const eintrag2 = new EtbEintrag(eintragId, sequenceNumber, 'Different text', userId);

      expect(eintrag1.equals(eintrag2)).toBe(true);
    });

    it('should return false for different IDs', () => {
      const otherId = EintragId.create().value!;
      const eintrag1 = new EtbEintrag(eintragId, sequenceNumber, testText, userId);
      const eintrag2 = new EtbEintrag(otherId, sequenceNumber, testText, userId);

      expect(eintrag1.equals(eintrag2)).toBe(false);
    });

    it('should return true when comparing to itself', () => {
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);

      expect(eintrag.equals(eintrag)).toBe(true);
    });

    it('should return false for null', () => {
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);

      expect(eintrag.equals(null as unknown as EtbEintrag)).toBe(false);
    });

    it('should return false for undefined', () => {
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);

      expect(eintrag.equals(undefined)).toBe(false);
    });

    it('should ignore text differences (ID-based equality)', () => {
      const eintrag1 = new EtbEintrag(eintragId, sequenceNumber, 'Text 1', userId);
      const eintrag2 = new EtbEintrag(eintragId, sequenceNumber, 'Text 2', userId);

      expect(eintrag1.equals(eintrag2)).toBe(true);
    });

    it('should ignore isDeleted flag (ID-based equality)', () => {
      const eintrag1 = new EtbEintrag(eintragId, sequenceNumber, testText, userId);
      const eintrag2 = new EtbEintrag(eintragId, sequenceNumber, testText, userId);
      eintrag2.markAsDeleted();

      expect(eintrag1.equals(eintrag2)).toBe(true);
    });
  });

  describe('complex scenarios', () => {
    it('should handle update after soft-delete (should be prevented by Aggregate)', () => {
      // Given: Deleted entry
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);
      eintrag.markAsDeleted();

      // When: Attempting update (Entity allows this, Aggregate should prevent)
      eintrag.update('New text');

      // Then: Update is applied (validation is Aggregate's responsibility)
      expect(eintrag.text).toBe('New text');
      expect(eintrag.isDeleted).toBe(true);
    });

    it('should handle multiple state transitions', () => {
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);

      // Update → Update → Delete
      eintrag.update('Update 1');
      eintrag.update('Update 2');
      eintrag.markAsDeleted();

      expect(eintrag.text).toBe('Update 2');
      expect(eintrag.isDeleted).toBe(true);
      expect(eintrag.updatedAt).toBeDefined();
    });

    it('should maintain entity consistency across operations', () => {
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);

      // Perform various operations
      eintrag.update('Updated');
      eintrag.markAsDeleted();
      eintrag.update('Updated again');

      // Entity remains consistent
      expect(eintrag.id.equals(eintragId)).toBe(true);
      expect(eintrag.sequenceNumber.equals(sequenceNumber)).toBe(true);
      expect(eintrag.createdBy.equals(userId)).toBe(true);
    });
  });

  describe('kategorie handling', () => {
    it('should support all available kategorien', () => {
      const kategorien = [
        EtbKategorie.ALARMIERUNG(),
        EtbKategorie.ANKUNFT(),
        EtbKategorie.BEFEHL(),
        EtbKategorie.ERKUNDUNG(),
        EtbKategorie.LAGE(),
        EtbKategorie.MASSNAHME(),
        EtbKategorie.PERSONAL(),
        EtbKategorie.FAHRZEUG(),
        EtbKategorie.MATERIAL(),
        EtbKategorie.KOMMUNIKATION(),
        EtbKategorie.WETTER(),
        EtbKategorie.DOKUMENTATION(),
        EtbKategorie.SONSTIGES(),
        EtbKategorie.SYSTEM(),
      ];

      kategorien.forEach((kategorie) => {
        const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId, undefined, kategorie);
        expect(eintrag.kategorie.equals(kategorie)).toBe(true);
      });
    });

    it('should preserve kategorie after update', () => {
      const kategorie = EtbKategorie.MASSNAHME();
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId, undefined, kategorie);

      eintrag.update('Updated text');

      expect(eintrag.kategorie.equals(kategorie)).toBe(true);
    });

    it('should preserve kategorie after soft-delete', () => {
      const kategorie = EtbKategorie.BEFEHL();
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId, undefined, kategorie);

      eintrag.markAsDeleted();

      expect(eintrag.kategorie.equals(kategorie)).toBe(true);
    });
  });

  describe('metadata handling', () => {
    it('should handle complex metadata objects', () => {
      const metadata = {
        screenshot: 'path/to/image.png',
        coordinates: { lat: 51.5, lon: 7.5 },
        tags: ['important', 'geo-tagged'],
        customData: { key: 'value' },
      };

      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId, undefined, undefined, metadata);

      expect(eintrag.metadata).toEqual(metadata);
    });

    it('should preserve metadata after update', () => {
      const metadata = { key: 'value' };
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId, undefined, undefined, metadata);

      eintrag.update('New text');

      expect(eintrag.metadata).toEqual(metadata);
    });

    it('should preserve metadata after soft-delete', () => {
      const metadata = { screenshot: 'image.png' };
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId, undefined, undefined, metadata);

      eintrag.markAsDeleted();

      expect(eintrag.metadata).toEqual(metadata);
    });

    it('should handle undefined metadata', () => {
      const eintrag = new EtbEintrag(eintragId, sequenceNumber, testText, userId);

      expect(eintrag.metadata).toBeUndefined();
    });
  });
});
