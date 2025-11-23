import { GetEtbQueryHandler } from '../get-etb/get-etb.handler';
import { GetEtbQuery } from '../get-etb/get-etb.query';
import { InMemoryEtbRepository } from '../../__tests__/in-memory-etb.repository';
import { createTestEtb } from '@domain/aggregates/__tests__/fixtures/etb.fixtures';
import { UserId } from '@domain/value-objects/user-id';
import { createValidTestId } from './helpers/test-id.helper';

// Mock cuid2 für deterministische Test-IDs
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
 * Unit Tests fuer GetEtbQueryHandler.
 *
 * Testet Handler-Orchestration gemaess BDD Given-When-Then Pattern.
 * Nutzt InMemoryEtbRepository fuer Integration Tests ohne echte Datenbank.
 *
 * Coverage Target: >90%
 */
describe('GetEtbQueryHandler', () => {
  let handler: GetEtbQueryHandler;
  let repository: InMemoryEtbRepository;

  beforeEach(() => {
    repository = new InMemoryEtbRepository();
    handler = new GetEtbQueryHandler(repository);
  });

  afterEach(() => {
    repository.clear();
    jest.clearAllMocks();
  });

  describe('Erfolgreiche Abfragen', () => {
    it('sollte ETB mit allen nicht-geloeschten Eintraegen zurueckgeben', async () => {
      // Given: ETB mit 3 Eintraegen (explizite gueltige IDs)
      const einsatzId = createValidTestId('einsatz1');
      const userId = createValidTestId('user0001');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 3 });
      await repository.save(etb);

      const query = new GetEtbQuery(etb.einsatzId.value);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).not.toBeNull();
      expect(result.value!.id).toBe(etb.id.value);
      expect(result.value!.einsatzId).toBe(etb.einsatzId.value);
      expect(result.value!.eintraege).toHaveLength(3);
      expect(result.value!.status).toBe('DRAFT');
    });

    it('sollte geloeschte Eintraege ausschliessen wenn includeDeleted=false', async () => {
      // Given: ETB mit Eintraegen, wovon einer geloescht wird
      const einsatzId = createValidTestId('einsatz2');
      const userId = createValidTestId('user0002');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 3 });
      const userIdVo = UserId.create(createValidTestId('deluser01')).value!;

      // Ersten Eintrag loeschen
      const firstEntry = etb.eintraege[0];
      etb.deleteEintrag(firstEntry.id, userIdVo);

      await repository.save(etb);

      const query = new GetEtbQuery(etb.einsatzId.value, false); // includeDeleted = false

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).not.toBeNull();
      expect(result.value!.eintraege).toHaveLength(2); // 3 - 1 geloescht = 2
      expect(result.value!.eintraege.every((e) => !e.isDeleted)).toBe(true);
    });

    it('sollte geloeschte Eintraege inkludieren wenn includeDeleted=true', async () => {
      // Given: ETB mit Eintraegen, wovon einer geloescht wird
      const einsatzId = createValidTestId('einsatz3');
      const userId = createValidTestId('user0003');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 3 });
      const userIdVo = UserId.create(createValidTestId('deluser02')).value!;

      // Ersten Eintrag loeschen
      const firstEntry = etb.eintraege[0];
      etb.deleteEintrag(firstEntry.id, userIdVo);

      await repository.save(etb);

      const query = new GetEtbQuery(etb.einsatzId.value, true); // includeDeleted = true

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).not.toBeNull();
      expect(result.value!.eintraege).toHaveLength(3); // Alle 3 inkl. geloeschter
      expect(result.value!.eintraege.some((e) => e.isDeleted)).toBe(true);
    });

    it('sollte Result.ok(null) zurueckgeben wenn ETB nicht gefunden', async () => {
      // Given: Keine ETB im Repository gespeichert
      const nonExistentEinsatzId = createValidTestId('notfound');
      const query = new GetEtbQuery(nonExistentEinsatzId);

      // When
      const result = await handler.execute(query);

      // Then: null ist valide Response (NICHT Error!)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
      expect(result.error).toBeUndefined();
    });

    it('sollte Result.ok(null) zurueckgeben wenn Einsatz kein ETB hat', async () => {
      // Given: Repository ist leer (Einsatz existiert, aber hat noch kein ETB)
      const einsatzIdWithoutEtb = createValidTestId('noeinsatz');
      const query = new GetEtbQuery(einsatzIdWithoutEtb);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('sollte Aggregate korrekt zu EtbDto mappen', async () => {
      // Given: ETB mit spezifischen Eigenschaften
      const einsatzId = createValidTestId('einsatz4');
      const userId = createValidTestId('user0004');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 2 });
      await repository.save(etb);

      const query = new GetEtbQuery(etb.einsatzId.value);

      // When
      const result = await handler.execute(query);

      // Then: DTO-Struktur verifizieren
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();

      const dto = result.value!;
      expect(dto.id).toBe(etb.id.value);
      expect(dto.einsatzId).toBe(etb.einsatzId.value);
      expect(dto.status).toMatch(/^(DRAFT|ACTIVE|LOCKED)$/);
      expect(dto.version).toBeDefined();
      expect(dto.version.versionNumber).toBeGreaterThanOrEqual(1);
      expect(dto.version.timestamp).toBeInstanceOf(Date);
      expect(dto.createdAt).toBeInstanceOf(Date);
      expect(Array.isArray(dto.eintraege)).toBe(true);

      // Eintrag-DTO-Struktur verifizieren
      if (dto.eintraege.length > 0) {
        const eintragDto = dto.eintraege[0];
        expect(eintragDto.id).toBeDefined();
        expect(eintragDto.sequenceNumber).toBeGreaterThanOrEqual(1);
        expect(eintragDto.text).toBeDefined();
        expect(eintragDto.createdBy).toBeDefined();
        expect(eintragDto.createdAt).toBeInstanceOf(Date);
        expect(typeof eintragDto.isDeleted).toBe('boolean');
      }
    });

    it('sollte leeres Eintraege-Array korrekt behandeln', async () => {
      // Given: ETB ohne Eintraege
      const einsatzId = createValidTestId('einsatz5');
      const userId = createValidTestId('user0005');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 0 });
      await repository.save(etb);

      const query = new GetEtbQuery(etb.einsatzId.value);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).not.toBeNull();
      expect(result.value!.eintraege).toEqual([]);
      expect(result.value!.eintraege.length).toBe(0);
    });
  });

  describe('Fehlerbehandlung', () => {
    it('sollte bei ungueltigem einsatzId Format fehlschlagen', async () => {
      // Given: Ungueltige EinsatzId (zu kurz, nicht CUID2 konform)
      const invalidEinsatzId = 'invalid-id';

      // When/Then: Query-Konstruktor sollte Error werfen
      expect(() => new GetEtbQuery(invalidEinsatzId)).toThrow();
    });

    it('sollte bei leerem einsatzId fehlschlagen', async () => {
      // Given: Leere EinsatzId
      const emptyEinsatzId = '';

      // When/Then: Query-Konstruktor sollte Error werfen
      expect(() => new GetEtbQuery(emptyEinsatzId)).toThrow('einsatzId is required');
    });
  });

  describe('Orchestrierung-Verifikation', () => {
    it('sollte Repository.findByEinsatzId mit korrekter EinsatzId aufrufen', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz6');
      const userId = createValidTestId('user0006');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 1 });
      await repository.save(etb);

      const query = new GetEtbQuery(etb.einsatzId.value);

      // When
      const result = await handler.execute(query);

      // Then: Korrektes ETB gefunden
      expect(result.isSuccess).toBe(true);
      expect(result.value).not.toBeNull();
      expect(result.value!.einsatzId).toBe(etb.einsatzId.value);
    });

    it('sollte save() Methode NICHT aufrufen (Read-Only Query)', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz7');
      const userId = createValidTestId('user0007');
      const etb = createTestEtb({ einsatzId, userId, entriesCount: 1 });
      await repository.save(etb);
      const initialCount = repository.count();

      const query = new GetEtbQuery(etb.einsatzId.value);

      // When
      await handler.execute(query);

      // Then: Repository-Zustand unveraendert
      expect(repository.count()).toBe(initialCount);
    });
  });
});
