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
 * Unit Tests für PrismaLagekarteMapper (Infrastructure Layer).
 *
 * Diese Tests validieren die bidirektionale Transformation zwischen:
 * - Domain Layer: LagekarteAggregate mit Poi Entities Collection
 * - Infrastructure Layer: Prisma Lagekarte mit LagekartePoi[] Relation
 *
 * **Test Strategy:**
 * - Round-Trip Tests: Domain → Prisma → Domain = equal Aggregate
 * - POI Collection Persistence: Alle POIs werden korrekt gemapped
 * - Aggregate Reconstruction: ID, Timestamps, POIs korrekt rekonstruiert
 * - Empty POI List Handling: Lagekarte ohne POIs funktioniert
 *
 * Epic 2 Story 2.3 | Task 2
 */

import { PrismaLagekarteMapper } from '../mappers/prisma-lagekarte.mapper';
import { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { UserId } from '@domain/value-objects/user-id';
import type { Lagekarte, LagekartePoi } from '@prisma/client';

describe('PrismaLagekarteMapper', () => {
  // Test Data Setup (use valid CUID2 format - 25 characters, lowercase a-z0-9, starts with letter)
  const testEinsatzIdResult = EinsatzId.create('clw3h8x9y0000qwertyuieins');
  if (testEinsatzIdResult.isFailure) throw new Error('Failed to create test EinsatzId');
  const testEinsatzId = testEinsatzIdResult.value as EinsatzId;

  const testUserIdResult = UserId.create('clw3h8x9y0000qwertyuiuser');
  if (testUserIdResult.isFailure) throw new Error('Failed to create test UserId');
  const testUserId = testUserIdResult.value as UserId;

  const berlinMgrsResult = MgrsCoordinate.fromLatLng(52.52, 13.4, 5);
  if (berlinMgrsResult.isFailure) throw new Error('Failed to create Berlin MGRS');
  const berlinMgrs = berlinMgrsResult.value as MgrsCoordinate;

  const hamburgMgrsResult = MgrsCoordinate.fromLatLng(53.55, 10.0, 5);
  if (hamburgMgrsResult.isFailure) throw new Error('Failed to create Hamburg MGRS');
  const hamburgMgrs = hamburgMgrsResult.value as MgrsCoordinate;

  describe('toAggregate', () => {
    it('should convert Prisma Lagekarte to Domain Aggregate with POIs', () => {
      // Given: Prisma Lagekarte with 2 POIs
      const prismaLagekarte: Lagekarte & { pois: LagekartePoi[] } = {
        id: 'clw3h8x9y0000qwertyuilagek',
        einsatzId: testEinsatzId.value,
        state: {},
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
        pois: [
          {
            id: 'clw3h8x9y0000qwertyuipoi01', // Valid CUID2
            lagekarteId: 'clw3h8x9y0000qwertyuilagek',
            type: 'EINSATZORT',
            name: 'Brandenburger Tor',
            adresse: 'Haupteinsatzort',
            mgrs: berlinMgrs.value,
            latitude: 52.52,
            longitude: 13.4,
            icon: null,
            metadata: null,
            createdAt: new Date('2024-01-01T10:00:00Z'),
            updatedAt: new Date('2024-01-01T10:00:00Z'),
          },
          {
            id: 'clw3h8x9y0000qwertyuipoi02', // Valid CUID2
            lagekarteId: 'clw3h8x9y0000qwertyuilagek',
            type: 'BEREITSTELLUNGSRAUM',
            name: 'Rathaus Hamburg',
            adresse: null,
            mgrs: hamburgMgrs.value,
            latitude: 53.55,
            longitude: 10.0,
            icon: null,
            metadata: null,
            createdAt: new Date('2024-01-01T10:00:00Z'),
            updatedAt: new Date('2024-01-01T10:00:00Z'),
          },
        ],
      };

      // When: Convert to Domain Aggregate
      const aggregate = PrismaLagekarteMapper.toAggregate(prismaLagekarte);

      // Then: Aggregate properties correct
      expect(aggregate.id.value).toBe('clw3h8x9y0000qwertyuilagek');
      expect(aggregate.einsatzId.value).toBe(testEinsatzId.value);
      expect(aggregate.pois.length).toBe(2);

      // Verify POI 1
      const poi1 = aggregate.pois[0];
      expect(poi1.name).toBe('Brandenburger Tor');
      expect(poi1.category.value).toBe('EINSATZSTELLE'); // EINSATZORT → EINSATZSTELLE
      expect(poi1.beschreibung).toBe('Haupteinsatzort');

      // Verify POI 2
      const poi2 = aggregate.pois[1];
      expect(poi2.name).toBe('Rathaus Hamburg');
      expect(poi2.category.value).toBe('BEREITSTELLUNGSRAUM');
      expect(poi2.beschreibung).toBeUndefined(); // NULL → undefined
    });

    it('should convert Prisma Lagekarte with empty POI list', () => {
      // Given: Prisma Lagekarte without POIs
      const prismaLagekarte: Lagekarte & { pois: LagekartePoi[] } = {
        id: 'clw3h8x9y0000qwertyuilagek',
        einsatzId: testEinsatzId.value,
        state: {},
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
        pois: [], // Empty POI list
      };

      // When: Convert to Domain
      const aggregate = PrismaLagekarteMapper.toAggregate(prismaLagekarte);

      // Then: Aggregate has empty POI list
      expect(aggregate.pois.length).toBe(0);
    });

    it('should reconstruct Aggregate with correct timestamps', () => {
      // Given: Prisma Lagekarte with specific timestamps
      const createdAt = new Date('2024-01-01T10:00:00Z');
      const updatedAt = new Date('2024-01-02T15:30:00Z');

      const prismaLagekarte: Lagekarte & { pois: LagekartePoi[] } = {
        id: 'clw3h8x9y0000qwertyuilagek',
        einsatzId: testEinsatzId.value,
        state: {},
        createdAt,
        updatedAt,
        pois: [],
      };

      // When: Convert to Domain
      const aggregate = PrismaLagekarteMapper.toAggregate(prismaLagekarte);

      // Then: Timestamps preserved
      expect(aggregate.createdAt).toEqual(createdAt);
      expect(aggregate.updatedAt).toEqual(updatedAt);
    });

    it('should clear Domain Events after reconstruction', () => {
      // Given: Prisma Lagekarte
      const prismaLagekarte: Lagekarte & { pois: LagekartePoi[] } = {
        id: 'clw3h8x9y0000qwertyuilagek',
        einsatzId: testEinsatzId.value,
        state: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        pois: [],
      };

      // When: Convert to Domain
      const aggregate = PrismaLagekarteMapper.toAggregate(prismaLagekarte);

      // Then: No Domain Events (reconstruction doesn't emit events)
      expect(aggregate.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('toPersistence', () => {
    it('should convert Domain Aggregate to Prisma CreateInput with POIs', () => {
      // Given: Domain Aggregate with 2 POIs
      const aggregateResult = LagekarteAggregate.create(testEinsatzId, testUserId);
      expect(aggregateResult.isSuccess).toBe(true);

      const aggregate = aggregateResult.value as LagekarteAggregate;
      aggregate.addPoi('Brandenburger Tor', berlinMgrs, PoiCategory.EINSATZSTELLE(), testUserId, 'Haupteinsatzort');
      aggregate.addPoi('Rathaus Hamburg', hamburgMgrs, PoiCategory.BEREITSTELLUNGSRAUM(), testUserId);

      // When: Convert to Prisma CreateInput
      const prismaData = PrismaLagekarteMapper.toPersistence(aggregate);

      // Then: Lagekarte data correct
      expect(prismaData.id).toBe(aggregate.id.value);
      expect(prismaData.state).toEqual({}); // Empty GeoJSON (future feature)
      expect(prismaData.pois.length).toBe(2);

      // Verify POI 1
      const poi1 = prismaData.pois[0];
      expect(poi1.type).toBe('EINSATZORT'); // EINSATZSTELLE → EINSATZORT
      expect(poi1.name).toBe('Brandenburger Tor');
      expect(poi1.adresse).toBe('Haupteinsatzort'); // beschreibung → adresse
      expect(poi1.mgrs).toBe(berlinMgrs.value);

      // Verify POI 2
      const poi2 = prismaData.pois[1];
      expect(poi2.type).toBe('BEREITSTELLUNGSRAUM');
      expect(poi2.name).toBe('Rathaus Hamburg');
      expect(poi2.adresse).toBeNull(); // undefined → null
      expect(poi2.mgrs).toBe(hamburgMgrs.value);
    });

    it('should convert Aggregate with empty POI list', () => {
      // Given: Domain Aggregate without POIs
      const aggregateResult = LagekarteAggregate.create(testEinsatzId, testUserId);
      const aggregate = aggregateResult.value as LagekarteAggregate;

      // When: Convert to Prisma
      const prismaData = PrismaLagekarteMapper.toPersistence(aggregate);

      // Then: POI array empty
      expect(prismaData.pois).toHaveLength(0);
    });

    it('should preserve POI order in array', () => {
      // Given: Aggregate with 3 POIs added in specific order
      const aggregateResult = LagekarteAggregate.create(testEinsatzId, testUserId);
      const aggregate = aggregateResult.value as LagekarteAggregate;

      aggregate.addPoi('POI 1', berlinMgrs, PoiCategory.EINSATZSTELLE(), testUserId);
      aggregate.addPoi('POI 2', hamburgMgrs, PoiCategory.GEFAHRENSTELLE(), testUserId);
      aggregate.addPoi('POI 3', berlinMgrs, PoiCategory.WASSERENTNAHMESTELLE(), testUserId);

      // When: Convert to Prisma
      const prismaData = PrismaLagekarteMapper.toPersistence(aggregate);

      // Then: POI order preserved
      expect(prismaData.pois[0].name).toBe('POI 1');
      expect(prismaData.pois[1].name).toBe('POI 2');
      expect(prismaData.pois[2].name).toBe('POI 3');
    });
  });

  describe('Round-Trip Tests', () => {
    it('should preserve Aggregate data in Domain → Prisma → Domain conversion', () => {
      // Given: Original Domain Aggregate with POIs
      const originalResult = LagekarteAggregate.create(testEinsatzId, testUserId);
      expect(originalResult.isSuccess).toBe(true);
      const original = originalResult.value as LagekarteAggregate;
      original.addPoi('Brandenburger Tor', berlinMgrs, PoiCategory.EINSATZSTELLE(), testUserId, 'Haupteinsatzort');
      original.addPoi('Rathaus Hamburg', hamburgMgrs, PoiCategory.BEREITSTELLUNGSRAUM(), testUserId);

      const originalId = original.id.value;
      const originalEinsatzId = original.einsatzId.value;
      const originalPoiCount = original.pois.length;

      // When: Convert Domain → Prisma → Domain
      const prismaData = PrismaLagekarteMapper.toPersistence(original);

      // Simulate DB persistence (add missing fields)
      const prismaLagekarte: Lagekarte & { pois: LagekartePoi[] } = {
        id: prismaData.id,
        einsatzId: testEinsatzId.value,
        state: prismaData.state,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
        pois: prismaData.pois.map((poi, index) => ({
          ...poi,
          lagekarteId: prismaData.id,
          name: poi.name ?? `POI ${index}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      };

      const reconstructed = PrismaLagekarteMapper.toAggregate(prismaLagekarte);

      // Then: Reconstructed Aggregate equals original (core properties)
      expect(reconstructed.id.value).toBe(originalId);
      expect(reconstructed.einsatzId.value).toBe(originalEinsatzId);
      expect(reconstructed.pois.length).toBe(originalPoiCount);

      // Verify POI 1
      const poi1 = reconstructed.pois[0];
      expect(poi1.name).toBe('Brandenburger Tor');
      expect(poi1.category.value).toBe('EINSATZSTELLE');
      expect(poi1.beschreibung).toBe('Haupteinsatzort');

      // Verify POI 2
      const poi2 = reconstructed.pois[1];
      expect(poi2.name).toBe('Rathaus Hamburg');
      expect(poi2.category.value).toBe('BEREITSTELLUNGSRAUM');
    });

    it('should handle round-trip with empty POI list', () => {
      // Given: Aggregate without POIs
      const originalResult = LagekarteAggregate.create(testEinsatzId, testUserId);
      expect(originalResult.isSuccess).toBe(true);
      const original = originalResult.value as LagekarteAggregate;

      // When: Round-trip
      const prismaData = PrismaLagekarteMapper.toPersistence(original);
      const prismaLagekarte: Lagekarte & { pois: LagekartePoi[] } = {
        id: prismaData.id,
        einsatzId: testEinsatzId.value,
        state: prismaData.state,
        createdAt: new Date(),
        updatedAt: new Date(),
        pois: [],
      };
      const reconstructed = PrismaLagekarteMapper.toAggregate(prismaLagekarte);

      // Then: POI list still empty
      expect(reconstructed.pois).toHaveLength(0);
    });

    it('should handle round-trip with multiple POI categories', () => {
      // Given: Aggregate with all POI categories
      const originalResult = LagekarteAggregate.create(testEinsatzId, testUserId);
      expect(originalResult.isSuccess).toBe(true);
      const original = originalResult.value as LagekarteAggregate;

      original.addPoi('POI 1', berlinMgrs, PoiCategory.EINSATZSTELLE(), testUserId);
      original.addPoi('POI 2', hamburgMgrs, PoiCategory.GEFAHRENSTELLE(), testUserId);
      original.addPoi('POI 3', berlinMgrs, PoiCategory.WASSERENTNAHMESTELLE(), testUserId);
      original.addPoi('POI 4', hamburgMgrs, PoiCategory.BEREITSTELLUNGSRAUM(), testUserId);
      original.addPoi('POI 5', berlinMgrs, PoiCategory.SONSTIGES(), testUserId);

      // When: Round-trip
      const prismaData = PrismaLagekarteMapper.toPersistence(original);
      const prismaLagekarte: Lagekarte & { pois: LagekartePoi[] } = {
        id: prismaData.id,
        einsatzId: testEinsatzId.value,
        state: prismaData.state,
        createdAt: new Date(),
        updatedAt: new Date(),
        pois: prismaData.pois.map((poi, index) => ({
          ...poi,
          lagekarteId: prismaData.id,
          name: poi.name ?? `POI ${index}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      };
      const reconstructed = PrismaLagekarteMapper.toAggregate(prismaLagekarte);

      // Then: All categories preserved
      expect(reconstructed.pois.length).toBe(5);
      expect(reconstructed.pois[0].category.value).toBe('EINSATZSTELLE');
      expect(reconstructed.pois[1].category.value).toBe('GEFAHRENSTELLE');
      expect(reconstructed.pois[2].category.value).toBe('WASSERENTNAHMESTELLE');
      expect(reconstructed.pois[3].category.value).toBe('BEREITSTELLUNGSRAUM');
      expect(reconstructed.pois[4].category.value).toBe('SONSTIGES');
    });
  });
});
