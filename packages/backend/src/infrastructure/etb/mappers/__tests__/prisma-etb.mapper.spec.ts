// Mock @paralleldrive/cuid2 BEFORE any imports (hoisting workaround for Jest + ESM)
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

/**
 * Unit Tests fuer PrismaEtbMapper und PrismaEintragMapper (Infrastructure Layer).
 *
 * Diese Tests validieren die bidirektionale Transformation zwischen:
 * - Domain Layer: EinsatztagebuchAggregate und EtbEintrag mit Value Objects
 * - Infrastructure Layer: Prisma Einsatztagebuch und EtbEintrag mit primitiven Typen
 *
 * **Test Strategy:**
 * - Einzelne Mapper-Methoden isoliert testen (toEntity, toAggregate, toPersistence)
 * - Round-Trip Tests: Domain → Prisma → Domain = strukturell gleich
 * - Status Mapping Tests: EtbStatus ↔ PrismaEtbStatus
 * - Soft-Delete Mapping: isDeleted ↔ deletedAt
 * - Version Reconstruction: EtbVersion mit versionNumber + timestamp
 * - Eintraege Sortierung: chronologisch nach sequenceNumber
 *
 * Epic 3 Story 3.x | Hexagonale Architektur Migration
 */

import { EinsatztagebuchAggregate } from '@domain/aggregates/einsatztagebuch.aggregate';
import { EtbEintrag } from '@domain/entities/etb-eintrag.entity';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EintragId } from '@domain/value-objects/eintrag-id';
import { EtbSequenceNumber } from '@domain/value-objects/etb-sequence-number';
import { UserId } from '@domain/value-objects/user-id';
import type { EtbEintrag as PrismaEtbEintrag, EtbStatus as PrismaEtbStatus } from '@prisma/client';
import { PrismaEintragMapper, PrismaEtbMapper, type EinsatztagebuchWithEintraege } from '../prisma-etb.mapper';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Erstellt eine valide CUID2-Format Test-ID fuer Tests.
 * CUID2 Format: 20-30 Zeichen, lowercase a-z0-9, beginnt mit Kleinbuchstabe.
 *
 * @param suffix - Optionaler Suffix fuer Eindeutigkeit (wird lowercased)
 * @returns Ein valider 25-Zeichen CUID2-aehnlicher String
 */
function createValidTestId(suffix = ''): string {
  // Base: valid CUID2 prefix (20 chars)
  const base = 'clw3h8x9y0000qwertyui';
  // Suffix: lowercase alphanumeric only, padded to 5 chars
  const safeSuffix = suffix
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .padEnd(5, '0')
    .slice(0, 5);
  return base + safeSuffix; // Total: 25 chars
}

/**
 * Erstellt ein Mock Prisma EtbEintrag Objekt fuer Tests.
 *
 * @param overrides - Optionale Felder zum Ueberschreiben
 * @returns Mock PrismaEtbEintrag
 */
function createMockPrismaEintrag(overrides: Partial<PrismaEtbEintrag> = {}): PrismaEtbEintrag {
  return {
    id: createValidTestId('ein01'),
    etbId: createValidTestId('etb01'),
    sequenceNumber: 1,
    text: 'Test Eintrag',
    createdBy: createValidTestId('user1'),
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
    deletedAt: null,
    deletedBy: null,
    kategorie: 'LAGE',
    timestamp: new Date('2024-01-01T10:00:00Z'),
    version: 1,
    funkrufname: null,
    standort: null,
    isAutomatic: false,
    metadata: null,
    ...overrides,
  };
}

/**
 * Erstellt ein Mock Prisma Einsatztagebuch Objekt fuer Tests.
 *
 * @param overrides - Optionale Felder zum Ueberschreiben
 * @param eintraege - Optionale Liste von Eintraegen
 * @returns Mock EinsatztagebuchWithEintraege
 */
function createMockPrismaEtb(overrides: Partial<EinsatztagebuchWithEintraege> = {}, eintraege: PrismaEtbEintrag[] = []): EinsatztagebuchWithEintraege {
  return {
    id: createValidTestId('etb01'),
    einsatzId: createValidTestId('eins1'),
    status: 'DRAFT' as PrismaEtbStatus,
    version: 1,
    versionTimestamp: new Date('2024-01-01T10:00:00Z'),
    nextSequenceNumber: 1,
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
    createdBy: createValidTestId('user1'),
    updatedBy: null,
    lockedAt: null,
    lockedBy: null,
    eintraege,
    ...overrides,
  };
}

