/**
 * Lagekarte Smoke Tests - Kritische Kernfunktionen
 *
 * Diese minimale Smoke Test Suite validiert die 5 wichtigsten Lagekarte-Operationen:
 * 1. Lagekarte Create
 * 2. POI Add
 * 3. POI Remove
 * 4. Lagekarte Query (findById / findByEinsatzId)
 * 5. MGRS Conversion
 *
 * **Zeitbudget:** < 30 Sekunden fuer gesamte Suite
 * **Strategie:** Direkte Handler/Repository Tests (kein HTTP/SuperTest)
 */

// biome-ignore-all lint/style/noNonNullAssertion: Test file uses assertions after expect().not.toBeNull()

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

import { PrismaClient } from '@prisma/client';
import { PrismaLagekarteRepository } from '@infrastructure/repositories/prisma-lagekarte.repository';
import { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { GeoCoordinate } from '@domain/value-objects/geo-coordinate';
import { PoiCategory } from '@domain/value-objects/poi-category';
import type { Poi } from '@domain/entities/poi.entity';

/**
 * Generiert eine valide CUID2-kompatible ID fuer Domain Value Objects
 * CUID2 Format: 20-30 Zeichen, nur lowercase a-z0-9, startet mit Buchstabe
 */
function generateCuid2(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'c';
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

describe('Lagekarte Smoke Tests', () => {
  jest.setTimeout(30000); // 30 seconds max for entire suite

  let prisma: PrismaClient;
  let repository: PrismaLagekarteRepository;
  let testUserId: UserId;
  let testEinsatzId: EinsatzId;
  let testEinsatzDbId: string;
  let testUserDbId: string;

  /**
   * Setup: Erstelle Test-User und Test-Einsatz in der Datenbank
   * HINWEIS: Wir generieren nanoid-konforme IDs um Domain Value Objects zu nutzen
   */
  beforeAll(async () => {
    prisma = new PrismaClient();
    // PrismaLagekarteRepository erwartet PrismaService, wir nutzen Duck Typing
    // biome-ignore lint/suspicious/noExplicitAny: Duck Typing für PrismaClient statt PrismaService
    repository = new PrismaLagekarteRepository(prisma as any);

    // Generate nanoid-compliant User ID
    testUserDbId = generateCuid2();
    const userIdResult = UserId.create(testUserDbId);
    expect(userIdResult.isSuccess).toBe(true);
    testUserId = userIdResult.value as UserId;

    // Create test user in the database with custom ID
    await prisma.user.create({
      data: {
        id: testUserDbId,
        username: `smoke-test-user-${Date.now()}`,
        role: 'USER',
        isActive: true,
      },
    });

    // Generate nanoid-compliant Einsatz ID
    testEinsatzDbId = generateCuid2();
    const einsatzIdResult = EinsatzId.create(testEinsatzDbId);
    expect(einsatzIdResult.isSuccess).toBe(true);
    testEinsatzId = einsatzIdResult.value as EinsatzId;

    // Create test Einsatz in the database with custom ID
    await prisma.einsatz.create({
      data: {
        id: testEinsatzDbId,
        alarmstichwort: 'Smoke Test',
        status: 'ANGELEGT',
        createdBy: testUserDbId,
      },
    });
  });

  /**
   * Cleanup: Loesche Test-Daten nach allen Tests
   * HINWEIS: Wir nutzen session_replication_role um NO-DELETE Trigger zu umgehen
   */
  afterAll(async () => {
    try {
      // Use raw SQL to bypass NO-DELETE triggers (same pattern as repository)
      // All deletes in one transaction for atomicity
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL session_replication_role = replica`;

        // Delete test POIs first (cascade)
        await tx.$executeRaw`
          DELETE FROM lagekarte_poi
          WHERE "lagekarteId" IN (
            SELECT id FROM lagekarte WHERE "einsatzId" = ${testEinsatzDbId}
          )
        `;

        // Delete test Lagekarte
        await tx.$executeRaw`
          DELETE FROM lagekarte WHERE "einsatzId" = ${testEinsatzDbId}
        `;

        // Delete test Einsatz
        await tx.$executeRaw`
          DELETE FROM einsaetze WHERE id = ${testEinsatzDbId}
        `;

        // Delete test User
        await tx.$executeRaw`
          DELETE FROM "User" WHERE id = ${testUserDbId}
        `;
      });
    } catch (error) {
      console.error('Cleanup failed:', error);
    } finally {
      await prisma.$disconnect();
    }
  });

  it('Lagekarte Create -> Success', async () => {
    // Given: Valid EinsatzId and UserId
    // When: Create Lagekarte aggregate
    const result = LagekarteAggregate.create(testEinsatzId, testUserId);

    // Then: Success
    expect(result.isSuccess).toBe(true);
    const lagekarte = result.value as LagekarteAggregate;
    expect(lagekarte).toBeDefined();
    expect(lagekarte.einsatzId.equals(testEinsatzId)).toBe(true);
    expect(lagekarte.pois).toHaveLength(0);

    // And: Save to database
    await repository.save(lagekarte);

    // And: Can be found by EinsatzId
    const found = await repository.findByEinsatzId(testEinsatzId);
    expect(found).not.toBeNull();
    if (!found) throw new Error('Lagekarte not found');
    expect(found.id.equals(lagekarte.id)).toBe(true);
  });

  it('POI Add -> Success', async () => {
    // Given: Existing Lagekarte
    const lagekarte = await repository.findByEinsatzId(testEinsatzId);
    expect(lagekarte).not.toBeNull();

    // And: Berlin MGRS coordinate
    const berlinMgrsResult = MgrsCoordinate.fromLatLng(52.52, 13.405, 5);
    expect(berlinMgrsResult.isSuccess).toBe(true);
    const berlinMgrs = berlinMgrsResult.value as MgrsCoordinate;

    // When: Add POI
    const poiResult = lagekarte!.addPoi('Einsatzstelle Berlin', berlinMgrs, PoiCategory.EINSATZSTELLE(), testUserId, 'Smoke Test POI');

    // Then: Success
    expect(poiResult.isSuccess).toBe(true);
    const poi = poiResult.value as Poi;
    expect(poi.name).toBe('Einsatzstelle Berlin');
    expect(poi.beschreibung).toBe('Smoke Test POI');
    expect(lagekarte!.pois).toHaveLength(1);

    // And: Save to database
    await repository.save(lagekarte!);

    // And: POI is persisted
    const reloaded = await repository.findByEinsatzId(testEinsatzId);
    expect(reloaded).not.toBeNull();
    expect(reloaded!.pois).toHaveLength(1);
    expect(reloaded!.pois[0].name).toBe('Einsatzstelle Berlin');
  });

  it('POI Remove -> Success', async () => {
    // Given: Lagekarte with POI
    const lagekarte = await repository.findByEinsatzId(testEinsatzId);
    expect(lagekarte).not.toBeNull();
    expect(lagekarte!.pois.length).toBeGreaterThan(0);

    const poiToRemove = lagekarte!.pois[0];
    const initialPoiCount = lagekarte!.pois.length;

    // When: Remove POI
    const result = lagekarte!.removePoi(poiToRemove.id, testUserId);

    // Then: Success
    expect(result.isSuccess).toBe(true);
    expect(lagekarte!.pois).toHaveLength(initialPoiCount - 1);

    // And: Save to database
    await repository.save(lagekarte!);

    // And: POI is removed from DB
    const reloaded = await repository.findByEinsatzId(testEinsatzId);
    expect(reloaded).not.toBeNull();
    expect(reloaded!.pois).toHaveLength(initialPoiCount - 1);
  });

  it('Lagekarte Query -> Success', async () => {
    // Given: Existing Lagekarte in DB

    // When: Query by EinsatzId
    const byEinsatzId = await repository.findByEinsatzId(testEinsatzId);

    // Then: Found
    expect(byEinsatzId).not.toBeNull();
    expect(byEinsatzId!.einsatzId.equals(testEinsatzId)).toBe(true);

    // And: Query by LagekarteId
    const byId = await repository.findById(byEinsatzId!.id);

    // Then: Found
    expect(byId).not.toBeNull();
    expect(byId!.id.equals(byEinsatzId!.id)).toBe(true);

    // And: Check exists
    const exists = await repository.exists(testEinsatzId);
    expect(exists).toBe(true);
  });

  it('MGRS Conversion -> Success', async () => {
    // Given: Berlin coordinates (Brandenburger Tor)
    const berlinLat = 52.52;
    const berlinLng = 13.405;

    // When: Convert Lat/Lng to MGRS
    const mgrsResult = MgrsCoordinate.fromLatLng(berlinLat, berlinLng, 5);

    // Then: Success
    expect(mgrsResult.isSuccess).toBe(true);
    const mgrs = mgrsResult.value as MgrsCoordinate;

    // And: Correct zone (Berlin = Zone 33U)
    expect(mgrs.gridZone).toBe('33U');
    expect(mgrs.value).toMatch(/^33U/);

    // And: Round-trip conversion works
    const geoCoord = mgrs.toLatLng();
    expect(geoCoord.latitude).toBeCloseTo(berlinLat, 2);
    expect(geoCoord.longitude).toBeCloseTo(berlinLng, 2);

    // And: GeoCoordinate can be created and converted
    const geoResult = GeoCoordinate.create(berlinLat, berlinLng);
    expect(geoResult.isSuccess).toBe(true);

    // And: Hamburg coordinates (for Zone 32U)
    const hamburgMgrs = MgrsCoordinate.fromLatLng(53.55, 10.0, 5);
    expect(hamburgMgrs.isSuccess).toBe(true);
    expect((hamburgMgrs.value as MgrsCoordinate).gridZone).toBe('32U');

    // And: Munich coordinates (Zone 32U - Southern Germany)
    const munichMgrs = MgrsCoordinate.fromLatLng(48.14, 11.58, 5);
    expect(munichMgrs.isSuccess).toBe(true);
    // Munich is in Zone 32U
    expect((munichMgrs.value as MgrsCoordinate).gridZone).toBe('32U');
  });
});
