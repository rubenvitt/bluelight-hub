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
 * Unit Tests fuer PrismaEinsatzMapper (Infrastructure Layer).
 *
 * Diese Tests validieren die bidirektionale Transformation zwischen:
 * - Domain Layer: Einsatz Aggregate mit Value Objects
 * - Infrastructure Layer: Prisma Einsatz mit primitiven Typen
 *
 * **Test Strategy:**
 * - Einzelne Mapper-Methoden isoliert testen (toAggregate, toPersistence)
 * - Round-Trip Tests: Domain → Prisma → Domain = strukturell gleich
 * - Status Mapping Tests: EinsatzStatus ↔ PrismaEinsatzStatus
 * - Address Serialization: Address VO ↔ JSON String
 * - Edge Cases: null/undefined, archivierte Einsätze, optionale Felder
 *
 * Epic 4 Story 4-5 | Hexagonale Architektur Migration - Einsatz Lifecycle
 */

import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { Address } from '@domain/value-objects/address';
import { UserId } from '@domain/value-objects/user-id';
import type { EinsatzStatus as PrismaEinsatzStatus } from '@prisma/client';
import { PrismaEinsatzMapper, type EinsatzWithRelations } from '../prisma-einsatz.mapper';

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
 * Erstellt ein Mock Prisma Einsatz Objekt fuer Tests.
 *
 * @param overrides - Optionale Felder zum Ueberschreiben
 * @returns Mock PrismaEinsatz
 */
function createMockPrismaEinsatz(overrides: Partial<EinsatzWithRelations> = {}): EinsatzWithRelations {
  return {
    id: createValidTestId('ein01'),
    alarmstichwort: 'Wohnungsbrand',
    einsatzort: null,
    beschreibung: null,
    status: 'ANGELEGT' as PrismaEinsatzStatus,
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
    createdBy: createValidTestId('user1'),
    updatedBy: null,
    archivedAt: null,
    archivedBy: null,
    alarmierungszeit: null,
    einsatzleiter: null,
    metadata: null,
    ...overrides,
  };
}

/**
 * Erstellt ein Domain Einsatz Aggregate fuer Tests.
 *
 * @param overrides - Optionale Werte zum Ueberschreiben
 * @returns Einsatz Aggregate
 */
function createDomainEinsatz(overrides: { alarmstichwort?: string; createdBy?: string; einsatzort?: Address; bemerkung?: string } = {}): Einsatz {
  const createdByResult = UserId.create(overrides.createdBy ?? createValidTestId('user1'));

  const einsatzResult = Einsatz.create({
    alarmstichwort: overrides.alarmstichwort ?? 'Verkehrsunfall',
    createdBy: createdByResult.value as UserId,
    einsatzort: overrides.einsatzort,
    bemerkung: overrides.bemerkung,
  });

  return einsatzResult.value as Einsatz;
}

// ============================================================================
// PRISMA EINSATZ MAPPER TESTS - toAggregate()
// ============================================================================

