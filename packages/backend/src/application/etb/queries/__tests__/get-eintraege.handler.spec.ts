import { GetEintraegeQueryHandler } from '../get-eintraege/get-eintraege.handler';
import { GetEintraegeQuery } from '../get-eintraege/get-eintraege.query';
import { InMemoryEtbRepository } from '../../__tests__/in-memory-etb.repository';
import { createTestEtb } from '@domain/aggregates/__tests__/fixtures/etb.fixtures';
import { UserId } from '@domain/value-objects/user-id';
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
 * Unit Tests fuer GetEintraegeQueryHandler.
 *
 * Testet die Abfrage von ETB-Eintraegen mit optionaler Filterung.
 * Wichtiger Unterschied zu GetEtbQueryHandler:
 * - GetEtbQuery: null ist valide (ETB existiert nicht)
 * - GetEintraegeQuery: Result.fail() (Eintraege ohne ETB haben keinen Kontext)
 *
 * Coverage Target: >90%
 */
describe('GetEintraegeQueryHandler', () => {
  let handler: GetEintraegeQueryHandler;
  let repository: InMemoryEtbRepository;

  beforeEach(() => {
    repository = new InMemoryEtbRepository();
    handler = new GetEintraegeQueryHandler(repository);
  });

  afterEach(() => {
    repository.clear();
    jest.clearAllMocks();
  });

  describe('Erfolgreiche Abfragen', () => {
    it('sollte alle nicht-geloeschten Eintraege zurueckgeben', async () => {
      // Given: ETB mit 3 Eintraegen
      const einsatzId = createValidTestId('einsatz1');
      const userId = createValidTestId('user0001');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 3 });
      await repository.save(etb);

      const query = new GetEintraegeQuery(etb.id.value);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(3);
      expect(result.value!.every((e) => !e.isDeleted)).toBe(true);
    });

    it('sollte Eintraege aufsteigend nach sequenceNumber sortieren', async () => {
      // Given: ETB mit mehreren Eintraegen
      const einsatzId = createValidTestId('einsatz2');
      const userId = createValidTestId('user0002');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 5 });
      await repository.save(etb);

      const query = new GetEintraegeQuery(etb.id.value);

      // When
      const result = await handler.execute(query);

      // Then: Sortierung nach sequenceNumber ascending
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(5);

      for (let i = 1; i < result.value!.length; i++) {
        expect(result.value![i].sequenceNumber).toBeGreaterThan(result.value![i - 1].sequenceNumber);
      }
    });

    it('sollte geloeschte Eintraege ausschliessen wenn includeDeleted=false', async () => {
      // Given: ETB mit Eintraegen, wovon einige geloescht werden
      const einsatzId = createValidTestId('einsatz3');
      const userId = createValidTestId('user0003');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 4 });
      const userIdVo = UserId.create(createValidTestId('deluser01')).value!;

      // Zwei Eintraege loeschen
      const entry1 = etb.eintraege[0];
      const entry2 = etb.eintraege[2];
      etb.deleteEintrag(entry1.id, userIdVo);
      etb.deleteEintrag(entry2.id, userIdVo);

      await repository.save(etb);

      const query = new GetEintraegeQuery(etb.id.value, false); // includeDeleted = false

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(2); // 4 - 2 geloescht = 2
      expect(result.value!.every((e) => !e.isDeleted)).toBe(true);
    });

    it('sollte geloeschte Eintraege inkludieren wenn includeDeleted=true', async () => {
      // Given: ETB mit Eintraegen, wovon einer geloescht wird
      const einsatzId = createValidTestId('einsatz4');
      const userId = createValidTestId('user0004');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 3 });
      const userIdVo = UserId.create(createValidTestId('deluser02')).value!;

      // Einen Eintrag loeschen
      const deletedEntry = etb.eintraege[1];
      etb.deleteEintrag(deletedEntry.id, userIdVo);

      await repository.save(etb);

      const query = new GetEintraegeQuery(etb.id.value, true); // includeDeleted = true

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(3); // Alle 3 inkl. geloeschter
      expect(result.value!.some((e) => e.isDeleted)).toBe(true);
    });

    it('sollte leeres Array fuer ETB ohne Eintraege zurueckgeben', async () => {
      // Given: ETB ohne Eintraege
      const einsatzId = createValidTestId('einsatz5');
      const userId = createValidTestId('user0005');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 0 });
      await repository.save(etb);

      const query = new GetEintraegeQuery(etb.id.value);

      // When
      const result = await handler.execute(query);

      // Then: Leeres Array ist valide Response
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
      expect(result.value).toHaveLength(0);
    });

    it('sollte mehrere Eintraege in korrekter Reihenfolge behandeln', async () => {
      // Given: ETB mit mehreren Eintraegen in sequentieller Reihenfolge
      const einsatzId = createValidTestId('einsatz6');
      const userId = createValidTestId('user0006');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 10 });
      await repository.save(etb);

      const query = new GetEintraegeQuery(etb.id.value);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(10);

      // Verifiziere chronologische Reihenfolge
      result.value!.forEach((entry, index) => {
        expect(entry.sequenceNumber).toBe(index + 1);
        expect(entry.text).toContain(`Eintrag ${index + 1}`);
      });
    });
  });

  describe('Fehlerbehandlung', () => {
    it('sollte Result.fail() zurueckgeben wenn ETB nicht gefunden', async () => {
      // Given: ETB-ID die nicht existiert
      const nonExistentEtbId = createValidTestId('notfound');
      const query = new GetEintraegeQuery(nonExistentEtbId);

      // When
      const result = await handler.execute(query);

      // Then: Result.fail() erwartet (framework-agnostisch, UNTERSCHIED zu GetEtbQuery!)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Einsatztagebuch nicht gefunden');
    });

    it('sollte bei ungueltigem etbId Format fehlschlagen', async () => {
      // Given: Ungueltige ETB-ID (nicht CUID2 konform)
      const invalidEtbId = 'invalid-format';

      // When/Then: Query-Konstruktor sollte Error werfen
      expect(() => new GetEintraegeQuery(invalidEtbId)).toThrow();
    });

    it('sollte bei leerem etbId fehlschlagen', async () => {
      // Given: Leere ETB-ID
      const emptyEtbId = '';

      // When/Then: Query-Konstruktor sollte Error werfen
      expect(() => new GetEintraegeQuery(emptyEtbId)).toThrow('etbId is required');
    });
  });

  describe('DTO Mapping', () => {
    it('sollte Eintraege korrekt zu EintragDto mappen', async () => {
      // Given: ETB mit Eintraegen
      const einsatzId = createValidTestId('einsatz7');
      const userId = createValidTestId('user0007');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 2 });
      await repository.save(etb);

      const query = new GetEintraegeQuery(etb.id.value);

      // When
      const result = await handler.execute(query);

      // Then: DTO-Struktur verifizieren
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(2);

      const dto = result.value![0];
      expect(dto.id).toBeDefined();
      expect(typeof dto.id).toBe('string');
      expect(dto.sequenceNumber).toBeGreaterThanOrEqual(1);
      expect(typeof dto.sequenceNumber).toBe('number');
      expect(dto.text).toBeDefined();
      expect(typeof dto.text).toBe('string');
      expect(dto.createdBy).toBeDefined();
      expect(typeof dto.createdBy).toBe('string');
      expect(dto.createdAt).toBeInstanceOf(Date);
      expect(typeof dto.isDeleted).toBe('boolean');
    });
  });

  describe('Edge Cases', () => {
    it('sollte ETB mit nur geloeschten Eintraegen korrekt behandeln', async () => {
      // Given: ETB wo alle Eintraege geloescht sind
      const einsatzId = createValidTestId('einsatz8');
      const userId = createValidTestId('user0008');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 3 });
      const userIdVo = UserId.create(createValidTestId('deluser03')).value!;

      // Alle Eintraege loeschen
      for (const entry of etb.eintraege) {
        etb.deleteEintrag(entry.id, userIdVo);
      }

      await repository.save(etb);

      const query = new GetEintraegeQuery(etb.id.value, false); // includeDeleted = false

      // When
      const result = await handler.execute(query);

      // Then: Leeres Array (alle geloescht)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
    });

    it('sollte geloeschte Eintraege auch in korrekter Reihenfolge sortieren', async () => {
      // Given: ETB mit Eintraegen, wovon einige geloescht
      const einsatzId = createValidTestId('einsatz9');
      const userId = createValidTestId('user0009');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 5 });
      const userIdVo = UserId.create(createValidTestId('deluser04')).value!;

      // Ungerade Eintraege loeschen (1, 3, 5)
      etb.deleteEintrag(etb.eintraege[0].id, userIdVo);
      etb.deleteEintrag(etb.eintraege[2].id, userIdVo);
      etb.deleteEintrag(etb.eintraege[4].id, userIdVo);

      await repository.save(etb);

      const query = new GetEintraegeQuery(etb.id.value, true); // includeDeleted = true

      // When
      const result = await handler.execute(query);

      // Then: Alle 5 Eintraege, sortiert nach sequenceNumber
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(5);

      for (let i = 1; i < result.value!.length; i++) {
        expect(result.value![i].sequenceNumber).toBeGreaterThan(result.value![i - 1].sequenceNumber);
      }
    });
  });
});
