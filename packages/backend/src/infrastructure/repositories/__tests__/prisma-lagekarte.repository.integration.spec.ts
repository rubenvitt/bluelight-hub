/**
 * Integration Tests für PrismaLagekarteRepository mit Real PostgreSQL Database (Story 2.3 Task 4).
 *
 * Diese Tests validieren den Prisma Adapter für ILagekarteRepository:
 * 1. save() - Upsert Pattern (CREATE + UPDATE idempotency)
 * 2. findById() - Lagekarte + eager-loaded POIs
 * 3. findByEinsatzId() - 1:1 Relation Query
 * 4. exists() - Efficient COUNT query
 * 5. Error Handling - FK Violations, Unique Constraints, MGRS Validation
 *
 * **Test Strategy:**
 * - Real PostgreSQL Database (NICHT mocked, NICHT in-memory)
 * - Given-When-Then BDD Style für maximale Lesbarkeit
 * - Cleanup mit Triggers disabled (SET session_replication_role = replica)
 * - Test User + Test Einsatz in beforeAll() erstellt
 * - afterEach() cleanup in reverse FK order (POI → Lagekarte → Einsatz)
 *
 * **Story Context:** .bmad-ephemeral/stories/2-3-lagekarte-infrastructure-prisma-repository-adapter.context.xml
 *
 * Epic 2 Story 2.3 | Task 4 (Integration Tests)
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
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { PoiCategory } from '@domain/value-objects/poi-category';
import type { PrismaService } from '@/infrastructure/database/prisma.service';

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

describe('PrismaLagekarteRepository - Integration Tests', () => {
  let repository: PrismaLagekarteRepository;
  let testUserId: string; // System User for createdBy/updatedBy references
  let testEinsatzId: string; // Test Einsatz for Lagekarte FK
  const testRunId = Date.now(); // Unique ID für diesen Test Run (verhindert Collisions)

  /**
   * Setup: Erstellt System Test User + Test Einsatz für alle Lagekarte Tests.
   *
   * **Warum beforeAll statt beforeEach:**
   * - User + Einsatz können für alle Tests wiederverwendet werden
   * - Performance: Weniger DB Roundtrips
   * - Cleanup ist einfacher (nur 1 User + Einsatz löschen)
   *
   * **Trigger Disable:**
   * - SET session_replication_role = replica (disables NO-DELETE triggers)
   * - Ermöglicht cleanup von Test-Daten ohne Compliance Violations
   * - Re-enabled in afterAll()
   */
  beforeAll(async () => {
    // Disable triggers temporarily für cleanup von vorherigen Test Runs
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      // Cleanup from previous failed test runs (last 1 hour)
      await prisma.$executeRawUnsafe('DELETE FROM lagekarte_poi WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe('DELETE FROM lagekarte WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe('DELETE FROM einsaetze WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE username LIKE 'test-lagekarte-repo-%'`);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }

    // Create test user for createdBy/updatedBy references
    const userResult = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "User" (id, username, "passwordHash", role, "isActive", "createdAt", "updatedAt")
      VALUES (
        ${generateTestId()},
        ${`test-lagekarte-repo-user-${testRunId}`},
        'dummy-hash',
        'USER',
        true,
        NOW(),
        NOW()
      )
      RETURNING id
    `;
    testUserId = userResult[0].id;

    // Create test Einsatz for Lagekarte FK
    const einsatzResult = await prisma.einsatz.create({
      data: {
        id: generateTestId(),
        alarmstichwort: `TEST - Lagekarte Repository ${testRunId}`,
        einsatzort: 'Test-Einsatzort für Lagekarte Repository Tests',
        status: 'ANGELEGT',
        createdBy: testUserId,
        updatedBy: testUserId,
      },
      select: { id: true },
    });
    testEinsatzId = einsatzResult.id;

    // Initialize Repository (mock PrismaService mit echtem PrismaClient)
    const prismaService = prisma as unknown as PrismaService;
    const eventSerializer = new EventSerializer();
    const outboxRepository = new PrismaOutboxRepository(prismaService, eventSerializer);
    repository = new PrismaLagekarteRepository(prismaService, outboxRepository);
  });

  /**
   * Cleanup nach jedem Test: Entfernt nur Lagekarte + POIs (nicht User + Einsatz).
   *
   * **Reihenfolge ist wichtig (CASCADE vs. Restrict):**
   * 1. LagekartePoi (FK zu Lagekarte, ON DELETE CASCADE)
   * 2. Lagekarte (FK zu Einsatz, ON DELETE CASCADE)
   *
   * **Warum Triggers disabled:**
   * - NO-DELETE Triggers blockieren cleanup (DRK Compliance)
   * - Triggers nur in Production relevant, nicht in Tests
   * - Re-enabled in afterAll()
   */
  afterEach(async () => {
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      // Delete test Lagekarten + POIs (only from this test run's Einsatz)
      await prisma.$executeRawUnsafe(
        `DELETE FROM lagekarte_poi WHERE "lagekarteId" IN (
          SELECT id FROM lagekarte WHERE "einsatzId" = $1
        )`,
        testEinsatzId,
      );
      await prisma.$executeRawUnsafe('DELETE FROM lagekarte WHERE "einsatzId" = $1', testEinsatzId);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }
  });

  /**
   * Teardown: Cleanup aller Test-Daten inkl. Test User + Einsatz.
   *
   * **Reihenfolge:**
   * 1. LagekartePoi (FK zu Lagekarte)
   * 2. Lagekarte (FK zu Einsatz)
   * 3. Einsatz (FK zu User)
   * 4. User (NO CASCADE, delete last)
   */
  afterAll(async () => {
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      // Delete test data (FK constraints respected)
      await prisma.$executeRawUnsafe(
        `DELETE FROM lagekarte_poi WHERE "lagekarteId" IN (
          SELECT id FROM lagekarte WHERE "einsatzId" = $1
        )`,
        testEinsatzId,
      );
      await prisma.$executeRawUnsafe('DELETE FROM lagekarte WHERE "einsatzId" = $1', testEinsatzId);
      await prisma.einsatz.delete({ where: { id: testEinsatzId } });
      await prisma.user.delete({ where: { id: testUserId } });
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
      await prisma.$disconnect();
    }
  });

  // ========================================
  // SAVE() TESTS (Upsert Pattern)
  // ========================================

  describe('save()', () => {
    /**
     * Test 1: Create new Lagekarte (INSERT operation)
     *
     * **Business Rule:** Lagekarte kann lazy-created werden (erst beim ersten POI)
     * **Pattern:** Upsert mit CREATE-Branch
     */
    it('should create new Lagekarte (INSERT operation)', async () => {
      // Given: Fresh aggregate with no POIs
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregateResult = LagekarteAggregate.create(einsatzId, userId);
      expect(aggregateResult.isSuccess).toBe(true);
      const aggregate = aggregateResult.value as LagekarteAggregate;

      // When: Save aggregate
      await repository.save(aggregate);

      // Then: Database has 1 Lagekarte row
      const count = await prisma.lagekarte.count({ where: { id: aggregate.id.value } });
      expect(count).toBe(1);

      // Verify: einsatzId FK correctly set
      const lagekarte = await prisma.lagekarte.findUnique({ where: { id: aggregate.id.value } });
      expect(lagekarte?.einsatzId).toBe(testEinsatzId);
    });

    /**
     * Test 2: Update existing Lagekarte (UPSERT idempotency)
     *
     * **Business Rule:** save() kann mehrfach aufgerufen werden (idempotent)
     * **Pattern:** Upsert mit UPDATE-Branch
     */
    it('should update existing Lagekarte (UPSERT idempotency)', async () => {
      // Given: Aggregate saved once
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = LagekarteAggregate.create(einsatzId, userId).value as LagekarteAggregate;
      await repository.save(aggregate);

      // When: Save same aggregate again
      await repository.save(aggregate);

      // Then: Still only 1 row (no duplicate)
      const count = await prisma.lagekarte.count({ where: { einsatzId: einsatzId.value } });
      expect(count).toBe(1);
    });

    /**
     * Test 3: Persist POI collection with correct order
     *
     * **Business Rule:** POI-Reihenfolge muss erhalten bleiben (UI-Konsistenz)
     * **Strategy:** CASCADE DELETE + CREATE (simplicity über delta tracking)
     */
    it('should persist POI collection with correct order', async () => {
      // Given: Aggregate with 3 POIs
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = LagekarteAggregate.create(einsatzId, userId).value as LagekarteAggregate;

      const mgrs1 = (MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate)!;
      const mgrs2 = (MgrsCoordinate.fromLatLng(52.53, 13.41, 5).value as MgrsCoordinate)!;
      const mgrs3 = (MgrsCoordinate.fromLatLng(52.54, 13.42, 5).value as MgrsCoordinate)!;

      aggregate.addPoi('POI 1', mgrs1, PoiCategory.EINSATZSTELLE(), userId);
      aggregate.addPoi('POI 2', mgrs2, PoiCategory.BEREITSTELLUNGSRAUM(), userId);
      aggregate.addPoi('POI 3', mgrs3, PoiCategory.GEFAHRENSTELLE(), userId);

      // When: Save aggregate
      await repository.save(aggregate);

      // Then: POIs in database preserve order (order by createdAt)
      const pois = await prisma.lagekartePoi.findMany({
        where: { lagekarteId: aggregate.id.value },
        orderBy: { createdAt: 'asc' },
      });
      expect(pois).toHaveLength(3);
      expect(pois[0].name).toBe('POI 1');
      expect(pois[1].name).toBe('POI 2');
      expect(pois[2].name).toBe('POI 3');
    });

    /**
     * Test 4: POI CASCADE DELETE/CREATE Strategy
     *
     * **Business Rule:** Update Lagekarte mit geänderten POIs
     * **Strategy:** DELETE all old POIs + CREATE all current POIs (simplicity)
     *
     * **NOTE:** Repository verwendet $executeRawUnsafe für POI DELETE (bypass NO-DELETE Trigger).
     * Das ist akzeptabel weil Repository die EINZIGE Stelle ist die POIs managed (Aggregate Boundary).
     */
    it('should delete old POIs and create new POIs (cascade strategy)', async () => {
      // Given: Aggregate with 2 POIs
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = LagekarteAggregate.create(einsatzId, userId).value as LagekarteAggregate;

      const mgrs1 = (MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate)!;
      const mgrs2 = (MgrsCoordinate.fromLatLng(52.53, 13.41, 5).value as MgrsCoordinate)!;

      const poi1Result = aggregate.addPoi('POI 1', mgrs1, PoiCategory.EINSATZSTELLE(), userId);
      const poi1 = poi1Result.value!;
      aggregate.addPoi('POI 2', mgrs2, PoiCategory.BEREITSTELLUNGSRAUM(), userId);

      await repository.save(aggregate);

      // When: Remove POI 1, aggregate now has only POI 2
      aggregate.removePoi(poi1.id, userId);
      await repository.save(aggregate);

      // Then: Database has only 1 POI
      const poisAfter = await prisma.lagekartePoi.findMany({
        where: { lagekarteId: aggregate.id.value },
      });
      expect(poisAfter).toHaveLength(1);
      expect(poisAfter[0].name).toBe('POI 2');
    });
  });

  // ========================================
  // FINDBYID() TESTS (Eager Loading)
  // ========================================

  describe('findById()', () => {
    /**
     * Test 5: Return aggregate with POIs when found
     *
     * **Business Rule:** Aggregate Consistency Boundary erfordert eager loading
     * **Pattern:** include: { pois: true } verhindert N+1 Queries
     */
    it('should return aggregate with POIs when found', async () => {
      // Given: Saved aggregate with 2 POIs
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = LagekarteAggregate.create(einsatzId, userId).value as LagekarteAggregate;

      const mgrs1 = (MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate)!;
      const mgrs2 = (MgrsCoordinate.fromLatLng(52.53, 13.41, 5).value as MgrsCoordinate)!;

      aggregate.addPoi('POI A', mgrs1, PoiCategory.EINSATZSTELLE(), userId);
      aggregate.addPoi('POI B', mgrs2, PoiCategory.BEREITSTELLUNGSRAUM(), userId);

      await repository.save(aggregate);

      // When: Find by ID
      const result = await repository.findById(aggregate.id);

      // Then: Returns correct aggregate with POIs
      expect(result).not.toBeNull();
      expect(result!.id.value).toBe(aggregate.id.value);
      expect(result!.einsatzId.value).toBe(testEinsatzId);
      expect(result!.pois).toHaveLength(2);
      expect(result!.pois[0].name).toBe('POI A');
      expect(result!.pois[1].name).toBe('POI B');
    });

    /**
     * Test 6: Return null when not found
     *
     * **Business Rule:** null Return (NICHT Exception) bei Not Found
     * **Rationale:** Caller muss explizit prüfen (Type-Safe null handling)
     */
    it('should return null when not found', async () => {
      // Given: Non-existing ID
      const fakeId = (LagekarteId.create(generateTestId()).value as LagekarteId)!;

      // When: Find by ID
      const result = await repository.findById(fakeId);

      // Then: Returns null (NOT error!)
      expect(result).toBeNull();
    });
  });

  // ========================================
  // FINDBYEINSATZID() TESTS (1:1 Relation)
  // ========================================

  describe('findByEinsatzId()', () => {
    /**
     * Test 7: Find Lagekarte by Einsatz relation
     *
     * **Business Rule:** Lagekarte hat 1:1 Beziehung zu Einsatz
     * **Performance:** Unique Index auf einsatzId für schnellen Lookup
     */
    it('should find Lagekarte by Einsatz relation', async () => {
      // Given: Saved aggregate
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = LagekarteAggregate.create(einsatzId, userId).value as LagekarteAggregate;
      await repository.save(aggregate);

      // When: Find by EinsatzId
      const result = await repository.findByEinsatzId(einsatzId);

      // Then: Returns correct aggregate
      expect(result).not.toBeNull();
      expect(result!.einsatzId.value).toBe(einsatzId.value);
      expect(result!.id.value).toBe(aggregate.id.value);
    });

    /**
     * Test 8: Return null when Einsatz has no Lagekarte
     *
     * **Business Rule:** Lagekarte ist optional für Einsatz (Lazy Creation)
     * **Use Case:** Caller erstellt Lagekarte wenn null
     */
    it('should return null when Einsatz has no Lagekarte', async () => {
      // Given: Create second test Einsatz without Lagekarte
      const einsatz2 = await prisma.einsatz.create({
        data: {
          id: generateTestId(),
          alarmstichwort: `TEST - No Lagekarte ${testRunId}`,
          status: 'ANGELEGT',
          createdBy: testUserId,
          updatedBy: testUserId,
        },
      });

      try {
        const fakeEinsatzId = (EinsatzId.create(einsatz2.id).value as EinsatzId)!;

        // When: Find by EinsatzId
        const result = await repository.findByEinsatzId(fakeEinsatzId);

        // Then: Returns null
        expect(result).toBeNull();
      } finally {
        // Cleanup: Delete second test Einsatz
        await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
        await prisma.einsatz.delete({ where: { id: einsatz2.id } });
        await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
      }
    });
  });

  // ========================================
  // EXISTS() TESTS (Efficient COUNT Query)
  // ========================================

  describe('exists()', () => {
    /**
     * Test 9: Return true when Lagekarte exists
     *
     * **Performance:** COUNT Query ohne Row Materialization
     * **Use Case:** Guard Clause in CreateLagekarteCommandHandler
     */
    it('should return true when Lagekarte exists', async () => {
      // Given: Saved aggregate
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = LagekarteAggregate.create(einsatzId, userId).value as LagekarteAggregate;
      await repository.save(aggregate);

      // When: Check exists
      const exists = await repository.exists(einsatzId);

      // Then: Returns true
      expect(exists).toBe(true);
    });

    /**
     * Test 10: Return false when Lagekarte does not exist
     *
     * **Use Case:** Lazy Creation Pattern - Caller erstellt Lagekarte wenn false
     */
    it('should return false when Lagekarte does not exist', async () => {
      // Given: Create second test Einsatz without Lagekarte
      const einsatz2 = await prisma.einsatz.create({
        data: {
          id: generateTestId(),
          alarmstichwort: `TEST - Exists Check ${testRunId}`,
          status: 'ANGELEGT',
          createdBy: testUserId,
          updatedBy: testUserId,
        },
      });

      try {
        const fakeEinsatzId = (EinsatzId.create(einsatz2.id).value as EinsatzId)!;

        // When: Check exists
        const exists = await repository.exists(fakeEinsatzId);

        // Then: Returns false
        expect(exists).toBe(false);
      } finally {
        // Cleanup
        await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
        await prisma.einsatz.delete({ where: { id: einsatz2.id } });
        await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
      }
    });
  });

  // ========================================
  // ROUND-TRIP TESTS (Data Integrity)
  // ========================================

  describe('Round-Trip Tests', () => {
    /**
     * Test 11: Preserve Aggregate data in save + findById
     *
     * **Business Rule:** Round-Trip Test für Mapper Correctness
     * **MGRS Tolerance:** ±11m (5-digit MGRS precision)
     */
    it('should preserve Aggregate data in save + findById', async () => {
      // Given: Aggregate with POIs + MGRS coordinates
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = LagekarteAggregate.create(einsatzId, userId).value as LagekarteAggregate;

      const berlinMgrs = (MgrsCoordinate.fromLatLng(52.52, 13.405, 5).value as MgrsCoordinate)!;
      aggregate.addPoi('Brandenburger Tor', berlinMgrs, PoiCategory.EINSATZSTELLE(), userId, 'Haupteinsatzort');

      // When: Save + retrieve
      await repository.save(aggregate);
      const retrieved = await repository.findById(aggregate.id);

      // Then: MGRS coordinates match (exact string comparison)
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id.value).toBe(aggregate.id.value);
      expect(retrieved!.pois[0].coordinate.value).toBe(berlinMgrs.value);
      expect(retrieved!.pois[0].name).toBe('Brandenburger Tor');
      expect(retrieved!.pois[0].beschreibung).toBe('Haupteinsatzort');
    });
  });

  // ========================================
  // ERROR HANDLING TESTS (AC 4)
  // ========================================

  describe('Error Handling', () => {
    /**
     * Test 12: Throw on unique constraint violation (duplicate einsatzId)
     *
     * **Business Rule:** Nur 1 Lagekarte pro Einsatz (UNIQUE Constraint)
     * **Error:** PrismaClientKnownRequestError Code P2002
     */
    it('should throw on unique constraint violation (duplicate einsatzId)', async () => {
      // Given: Two aggregates with SAME einsatzId
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate1 = LagekarteAggregate.create(einsatzId, userId).value as LagekarteAggregate;
      const aggregate2 = LagekarteAggregate.create(einsatzId, userId).value as LagekarteAggregate;

      await repository.save(aggregate1);

      // When/Then: Second save throws PrismaClientKnownRequestError
      // HINWEIS: Upsert verhindert eigentlich Duplicate - wir müssen manuell INSERT erzwingen
      // Stattdessen: Wir erstellen Lagekarte mit ANDERER ID aber GLEICHER einsatzId
      await expect(async () => {
        await prisma.lagekarte.create({
          data: {
            id: aggregate2.id.value, // Andere ID
            einsatzId: testEinsatzId, // Gleiche einsatzId → UNIQUE Violation
            state: {},
          },
        });
      }).rejects.toThrow(); // P2002 Unique Constraint Violation
    });

    /**
     * Test 13: Throw on foreign key violation (non-existing einsatzId)
     *
     * **Business Rule:** Lagekarte muss zu existierendem Einsatz gehören
     * **Error:** PrismaClientKnownRequestError Code P2003
     */
    it('should throw on foreign key violation (non-existing einsatzId)', async () => {
      // Given: Aggregate with non-existing einsatzId
      const fakeEinsatzId = (EinsatzId.create(generateTestId()).value as EinsatzId)!;
      const fakeUserId = UserId.create(testUserId).value as UserId;
      const aggregate = (LagekarteAggregate.create(fakeEinsatzId, fakeUserId).value as LagekarteAggregate)!;

      // When/Then: Save throws PrismaClientKnownRequestError (P2003 FK Violation)
      await expect(repository.save(aggregate)).rejects.toThrow();
    });

    /**
     * Test 14: Handle invalid MGRS format (mapper validation)
     *
     * **Business Rule:** Mapper muss invalid MGRS-Strings ablehnen
     * **Error:** MgrsCoordinate.fromString() gibt Result.fail() zurück
     */
    it('should handle invalid MGRS format (mapper validation)', async () => {
      // Given: Invalid MGRS string (direkt in DB geschrieben)
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = LagekarteAggregate.create(einsatzId, userId).value as LagekarteAggregate;
      await repository.save(aggregate);

      // Inject invalid MGRS POI direkt in DB (bypass Domain Layer Validation)
      await prisma.lagekartePoi.create({
        data: {
          id: generateTestId(),
          lagekarteId: aggregate.id.value,
          type: 'EINSATZORT',
          name: 'Invalid POI',
          mgrs: 'INVALID_MGRS_FORMAT', // ❌ Invalid!
          latitude: 52.52,
          longitude: 13.4,
        },
      });

      // When/Then: findById() throws validation error (Mapper rejects invalid MGRS)
      await expect(repository.findById(aggregate.id)).rejects.toThrow(/Failed to parse MGRS/);
    });
  });
});
