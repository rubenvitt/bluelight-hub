import { GetLagekarteExistsQueryHandler } from '../../get-lagekarte-exists.handler';
import { GetLagekarteExistsQuery } from '../../get-lagekarte-exists.query';
import { InMemoryLagekarteRepository } from './in-memory-lagekarte.repository';
import { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { Poi } from '@domain/entities/poi.entity';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { UserId } from '@domain/value-objects/user-id';

// Mock nanoid for deterministic test IDs
jest.mock('nanoid/non-secure', () => ({
  nanoid: jest.fn((length?: number) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    const targetLength = length || 21;
    let result = '';
    for (let i = 0; i < targetLength; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
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
    it('should return true when Lagekarte exists in repository', async () => {
      // Given: Aggregate stored in repository
      const einsatzId = EinsatzId.create('V1StGXR8_Z5jdHi6B-myT').value!;
      const userId = UserId.create().value!;

      const poi = Poi.create('Einsatzstelle', MgrsCoordinate.fromString('33UUU8990317936').value!, PoiCategory.create('EINSATZSTELLE').value!, userId);

      const aggregate = LagekarteAggregate.create(einsatzId, poi).value!;
      await repository.save(aggregate);

      // When: Check existence
      const query = new GetLagekarteExistsQuery(einsatzId.value);
      const result = await handler.execute(query);

      // Then: Should return true
      expect(result).toBe(true);
    });

    it('should return false when Lagekarte does not exist', async () => {
      // Given: Empty repository

      // When: Check existence
      const einsatzId = EinsatzId.create('V1StGXR8_Z5jdHi6B-myT').value!;
      const query = new GetLagekarteExistsQuery(einsatzId.value);
      const result = await handler.execute(query);

      // Then: Should return false
      expect(result).toBe(false);
    });

    it('should distinguish between multiple Lagekarten by EinsatzId', async () => {
      // Given: Two Lagekarten with different EinsatzIds
      const einsatzId1 = EinsatzId.create('V1StGXR8_Z5jdHi6B-my1').value!;
      const einsatzId2 = EinsatzId.create('V1StGXR8_Z5jdHi6B-my2').value!;
      const userId = UserId.create().value!;

      const poi1 = Poi.create('Einsatzstelle 1', MgrsCoordinate.fromString('33UUU8990317936').value!, PoiCategory.create('EINSATZSTELLE').value!, userId);

      const poi2 = Poi.create(
        'Einsatzstelle 2',
        MgrsCoordinate.fromString('32UPU1234567890').value!, // Hamburg MGRS (32U zone)
        PoiCategory.create('EINSATZSTELLE').value!,
        userId,
      );

      const aggregate1 = LagekarteAggregate.create(einsatzId1, poi1).value!;
      const aggregate2 = LagekarteAggregate.create(einsatzId2, poi2).value!;

      await repository.save(aggregate1);
      await repository.save(aggregate2);

      // When: Check existence for einsatz-1
      const query1 = new GetLagekarteExistsQuery(einsatzId1.value);
      const result1 = await handler.execute(query1);

      // Then: Should return true for einsatz-1
      expect(result1).toBe(true);

      // When: Check existence for einsatz-2
      const query2 = new GetLagekarteExistsQuery(einsatzId2.value);
      const result2 = await handler.execute(query2);

      // Then: Should return true for einsatz-2
      expect(result2).toBe(true);

      // When: Check existence for non-existent einsatz-3
      const einsatzId3 = EinsatzId.create('V1StGXR8_Z5jdHi6B-my3').value!;
      const query3 = new GetLagekarteExistsQuery(einsatzId3.value);
      const result3 = await handler.execute(query3);

      // Then: Should return false for einsatz-3
      expect(result3).toBe(false);
    });

    it('should return true even when Lagekarte has no POIs', async () => {
      // Given: Lagekarte WITHOUT POIs
      const einsatzId = EinsatzId.create('V1StGXR8_Z5jdHi6B-myT').value!;

      // Create Lagekarte without initial POI
      const aggregate = LagekarteAggregate.create(einsatzId).value!;
      await repository.save(aggregate);

      // When: Check existence
      const query = new GetLagekarteExistsQuery(einsatzId.value);
      const result = await handler.execute(query);

      // Then: Should return true (Lagekarte exists, even without POIs)
      expect(result).toBe(true);
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
      const einsatzId = EinsatzId.create('V1StGXR8_Z5jdHi6B-myT').value!;
      const userId = UserId.create().value!;

      const poi = Poi.create('Einsatzstelle', MgrsCoordinate.fromString('33UUU8990317936').value!, PoiCategory.create('EINSATZSTELLE').value!, userId);

      const aggregate = LagekarteAggregate.create(einsatzId, poi).value!;
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
