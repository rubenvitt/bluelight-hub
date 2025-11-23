import { GetEtbHistoryQueryHandler } from '../get-etb-history/get-etb-history.handler';
import { GetEtbHistoryQuery } from '../get-etb-history/get-etb-history.query';
import { InMemoryEtbRepository } from '../../__tests__/in-memory-etb.repository';
import { createTestEtb, createTestSnapshot } from '@domain/aggregates/__tests__/fixtures/etb.fixtures';
import type { EtbEintragSnapshot } from '@domain/value-objects/etb-snapshot';
import { createValidTestId } from './helpers/test-id.helper';

// Mock cuid2 fuer deterministische Test-IDs
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
 * Erstellt gueltige EtbEintragSnapshot-Objekte fuer Tests.
 * Diese Funktion umgeht das Problem mit generateTestId() in createTestEintrag().
 */
function createTestEintraegeSnapshots(count: number): EtbEintragSnapshot[] {
  return Array.from({ length: count }, (_, i) => ({
    id: createValidTestId(`entry${i.toString().padStart(2, '0')}`),
    sequenceNumber: i + 1,
    text: `Snapshot Eintrag ${i + 1}`,
    createdBy: createValidTestId(`user00${i}`),
    createdAt: new Date().toISOString(),
    updatedAt: undefined,
    isDeleted: false,
  }));
}

/**
 * Unit Tests fuer GetEtbHistoryQueryHandler.
 *
 * Testet die Abfrage der ETB-Versions-Historie fuer Audit-Trail und Rollback.
 * Nutzt InMemoryEtbRepository mit manuell hinzugefuegten Snapshots.
 *
 * Coverage Target: >90%
 */
