/**
 * Performance Baseline Tests für PrismaLagekarteRepository.
 *
 * Diese Tests etablieren Performance-Baselines für kritische Lagekarte-Operationen.
 * Die gemessenen Werte dienen als Referenz für zukünftige Performance-Optimierungen
 * und Regression-Detection.
 *
 * **Test Strategy:**
 * - Real PostgreSQL Database (NICHT mocked, NICHT in-memory)
 * - performance.now() für präzise Zeitmessung
 * - Mehrere Iterationen pro Test (avg/min/max)
 * - Console-Ausgabe der Performance-Baselines am Ende
 *
 * **Performance Thresholds:**
 * - Write Operations: < 100ms
 * - Read Operations: < 50ms
 * - Existence Checks: < 10ms
 * - Full CRUD Cycle: < 500ms
 *
 * Story 2.3 Task 5 (Performance Baseline Tests)
 */

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
import { PrismaLagekarteRepository } from '../prisma-lagekarte.repository';
import { PrismaOutboxRepository } from '@/infrastructure/outbox/prisma-outbox.repository';
import { EventSerializer } from '@/infrastructure/outbox/event-serializer';
import { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { PoiCategory } from '@domain/value-objects/poi-category';
import type { PrismaService } from '@/prisma/prisma.service';

// Generate CUID2-compliant test IDs (20-30 chars, lowercase a-z0-9, starts with letter)
const generateTestId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'c';
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const prisma = new PrismaClient();

/**
 * Misst die Performance einer async Funktion über mehrere Iterationen.
 *
 * @param fn - Die zu messende Funktion
 * @param iterations - Anzahl der Iterationen (default: 10)
 * @returns Performance-Statistiken (avg, min, max in ms)
 */
const measurePerformance = async (fn: () => Promise<void>, iterations = 10): Promise<{ avg: number; min: number; max: number }> => {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }
  return {
    avg: times.reduce((a, b) => a + b) / times.length,
    min: Math.min(...times),
    max: Math.max(...times),
  };
};

// Speichert alle gemessenen Performance-Werte für Summary-Output
const performanceResults: Record<string, { avg: number; min: number; max: number; threshold: number }> = {};