/**
 * Erstellt ein Domain EtbEintrag Entity fuer Tests.
 *
 * @param overrides - Optionale Werte zum Ueberschreiben
 * @returns EtbEintrag Entity
 */
function createDomainEintrag(overrides: { id?: string; sequenceNumber?: number; text?: string; createdBy?: string; createdAt?: Date; isDeleted?: boolean } = {}): EtbEintrag {
  const idResult = EintragId.create(overrides.id ?? createValidTestId('ein01'));
  const seqResult = EtbSequenceNumber.create(overrides.sequenceNumber ?? 1);
  const userResult = UserId.create(overrides.createdBy ?? createValidTestId('user1'));

  const eintrag = new EtbEintrag(
    idResult.value as EintragId,
    seqResult.value as EtbSequenceNumber,
    overrides.text ?? 'Test Eintrag',
    userResult.value as UserId,
    overrides.createdAt ?? new Date('2024-01-01T10:00:00Z'),
  );

  // Soft-Delete Flag setzen wenn erforderlich
  if (overrides.isDeleted) {
    eintrag.markAsDeleted();
  }

  return eintrag;
}

// ============================================================================
// PRISMA EINTRAG MAPPER TESTS
// ============================================================================

describe('PrismaEintragMapper', () => {
  describe('toEntity() - Basic Mapping', () => {
    it('sollte Prisma EtbEintrag zu Domain Entity mit korrekten Properties konvertieren', () => {
      // Given: Valid Prisma EtbEintrag
      const prismaEintrag = createMockPrismaEintrag({
        id: createValidTestId('ein01'),
        sequenceNumber: 5,
        text: 'Fahrzeug W1 eingetroffen',
        createdBy: createValidTestId('user1'),
      });

      // When: toEntity() aufgerufen
      const entity = PrismaEintragMapper.toEntity(prismaEintrag);

      // Then: Entity hat korrekte Werte
      expect(entity.id.value).toBe(prismaEintrag.id);
      expect(entity.sequenceNumber.value).toBe(5);
      expect(entity.text).toBe('Fahrzeug W1 eingetroffen');
      expect(entity.createdBy.value).toBe(prismaEintrag.createdBy);
    });

    it('sollte Soft-Delete korrekt mappen wenn deletedAt gesetzt ist', () => {
      // Given: Prisma EtbEintrag mit deletedAt
      const deletedDate = new Date('2024-01-15T14:30:00Z');
      const prismaEintrag = createMockPrismaEintrag({
        deletedAt: deletedDate,
        deletedBy: createValidTestId('user2'),
      });

      // When: toEntity() aufgerufen
      const entity = PrismaEintragMapper.toEntity(prismaEintrag);

      // Then: Entity hat isDeleted=true
      expect(entity.isDeleted).toBe(true);
    });

    it('sollte isDeleted=false zurueckgeben wenn deletedAt null ist', () => {
      // Given: Prisma EtbEintrag ohne deletedAt
      const prismaEintrag = createMockPrismaEintrag({
        deletedAt: null,
      });

      // When: toEntity() aufgerufen
      const entity = PrismaEintragMapper.toEntity(prismaEintrag);

      // Then: Entity hat isDeleted=false
      expect(entity.isDeleted).toBe(false);
    });

    it('sollte Timestamps korrekt mappen', () => {
      // Given: Prisma EtbEintrag mit Timestamps
      const createdAt = new Date('2024-01-01T08:00:00Z');
      const updatedAt = new Date('2024-01-05T15:30:00Z');
      const prismaEintrag = createMockPrismaEintrag({
        createdAt,
        updatedAt,
      });

      // When: toEntity() aufgerufen
      const entity = PrismaEintragMapper.toEntity(prismaEintrag);

      // Then: Entity hat korrekte Timestamps
      expect(entity.createdAt).toEqual(createdAt);
      expect(entity.updatedAt).toEqual(updatedAt);
    });
  });

  describe('toPersistence() - Basic Mapping', () => {
    it('sollte Domain EtbEintrag zu Persistence Data konvertieren', () => {
      // Given: Domain EtbEintrag Entity
      const eintrag = createDomainEintrag({
        id: createValidTestId('ein01'),
        sequenceNumber: 3,
        text: 'Lage stabil',
        createdBy: createValidTestId('user1'),
      });
      const etbId = createValidTestId('etb01');

      // When: toPersistence() aufgerufen
      const persistData = PrismaEintragMapper.toPersistence(eintrag, etbId);

      // Then: Persistence Data hat korrekte Werte
      expect(persistData.id).toBe(eintrag.id.value);
      expect(persistData.etbId).toBe(etbId);
      expect(persistData.sequenceNumber).toBe(3);
      expect(persistData.text).toBe('Lage stabil');
      expect(persistData.createdBy).toBe(eintrag.createdBy.value);
    });

    it('sollte Default Values fuer Prisma-Schema setzen', () => {
      // Given: Domain EtbEintrag Entity
      const eintrag = createDomainEintrag();
      const etbId = createValidTestId('etb01');

      // When: toPersistence() aufgerufen
      const persistData = PrismaEintragMapper.toPersistence(eintrag, etbId);

      // Then: Default Values sind gesetzt
      expect(persistData.kategorie).toBe('LAGE');
      expect(persistData.version).toBe(1);
      expect(persistData.isAutomatic).toBe(false);
    });

    it('sollte Soft-Delete korrekt mappen wenn isDeleted=true', () => {
      // Given: Domain EtbEintrag mit isDeleted=true
      const eintrag = createDomainEintrag({ isDeleted: true });
      const etbId = createValidTestId('etb01');

      // When: toPersistence() aufgerufen
      const persistData = PrismaEintragMapper.toPersistence(eintrag, etbId);

      // Then: deletedAt ist gesetzt (nicht null)
      expect(persistData.deletedAt).not.toBeNull();
      expect(persistData.deletedAt).toBeInstanceOf(Date);
    });

    it('sollte deletedAt=null zurueckgeben wenn isDeleted=false', () => {
      // Given: Domain EtbEintrag mit isDeleted=false
      const eintrag = createDomainEintrag({ isDeleted: false });
      const etbId = createValidTestId('etb01');

      // When: toPersistence() aufgerufen
      const persistData = PrismaEintragMapper.toPersistence(eintrag, etbId);

      // Then: deletedAt ist null
      expect(persistData.deletedAt).toBeNull();
    });
  });
});