describe('GetEtbHistoryQueryHandler', () => {
  let handler: GetEtbHistoryQueryHandler;
  let repository: InMemoryEtbRepository;

  beforeEach(() => {
    repository = new InMemoryEtbRepository();
    handler = new GetEtbHistoryQueryHandler(repository);
  });

  afterEach(() => {
    repository.clear();
    jest.clearAllMocks();
  });

  describe('Erfolgreiche Abfragen', () => {
    it('sollte alle Snapshots fuer ETB zurueckgeben', async () => {
      // Given: ETB mit mehreren Snapshots in der Historie
      const einsatzId = createValidTestId('einsatz1');
      const userId = createValidTestId('user0001');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 2 });
      await repository.save(etb);

      // Snapshots manuell hinzufuegen (neueste zuerst im Store)
      const snapshot1 = createTestSnapshot({ versionNumber: 1, eintraege: createTestEintraegeSnapshots(1) });
      const snapshot2 = createTestSnapshot({ versionNumber: 2, eintraege: createTestEintraegeSnapshots(2) });
      const snapshot3 = createTestSnapshot({ versionNumber: 3, eintraege: createTestEintraegeSnapshots(3) });

      repository.addSnapshot(etb.id, snapshot3); // Neueste zuerst
      repository.addSnapshot(etb.id, snapshot2);
      repository.addSnapshot(etb.id, snapshot1);

      const query = new GetEtbHistoryQuery(etb.id.value);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(3);
    });

    it('sollte Snapshots aufsteigend nach Versionsnummer sortieren', async () => {
      // Given: ETB mit Snapshots in unsortierter Reihenfolge
      const einsatzId = createValidTestId('einsatz2');
      const userId = createValidTestId('user0002');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 1 });
      await repository.save(etb);

      // Snapshots in falscher Reihenfolge hinzufuegen
      const snapshot3 = createTestSnapshot({ versionNumber: 3 });
      const snapshot1 = createTestSnapshot({ versionNumber: 1 });
      const snapshot2 = createTestSnapshot({ versionNumber: 2 });

      repository.addSnapshot(etb.id, snapshot3);
      repository.addSnapshot(etb.id, snapshot1);
      repository.addSnapshot(etb.id, snapshot2);

      const query = new GetEtbHistoryQuery(etb.id.value);

      // When
      const result = await handler.execute(query);

      // Then: Sortiert nach versionNumber ascending (aelteste zuerst)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(3);
      expect(result.value![0].version).toBe(1);
      expect(result.value![1].version).toBe(2);
      expect(result.value![2].version).toBe(3);
    });

    it('sollte leeres Array zurueckgeben wenn keine Historie existiert', async () => {
      // Given: ETB ohne Snapshots
      const einsatzId = createValidTestId('einsatz3');
      const userId = createValidTestId('user0003');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 1 });
      await repository.save(etb);
      // Keine Snapshots hinzugefuegt

      const query = new GetEtbHistoryQuery(etb.id.value);

      // When
      const result = await handler.execute(query);

      // Then: Leeres Array ist valide Response (kein Error!)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
      expect(result.value).toHaveLength(0);
    });

    it('sollte leeres Array fuer neues ETB zurueckgeben', async () => {
      // Given: Frisch erstelltes ETB (hat noch keine Historie)
      const einsatzId = createValidTestId('einsatz4');
      const userId = createValidTestId('user0004');
      const freshEtb = createTestEtb({ einsatzId, userId, entriesCount: 0 });
      await repository.save(freshEtb);

      const query = new GetEtbHistoryQuery(freshEtb.id.value);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
    });

    it('sollte Snapshots korrekt zu EtbSnapshotDto mappen', async () => {
      // Given: ETB mit Snapshot der Eintraege enthaelt
      const einsatzId = createValidTestId('einsatz5');
      const userId = createValidTestId('user0005');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 2 });
      await repository.save(etb);

      const snapshotAt = new Date('2024-01-15T10:30:00.000Z');
      const snapshot = createTestSnapshot({
        versionNumber: 5,
        eintraege: createTestEintraegeSnapshots(3),
        snapshotAt,
      });

      repository.addSnapshot(etb.id, snapshot);

      const query = new GetEtbHistoryQuery(etb.id.value);

      // When
      const result = await handler.execute(query);

      // Then: DTO-Struktur verifizieren
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);

      const dto = result.value![0];
      expect(dto.version).toBe(5);
      expect(dto.snapshotAt).toBeInstanceOf(Date);
      expect(dto.eintraege).toHaveLength(3);

      // Eintrag-Snapshot-Struktur verifizieren
      const eintragSnapshot = dto.eintraege[0];
      expect(eintragSnapshot.id).toBeDefined();
      expect(eintragSnapshot.sequenceNumber).toBeGreaterThanOrEqual(1);
      expect(eintragSnapshot.text).toBeDefined();
      expect(eintragSnapshot.createdBy).toBeDefined();
      expect(typeof eintragSnapshot.createdAt).toBe('string'); // ISO 8601 String
      expect(typeof eintragSnapshot.isDeleted).toBe('boolean');
    });
  });

  describe('Fehlerbehandlung', () => {
    it('sollte bei ungueltigem etbId Format fehlschlagen', async () => {
      // Given: Ungueltige ETB-ID (nicht CUID2 konform)
      const invalidEtbId = 'invalid-id-format';

      // When/Then: Query-Konstruktor sollte Error werfen
      expect(() => new GetEtbHistoryQuery(invalidEtbId)).toThrow();
    });

    it('sollte bei leerem etbId fehlschlagen', async () => {
      // Given: Leere ETB-ID
      const emptyEtbId = '';

      // When/Then: Query-Konstruktor sollte Error werfen
      expect(() => new GetEtbHistoryQuery(emptyEtbId)).toThrow('etbId is required');
    });

    it('sollte leeres Array zurueckgeben wenn ETB nicht existiert (keine Exception)', async () => {
      // Given: ETB-ID die nicht existiert
      const nonExistentEtbId = createValidTestId('notexist');

      const query = new GetEtbHistoryQuery(nonExistentEtbId);

      // When
      const result = await handler.execute(query);

      // Then: Leeres Array (ETB hat keine Historie weil es nicht existiert)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('sollte Snapshots mit vielen Eintraegen korrekt behandeln', async () => {
      // Given: ETB mit Snapshot der viele Eintraege hat
      const einsatzId = createValidTestId('einsatz6');
      const userId = createValidTestId('user0006');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 1 });
      await repository.save(etb);

      const largeSnapshot = createTestSnapshot({
        versionNumber: 1,
        eintraege: createTestEintraegeSnapshots(50),
      });

      repository.addSnapshot(etb.id, largeSnapshot);

      const query = new GetEtbHistoryQuery(etb.id.value);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value![0].eintraege).toHaveLength(50);
    });

    it('sollte mehrere Snapshots mit gleichem Zeitstempel korrekt sortieren', async () => {
      // Given: ETB mit Snapshots (unterschiedliche Versionen, aehnliche Zeitstempel)
      const einsatzId = createValidTestId('einsatz7');
      const userId = createValidTestId('user0007');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 1 });
      await repository.save(etb);

      const sameTime = new Date();
      const snapshot1 = createTestSnapshot({ versionNumber: 1, snapshotAt: sameTime });
      const snapshot2 = createTestSnapshot({ versionNumber: 2, snapshotAt: sameTime });

      repository.addSnapshot(etb.id, snapshot2);
      repository.addSnapshot(etb.id, snapshot1);

      const query = new GetEtbHistoryQuery(etb.id.value);

      // When
      const result = await handler.execute(query);

      // Then: Sortierung nach versionNumber (nicht nach Zeit)
      expect(result.isSuccess).toBe(true);
      expect(result.value![0].version).toBe(1);
      expect(result.value![1].version).toBe(2);
    });
  });
});