describe('PrismaLagekarteRepository - Performance Baselines', () => {
  let repository: PrismaLagekarteRepository;
  let testUserId: string;
  let testEinsatzId: string;
  const testRunId = Date.now();

  // Helper: Erstellt einen Test-Einsatz für Lagekarte-Tests
  const createTestEinsatz = async (): Promise<string> => {
    const einsatz = await prisma.einsatz.create({
      data: {
        id: generateTestId(),
        alarmstichwort: `PERF-TEST-${testRunId}-${Date.now()}`,
        einsatzort: 'Performance Test Einsatzort',
        status: 'ANGELEGT',
        createdBy: testUserId,
        updatedBy: testUserId,
      },
      select: { id: true },
    });
    return einsatz.id;
  };

  // Helper: Generiert MGRS-Koordinate mit leichter Variation
  const generateMgrs = (index: number): MgrsCoordinate => {
    // Berlin-Koordinaten mit kleiner Variation pro Index
    const lat = 52.52 + index * 0.001;
    const lng = 13.4 + index * 0.001;
    return MgrsCoordinate.fromLatLng(lat, lng, 5).value as MgrsCoordinate;
  };

  /**
   * Setup: Erstellt System Test User + Test Einsatz für alle Performance Tests.
   */
  beforeAll(async () => {
    // Disable triggers temporarily für cleanup von vorherigen Test Runs
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      // Cleanup from previous failed test runs
      await prisma.$executeRawUnsafe('DELETE FROM lagekarte_poi WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe('DELETE FROM lagekarte WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe('DELETE FROM einsaetze WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE username LIKE 'test-lagekarte-perf-%'`);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }

    // Create test user
    const userResult = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "User" (id, username, "passwordHash", role, "isActive", "createdAt", "updatedAt")
      VALUES (
        ${generateTestId()},
        ${`test-lagekarte-perf-user-${testRunId}`},
        'dummy-hash',
        'USER',
        true,
        NOW(),
        NOW()
      )
      RETURNING id
    `;
    testUserId = userResult[0].id;

    // Create test Einsatz
    const einsatzResult = await prisma.einsatz.create({
      data: {
        id: generateTestId(),
        alarmstichwort: `TEST - Performance Baselines ${testRunId}`,
        einsatzort: 'Performance Test Einsatzort',
        status: 'ANGELEGT',
        createdBy: testUserId,
        updatedBy: testUserId,
      },
      select: { id: true },
    });
    testEinsatzId = einsatzResult.id;

    // Initialize Repository
    const prismaService = prisma as unknown as PrismaService;
    const eventSerializer = new EventSerializer();
    const outboxRepository = new PrismaOutboxRepository(prismaService, eventSerializer);
    repository = new PrismaLagekarteRepository(prismaService, outboxRepository);
  });

  /**
   * Cleanup nach jedem Test.
   */
  afterEach(async () => {
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      // Delete ALL test Lagekarten + POIs (from all test Einsätze)
      await prisma.$executeRawUnsafe('DELETE FROM lagekarte_poi WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe('DELETE FROM lagekarte WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      // Cleanup alle temporären Einsätze (außer Haupt-Test-Einsatz)
      await prisma.$executeRawUnsafe(`DELETE FROM einsaetze WHERE "createdAt" >= NOW() - INTERVAL '1 hour' AND id != $1`, testEinsatzId);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }
  });

  /**
   * Teardown: Cleanup + Performance Summary Output.
   */
  afterAll(async () => {
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      // Cleanup all test data
      await prisma.$executeRawUnsafe('DELETE FROM lagekarte_poi WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe('DELETE FROM lagekarte WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe('DELETE FROM einsaetze WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE username LIKE 'test-lagekarte-perf-%'`);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
      await prisma.$disconnect();
    }

    // Performance Summary Output
    console.log('\n📊 Performance Baselines:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Operation                           | Avg (ms)  | Min (ms)  | Max (ms)  | Threshold');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    for (const [name, result] of Object.entries(performanceResults)) {
      const status = result.avg <= result.threshold ? '✅' : '⚠️';
      console.log(`${status} ${name.padEnd(33)} | ${result.avg.toFixed(2).padStart(7)} | ${result.min.toFixed(2).padStart(7)} | ${result.max.toFixed(2).padStart(7)} | < ${result.threshold}ms`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  });

  // ========================================
  // TASK 5.2: WRITE OPERATION BASELINES
  // ========================================

  describe('Write Operation Baselines (Task 5.2)', () => {
    /**
     * Test: Create Lagekarte mit POI < 100ms
     */
    it('Create Lagekarte mit POI: < 100ms', async () => {
      const threshold = 100;

      const result = await measurePerformance(async () => {
        // Erstelle neuen Einsatz für jede Iteration (unique constraint)
        const einsatzId = await createTestEinsatz();
        const einsatzIdVO = EinsatzId.create(einsatzId).value as EinsatzId;
        const userIdVO = UserId.create(testUserId).value as UserId;

        // Erstelle Lagekarte mit 1 POI
        const aggregate = LagekarteAggregate.create(einsatzIdVO, userIdVO).value as LagekarteAggregate;
        aggregate.addPoi('Einsatzstelle', generateMgrs(0), PoiCategory.EINSATZSTELLE(), userIdVO);

        // Speichere
        await repository.save(aggregate);
      }, 10);

      performanceResults['Create Lagekarte + POI'] = { ...result, threshold };
      expect(result.avg).toBeLessThan(threshold);
    });

    /**
     * Test: Add POI < 50ms
     */
    it('Add POI: < 50ms', async () => {
      const threshold = 50;

      // Setup: Erstelle Lagekarte einmal
      const einsatzId = await createTestEinsatz();
      const einsatzIdVO = EinsatzId.create(einsatzId).value as EinsatzId;
      const userIdVO = UserId.create(testUserId).value as UserId;
      const aggregate = LagekarteAggregate.create(einsatzIdVO, userIdVO).value as LagekarteAggregate;
      await repository.save(aggregate);

      let poiCounter = 0;
      const result = await measurePerformance(async () => {
        // Lade existierende Lagekarte
        const loaded = await repository.findByEinsatzId(einsatzIdVO);
        if (!loaded) throw new Error('Lagekarte not found');

        // Füge neuen POI hinzu
        loaded.addPoi(`POI ${++poiCounter}`, generateMgrs(poiCounter), PoiCategory.BEREITSTELLUNGSRAUM(), userIdVO);

        // Speichere
        await repository.save(loaded);
      }, 10);

      performanceResults['Add POI'] = { ...result, threshold };
      expect(result.avg).toBeLessThan(threshold);
    });

    /**
     * Test: Update POI Position < 50ms
     */
    it('Update POI Position: < 50ms', async () => {
      const threshold = 50;

      // Setup: Erstelle Lagekarte mit POI
      const einsatzId = await createTestEinsatz();
      const einsatzIdVO = EinsatzId.create(einsatzId).value as EinsatzId;
      const userIdVO = UserId.create(testUserId).value as UserId;
      const aggregate = LagekarteAggregate.create(einsatzIdVO, userIdVO).value as LagekarteAggregate;
      const poiResult = aggregate.addPoi('Test POI', generateMgrs(0), PoiCategory.EINSATZSTELLE(), userIdVO);
      const poi = poiResult.value!;
      await repository.save(aggregate);

      let updateCounter = 0;
      const result = await measurePerformance(async () => {
        // Lade existierende Lagekarte
        const loaded = await repository.findByEinsatzId(einsatzIdVO);
        if (!loaded) throw new Error('Lagekarte not found');

        // Update Position
        const loadedPoi = loaded.pois.find((p) => p.id.equals(poi.id));
        if (!loadedPoi) throw new Error('POI not found');
        loaded.updatePoiPosition(loadedPoi.id, generateMgrs(++updateCounter), userIdVO);

        // Speichere
        await repository.save(loaded);
      }, 10);

      performanceResults['Update POI Position'] = { ...result, threshold };
      expect(result.avg).toBeLessThan(threshold);
    });

    /**
     * Test: Remove POI < 50ms
     */
    it('Remove POI: < 50ms', async () => {
      const threshold = 50;

      // Setup: Erstelle Lagekarte mit mehreren POIs
      const einsatzId = await createTestEinsatz();
      const einsatzIdVO = EinsatzId.create(einsatzId).value as EinsatzId;
      const userIdVO = UserId.create(testUserId).value as UserId;
      const aggregate = LagekarteAggregate.create(einsatzIdVO, userIdVO).value as LagekarteAggregate;

      // Füge 20 POIs hinzu (damit wir genug zum Entfernen haben)
      for (let i = 0; i < 20; i++) {
        aggregate.addPoi(`POI ${i}`, generateMgrs(i), PoiCategory.GEFAHRENSTELLE(), userIdVO);
      }
      await repository.save(aggregate);

      const result = await measurePerformance(async () => {
        // Lade existierende Lagekarte
        const loaded = await repository.findByEinsatzId(einsatzIdVO);
        if (!loaded) throw new Error('Lagekarte not found');
        if (loaded.pois.length === 0) throw new Error('No POIs to remove');

        // Entferne ersten POI
        const poiToRemove = loaded.pois[0];
        loaded.removePoi(poiToRemove.id, userIdVO);

        // Speichere
        await repository.save(loaded);
      }, 10);

      performanceResults['Remove POI'] = { ...result, threshold };
      expect(result.avg).toBeLessThan(threshold);
    });
  });

  // ========================================
  // TASK 5.3: READ OPERATION BASELINES
  // ========================================

  describe('Read Operation Baselines (Task 5.3)', () => {
    /**
     * Test: Load Lagekarte (1 POI) < 20ms
     */
    it('Load Lagekarte (1 POI): < 20ms', async () => {
      const threshold = 20;

      // Setup: Erstelle Lagekarte mit 1 POI
      const einsatzId = await createTestEinsatz();
      const einsatzIdVO = EinsatzId.create(einsatzId).value as EinsatzId;
      const userIdVO = UserId.create(testUserId).value as UserId;
      const aggregate = LagekarteAggregate.create(einsatzIdVO, userIdVO).value as LagekarteAggregate;
      aggregate.addPoi('Test POI', generateMgrs(0), PoiCategory.EINSATZSTELLE(), userIdVO);
      await repository.save(aggregate);

      const result = await measurePerformance(async () => {
        const loaded = await repository.findById(aggregate.id);
        if (!loaded) throw new Error('Lagekarte not found');
      }, 10);

      performanceResults['Load Lagekarte (1 POI)'] = { ...result, threshold };
      expect(result.avg).toBeLessThan(threshold);
    });

    /**
     * Test: Load Lagekarte (50 POIs) < 50ms
     */
    it('Load Lagekarte (50 POIs): < 50ms', async () => {
      const threshold = 50;

      // Setup: Erstelle Lagekarte mit 50 POIs
      const einsatzId = await createTestEinsatz();
      const einsatzIdVO = EinsatzId.create(einsatzId).value as EinsatzId;
      const userIdVO = UserId.create(testUserId).value as UserId;
      const aggregate = LagekarteAggregate.create(einsatzIdVO, userIdVO).value as LagekarteAggregate;

      for (let i = 0; i < 50; i++) {
        aggregate.addPoi(`POI ${i}`, generateMgrs(i), PoiCategory.EINSATZSTELLE(), userIdVO);
      }
      await repository.save(aggregate);

      const result = await measurePerformance(async () => {
        const loaded = await repository.findById(aggregate.id);
        if (!loaded) throw new Error('Lagekarte not found');
        if (loaded.pois.length !== 50) throw new Error(`Expected 50 POIs, got ${loaded.pois.length}`);
      }, 10);

      performanceResults['Load Lagekarte (50 POIs)'] = { ...result, threshold };
      expect(result.avg).toBeLessThan(threshold);
    });

    /**
     * Test: Query POIs by Category < 30ms
     */
    it('Query POIs by Category: < 30ms', async () => {
      const threshold = 30;

      // Setup: Erstelle Lagekarte mit POIs verschiedener Kategorien
      const einsatzId = await createTestEinsatz();
      const einsatzIdVO = EinsatzId.create(einsatzId).value as EinsatzId;
      const userIdVO = UserId.create(testUserId).value as UserId;
      const aggregate = LagekarteAggregate.create(einsatzIdVO, userIdVO).value as LagekarteAggregate;

      // 30 EINSATZSTELLE, 10 BEREITSTELLUNGSRAUM, 10 GEFAHRENSTELLE
      for (let i = 0; i < 30; i++) {
        aggregate.addPoi(`Einsatzstelle ${i}`, generateMgrs(i), PoiCategory.EINSATZSTELLE(), userIdVO);
      }
      for (let i = 0; i < 10; i++) {
        aggregate.addPoi(`Bereitstellung ${i}`, generateMgrs(30 + i), PoiCategory.BEREITSTELLUNGSRAUM(), userIdVO);
      }
      for (let i = 0; i < 10; i++) {
        aggregate.addPoi(`Gefahr ${i}`, generateMgrs(40 + i), PoiCategory.GEFAHRENSTELLE(), userIdVO);
      }
      await repository.save(aggregate);

      const result = await measurePerformance(async () => {
        // Lade Lagekarte + filter nach Kategorie
        const loaded = await repository.findById(aggregate.id);
        if (!loaded) throw new Error('Lagekarte not found');

        const einsatzstellen = loaded.findPoisByCategory(PoiCategory.EINSATZSTELLE());
        if (einsatzstellen.length !== 30) throw new Error(`Expected 30 EINSATZSTELLE, got ${einsatzstellen.length}`);
      }, 10);

      performanceResults['Query POIs by Category'] = { ...result, threshold };
      expect(result.avg).toBeLessThan(threshold);
    });

    /**
     * Test: Check Lagekarte Exists < 10ms
     */
    it('Check Lagekarte Exists: < 10ms', async () => {
      const threshold = 10;

      // Setup: Erstelle Lagekarte
      const einsatzId = await createTestEinsatz();
      const einsatzIdVO = EinsatzId.create(einsatzId).value as EinsatzId;
      const userIdVO = UserId.create(testUserId).value as UserId;
      const aggregate = LagekarteAggregate.create(einsatzIdVO, userIdVO).value as LagekarteAggregate;
      await repository.save(aggregate);

      const result = await measurePerformance(async () => {
        const exists = await repository.exists(einsatzIdVO);
        if (!exists) throw new Error('Lagekarte should exist');
      }, 10);

      performanceResults['Check Lagekarte Exists'] = { ...result, threshold };
      expect(result.avg).toBeLessThan(threshold);
    });
  });

  // ========================================
  // TASK 5.4: AGGREGATE PERFORMANCE BASELINE
  // ========================================

  describe('Aggregate Performance Baseline (Task 5.4)', () => {
    /**
     * Test: Full CRUD Cycle < 500ms
     *
     * Sequenz:
     * 1. Create Lagekarte
     * 2. Add 10 POIs
     * 3. Update 2 POI Positions
     * 4. Remove 5 POIs
     * 5. Load final state
     */
    it('Full CRUD Cycle: < 500ms', async () => {
      const threshold = 500;

      const result = await measurePerformance(async () => {
        // 1. Create Lagekarte
        const einsatzId = await createTestEinsatz();
        const einsatzIdVO = EinsatzId.create(einsatzId).value as EinsatzId;
        const userIdVO = UserId.create(testUserId).value as UserId;
        const aggregate = LagekarteAggregate.create(einsatzIdVO, userIdVO).value as LagekarteAggregate;
        await repository.save(aggregate);

        // 2. Add 10 POIs
        let loaded = await repository.findByEinsatzId(einsatzIdVO);
        if (!loaded) throw new Error('Lagekarte not found after create');

        for (let i = 0; i < 10; i++) {
          loaded.addPoi(`POI ${i}`, generateMgrs(i), PoiCategory.EINSATZSTELLE(), userIdVO);
        }
        await repository.save(loaded);

        // 3. Update 2 POI Positions
        loaded = await repository.findByEinsatzId(einsatzIdVO);
        if (!loaded) throw new Error('Lagekarte not found after add POIs');

        const poi1 = loaded.pois[0];
        const poi2 = loaded.pois[1];
        loaded.updatePoiPosition(poi1.id, generateMgrs(100), userIdVO);
        loaded.updatePoiPosition(poi2.id, generateMgrs(101), userIdVO);
        await repository.save(loaded);

        // 4. Remove 5 POIs
        loaded = await repository.findByEinsatzId(einsatzIdVO);
        if (!loaded) throw new Error('Lagekarte not found after update');

        for (let i = 0; i < 5; i++) {
          const poiToRemove = loaded.pois[0]; // Immer ersten entfernen
          loaded.removePoi(poiToRemove.id, userIdVO);
        }
        await repository.save(loaded);

        // 5. Load final state
        const finalState = await repository.findByEinsatzId(einsatzIdVO);
        if (!finalState) throw new Error('Lagekarte not found at end');
        if (finalState.pois.length !== 5) {
          throw new Error(`Expected 5 POIs at end, got ${finalState.pois.length}`);
        }
      }, 5); // Weniger Iterationen wegen langer Laufzeit

      performanceResults['Full CRUD Cycle'] = { ...result, threshold };
      expect(result.avg).toBeLessThan(threshold);
    });
  });
});