describe('PrismaEinsatzMapper', () => {
  describe('toAggregate() - Basic Reconstruction', () => {
    it('sollte Prisma Einsatz zu Domain Aggregate rekonstruieren', () => {
      // Given: Valid Prisma Einsatz
      const prismaEinsatz = createMockPrismaEinsatz({
        id: createValidTestId('ein01'),
        alarmstichwort: 'Großbrand',
        status: 'IN_BEARBEITUNG' as PrismaEinsatzStatus,
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);

      // Then: Aggregate hat korrekte Properties
      expect(aggregate.id.value).toBe(prismaEinsatz.id);
      expect(aggregate.alarmstichwort).toBe('Großbrand');
      expect(aggregate.status.value).toBe('IN_BEARBEITUNG');
      expect(aggregate.createdBy.value).toBe(prismaEinsatz.createdBy);
    });

    it('sollte Einsatznummer aus ID generieren (Format: E{YEAR}-{ID-8})', () => {
      // Given: Prisma Einsatz mit bekannter ID
      const testId = createValidTestId('test1');
      const createdAt = new Date('2024-06-15T10:00:00Z');
      const prismaEinsatz = createMockPrismaEinsatz({
        id: testId,
        createdAt,
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);

      // Then: Nummer ist korrekt formatiert
      expect(aggregate.nummer).toMatch(/^E2024-[a-z0-9]{8}$/);
      expect(aggregate.nummer).toContain('E2024-'); // Jahr aus createdAt
      expect(aggregate.nummer).toContain(testId.substring(0, 8)); // Ersten 8 Zeichen der ID
    });

    it('sollte Timestamps korrekt rekonstruieren', () => {
      // Given: Prisma Einsatz mit Timestamps
      const createdAt = new Date('2024-01-01T08:00:00Z');
      const updatedAt = new Date('2024-01-05T15:30:00Z');
      const prismaEinsatz = createMockPrismaEinsatz({
        createdAt,
        updatedAt,
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);

      // Then: Aggregate hat korrekte Timestamps
      expect(aggregate.createdAt).toEqual(createdAt);
      expect(aggregate.updatedAt).toEqual(updatedAt);
    });

    it('sollte Domain Events nach Reconstruction geleert haben', () => {
      // Given: Prisma Einsatz
      const prismaEinsatz = createMockPrismaEinsatz();

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);

      // Then: Aggregate hat keine uncommitted Domain Events
      // (Factory emittiert EinsatzCreatedEvent, aber Mapper cleared diese)
      expect(aggregate.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('toAggregate() - Status Mapping', () => {
    it('sollte Status ANGELEGT korrekt mappen', () => {
      // Given: Prisma Einsatz mit Status ANGELEGT
      const prismaEinsatz = createMockPrismaEinsatz({
        status: 'ANGELEGT' as PrismaEinsatzStatus,
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);

      // Then: Domain Status ist ANGELEGT
      expect(aggregate.status.value).toBe('ANGELEGT');
    });

    it('sollte Status IN_BEARBEITUNG korrekt mappen', () => {
      // Given: Prisma Einsatz mit Status IN_BEARBEITUNG
      const prismaEinsatz = createMockPrismaEinsatz({
        status: 'IN_BEARBEITUNG' as PrismaEinsatzStatus,
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);

      // Then: Domain Status ist IN_BEARBEITUNG
      expect(aggregate.status.value).toBe('IN_BEARBEITUNG');
    });

    it('sollte Status ABGESCHLOSSEN korrekt mappen', () => {
      // Given: Prisma Einsatz mit Status ABGESCHLOSSEN
      const prismaEinsatz = createMockPrismaEinsatz({
        status: 'ABGESCHLOSSEN' as PrismaEinsatzStatus,
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);

      // Then: Domain Status ist ABGESCHLOSSEN
      expect(aggregate.status.value).toBe('ABGESCHLOSSEN');
    });

    it('sollte Status ARCHIVIERT korrekt mappen', () => {
      // Given: Prisma Einsatz mit Status ARCHIVIERT
      const archivedAt = new Date('2024-12-31T23:59:00Z');
      const prismaEinsatz = createMockPrismaEinsatz({
        status: 'ARCHIVIERT' as PrismaEinsatzStatus,
        archivedAt,
        archivedBy: createValidTestId('user2'),
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);

      // Then: Domain Status ist ARCHIVIERT
      expect(aggregate.status.value).toBe('ARCHIVIERT');
      expect(aggregate.archivedAt).toEqual(archivedAt);
    });

    it('sollte alle Status-Varianten korrekt mappen (ANGELEGT, IN_BEARBEITUNG, ABGESCHLOSSEN, ARCHIVIERT)', () => {
      // Test alle Status-Mappings
      const statusVariants: PrismaEinsatzStatus[] = ['ANGELEGT', 'IN_BEARBEITUNG', 'ABGESCHLOSSEN', 'ARCHIVIERT'];

      for (const status of statusVariants) {
        // Given: Prisma Einsatz mit spezifischem Status
        const prismaEinsatz = createMockPrismaEinsatz({ status });

        // When: toAggregate() aufgerufen
        const aggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);

        // Then: Status ist korrekt gemapped
        expect(aggregate.status.value).toBe(status);
      }
    });
  });

  describe('toAggregate() - Address Deserialization', () => {
    it('sollte Address aus JSON-String korrekt deserialisieren', () => {
      // Given: Prisma Einsatz mit Address als JSON
      const addressJson = JSON.stringify({
        strasse: 'Musterstraße',
        hausnummer: '42',
        plz: '80331',
        ort: 'München',
      });
      const prismaEinsatz = createMockPrismaEinsatz({
        einsatzort: addressJson,
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);

      // Then: Address VO ist korrekt deserialisiert
      expect(aggregate.einsatzort).toBeDefined();
      expect(aggregate.einsatzort?.strasse).toBe('Musterstraße');
      expect(aggregate.einsatzort?.hausnummer).toBe('42');
      expect(aggregate.einsatzort?.plz).toBe('80331');
      expect(aggregate.einsatzort?.ort).toBe('München');
    });

    it('sollte undefined zurueckgeben wenn einsatzort null ist', () => {
      // Given: Prisma Einsatz ohne einsatzort
      const prismaEinsatz = createMockPrismaEinsatz({
        einsatzort: null,
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);

      // Then: einsatzort ist undefined
      expect(aggregate.einsatzort).toBeUndefined();
    });

    it('sollte undefined zurueckgeben bei ungueltigem JSON', () => {
      // Given: Prisma Einsatz mit ungültigem JSON
      const prismaEinsatz = createMockPrismaEinsatz({
        einsatzort: 'invalid-json{',
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);

      // Then: einsatzort ist undefined (graceful degradation)
      expect(aggregate.einsatzort).toBeUndefined();
    });

    it('sollte undefined zurueckgeben bei ungültiger PLZ in deserialisierter Address', () => {
      // Given: Prisma Einsatz mit Address mit ungültiger PLZ
      const addressJson = JSON.stringify({
        strasse: 'Teststr.',
        hausnummer: '1',
        plz: '1234', // Ungültig: nur 4 Ziffern
        ort: 'Berlin',
      });
      const prismaEinsatz = createMockPrismaEinsatz({
        einsatzort: addressJson,
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);

      // Then: einsatzort ist undefined (Address.create() failed)
      expect(aggregate.einsatzort).toBeUndefined();
    });
  });

  describe('toAggregate() - Optional Fields', () => {
    it('sollte bemerkung korrekt mappen wenn beschreibung vorhanden ist', () => {
      // Given: Prisma Einsatz mit beschreibung
      const prismaEinsatz = createMockPrismaEinsatz({
        beschreibung: 'Dachstuhl brennt vollständig',
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);

      // Then: bemerkung ist gesetzt (DB: beschreibung → Domain: bemerkung)
      expect(aggregate.bemerkung).toBe('Dachstuhl brennt vollständig');
    });

    it('sollte bemerkung undefined lassen wenn beschreibung null ist', () => {
      // Given: Prisma Einsatz ohne beschreibung
      const prismaEinsatz = createMockPrismaEinsatz({
        beschreibung: null,
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);

      // Then: bemerkung ist undefined
      expect(aggregate.bemerkung).toBeUndefined();
    });

    it('sollte archivedAt korrekt rekonstruieren wenn gesetzt', () => {
      // Given: Archivierter Prisma Einsatz
      const archivedAt = new Date('2024-12-31T23:59:00Z');
      const prismaEinsatz = createMockPrismaEinsatz({
        status: 'ARCHIVIERT' as PrismaEinsatzStatus,
        archivedAt,
        archivedBy: createValidTestId('user2'),
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);

      // Then: archivedAt ist gesetzt
      expect(aggregate.archivedAt).toEqual(archivedAt);
    });

    it('sollte archivedAt undefined lassen wenn null', () => {
      // Given: Nicht-archivierter Prisma Einsatz
      const prismaEinsatz = createMockPrismaEinsatz({
        archivedAt: null,
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);

      // Then: archivedAt ist undefined
      expect(aggregate.archivedAt).toBeUndefined();
    });
  });

  // ============================================================================
  // PRISMA EINSATZ MAPPER TESTS - toPersistence()
  // ============================================================================

  describe('toPersistence() - Basic Conversion', () => {
    it('sollte Domain Aggregate zu Persistence Data konvertieren', () => {
      // Given: Domain Einsatz Aggregate
      const einsatz = createDomainEinsatz({
        alarmstichwort: 'Verkehrsunfall',
      });
      const createdBy = createValidTestId('user1');

      // When: toPersistence() aufgerufen
      const persistData = PrismaEinsatzMapper.toPersistence(einsatz, createdBy);

      // Then: Persistence Data hat korrekte Struktur
      expect(persistData.id).toBe(einsatz.id.value);
      expect(persistData.alarmstichwort).toBe('Verkehrsunfall');
      expect(persistData.status).toBe('ANGELEGT');
      expect(persistData.createdBy).toBe(createdBy);
    });

    it('sollte Status Mapping Domain -> Prisma korrekt durchfuehren', () => {
      // Given: Domain Aggregate mit ANGELEGT Status (default)
      const einsatz = createDomainEinsatz();

      // When: toPersistence() aufgerufen
      const persistData = PrismaEinsatzMapper.toPersistence(einsatz, createValidTestId('user1'));

      // Then: Persistence data hat Status='ANGELEGT'
      expect(persistData.status).toBe('ANGELEGT');
    });

    it('sollte createdBy verwenden wenn createdByUser Parameter gesetzt ist', () => {
      // Given: Domain Aggregate
      const einsatz = createDomainEinsatz();
      const createdByUser = createValidTestId('user9');

      // When: toPersistence() mit createdByUser aufgerufen
      const persistData = PrismaEinsatzMapper.toPersistence(einsatz, createdByUser);

      // Then: createdBy ist auf Parameter gesetzt
      expect(persistData.createdBy).toBe(createdByUser);
    });

    it('sollte createdBy aus Aggregate verwenden wenn createdByUser Parameter fehlt', () => {
      // Given: Domain Aggregate mit createdBy
      const einsatz = createDomainEinsatz({
        createdBy: createValidTestId('user5'),
      });

      // When: toPersistence() ohne createdByUser aufgerufen
      const persistData = PrismaEinsatzMapper.toPersistence(einsatz);

      // Then: createdBy ist aus Aggregate
      expect(persistData.createdBy).toBe(einsatz.createdBy.value);
    });

    it('sollte updatedBy setzen wenn angegeben', () => {
      // Given: Domain Aggregate
      const einsatz = createDomainEinsatz();
      const updatedBy = createValidTestId('user2');

      // When: toPersistence() mit updatedBy aufgerufen
      const persistData = PrismaEinsatzMapper.toPersistence(einsatz, createValidTestId('user1'), updatedBy);

      // Then: updatedBy ist gesetzt
      expect(persistData.updatedBy).toBe(updatedBy);
    });

    it('sollte updatedBy null lassen wenn nicht angegeben', () => {
      // Given: Domain Aggregate
      const einsatz = createDomainEinsatz();

      // When: toPersistence() ohne updatedBy aufgerufen
      const persistData = PrismaEinsatzMapper.toPersistence(einsatz, createValidTestId('user1'));

      // Then: updatedBy ist null
      expect(persistData.updatedBy).toBeNull();
    });

    it('sollte Timestamps korrekt uebernehmen', () => {
      // Given: Domain Aggregate (mit auto-generierten Timestamps)
      const einsatz = createDomainEinsatz();

      // When: toPersistence() aufgerufen
      const persistData = PrismaEinsatzMapper.toPersistence(einsatz, createValidTestId('user1'));

      // Then: Timestamps sind uebernommen
      expect(persistData.createdAt).toEqual(einsatz.createdAt);
      expect(persistData.updatedAt).toEqual(einsatz.updatedAt);
    });

    it('sollte Default Values fuer Prisma-Schema setzen', () => {
      // Given: Domain Aggregate
      const einsatz = createDomainEinsatz();

      // When: toPersistence() aufgerufen
      const persistData = PrismaEinsatzMapper.toPersistence(einsatz, createValidTestId('user1'));

      // Then: Default Values sind gesetzt
      expect(persistData.alarmierungszeit).toBeNull();
      expect(persistData.einsatzleiter).toBeNull();
      expect(persistData.metadata).toBeNull();
    });
  });

  describe('toPersistence() - Address Serialization', () => {
    it('sollte Address VO zu JSON-String serialisieren', () => {
      // Given: Domain Aggregate mit Address
      const addressResult = Address.create({
        strasse: 'Hauptstraße',
        hausnummer: '123',
        plz: '10115',
        ort: 'Berlin',
      });
      const einsatz = createDomainEinsatz({
        einsatzort: addressResult.value as Address,
      });

      // When: toPersistence() aufgerufen
      const persistData = PrismaEinsatzMapper.toPersistence(einsatz, createValidTestId('user1'));

      // Then: einsatzort ist JSON-String
      expect(persistData.einsatzort).toBeDefined();
      expect(typeof persistData.einsatzort).toBe('string');

      // Parse JSON und validiere Inhalt
      const parsed = JSON.parse(persistData.einsatzort as string);
      expect(parsed.strasse).toBe('Hauptstraße');
      expect(parsed.hausnummer).toBe('123');
      expect(parsed.plz).toBe('10115');
      expect(parsed.ort).toBe('Berlin');
    });

    it('sollte null zurueckgeben wenn keine Address vorhanden', () => {
      // Given: Domain Aggregate ohne Address
      const einsatz = createDomainEinsatz({
        einsatzort: undefined,
      });

      // When: toPersistence() aufgerufen
      const persistData = PrismaEinsatzMapper.toPersistence(einsatz, createValidTestId('user1'));

      // Then: einsatzort ist null
      expect(persistData.einsatzort).toBeNull();
    });
  });

  describe('toPersistence() - Optional Fields', () => {
    it('sollte bemerkung zu beschreibung mappen', () => {
      // Given: Domain Aggregate mit bemerkung
      const einsatz = createDomainEinsatz({
        bemerkung: 'Mehrere verletzte Personen',
      });

      // When: toPersistence() aufgerufen
      const persistData = PrismaEinsatzMapper.toPersistence(einsatz, createValidTestId('user1'));

      // Then: beschreibung ist gesetzt (Domain: bemerkung → DB: beschreibung)
      expect(persistData.beschreibung).toBe('Mehrere verletzte Personen');
    });

    it('sollte beschreibung null lassen wenn bemerkung undefined', () => {
      // Given: Domain Aggregate ohne bemerkung
      const einsatz = createDomainEinsatz({
        bemerkung: undefined,
      });

      // When: toPersistence() aufgerufen
      const persistData = PrismaEinsatzMapper.toPersistence(einsatz, createValidTestId('user1'));

      // Then: beschreibung ist null
      expect(persistData.beschreibung).toBeNull();
    });

    it('sollte archivedAt korrekt mappen wenn gesetzt', () => {
      // Given: Prisma Einsatz mit archivedAt rekonstruieren und dann toPersistence
      const archivedAt = new Date('2024-12-31T23:59:00Z');
      const prismaEinsatz = createMockPrismaEinsatz({
        status: 'ARCHIVIERT' as PrismaEinsatzStatus,
        archivedAt,
        archivedBy: createValidTestId('user2'),
      });
      const aggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);

      // When: toPersistence() aufgerufen
      const persistData = PrismaEinsatzMapper.toPersistence(aggregate, createValidTestId('user1'));

      // Then: archivedAt ist gesetzt
      expect(persistData.archivedAt).toEqual(archivedAt);
    });

    it('sollte archivedAt null lassen wenn nicht gesetzt', () => {
      // Given: Domain Aggregate ohne archivedAt
      const einsatz = createDomainEinsatz();

      // When: toPersistence() aufgerufen
      const persistData = PrismaEinsatzMapper.toPersistence(einsatz, createValidTestId('user1'));

      // Then: archivedAt ist null
      expect(persistData.archivedAt).toBeNull();
    });

    it('sollte archivedBy setzen wenn archivedAt vorhanden und updatedByUser Parameter gesetzt', () => {
      // Given: Archivierter Einsatz (rekonstruiert)
      const archivedAt = new Date('2024-12-31T23:59:00Z');
      const prismaEinsatz = createMockPrismaEinsatz({
        status: 'ARCHIVIERT' as PrismaEinsatzStatus,
        archivedAt,
        archivedBy: createValidTestId('user2'),
      });
      const aggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);
      const updatedByUser = createValidTestId('user3');

      // When: toPersistence() mit updatedByUser aufgerufen
      const persistData = PrismaEinsatzMapper.toPersistence(aggregate, createValidTestId('user1'), updatedByUser);

      // Then: archivedBy ist auf updatedByUser gesetzt
      expect(persistData.archivedBy).toBe(updatedByUser);
    });

    it('sollte archivedBy null lassen wenn archivedAt null ist', () => {
      // Given: Nicht-archivierter Einsatz
      const einsatz = createDomainEinsatz();

      // When: toPersistence() aufgerufen
      const persistData = PrismaEinsatzMapper.toPersistence(einsatz, createValidTestId('user1'), createValidTestId('user2'));

      // Then: archivedBy ist null (weil archivedAt null ist)
      expect(persistData.archivedBy).toBeNull();
    });
  });

  // ============================================================================
  // ROUND-TRIP TESTS
  // ============================================================================

  describe('Round-Trip Tests', () => {
    it('sollte Aggregate Daten bei Domain -> Prisma -> Domain Konvertierung erhalten', () => {
      // Given: Original Domain Aggregate erstellen
      const _addressResult = Address.create({
        strasse: 'Teststraße',
        hausnummer: '99',
        plz: '80331',
        ort: 'München',
      });
      const prismaEinsatz = createMockPrismaEinsatz({
        id: createValidTestId('ein99'),
        alarmstichwort: 'Großbrand',
        status: 'IN_BEARBEITUNG' as PrismaEinsatzStatus,
        einsatzort: JSON.stringify({
          strasse: 'Teststraße',
          hausnummer: '99',
          plz: '80331',
          ort: 'München',
        }),
        beschreibung: 'Testbemerkung',
      });
      const originalAggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);
      const originalId = originalAggregate.id.value;
      const originalStatus = originalAggregate.status.value;
      const originalAlarmstichwort = originalAggregate.alarmstichwort;

      // When: Domain -> Prisma -> Domain (simuliert Save + Load)
      const persistData = PrismaEinsatzMapper.toPersistence(originalAggregate, createValidTestId('user1'));

      // Simuliere DB-Row aus Persistence Data
      const simulatedDbRow: EinsatzWithRelations = {
        id: persistData.id,
        alarmstichwort: persistData.alarmstichwort,
        einsatzort: persistData.einsatzort,
        beschreibung: persistData.beschreibung,
        status: persistData.status,
        createdAt: persistData.createdAt,
        updatedAt: persistData.updatedAt,
        createdBy: persistData.createdBy,
        updatedBy: persistData.updatedBy,
        archivedAt: persistData.archivedAt,
        archivedBy: persistData.archivedBy,
        alarmierungszeit: persistData.alarmierungszeit,
        einsatzleiter: persistData.einsatzleiter,
        metadata: persistData.metadata,
      };

      const reconstructedAggregate = PrismaEinsatzMapper.toAggregate(simulatedDbRow);

      // Then: Rekonstruiertes Aggregate entspricht Original
      expect(reconstructedAggregate.id.value).toBe(originalId);
      expect(reconstructedAggregate.status.value).toBe(originalStatus);
      expect(reconstructedAggregate.alarmstichwort).toBe(originalAlarmstichwort);
      expect(reconstructedAggregate.einsatzort?.strasse).toBe('Teststraße');
      expect(reconstructedAggregate.einsatzort?.ort).toBe('München');
      expect(reconstructedAggregate.bemerkung).toBe('Testbemerkung');
    });

    it('sollte Round-Trip mit allen Status-Varianten korrekt handhaben', () => {
      const statusVariants: PrismaEinsatzStatus[] = ['ANGELEGT', 'IN_BEARBEITUNG', 'ABGESCHLOSSEN', 'ARCHIVIERT'];

      for (const status of statusVariants) {
        // Given: Prisma Einsatz mit spezifischem Status
        const prismaEinsatz = createMockPrismaEinsatz({ status });
        const originalAggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);

        // When: Round-Trip
        const persistData = PrismaEinsatzMapper.toPersistence(originalAggregate, createValidTestId('user1'));
        const simulatedDbRow: EinsatzWithRelations = {
          ...prismaEinsatz,
          ...persistData,
        };
        const reconstructedAggregate = PrismaEinsatzMapper.toAggregate(simulatedDbRow);

        // Then: Status bleibt erhalten
        expect(reconstructedAggregate.status.value).toBe(status);
      }
    });

    it('sollte Round-Trip mit Address korrekt handhaben', () => {
      // Given: Aggregate mit Address
      const addressJson = JSON.stringify({
        strasse: 'Hauptstraße',
        hausnummer: '42',
        plz: '10115',
        ort: 'Berlin',
      });
      const prismaEinsatz = createMockPrismaEinsatz({
        einsatzort: addressJson,
      });
      const originalAggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);

      // When: Round-Trip
      const persistData = PrismaEinsatzMapper.toPersistence(originalAggregate, createValidTestId('user1'));
      const simulatedDbRow: EinsatzWithRelations = {
        ...prismaEinsatz,
        einsatzort: persistData.einsatzort,
      };
      const reconstructedAggregate = PrismaEinsatzMapper.toAggregate(simulatedDbRow);

      // Then: Address bleibt erhalten
      expect(reconstructedAggregate.einsatzort).toBeDefined();
      expect(reconstructedAggregate.einsatzort?.strasse).toBe('Hauptstraße');
      expect(reconstructedAggregate.einsatzort?.hausnummer).toBe('42');
      expect(reconstructedAggregate.einsatzort?.plz).toBe('10115');
      expect(reconstructedAggregate.einsatzort?.ort).toBe('Berlin');
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('sollte leere Address-Felder korrekt handhaben', () => {
      // Given: Address mit nur PLZ und Ort
      const addressResult = Address.create({
        plz: '80331',
        ort: 'München',
      });
      const einsatz = createDomainEinsatz({
        einsatzort: addressResult.value as Address,
      });

      // When: toPersistence() aufgerufen
      const persistData = PrismaEinsatzMapper.toPersistence(einsatz, createValidTestId('user1'));

      // Then: Address ist serialisiert (mit undefined für fehlende Felder)
      expect(persistData.einsatzort).toBeDefined();
      const parsed = JSON.parse(persistData.einsatzort as string);
      expect(parsed.strasse).toBeUndefined();
      expect(parsed.hausnummer).toBeUndefined();
      expect(parsed.plz).toBe('80331');
      expect(parsed.ort).toBe('München');
    });

    it('sollte archivierter Einsatz korrekt gemapped werden', () => {
      // Given: Archivierter Prisma Einsatz
      const archivedAt = new Date('2024-12-31T23:59:00Z');
      const archivedBy = createValidTestId('user2');
      const prismaEinsatz = createMockPrismaEinsatz({
        status: 'ARCHIVIERT' as PrismaEinsatzStatus,
        archivedAt,
        archivedBy,
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaEinsatzMapper.toAggregate(prismaEinsatz);

      // Then: Aggregate ist korrekt archiviert
      expect(aggregate.status.value).toBe('ARCHIVIERT');
      expect(aggregate.archivedAt).toEqual(archivedAt);

      // When: toPersistence() aufgerufen
      const persistData = PrismaEinsatzMapper.toPersistence(aggregate, createValidTestId('user1'), archivedBy);

      // Then: Archivierungs-Felder sind gesetzt
      expect(persistData.status).toBe('ARCHIVIERT');
      expect(persistData.archivedAt).toEqual(archivedAt);
      expect(persistData.archivedBy).toBe(archivedBy);
    });

    it('sollte null/undefined fuer optionale Felder korrekt handhaben', () => {
      // Given: Minimales Domain Aggregate (nur required Felder)
      const einsatz = createDomainEinsatz({
        alarmstichwort: 'Test',
        einsatzort: undefined,
        bemerkung: undefined,
      });

      // When: toPersistence() aufgerufen
      const persistData = PrismaEinsatzMapper.toPersistence(einsatz, createValidTestId('user1'));

      // Then: Optionale Felder sind null
      expect(persistData.einsatzort).toBeNull();
      expect(persistData.beschreibung).toBeNull();
      expect(persistData.archivedAt).toBeNull();
      expect(persistData.archivedBy).toBeNull();
      expect(persistData.updatedBy).toBeNull();
    });

    it('sollte Fehler werfen bei ungültiger EinsatzId', () => {
      // Given: Prisma Einsatz mit ungültiger ID
      const prismaEinsatz = createMockPrismaEinsatz({
        id: 'invalid-id', // Zu kurz für CUID2
      });

      // When/Then: toAggregate() wirft Error
      expect(() => {
        PrismaEinsatzMapper.toAggregate(prismaEinsatz);
      }).toThrow('Invalid EinsatzId');
    });

    it('sollte Fehler werfen bei ungültiger UserId (createdBy)', () => {
      // Given: Prisma Einsatz mit ungültiger createdBy
      const prismaEinsatz = createMockPrismaEinsatz({
        createdBy: 'invalid', // Zu kurz für CUID
      });

      // When/Then: toAggregate() wirft Error
      expect(() => {
        PrismaEinsatzMapper.toAggregate(prismaEinsatz);
      }).toThrow('Invalid UserId for createdBy');
    });

    it('sollte Fehler werfen bei unbekanntem Status', () => {
      // Given: Prisma Einsatz mit unbekanntem Status (simuliert DB-Corruption)
      const prismaEinsatz = createMockPrismaEinsatz({
        status: 'UNKNOWN_STATUS' as PrismaEinsatzStatus,
      });

      // When/Then: toAggregate() wirft Error
      expect(() => {
        PrismaEinsatzMapper.toAggregate(prismaEinsatz);
      }).toThrow('Unknown EinsatzStatus');
    });
  });
});
