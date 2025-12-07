import { GetLagekarteExistsQueryHandler } from '../../get-lagekarte-exists.handler';
import { GetLagekarteExistsQuery } from '../../get-lagekarte-exists.query';
import { InMemoryLagekarteRepository } from './in-memory-lagekarte.repository';
import { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { Poi } from '@domain/entities/poi.entity';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { UserId } from '@domain/value-objects/user-id';

// Mock cuid2 for deterministic test IDs (CUID2 format: 20-30 chars, lowercase a-z0-9, starts with letter)
jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn(() => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'c'; // CUID2 always starts with a letter
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
 * Integration Tests für GetLagekarteExistsQueryHandler.
 *
 * Diese Tests validieren den VOLLSTÄNDIGEN Flow:
 * Handler → Repository → Exists Check
 *
 * **Unterschied zu Unit Tests:**
 * - Unit Tests: Verwenden jest.fn() Mocks für Repository (isoliert Handler)
 * - Integration Tests: Verwenden In-Memory Repository (testen vollen Flow)
 *
 * **Was wird getestet:**
 * - ✅ Application → Repository Integration
 * - ✅ EinsatzId-basierte Existenz-Prüfung
 * - ✅ Unterscheidung zwischen mehreren Lagekarten
 * - ✅ Boolean Return-Wert (true/false)
 */
describe('GetLagekarteExistsQueryHandler - Integration Tests', () => {
  let handler: GetLagekarteExistsQueryHandler;
  let repository: InMemoryLagekarteRepository;

  beforeEach(() => {
    repository = new InMemoryLagekarteRepository();
    handler = new GetLagekarteExistsQueryHandler(repository);
  });

  afterEach(() => {
    repository.clear();
  });

  describe('Full Application → Repository Flow', () => {
    it('should return Result.ok(true) when Lagekarte exists in repository', async () => {
      // Given: Aggregate stored in repository
      const einsatzId = EinsatzId.create('clw3h8x9y0000qwertyuieins1').value!;
      const userId = UserId.create().value!;

      const poi = Poi.create('Einsatzstelle', MgrsCoordinate.fromString('33UUU8990317936').value!, PoiCategory.EINSATZSTELLE(), userId);

      const aggregate = LagekarteAggregate.create(einsatzId, userId, poi).value!;
      await repository.save(aggregate);

      // When: Check existence
      const query = new GetLagekarteExistsQuery(einsatzId.value);
      const result = await handler.execute(query);

      // Then: Should return Result.ok(true)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should return Result.ok(false) when Lagekarte does not exist', async () => {
      // Given: Empty repository

      // When: Check existence
      const einsatzId = EinsatzId.create('clw3h8x9y0000qwertyuieins1').value!;
      const query = new GetLagekarteExistsQuery(einsatzId.value);
      const result = await handler.execute(query);

      // Then: Should return Result.ok(false)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(false);
    });

    it('should distinguish between multiple Lagekarten by EinsatzId', async () => {
      // Given: Two Lagekarten with different EinsatzIds
      const einsatzId1 = EinsatzId.create('clw3h8x9y0000qwertyuiein01').value!;
      const einsatzId2 = EinsatzId.create('clw3h8x9y0000qwertyuiein02').value!;
      const userId = UserId.create().value!;

      const poi1 = Poi.create('Einsatzstelle 1', MgrsCoordinate.fromString('33UUU8990317936').value!, PoiCategory.EINSATZSTELLE(), userId);

      const poi2 = Poi.create(
        'Einsatzstelle 2',
        MgrsCoordinate.fromString('32UPU1234567890').value!, // Hamburg MGRS (32U zone)
        PoiCategory.EINSATZSTELLE(),
        userId,
      );

      const aggregate1 = LagekarteAggregate.create(einsatzId1, userId, poi1).value!;
      const aggregate2 = LagekarteAggregate.create(einsatzId2, userId, poi2).value!;

      await repository.save(aggregate1);
      await repository.save(aggregate2);

      // When: Check existence for einsatz-1
      const query1 = new GetLagekarteExistsQuery(einsatzId1.value);
      const result1 = await handler.execute(query1);

      // Then: Should return Result.ok(true) for einsatz-1
      expect(result1.isSuccess).toBe(true);
      expect(result1.value).toBe(true);

      // When: Check existence for einsatz-2
      const query2 = new GetLagekarteExistsQuery(einsatzId2.value);
      const result2 = await handler.execute(query2);

      // Then: Should return Result.ok(true) for einsatz-2
      expect(result2.isSuccess).toBe(true);
      expect(result2.value).toBe(true);

      // When: Check existence for non-existent einsatz-3
      const einsatzId3 = EinsatzId.create('clw3h8x9y0000qwertyuiein03').value!;
      const query3 = new GetLagekarteExistsQuery(einsatzId3.value);
      const result3 = await handler.execute(query3);

      // Then: Should return Result.ok(false) for einsatz-3
      expect(result3.isSuccess).toBe(true);
      expect(result3.value).toBe(false);
    });

    it('should return Result.ok(true) even when Lagekarte has no POIs', async () => {
      // Given: Lagekarte WITHOUT POIs
      const einsatzId = EinsatzId.create('clw3h8x9y0000qwertyuieins1').value!;
      const userId = UserId.create().value!;

      // Create Lagekarte without initial POI
      const aggregate = LagekarteAggregate.create(einsatzId, userId).value!;
      await repository.save(aggregate);

      // When: Check existence
      const query = new GetLagekarteExistsQuery(einsatzId.value);
      const result = await handler.execute(query);

      // Then: Should return Result.ok(true) (Lagekarte exists, even without POIs)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should throw error for invalid EinsatzId format', async () => {
      // Given: Invalid EinsatzId (too short)
      const invalidEinsatzId = 'invalid-id';

      // When: Execute query handler with invalid ID
      // Note: Query constructor validates format, so this throws
      expect(() => new GetLagekarteExistsQuery(invalidEinsatzId)).toThrow();
    });

    it('should use repository.exists() method (not findByEinsatzId)', async () => {
      // Given: Aggregate stored in repository
      const einsatzId = EinsatzId.create('clw3h8x9y0000qwertyuieins1').value!;
      const userId = UserId.create().value!;

      const poi = Poi.create('Einsatzstelle', MgrsCoordinate.fromString('33UUU8990317936').value!, PoiCategory.EINSATZSTELLE(), userId);

      const aggregate = LagekarteAggregate.create(einsatzId, userId, poi).value!;
      await repository.save(aggregate);

      // Spy on repository.exists() to verify it's called
      const existsSpy = jest.spyOn(repository, 'exists');

      // When: Check existence
      const query = new GetLagekarteExistsQuery(einsatzId.value);
      await handler.execute(query);

      // Then: Should call repository.exists() exactly once
      expect(existsSpy).toHaveBeenCalledTimes(1);
      expect(existsSpy).toHaveBeenCalledWith(expect.objectContaining({ value: einsatzId.value }));

      existsSpy.mockRestore();
    });
  });
});
