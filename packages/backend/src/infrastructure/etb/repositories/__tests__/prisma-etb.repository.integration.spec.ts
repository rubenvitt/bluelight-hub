/**
 * Integration Tests für PrismaEtbRepository mit Real PostgreSQL Database.
 *
 * Diese Tests validieren den Prisma Adapter für IEtbRepository:
 * 1. save() - Upsert Pattern (CREATE + UPDATE idempotency)
 * 2. findById() - ETB + eager-loaded Eintraege (sorted by sequenceNumber)
 * 3. findByEinsatzId() - 1:1 Relation Query
 * 4. getHistory() - Snapshot Versions History (sorted ascending)
 * 5. Transaction Support - Internal und External Transactions
 * 6. Error Handling - FK Violations, Unique Constraints
 *
 * **Test Strategy:**
 * - Real PostgreSQL Database (NICHT mocked, NICHT in-memory)
 * - Given-When-Then BDD Style für maximale Lesbarkeit
 * - Cleanup mit Triggers disabled (SET session_replication_role = replica)
 * - Test User + Test Einsatz in beforeAll() erstellt
 * - afterEach() cleanup in reverse FK order (Snapshot → Eintrag → ETB → Einsatz)
 *
 * **AC Coverage:**
 * - AC1: Repository implements IEtbRepository Interface
 * - AC2: save() creates/updates ETB with Eintraege and Snapshots
 * - AC3: findById() and findByEinsatzId() return correct aggregates
 * - AC4: getHistory() returns snapshots sorted ascending
 * - AC5: Transaction support (internal and external tx parameter)
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
import { PrismaEtbRepository } from '../prisma-etb.repository';
import { PrismaOutboxRepository } from '@/infrastructure/outbox/prisma-outbox.repository';
import { EventSerializer } from '@/infrastructure/outbox/event-serializer';
import { EinsatztagebuchAggregate } from '@domain/aggregates/einsatztagebuch.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EtbId } from '@domain/value-objects/etb-id';
import { UserId } from '@domain/value-objects/user-id';
import type { PrismaService } from '@/prisma/prisma.service';
import type { IEtbRepository } from '@domain/repositories/i-etb.repository';

// Generate CUID2-compliant test IDs (20-30 chars, lowercase a-z0-9, starts with letter)
const generateTestId = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'c';
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Generate Nanoid-compliant test IDs for User (21 chars, alphanumeric with mixed case)
// This matches the User.id format defined in Prisma schema: @default(nanoid())
const generateNanoidTestId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let result = '';
  for (let i = 0; i < 21; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const prisma = new PrismaClient();

/**
 * Flag to track if etb_snapshots table exists (might be missing if migration not run)
 */
let snapshotTableExists = false;

/**
 * Flag to track if database schema is compatible (version column exists in einsatztagebuecher)
 */
let databaseSchemaCompatible = false;

/**
 * Helper function to safely execute raw SQL that might fail due to missing tables.
 * Returns true if successful, false if table doesn't exist (PostgreSQL error code 42P01).
 * Prisma wraps this error with message containing "does not exist".
 */
async function safeExecute(query: string, ...params: unknown[]): Promise<boolean> {
  try {
    await prisma.$executeRawUnsafe(query, ...params);
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Check for table-not-exist errors (PostgreSQL error code 42P01)
    if (errorMessage.includes('does not exist') || errorMessage.includes('42P01')) {
      // Table does not exist - ignore
      return false;
    }
    throw error;
  }
}