// ============================================================================
// PRISMA ETB MAPPER TESTS
// ============================================================================

describe('PrismaEtbMapper', () => {
  describe('toAggregate() - Basic Reconstruction', () => {
    it('sollte Prisma Einsatztagebuch zu Domain Aggregate rekonstruieren', () => {
      // Given: Prisma ETB mit Eintraegen
      const eintrag1 = createMockPrismaEintrag({ sequenceNumber: 1, text: 'Eintrag 1' });
      const eintrag2 = createMockPrismaEintrag({
        id: createValidTestId('ein02'),
        sequenceNumber: 2,
        text: 'Eintrag 2',
      });
      const prismaEtb = createMockPrismaEtb({}, [eintrag1, eintrag2]);

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEtbMapper.toAggregate(prismaEtb);

      // Then: Aggregate hat korrekte Properties
      expect(aggregate.id.value).toBe(prismaEtb.id);
      expect(aggregate.einsatzId.value).toBe(prismaEtb.einsatzId);
      expect(aggregate.eintraege).toHaveLength(2);
    });

    it('sollte Status DRAFT korrekt mappen', () => {
      // Given: Prisma ETB mit Status DRAFT
      const prismaEtb = createMockPrismaEtb({ status: 'DRAFT' as PrismaEtbStatus });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEtbMapper.toAggregate(prismaEtb);

      // Then: Domain Status ist DRAFT
      expect(aggregate.status.value).toBe('DRAFT');
      expect(aggregate.isLocked()).toBe(false);
    });

    it('sollte Status ACTIVE korrekt mappen', () => {
      // Given: Prisma ETB mit Status ACTIVE
      const prismaEtb = createMockPrismaEtb({ status: 'ACTIVE' as PrismaEtbStatus });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEtbMapper.toAggregate(prismaEtb);

      // Then: Domain Status ist ACTIVE
      expect(aggregate.status.value).toBe('ACTIVE');
      expect(aggregate.isLocked()).toBe(false);
    });

    it('sollte Status LOCKED korrekt mappen', () => {
      // Given: Prisma ETB mit Status LOCKED
      const prismaEtb = createMockPrismaEtb({
        status: 'LOCKED' as PrismaEtbStatus,
        lockedAt: new Date('2024-01-20T16:00:00Z'),
        lockedBy: createValidTestId('user3'),
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEtbMapper.toAggregate(prismaEtb);

      // Then: Domain Status ist LOCKED
      expect(aggregate.status.value).toBe('LOCKED');
      expect(aggregate.isLocked()).toBe(true);
    });

    it('sollte Version korrekt rekonstruieren', () => {
      // Given: Prisma ETB mit Version 5
      const versionTimestamp = new Date('2024-01-15T12:00:00Z');
      const prismaEtb = createMockPrismaEtb({
        version: 5,
        versionTimestamp,
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEtbMapper.toAggregate(prismaEtb);

      // Then: Aggregate.version.versionNumber === 5
      expect(aggregate.version.versionNumber).toBe(5);
      expect(aggregate.version.timestamp).toEqual(versionTimestamp);
    });

    it('sollte Eintraege nach sequenceNumber sortieren', () => {
      // Given: Prisma ETB mit unsortierten Eintraegen
      const eintrag3 = createMockPrismaEintrag({
        id: createValidTestId('ein03'),
        sequenceNumber: 3,
        text: 'Dritter',
      });
      const eintrag1 = createMockPrismaEintrag({
        id: createValidTestId('ein01'),
        sequenceNumber: 1,
        text: 'Erster',
      });
      const eintrag2 = createMockPrismaEintrag({
        id: createValidTestId('ein02'),
        sequenceNumber: 2,
        text: 'Zweiter',
      });
      // Absichtlich unsortiert uebergeben
      const prismaEtb = createMockPrismaEtb({}, [eintrag3, eintrag1, eintrag2]);

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEtbMapper.toAggregate(prismaEtb);

      // Then: Eintraege sind nach sequenceNumber sortiert
      expect(aggregate.eintraege[0].sequenceNumber.value).toBe(1);
      expect(aggregate.eintraege[0].text).toBe('Erster');
      expect(aggregate.eintraege[1].sequenceNumber.value).toBe(2);
      expect(aggregate.eintraege[1].text).toBe('Zweiter');
      expect(aggregate.eintraege[2].sequenceNumber.value).toBe(3);
      expect(aggregate.eintraege[2].text).toBe('Dritter');
    });

    it('sollte Domain Events nach Reconstruction geleert haben', () => {
      // Given: Prisma ETB
      const prismaEtb = createMockPrismaEtb();

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEtbMapper.toAggregate(prismaEtb);

      // Then: Aggregate hat keine uncommitted Domain Events
      expect(aggregate.getDomainEvents()).toHaveLength(0);
    });

    it('sollte Timestamps korrekt rekonstruieren', () => {
      // Given: Prisma ETB mit Timestamps
      const createdAt = new Date('2024-01-01T08:00:00Z');
      const updatedAt = new Date('2024-01-10T14:30:00Z');
      const prismaEtb = createMockPrismaEtb({ createdAt, updatedAt });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEtbMapper.toAggregate(prismaEtb);

      // Then: Aggregate hat korrekte Timestamps
      expect(aggregate.createdAt).toEqual(createdAt);
      expect(aggregate.updatedAt).toEqual(updatedAt);
    });
  });

  describe('toPersistence() - Basic Conversion', () => {
    it('sollte Domain Aggregate zu Persistence Data konvertieren', () => {
      // Given: Domain EinsatztagebuchAggregate
      const einsatzId = EinsatzId.create(createValidTestId('eins1')).value as EinsatzId;
      const aggregateResult = EinsatztagebuchAggregate.create(einsatzId);
      expect(aggregateResult.isSuccess).toBe(true);
      const aggregate = aggregateResult.value as EinsatztagebuchAggregate;
      const createdBy = createValidTestId('user1');

      // When: toPersistence() aufgerufen
      const persistData = PrismaEtbMapper.toPersistence(aggregate, createdBy);

      // Then: Persistence Data hat korrekte Struktur
      expect(persistData.etb).toBeDefined();
      expect(persistData.eintraege).toBeDefined();
      expect(persistData.etb.id).toBe(aggregate.id.value);
      expect(persistData.etb.einsatzId).toBe(einsatzId.value);
      expect(persistData.etb.createdBy).toBe(createdBy);
    });

    it('sollte Status Mapping Domain -> Prisma korrekt durchfuehren', () => {
      // Given: Domain Aggregate mit DRAFT Status (default)
      const einsatzId = EinsatzId.create(createValidTestId('eins1')).value as EinsatzId;
      const aggregate = EinsatztagebuchAggregate.create(einsatzId).value as EinsatztagebuchAggregate;

      // When: toPersistence() aufgerufen
      const persistData = PrismaEtbMapper.toPersistence(aggregate, createValidTestId('user1'));

      // Then: ETB data hat Status='DRAFT'
      expect(persistData.etb.status).toBe('DRAFT');
    });

    it('sollte Lock Fields setzen wenn Aggregate gesperrt ist', () => {
      // Given: Prisma ETB mit LOCKED Status rekonstruieren
      const prismaEtb = createMockPrismaEtb({
        status: 'LOCKED' as PrismaEtbStatus,
        lockedAt: new Date('2024-01-20T16:00:00Z'),
        lockedBy: createValidTestId('user3'),
      });
      const aggregate = PrismaEtbMapper.toAggregate(prismaEtb);
      const updatedBy = createValidTestId('user4');

      // When: toPersistence() aufgerufen
      const persistData = PrismaEtbMapper.toPersistence(aggregate, createValidTestId('user1'), updatedBy);

      // Then: lockedAt und lockedBy sind gesetzt
      expect(persistData.etb.lockedAt).not.toBeNull();
      expect(persistData.etb.lockedBy).toBe(updatedBy);
    });

    it('sollte Lock Fields null lassen wenn Aggregate nicht gesperrt ist', () => {
      // Given: Domain Aggregate mit DRAFT Status
      const einsatzId = EinsatzId.create(createValidTestId('eins1')).value as EinsatzId;
      const aggregate = EinsatztagebuchAggregate.create(einsatzId).value as EinsatztagebuchAggregate;

      // When: toPersistence() aufgerufen
      const persistData = PrismaEtbMapper.toPersistence(aggregate, createValidTestId('user1'));

      // Then: lockedAt und lockedBy sind null
      expect(persistData.etb.lockedAt).toBeNull();
      expect(persistData.etb.lockedBy).toBeNull();
    });

    it('sollte Eintraege Array korrekt konvertieren', () => {
      // Given: Aggregate mit Eintraegen (via Reconstruction)
      const eintrag1 = createMockPrismaEintrag({ sequenceNumber: 1, text: 'Eintrag 1' });
      const eintrag2 = createMockPrismaEintrag({
        id: createValidTestId('ein02'),
        sequenceNumber: 2,
        text: 'Eintrag 2',
      });
      const prismaEtb = createMockPrismaEtb({ nextSequenceNumber: 3 }, [eintrag1, eintrag2]);
      const aggregate = PrismaEtbMapper.toAggregate(prismaEtb);

      // When: toPersistence() aufgerufen
      const persistData = PrismaEtbMapper.toPersistence(aggregate, createValidTestId('user1'));

      // Then: Eintraege Array ist korrekt
      expect(persistData.eintraege).toHaveLength(2);
      expect(persistData.eintraege[0].text).toBe('Eintrag 1');
      expect(persistData.eintraege[1].text).toBe('Eintrag 2');
    });

    it('sollte updatedBy setzen wenn angegeben', () => {
      // Given: Domain Aggregate
      const einsatzId = EinsatzId.create(createValidTestId('eins1')).value as EinsatzId;
      const aggregate = EinsatztagebuchAggregate.create(einsatzId).value as EinsatztagebuchAggregate;
      const updatedBy = createValidTestId('user2');

      // When: toPersistence() mit updatedBy aufgerufen
      const persistData = PrismaEtbMapper.toPersistence(aggregate, createValidTestId('user1'), updatedBy);

      // Then: updatedBy ist gesetzt
      expect(persistData.etb.updatedBy).toBe(updatedBy);
    });
  });

  describe('Round-Trip Tests', () => {
    it('sollte Aggregate Daten bei Domain -> Prisma -> Domain Konvertierung erhalten', () => {
      // Given: Original Domain Aggregate erstellen und rekonstruieren
      const prismaEtb = createMockPrismaEtb({
        id: createValidTestId('etb99'),
        einsatzId: createValidTestId('eins9'),
        status: 'ACTIVE' as PrismaEtbStatus,
        version: 3,
        versionTimestamp: new Date('2024-01-10T10:00:00Z'),
        nextSequenceNumber: 3,
      });
      const originalAggregate = PrismaEtbMapper.toAggregate(prismaEtb);
      const originalId = originalAggregate.id.value;
      const originalEinsatzId = originalAggregate.einsatzId.value;
      const originalStatus = originalAggregate.status.value;
      const originalVersion = originalAggregate.version.versionNumber;

      // When: Domain -> Prisma -> Domain (simuliert Save + Load)
      const persistData = PrismaEtbMapper.toPersistence(originalAggregate, createValidTestId('user1'));

      // Simuliere DB-Row aus Persistence Data
      const simulatedDbRow: EinsatztagebuchWithEintraege = {
        id: persistData.etb.id,
        einsatzId: persistData.etb.einsatzId,
        status: persistData.etb.status,
        version: persistData.etb.version,
        versionTimestamp: persistData.etb.versionTimestamp,
        nextSequenceNumber: persistData.etb.nextSequenceNumber,
        createdAt: persistData.etb.createdAt,
        updatedAt: persistData.etb.updatedAt,
        createdBy: persistData.etb.createdBy,
        updatedBy: persistData.etb.updatedBy,
        lockedAt: persistData.etb.lockedAt,
        lockedBy: persistData.etb.lockedBy,
        eintraege: persistData.eintraege.map((e) => ({
          ...e,
          funkrufname: null,
          standort: null,
          metadata: null,
        })),
      };

      const reconstructedAggregate = PrismaEtbMapper.toAggregate(simulatedDbRow);

      // Then: Rekonstruiertes Aggregate entspricht Original
      expect(reconstructedAggregate.id.value).toBe(originalId);
      expect(reconstructedAggregate.einsatzId.value).toBe(originalEinsatzId);
      expect(reconstructedAggregate.status.value).toBe(originalStatus);
      expect(reconstructedAggregate.version.versionNumber).toBe(originalVersion);
    });

    it('sollte Round-Trip mit Eintraegen korrekt handhaben', () => {
      // Given: Aggregate mit mehreren Eintraegen
      const eintrag1 = createMockPrismaEintrag({
        id: createValidTestId('ein01'),
        sequenceNumber: 1,
        text: 'Erster Eintrag',
      });
      const eintrag2 = createMockPrismaEintrag({
        id: createValidTestId('ein02'),
        sequenceNumber: 2,
        text: 'Zweiter Eintrag',
        deletedAt: new Date(), // Soft-deleted
      });
      const prismaEtb = createMockPrismaEtb({ nextSequenceNumber: 3 }, [eintrag1, eintrag2]);
      const originalAggregate = PrismaEtbMapper.toAggregate(prismaEtb);

      // When: Round-Trip
      const persistData = PrismaEtbMapper.toPersistence(originalAggregate, createValidTestId('user1'));
      const simulatedDbRow: EinsatztagebuchWithEintraege = {
        ...prismaEtb,
        eintraege: persistData.eintraege.map((e) => ({
          ...e,
          funkrufname: null,
          standort: null,
          metadata: null,
        })),
      };
      const reconstructedAggregate = PrismaEtbMapper.toAggregate(simulatedDbRow);

      // Then: Eintraege erhalten (inkl. Soft-Delete Status)
      expect(reconstructedAggregate.eintraege).toHaveLength(2);
      expect(reconstructedAggregate.eintraege[0].text).toBe('Erster Eintrag');
      expect(reconstructedAggregate.eintraege[0].isDeleted).toBe(false);
      expect(reconstructedAggregate.eintraege[1].text).toBe('Zweiter Eintrag');
      expect(reconstructedAggregate.eintraege[1].isDeleted).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('sollte leeres Eintraege Array korrekt handhaben', () => {
      // Given: Domain Aggregate ohne Eintraege
      const einsatzId = EinsatzId.create(createValidTestId('eins1')).value as EinsatzId;
      const aggregate = EinsatztagebuchAggregate.create(einsatzId).value as EinsatztagebuchAggregate;

      // When: toPersistence() aufgerufen
      const persistData = PrismaEtbMapper.toPersistence(aggregate, createValidTestId('user1'));

      // Then: eintraege Array ist leer (nicht null)
      expect(persistData.eintraege).toBeDefined();
      expect(persistData.eintraege).toBeInstanceOf(Array);
      expect(persistData.eintraege).toHaveLength(0);
    });

    it('sollte Prisma ETB mit leeren Eintraegen korrekt rekonstruieren', () => {
      // Given: Prisma ETB ohne Eintraege
      const prismaEtb = createMockPrismaEtb({}, []);

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEtbMapper.toAggregate(prismaEtb);

      // Then: Aggregate hat leeres Eintraege Array
      expect(aggregate.eintraege).toHaveLength(0);
    });

    it('sollte nextSequenceNumber korrekt berechnen', () => {
      // Given: Aggregate mit Eintraegen
      const eintrag1 = createMockPrismaEintrag({ sequenceNumber: 1 });
      const eintrag2 = createMockPrismaEintrag({
        id: createValidTestId('ein02'),
        sequenceNumber: 2,
      });
      const prismaEtb = createMockPrismaEtb({ nextSequenceNumber: 3 }, [eintrag1, eintrag2]);
      const aggregate = PrismaEtbMapper.toAggregate(prismaEtb);

      // When: toPersistence() aufgerufen
      const persistData = PrismaEtbMapper.toPersistence(aggregate, createValidTestId('user1'));

      // Then: nextSequenceNumber ist korrekt
      expect(persistData.etb.nextSequenceNumber).toBe(3);
    });

    it('sollte Version und Timestamp zusammen korrekt handhaben', () => {
      // Given: Prisma ETB mit spezifischer Version und Timestamp
      const versionTimestamp = new Date('2024-06-15T09:30:00Z');
      const prismaEtb = createMockPrismaEtb({
        version: 42,
        versionTimestamp,
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEtbMapper.toAggregate(prismaEtb);

      // Then: Version und Timestamp sind korrekt
      expect(aggregate.version.versionNumber).toBe(42);
      expect(aggregate.version.timestamp).toEqual(versionTimestamp);

      // When: toPersistence() aufgerufen
      const persistData = PrismaEtbMapper.toPersistence(aggregate, createValidTestId('user1'));

      // Then: Version und Timestamp bleiben erhalten
      expect(persistData.etb.version).toBe(42);
      expect(persistData.etb.versionTimestamp).toEqual(versionTimestamp);
    });

    it('sollte alle Status-Varianten korrekt mappen (DRAFT, ACTIVE, LOCKED)', () => {
      // Test alle Status-Mappings
      const statusVariants: PrismaEtbStatus[] = ['DRAFT', 'ACTIVE', 'LOCKED'];

      for (const status of statusVariants) {
        // Given: Prisma ETB mit spezifischem Status
        const prismaEtb = createMockPrismaEtb({ status });

        // When: toAggregate() aufgerufen
        const aggregate = PrismaEtbMapper.toAggregate(prismaEtb);

        // Then: Status ist korrekt gemapped
        expect(aggregate.status.value).toBe(status);

        // When: toPersistence() aufgerufen
        const persistData = PrismaEtbMapper.toPersistence(aggregate, createValidTestId('user1'));

        // Then: Status bleibt erhalten
        expect(persistData.etb.status).toBe(status);
      }
    });
  });
});