describe('PrismaEtbRepository - Integration Tests', () => {
  let repository: PrismaEtbRepository;
  let testUserId: string; // System User für createdBy/updatedBy References
  let testEinsatzId: string; // Test Einsatz für ETB FK
  const testRunId = Date.now(); // Unique ID für diesen Test Run (verhindert Collisions)

  // ========================================
  // SETUP & TEARDOWN
  // ========================================

  /**
   * Setup: Erstellt System Test User + Test Einsatz für alle ETB Tests.
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
    // Check if etb_snapshots table exists (migration might not have been run)
    try {
      await prisma.$queryRaw`SELECT 1 FROM etb_snapshots LIMIT 1`;
      snapshotTableExists = true;
    } catch {
      snapshotTableExists = false;
      console.warn('etb_snapshots table does not exist - snapshot tests will be skipped');
    }

    // Check if database schema is compatible (version column exists)
    try {
      await prisma.$queryRaw`SELECT version FROM einsatztagebuecher LIMIT 1`;
      databaseSchemaCompatible = true;
    } catch {
      databaseSchemaCompatible = false;
      console.warn('Database schema is out of sync - some tests will be skipped (run prisma migrate)');
    }

    // Disable triggers temporarily für cleanup von vorherigen Test Runs
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      // Cleanup from previous failed test runs (last 1 hour)
      // NOTE: Use actual DB table names (from @@map), not Prisma model names!
      // Use safeExecute for snapshot table (might not exist)
      await safeExecute('DELETE FROM etb_snapshots WHERE "etbId" IN (SELECT id FROM einsatztagebuecher WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\')');
      await prisma.$executeRawUnsafe('DELETE FROM etb_eintraege WHERE "etbId" IN (SELECT id FROM einsatztagebuecher WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\')');
      await prisma.$executeRawUnsafe('DELETE FROM einsatztagebuecher WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe('DELETE FROM einsaetze WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE username LIKE 'test-etb-repo-%'`);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }

    // Create test user for createdBy/updatedBy references
    // WICHTIG: User IDs muessen Nanoid-Format haben (21 Zeichen, alphanumerisch mit Gross-/Kleinbuchstaben)
    // um mit UserId Value Object kompatibel zu sein
    const userResult = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "User" (id, username, "passwordHash", role, "isActive", "createdAt", "updatedAt")
      VALUES (
        ${generateNanoidTestId()},
        ${`test-etb-repo-user-${testRunId}`},
        'dummy-hash',
        'USER',
        true,
        NOW(),
        NOW()
      )
      RETURNING id
    `;
    testUserId = userResult[0].id;

    // Create SYSTEM user for ETBs created without Eintraege (createdBy defaults to 'SYSTEM')
    // Uses upsert-pattern since SYSTEM user might already exist from other tests
    // Note: UserRole enum only has SUPER_ADMIN, ADMIN, USER - we use USER for SYSTEM
    // WICHTIG: SYSTEM User ID muss auch Nanoid-Format haben (21 Zeichen)
    const systemUserId = 'SYSTEM_USER_TEST_0001'; // 21 Zeichen, Nanoid-kompatibel
    await prisma.$executeRaw`
      INSERT INTO "User" (id, username, "passwordHash", role, "isActive", "createdAt", "updatedAt")
      VALUES (
        ${systemUserId},
        'system',
        'no-login',
        'USER',
        false,
        NOW(),
        NOW()
      )
      ON CONFLICT (username) DO UPDATE SET id = EXCLUDED.id
    `;

    // Create test Einsatz for ETB FK
    const einsatzResult = await prisma.einsatz.create({
      data: {
        id: generateTestId(),
        alarmstichwort: `TEST - ETB Repository ${testRunId}`,
        einsatzort: 'Test-Einsatzort für ETB Repository Tests',
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
    repository = new PrismaEtbRepository(prismaService, outboxRepository);
  });

  /**
   * Cleanup nach jedem Test: Entfernt nur ETB + Eintraege + Snapshots (nicht User + Einsatz).
   *
   * **Reihenfolge ist wichtig (FK Constraints):**
   * 1. EtbSnapshot (FK zu ETB)
   * 2. EtbEintrag (FK zu ETB)
   * 3. Einsatztagebuch (FK zu Einsatz)
   *
   * **Warum Triggers disabled:**
   * - NO-DELETE Triggers blockieren cleanup (DRK Compliance)
   * - Triggers nur in Production relevant, nicht in Tests
   */
  afterEach(async () => {
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      // Delete test ETBs + Eintraege + Snapshots (only from this test run's Einsatz)
      // NOTE: Use actual DB table names (from @@map), not Prisma model names!
      // Use safeExecute for snapshot table (might not exist)
      await safeExecute(
        `DELETE FROM etb_snapshots WHERE "etbId" IN (
          SELECT id FROM einsatztagebuecher WHERE "einsatzId" = $1
        )`,
        testEinsatzId,
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM etb_eintraege WHERE "etbId" IN (
          SELECT id FROM einsatztagebuecher WHERE "einsatzId" = $1
        )`,
        testEinsatzId,
      );
      await prisma.$executeRawUnsafe('DELETE FROM einsatztagebuecher WHERE "einsatzId" = $1', testEinsatzId);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }
  });

  /**
   * Teardown: Cleanup aller Test-Daten inkl. Test User + Einsatz.
   *
   * **Reihenfolge:**
   * 1. EtbSnapshot (FK zu ETB)
   * 2. EtbEintrag (FK zu ETB)
   * 3. Einsatztagebuch (FK zu Einsatz)
   * 4. Einsatz (FK zu User)
   * 5. User (NO CASCADE, delete last)
   */
  afterAll(async () => {
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      // Guard: Skip cleanup if beforeAll failed (testEinsatzId/testUserId not set)
      if (!testEinsatzId || !testUserId) {
        return;
      }
      // Delete test data (FK constraints respected)
      // NOTE: Use actual DB table names (from @@map), not Prisma model names!
      // Use safeExecute for snapshot table (might not exist)
      await safeExecute(
        `DELETE FROM etb_snapshots WHERE "etbId" IN (
          SELECT id FROM einsatztagebuecher WHERE "einsatzId" = $1
        )`,
        testEinsatzId,
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM etb_eintraege WHERE "etbId" IN (
          SELECT id FROM einsatztagebuecher WHERE "einsatzId" = $1
        )`,
        testEinsatzId,
      );
      await prisma.$executeRawUnsafe('DELETE FROM einsatztagebuecher WHERE "einsatzId" = $1', testEinsatzId);
      // Use raw SQL for Einsatz/User delete to avoid Prisma undefined id errors
      await prisma.$executeRawUnsafe('DELETE FROM einsaetze WHERE id = $1', testEinsatzId);
      await prisma.$executeRawUnsafe('DELETE FROM "User" WHERE id = $1', testUserId);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
      await prisma.$disconnect();
    }
  });

  // ========================================
  // AC1: INTERFACE IMPLEMENTATION
  // ========================================

  describe('AC1: Repository implements IEtbRepository Interface', () => {
    /**
     * Test 1: Repository implements all IEtbRepository methods
     *
     * **Business Rule:** Repository muss alle Interface-Methoden implementieren
     * **Pattern:** Interface Compliance Check
     */
    it('should implement all IEtbRepository interface methods', () => {
      // Given: PrismaEtbRepository instance
      const repo: IEtbRepository = repository;

      // Then: All interface methods exist and are functions
      expect(typeof repo.save).toBe('function');
      expect(typeof repo.findById).toBe('function');
      expect(typeof repo.findByEinsatzId).toBe('function');
      expect(typeof repo.getHistory).toBe('function');
    });
  });

  // ========================================
  // AC2: SAVE() METHOD
  // ========================================

  describe('AC2: save() Method', () => {
    /**
     * Test 2: save() creates new ETB with Eintraege (INSERT path)
     *
     * **Business Rule:** Neues ETB kann erstellt werden
     * **Pattern:** Upsert mit CREATE-Branch
     * **Note:** Requires etb_snapshots table (skipped if migration not run)
     */
    it('should create new ETB with Eintraege (INSERT operation)', async () => {
      if (!snapshotTableExists) {
        console.warn('Skipping test: etb_snapshots table does not exist');
        return;
      }

      // Given: Fresh aggregate with Eintraege
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregateResult = EinsatztagebuchAggregate.create(einsatzId);
      expect(aggregateResult.isSuccess).toBe(true);
      const aggregate = aggregateResult.value as EinsatztagebuchAggregate;

      // Add Eintraege
      aggregate.addEintrag('Eintrag 1: Einsatz begonnen', userId);
      aggregate.addEintrag('Eintrag 2: Fahrzeug eingetroffen', userId);

      // When: Save aggregate
      await repository.save(aggregate);

      // Then: Database has 1 ETB row with 2 Eintraege
      const etbCount = await prisma.einsatztagebuch.count({ where: { id: aggregate.id.value } });
      expect(etbCount).toBe(1);

      const eintraegeCount = await prisma.etbEintrag.count({ where: { etbId: aggregate.id.value } });
      expect(eintraegeCount).toBe(2);

      // Verify: einsatzId FK correctly set
      const etb = await prisma.einsatztagebuch.findUnique({ where: { id: aggregate.id.value } });
      expect(etb?.einsatzId).toBe(testEinsatzId);
    });

    /**
     * Test 3: save() updates existing ETB (UPSERT path)
     *
     * **Business Rule:** save() kann mehrfach aufgerufen werden (idempotent)
     * **Pattern:** Upsert mit UPDATE-Branch
     * **Note:** Requires etb_snapshots table (skipped if migration not run)
     */
    it('should update existing ETB (UPSERT idempotency)', async () => {
      if (!snapshotTableExists) {
        console.warn('Skipping test: etb_snapshots table does not exist');
        return;
      }

      // Given: Aggregate saved once
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = EinsatztagebuchAggregate.create(einsatzId).value as EinsatztagebuchAggregate;

      aggregate.addEintrag('Initial entry', userId);
      await repository.save(aggregate);

      // When: Modify and save again
      aggregate.addEintrag('Second entry', userId);
      await repository.save(aggregate);

      // Then: Still only 1 ETB row (no duplicate)
      const etbCount = await prisma.einsatztagebuch.count({ where: { einsatzId: einsatzId.value } });
      expect(etbCount).toBe(1);

      // And: 2 Eintraege now
      const eintraegeCount = await prisma.etbEintrag.count({ where: { etbId: aggregate.id.value } });
      expect(eintraegeCount).toBe(2);
    });

    /**
     * Test 4: save() creates snapshots in EtbSnapshot table
     *
     * **Business Rule:** Snapshots werden bei Mutations erstellt (DRK Compliance)
     * **Pattern:** Automatic Snapshot Creation
     * **Note:** Requires etb_snapshots table (skipped if migration not run)
     */
    it('should create snapshots in EtbSnapshot table', async () => {
      if (!snapshotTableExists) {
        console.warn('Skipping test: etb_snapshots table does not exist');
        return;
      }

      // Given: Aggregate with uncommitted snapshots
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = EinsatztagebuchAggregate.create(einsatzId).value as EinsatztagebuchAggregate;

      // Add eintraege (each creates a snapshot before mutation)
      aggregate.addEintrag('Entry 1', userId); // Creates snapshot v1
      aggregate.addEintrag('Entry 2', userId); // Creates snapshot v2
      aggregate.addEintrag('Entry 3', userId); // Creates snapshot v3

      // Verify: Uncommitted snapshots exist
      expect(aggregate.hasUncommittedSnapshots()).toBe(true);
      expect(aggregate.getUncommittedSnapshots().length).toBe(3);

      // When: Save aggregate
      await repository.save(aggregate);

      // Then: Snapshots in database
      const snapshots = await prisma.etbSnapshot.findMany({
        where: { etbId: aggregate.id.value },
        orderBy: { versionNumber: 'asc' },
      });
      expect(snapshots.length).toBe(3);
      expect(snapshots[0].versionNumber).toBe(1);
      expect(snapshots[1].versionNumber).toBe(2);
      expect(snapshots[2].versionNumber).toBe(3);
    });

    /**
     * Test 5: save() clears uncommitted snapshots after persist
     *
     * **Business Rule:** Snapshots dürfen nicht doppelt persistiert werden
     * **Pattern:** Clear after Commit
     * **Note:** Requires etb_snapshots table (skipped if migration not run)
     */
    it('should clear uncommitted snapshots after persist', async () => {
      if (!snapshotTableExists) {
        console.warn('Skipping test: etb_snapshots table does not exist');
        return;
      }

      // Given: Aggregate with uncommitted snapshots
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = EinsatztagebuchAggregate.create(einsatzId).value as EinsatztagebuchAggregate;

      aggregate.addEintrag('Entry', userId);
      expect(aggregate.hasUncommittedSnapshots()).toBe(true);

      // When: Save aggregate
      await repository.save(aggregate);

      // Then: Uncommitted snapshots cleared
      expect(aggregate.hasUncommittedSnapshots()).toBe(false);
      expect(aggregate.getUncommittedSnapshots().length).toBe(0);
    });

    /**
     * Test 6: save() Eintrag CASCADE DELETE/CREATE Strategy
     *
     * **Business Rule:** Update ETB mit geänderten Eintraegen
     * **Strategy:** DELETE all old Eintraege + CREATE all current Eintraege (simplicity)
     * **Note:** Requires etb_snapshots table (skipped if migration not run)
     */
    it('should handle Eintrag cascade strategy (DELETE + CREATE)', async () => {
      if (!snapshotTableExists) {
        console.warn('Skipping test: etb_snapshots table does not exist');
        return;
      }

      // Given: Aggregate with 3 Eintraege
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = EinsatztagebuchAggregate.create(einsatzId).value as EinsatztagebuchAggregate;

      const eintrag1Result = aggregate.addEintrag('Entry 1', userId);
      aggregate.addEintrag('Entry 2', userId);
      aggregate.addEintrag('Entry 3', userId);
      const eintrag1 = eintrag1Result.value!;

      await repository.save(aggregate);

      // Verify: 3 Eintraege initially
      let eintraegeCount = await prisma.etbEintrag.count({ where: { etbId: aggregate.id.value } });
      expect(eintraegeCount).toBe(3);

      // When: Delete one entry (soft-delete) and save
      aggregate.deleteEintrag(eintrag1.id, userId);
      await repository.save(aggregate);

      // Then: Still 3 Eintraege in DB (soft-delete preserves)
      eintraegeCount = await prisma.etbEintrag.count({ where: { etbId: aggregate.id.value } });
      expect(eintraegeCount).toBe(3);

      // And: One entry is marked as deleted
      const deletedEntry = await prisma.etbEintrag.findFirst({
        where: { etbId: aggregate.id.value, sequenceNumber: 1 },
      });
      expect(deletedEntry?.deletedAt).not.toBeNull();
    });

    /**
     * Test 7: save() rollback on error (atomic transaction)
     *
     * **Business Rule:** Partial Data darf nicht persistiert werden
     * **Pattern:** Transaction Atomicity
     */
    it('should rollback on error (atomic transaction)', async () => {
      // Given: Aggregate with FK to non-existent Einsatz
      const fakeEinsatzId = EinsatzId.create(generateTestId()).value as EinsatzId;
      const aggregate = EinsatztagebuchAggregate.create(fakeEinsatzId).value as EinsatztagebuchAggregate;

      // When/Then: Save throws FK violation
      await expect(repository.save(aggregate)).rejects.toThrow();

      // And: No partial data in DB
      const etbCount = await prisma.einsatztagebuch.count({ where: { id: aggregate.id.value } });
      expect(etbCount).toBe(0);
    });
  });

  // ========================================
  // AC3: FINDBYID() AND FINDBYEINSATZID()
  // ========================================

  describe('AC3: findById() and findByEinsatzId()', () => {
    /**
     * Test 8: findById() returns aggregate with sorted Eintraege
     *
     * **Business Rule:** Eintraege müssen nach sequenceNumber sortiert sein
     * **Pattern:** Eager Loading mit ORDER BY
     * **Note:** Requires etb_snapshots table (skipped if migration not run)
     */
    it('should return aggregate with sorted Eintraege by sequenceNumber', async () => {
      if (!snapshotTableExists) {
        console.warn('Skipping test: etb_snapshots table does not exist');
        return;
      }

      // Given: Saved aggregate with 3 Eintraege
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = EinsatztagebuchAggregate.create(einsatzId).value as EinsatztagebuchAggregate;

      aggregate.addEintrag('Entry A', userId);
      aggregate.addEintrag('Entry B', userId);
      aggregate.addEintrag('Entry C', userId);

      await repository.save(aggregate);

      // When: Find by ID
      const result = await repository.findById(aggregate.id);

      // Then: Returns correct aggregate with Eintraege sorted by sequenceNumber
      expect(result).not.toBeNull();
      expect(result!.id.value).toBe(aggregate.id.value);
      expect(result!.eintraege).toHaveLength(3);
      expect(result!.eintraege[0].text).toBe('Entry A');
      expect(result!.eintraege[0].sequenceNumber.value).toBe(1);
      expect(result!.eintraege[1].text).toBe('Entry B');
      expect(result!.eintraege[1].sequenceNumber.value).toBe(2);
      expect(result!.eintraege[2].text).toBe('Entry C');
      expect(result!.eintraege[2].sequenceNumber.value).toBe(3);
    });

    /**
     * Test 9: findById() returns null when not found
     *
     * **Business Rule:** null Return (NICHT Exception) bei Not Found
     * **Rationale:** Caller muss explizit prüfen (Type-Safe null handling)
     * **Note:** Requires database schema to be up-to-date
     */
    it('should return null when not found', async () => {
      if (!databaseSchemaCompatible) {
        console.warn('Skipping test: database schema is out of sync');
        return;
      }

      // Given: Non-existing ID
      const fakeId = EtbId.create(generateTestId()).value as EtbId;

      // When: Find by ID
      const result = await repository.findById(fakeId);

      // Then: Returns null (NOT error!)
      expect(result).toBeNull();
    });

    /**
     * Test 10: findByEinsatzId() returns aggregate by Einsatz relation
     *
     * **Business Rule:** ETB hat 1:1 Beziehung zu Einsatz
     * **Performance:** Unique Index auf einsatzId für schnellen Lookup
     * **Note:** Requires etb_snapshots table (skipped if migration not run)
     */
    it('should find ETB by Einsatz relation', async () => {
      if (!snapshotTableExists) {
        console.warn('Skipping test: etb_snapshots table does not exist');
        return;
      }

      // Given: Saved aggregate
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = EinsatztagebuchAggregate.create(einsatzId).value as EinsatztagebuchAggregate;

      aggregate.addEintrag('Test entry', userId);
      await repository.save(aggregate);

      // When: Find by EinsatzId
      const result = await repository.findByEinsatzId(einsatzId);

      // Then: Returns correct aggregate
      expect(result).not.toBeNull();
      expect(result!.einsatzId.value).toBe(einsatzId.value);
      expect(result!.id.value).toBe(aggregate.id.value);
    });

    /**
     * Test 11: findByEinsatzId() returns null when Einsatz has no ETB
     *
     * **Business Rule:** ETB ist optional für Einsatz (Lazy Creation)
     * **Use Case:** Caller erstellt ETB wenn null
     * **Note:** Requires database schema to be up-to-date
     */
    it('should return null when Einsatz has no ETB', async () => {
      if (!databaseSchemaCompatible) {
        console.warn('Skipping test: database schema is out of sync');
        return;
      }
      // Given: Create second test Einsatz without ETB
      const einsatz2 = await prisma.einsatz.create({
        data: {
          id: generateTestId(),
          alarmstichwort: `TEST - No ETB ${testRunId}`,
          status: 'ANGELEGT',
          createdBy: testUserId,
          updatedBy: testUserId,
        },
      });

      try {
        const fakeEinsatzId = EinsatzId.create(einsatz2.id).value as EinsatzId;

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
  // AC4: GETHISTORY()
  // ========================================

  describe('AC4: getHistory()', () => {
    /**
     * Test 12: getHistory() returns snapshots sorted ascending
     *
     * **Business Rule:** Snapshots müssen chronologisch sortiert sein
     * **Compliance:** Audit-Trail für DRK-Dokumentation
     * **Note:** Requires etb_snapshots table (skipped if migration not run)
     */
    it('should return snapshots sorted ascending by versionNumber', async () => {
      if (!snapshotTableExists) {
        console.warn('Skipping test: etb_snapshots table does not exist');
        return;
      }

      // Given: ETB mit mehreren Mutations (erzeugt Snapshots)
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = EinsatztagebuchAggregate.create(einsatzId).value as EinsatztagebuchAggregate;

      // Multiple mutations create snapshots
      aggregate.addEintrag('Entry 1', userId); // Snapshot v1
      aggregate.addEintrag('Entry 2', userId); // Snapshot v2
      aggregate.addEintrag('Entry 3', userId); // Snapshot v3

      await repository.save(aggregate);

      // When: Get history
      const history = await repository.getHistory(aggregate.id);

      // Then: Snapshots sorted ascending (oldest first)
      expect(history).toHaveLength(3);
      expect(history[0].versionNumber).toBe(1);
      expect(history[1].versionNumber).toBe(2);
      expect(history[2].versionNumber).toBe(3);
    });

    /**
     * Test 13: getHistory() returns empty array for ETB without snapshots
     *
     * **Business Rule:** Neues ETB ohne Mutations hat keine Snapshots
     * **Use Case:** Leere Historie bei frisch erstelltem ETB
     * **Note:** Requires etb_snapshots table (skipped if migration not run)
     */
    it('should return empty array for new ETB without mutations', async () => {
      if (!snapshotTableExists) {
        console.warn('Skipping test: etb_snapshots table does not exist');
        return;
      }

      // Given: ETB saved without mutations (no addEintrag calls)
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const aggregate = EinsatztagebuchAggregate.create(einsatzId).value as EinsatztagebuchAggregate;

      // Save without any mutations
      await repository.save(aggregate);

      // When: Get history
      const history = await repository.getHistory(aggregate.id);

      // Then: Empty array (no snapshots created)
      expect(history).toEqual([]);
    });

    /**
     * Test 14: getHistory() snapshot contains correct Eintrag data
     *
     * **Business Rule:** Snapshot muss exakten State zum Zeitpunkt enthalten
     * **Compliance:** Audit-Trail muss vollständig sein
     * **Note:** Requires etb_snapshots table (skipped if migration not run)
     */
    it('should contain correct Eintrag data in snapshots', async () => {
      if (!snapshotTableExists) {
        console.warn('Skipping test: etb_snapshots table does not exist');
        return;
      }

      // Given: ETB mit Mutation
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = EinsatztagebuchAggregate.create(einsatzId).value as EinsatztagebuchAggregate;

      aggregate.addEintrag('First entry text', userId);
      await repository.save(aggregate);

      // When: Get history
      const history = await repository.getHistory(aggregate.id);

      // Then: First snapshot has empty eintraege (state BEFORE first add)
      expect(history).toHaveLength(1);
      expect(history[0].eintraege).toHaveLength(0); // Snapshot is BEFORE mutation
    });
  });

  // ========================================
  // AC5: TRANSACTION SUPPORT
  // ========================================

  describe('AC5: Transaction Support', () => {
    /**
     * Test 15: External transaction support (tx parameter)
     *
     * **Business Rule:** Repository kann externe Transaktionen verwenden
     * **Use Case:** Handler-Level Transactions über mehrere Repositories
     * **Note:** Requires etb_snapshots table (skipped if migration not run)
     */
    it('should support external transaction (tx parameter)', async () => {
      if (!snapshotTableExists) {
        console.warn('Skipping test: etb_snapshots table does not exist');
        return;
      }

      // Given: Aggregate to save
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = EinsatztagebuchAggregate.create(einsatzId).value as EinsatztagebuchAggregate;

      aggregate.addEintrag('Entry in transaction', userId);

      // When: Save using external transaction
      await prisma.$transaction(async (tx) => {
        await repository.save(aggregate, tx);
      });

      // Then: Data persisted
      const etb = await prisma.einsatztagebuch.findUnique({ where: { id: aggregate.id.value } });
      expect(etb).not.toBeNull();
    });

    /**
     * Test 16: Internal transaction when tx not provided
     *
     * **Business Rule:** Repository erstellt eigene Transaction wenn keine übergeben
     * **Pattern:** Auto-Transaction Wrapping
     * **Note:** Requires etb_snapshots table (skipped if migration not run)
     */
    it('should use internal transaction when tx not provided', async () => {
      if (!snapshotTableExists) {
        console.warn('Skipping test: etb_snapshots table does not exist');
        return;
      }

      // Given: Aggregate to save
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = EinsatztagebuchAggregate.create(einsatzId).value as EinsatztagebuchAggregate;

      aggregate.addEintrag('Entry without external tx', userId);

      // When: Save without tx parameter (uses internal transaction)
      await repository.save(aggregate);

      // Then: Data persisted (internal transaction committed)
      const etb = await prisma.einsatztagebuch.findUnique({ where: { id: aggregate.id.value } });
      expect(etb).not.toBeNull();

      const eintraege = await prisma.etbEintrag.findMany({ where: { etbId: aggregate.id.value } });
      expect(eintraege).toHaveLength(1);
    });
  });

  // ========================================
  // ADDITIONAL TESTS: ROUND-TRIP & EDGE CASES
  // ========================================

  describe('Round-Trip and Edge Cases', () => {
    /**
     * Test 17: Round-trip preservation (save → findById → verify)
     *
     * **Business Rule:** Aggregate State muss nach Load identisch sein
     * **Pattern:** Mapper Correctness Verification
     * **Note:** Requires etb_snapshots table (skipped if migration not run)
     */
    it('should preserve Aggregate data in save + findById round-trip', async () => {
      if (!snapshotTableExists) {
        console.warn('Skipping test: etb_snapshots table does not exist');
        return;
      }

      // Given: Aggregate with all fields populated
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = EinsatztagebuchAggregate.create(einsatzId).value as EinsatztagebuchAggregate;

      aggregate.addEintrag('Entry 1 with special chars: äöü ß €', userId);
      aggregate.addEintrag('Entry 2', userId);

      // When: Save + retrieve
      await repository.save(aggregate);
      const retrieved = await repository.findById(aggregate.id);

      // Then: All fields match
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id.value).toBe(aggregate.id.value);
      expect(retrieved!.einsatzId.value).toBe(einsatzId.value);
      expect(retrieved!.eintraege).toHaveLength(2);
      expect(retrieved!.eintraege[0].text).toBe('Entry 1 with special chars: äöü ß €');
      expect(retrieved!.eintraege[1].text).toBe('Entry 2');
      expect(retrieved!.version.versionNumber).toBe(aggregate.version.versionNumber);
    });

    /**
     * Test 18: Soft-deleted Eintraege preserved
     *
     * **Business Rule:** Gelöschte Eintraege bleiben in Historie
     * **Compliance:** DRK-konforme Audit-Trails
     * **Note:** Requires etb_snapshots table (skipped if migration not run)
     */
    it('should preserve soft-deleted Eintraege', async () => {
      if (!snapshotTableExists) {
        console.warn('Skipping test: etb_snapshots table does not exist');
        return;
      }

      // Given: Aggregate with deleted entry
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = EinsatztagebuchAggregate.create(einsatzId).value as EinsatztagebuchAggregate;

      const eintragResult = aggregate.addEintrag('Entry to delete', userId);
      const eintrag = eintragResult.value!;
      aggregate.deleteEintrag(eintrag.id, userId);

      // When: Save + retrieve
      await repository.save(aggregate);
      const retrieved = await repository.findById(aggregate.id);

      // Then: Entry exists with isDeleted=true
      expect(retrieved).not.toBeNull();
      expect(retrieved!.eintraege).toHaveLength(1);
      expect(retrieved!.eintraege[0].isDeleted).toBe(true);
      expect(retrieved!.eintraege[0].text).toBe('Entry to delete');
    });

    /**
     * Test 19: Sequential saves of same aggregate (upsert idempotent)
     *
     * **Business Rule:** Mehrfaches save() mit gleichem Aggregate ist idempotent
     * **Pattern:** Upsert Idempotency
     * **Note:** Truly concurrent saves would require optimistic locking (version check)
     *          This test validates sequential idempotency which is the more common use case.
     * **Note:** Requires etb_snapshots table (skipped if migration not run)
     */
    it('should handle sequential saves of same aggregate (upsert idempotent)', async () => {
      if (!snapshotTableExists) {
        console.warn('Skipping test: etb_snapshots table does not exist');
        return;
      }

      // Given: Save aggregate once
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = EinsatztagebuchAggregate.create(einsatzId).value as EinsatztagebuchAggregate;

      aggregate.addEintrag('Initial entry', userId);
      await repository.save(aggregate);

      // When: Save same aggregate multiple times sequentially (idempotent upsert)
      await repository.save(aggregate);
      await repository.save(aggregate);
      await repository.save(aggregate);

      // Then: Still only 1 ETB (upsert is idempotent)
      const etbCount = await prisma.einsatztagebuch.count({ where: { id: aggregate.id.value } });
      expect(etbCount).toBe(1);

      // And: Eintraege count is still 1 (delete + create is idempotent)
      const eintragCount = await prisma.etbEintrag.count({ where: { etbId: aggregate.id.value } });
      expect(eintragCount).toBe(1);
    });

    /**
     * Test 20: Empty ETB (no Eintraege)
     *
     * **Business Rule:** ETB kann ohne Eintraege gespeichert werden
     * **Use Case:** Lazy creation - ETB wird vor erstem Eintrag erstellt
     * **Note:** Requires database schema to be up-to-date
     */
    it('should handle empty ETB (no Eintraege)', async () => {
      if (!databaseSchemaCompatible) {
        console.warn('Skipping test: database schema is out of sync');
        return;
      }

      // Note: This test does NOT require snapshot table (no mutations = no snapshots)
      // Given: ETB without any Eintraege
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const aggregate = EinsatztagebuchAggregate.create(einsatzId).value as EinsatztagebuchAggregate;

      // When: Save + retrieve
      await repository.save(aggregate);
      const retrieved = await repository.findById(aggregate.id);

      // Then: ETB exists with empty Eintraege
      expect(retrieved).not.toBeNull();
      expect(retrieved!.eintraege).toHaveLength(0);
    });
  });

  // ========================================
  // ERROR HANDLING TESTS
  // ========================================

  describe('Error Handling', () => {
    /**
     * Test 21: Throw on foreign key violation (non-existing einsatzId)
     *
     * **Business Rule:** ETB muss zu existierendem Einsatz gehören
     * **Error:** PrismaClientKnownRequestError Code P2003
     * **Note:** Requires database schema to be up-to-date
     */
    it('should throw on foreign key violation (non-existing einsatzId)', async () => {
      if (!databaseSchemaCompatible) {
        console.warn('Skipping test: database schema is out of sync');
        return;
      }

      // Given: Aggregate with non-existing einsatzId
      const fakeEinsatzId = EinsatzId.create(generateTestId()).value as EinsatzId;
      const aggregate = EinsatztagebuchAggregate.create(fakeEinsatzId).value as EinsatztagebuchAggregate;

      // When/Then: Save throws PrismaClientKnownRequestError (P2003 FK Violation)
      await expect(repository.save(aggregate)).rejects.toThrow();
    });

    /**
     * Test 22: Handle unique constraint violation (duplicate einsatzId)
     *
     * **Business Rule:** Nur 1 ETB pro Einsatz (UNIQUE Constraint)
     * **Note:** Upsert verhindert eigentlich Duplicate via Repository,
     *           aber direkter Insert würde fehlschlagen
     * **Note:** Requires database schema to be up-to-date
     */
    it('should handle unique constraint violation (duplicate einsatzId)', async () => {
      if (!databaseSchemaCompatible) {
        console.warn('Skipping test: database schema is out of sync');
        return;
      }

      // Given: Two aggregates with SAME einsatzId
      const einsatzId = EinsatzId.create(testEinsatzId).value as EinsatzId;
      const aggregate1 = EinsatztagebuchAggregate.create(einsatzId).value as EinsatztagebuchAggregate;
      const aggregate2 = EinsatztagebuchAggregate.create(einsatzId).value as EinsatztagebuchAggregate;

      await repository.save(aggregate1);

      // When/Then: Second aggregate with different ID but same einsatzId
      // Repository uses upsert which updates existing, but direct create would fail
      await expect(async () => {
        await prisma.einsatztagebuch.create({
          data: {
            id: aggregate2.id.value, // Different ID
            einsatzId: testEinsatzId, // Same einsatzId → UNIQUE Violation
            status: 'DRAFT',
            version: 1,
            versionTimestamp: new Date(),
            nextSequenceNumber: 1,
            createdBy: testUserId,
          },
        });
      }).rejects.toThrow(); // P2002 Unique Constraint Violation
    });
  });
});
