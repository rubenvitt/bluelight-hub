/**
 * Integration Tests für PrismaEinsatzRepository mit Real PostgreSQL Database.
 *
 * Diese Tests validieren den Prisma Adapter für IEinsatzRepository:
 * 1. save() - Upsert Pattern (CREATE + UPDATE idempotency)
 * 2. findById() - Einsatz laden mit Result Pattern
 * 3. findActive() - Gefilterte Liste ohne ARCHIVIERT
 * 4. exists() - Efficient Existenz-Check
 * 5. Transactional Outbox - Domain Events in outbox_events Tabelle
 *
 * **Test Strategy:**
 * - Real PostgreSQL Database (NICHT mocked, NICHT in-memory)
 * - Given-When-Then BDD Style für maximale Lesbarkeit
 * - Cleanup mit Triggers disabled (SET session_replication_role = replica)
 * - Test User in beforeAll() erstellt
 * - afterEach() cleanup in reverse FK order (Outbox → Einsatz → User)
 *
 * **AC Coverage:**
 * - AC1: Repository implements IEinsatzRepository Interface
 * - AC2: save() creates/updates Einsatz with Transactional Outbox
 * - AC3: findById() and findActive() return correct aggregates
 * - AC4: exists() returns correct boolean
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
    // CUID2 Format: lowercase a-z and 0-9 only, starts with letter
    // Nanoid/CUID Format (für UserId): mixed case alphanumeric + underscore/hyphen
    // Wir akzeptieren beide Formate für Kompatibilität
    return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id);
  }),
}));

import { PrismaClient } from '@prisma/client';
import { PrismaEinsatzRepository } from '../prisma-einsatz.repository';
import { PrismaOutboxRepository } from '@/infrastructure/outbox/prisma-outbox.repository';
import { EventSerializer } from '@/infrastructure/outbox/event-serializer';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import type { PrismaService } from '@/infrastructure/database/prisma.service';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';

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
const generateNanoidTestId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let result = '';
  for (let i = 0; i < 21; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const prisma = new PrismaClient();

describe('PrismaEinsatzRepository - Integration Tests', () => {
  let repository: PrismaEinsatzRepository;
  let testUserId: string; // System User für createdBy/updatedBy References
  const testRunId = Date.now(); // Unique ID für diesen Test Run (verhindert Collisions)

  // ========================================
  // SETUP & TEARDOWN
  // ========================================

  /**
   * Setup: Erstellt System Test User für alle Einsatz Tests.
   *
   * **Warum beforeAll statt beforeEach:**
   * - User kann für alle Tests wiederverwendet werden
   * - Performance: Weniger DB Roundtrips
   * - Cleanup ist einfacher (nur 1 User löschen)
   */
  beforeAll(async () => {
    // Disable triggers temporarily für cleanup von vorherigen Test Runs
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      // Cleanup from previous failed test runs (last 1 hour)
      await prisma.$executeRawUnsafe('DELETE FROM outbox_events WHERE "aggregateId" IN (SELECT id FROM einsaetze WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\')');
      await prisma.$executeRawUnsafe('DELETE FROM einsaetze WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE username LIKE 'test-einsatz-repo-%'`);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }

    // Create test user for createdBy/updatedBy references
    const userResult = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "User" (id, username, "passwordHash", role, "isActive", "createdAt", "updatedAt")
      VALUES (
        ${generateNanoidTestId()},
        ${`test-einsatz-repo-user-${testRunId}`},
        'dummy-hash',
        'USER',
        true,
        NOW(),
        NOW()
      )
      RETURNING id
    `;
    testUserId = userResult[0].id;

    // Initialize Repository (mock PrismaService mit echtem PrismaClient)
    const prismaService = prisma as unknown as PrismaService;
    const eventSerializer = new EventSerializer();
    const outboxRepository = new PrismaOutboxRepository(prismaService, eventSerializer);
    repository = new PrismaEinsatzRepository(prismaService, outboxRepository);
  });

  /**
   * Cleanup nach jedem Test: Entfernt Outbox Events + Test-Einsätze (nicht User).
   *
   * **Reihenfolge ist wichtig (FK Constraints):**
   * 1. OutboxEvent (FK zu Einsatz via aggregateId)
   * 2. Einsatz (FK zu User)
   */
  afterEach(async () => {
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      // Delete test Einsatz + Outbox Events
      await prisma.$executeRawUnsafe(
        `DELETE FROM outbox_events WHERE "aggregateId" IN (
          SELECT id FROM einsaetze WHERE "createdBy" = $1
        )`,
        testUserId,
      );
      await prisma.$executeRawUnsafe('DELETE FROM einsaetze WHERE "createdBy" = $1', testUserId);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }
  });

  /**
   * Teardown: Cleanup aller Test-Daten inkl. Test User.
   *
   * **Reihenfolge:**
   * 1. OutboxEvent (FK zu Einsatz)
   * 2. Einsatz (FK zu User)
   * 3. User (NO CASCADE, delete last)
   */
  afterAll(async () => {
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      if (!testUserId) {
        return;
      }
      // Delete test data (FK constraints respected)
      await prisma.$executeRawUnsafe(
        `DELETE FROM outbox_events WHERE "aggregateId" IN (
          SELECT id FROM einsaetze WHERE "createdBy" = $1
        )`,
        testUserId,
      );
      await prisma.$executeRawUnsafe('DELETE FROM einsaetze WHERE "createdBy" = $1', testUserId);
      await prisma.$executeRawUnsafe('DELETE FROM "User" WHERE id = $1', testUserId);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
      await prisma.$disconnect();
    }
  });

  // ========================================
  // AC1: INTERFACE IMPLEMENTATION
  // ========================================

  describe('AC1: Repository implements IEinsatzRepository Interface', () => {
    /**
     * Test 1: Repository implements all IEinsatzRepository methods
     *
     * **Business Rule:** Repository muss alle Interface-Methoden implementieren
     * **Pattern:** Interface Compliance Check
     */
    it('should implement all IEinsatzRepository interface methods', () => {
      // Given: PrismaEinsatzRepository instance
      const repo: IEinsatzRepository = repository;

      // Then: All interface methods exist and are functions
      expect(typeof repo.save).toBe('function');
      expect(typeof repo.findById).toBe('function');
      expect(typeof repo.findActive).toBe('function');
      expect(typeof repo.exists).toBe('function');
      expect(typeof repo.findByNummer).toBe('function');
    });
  });

  // ========================================
  // AC2: SAVE() METHOD
  // ========================================

  describe('AC2: save() Method', () => {
    /**
     * Test 2: save() creates new Einsatz (INSERT path)
     *
     * **Business Rule:** Neuer Einsatz kann erstellt werden
     * **Pattern:** Upsert mit CREATE-Branch
     */
    it('should create new Einsatz (INSERT operation)', async () => {
      // Given: Fresh aggregate
      const userId = UserId.create(testUserId).value as UserId;
      const aggregateResult = Einsatz.create({ alarmstichwort: 'F2Y - Brand', createdBy: userId });
      expect(aggregateResult.isSuccess).toBe(true);
      const aggregate = aggregateResult.value as Einsatz;

      // When: Save aggregate
      const saveResult = await repository.save(aggregate);

      // Then: Save was successful
      expect(saveResult.isSuccess).toBe(true);

      // And: Database has 1 Einsatz row
      const einsatzCount = await prisma.einsatz.count({ where: { id: aggregate.id.value } });
      expect(einsatzCount).toBe(1);

      // Verify: createdBy FK correctly set
      const einsatz = await prisma.einsatz.findUnique({ where: { id: aggregate.id.value } });
      expect(einsatz?.createdBy).toBe(testUserId);
    });

    /**
     * Test 3: save() updates existing Einsatz (UPSERT path)
     *
     * **Business Rule:** save() kann mehrfach aufgerufen werden (idempotent)
     * **Pattern:** Upsert mit UPDATE-Branch
     */
    it('should update existing Einsatz (UPSERT idempotency)', async () => {
      // Given: Aggregate saved once
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = Einsatz.create({ alarmstichwort: 'F1 - VU', createdBy: userId }).value as Einsatz;

      await repository.save(aggregate);

      // When: Modify and save again
      aggregate.update({ alarmstichwort: 'F2 - VU mit Personenschaden', bemerkung: 'Autobahn A1 km 123' });
      await repository.save(aggregate);

      // Then: Still only 1 Einsatz row (no duplicate)
      const einsatzCount = await prisma.einsatz.count({ where: { id: aggregate.id.value } });
      expect(einsatzCount).toBe(1);

      // And: Fields are updated
      const einsatz = await prisma.einsatz.findUnique({ where: { id: aggregate.id.value } });
      expect(einsatz?.alarmstichwort).toBe('F2 - VU mit Personenschaden');
    });

    /**
     * Test 4: save() creates Domain Events in Outbox
     *
     * **Business Rule:** Domain Events werden atomar mit Aggregate persistiert
     * **Pattern:** Transactional Outbox Pattern
     */
    it('should persist Domain Events to outbox_events table', async () => {
      // Given: Fresh aggregate (EinsatzCreatedEvent is fired)
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = Einsatz.create({ alarmstichwort: 'F3 - Technische Hilfe', createdBy: userId }).value as Einsatz;

      // Verify: Aggregate has uncommitted Domain Events
      expect(aggregate.getDomainEvents().length).toBeGreaterThan(0);

      // When: Save aggregate
      await repository.save(aggregate);

      // Then: Outbox Events in database
      const outboxEvents = await prisma.outboxEvent.findMany({
        where: { aggregateId: aggregate.id.value },
      });
      expect(outboxEvents.length).toBeGreaterThan(0);

      // Verify: Event type is correct
      const event = outboxEvents[0];
      expect(event.eventName).toBe('einsatz.created');
      expect(event.status).toBe('PENDING');
    });

    /**
     * Test 5: save() clears Domain Events after persist
     *
     * **Business Rule:** Domain Events dürfen nicht doppelt persistiert werden
     * **Pattern:** Clear after Commit
     */
    it('should clear Domain Events after successful save', async () => {
      // Given: Aggregate with uncommitted events
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = Einsatz.create({ alarmstichwort: 'F1 - Rauchentwicklung', createdBy: userId }).value as Einsatz;

      expect(aggregate.getDomainEvents().length).toBeGreaterThan(0);

      // When: Save aggregate
      await repository.save(aggregate);

      // Then: Domain Events cleared
      expect(aggregate.getDomainEvents().length).toBe(0);
    });

    /**
     * Test 6: save() rollback on error (atomic transaction)
     *
     * **Business Rule:** Partial Data darf nicht persistiert werden
     * **Pattern:** Transaction Atomicity
     */
    it('should rollback on error (atomic transaction)', async () => {
      // Given: Aggregate with invalid FK (non-existent user)
      const fakeUserId = UserId.create(generateNanoidTestId()).value as UserId;
      const aggregate = Einsatz.create({ alarmstichwort: 'F1 - Test', createdBy: fakeUserId }).value as Einsatz;

      // When/Then: Save with non-existent user FK throws exception
      await expect(repository.save(aggregate)).rejects.toThrow();

      // And: No partial data in DB (transaction rolled back)
      const einsatzCount = await prisma.einsatz.count({ where: { id: aggregate.id.value } });
      expect(einsatzCount).toBe(0);
    });
  });

  // ========================================
  // AC3: FINDBYID() AND FINDACTIVE()
  // ========================================

  describe('AC3: findById() and findActive()', () => {
    /**
     * Test 7: findById() returns aggregate with correct data
     *
     * **Business Rule:** Aggregate muss vollständig rekonstruiert werden
     * **Pattern:** Eager Loading
     */
    it('should return aggregate with correct data', async () => {
      // Given: Saved aggregate
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = Einsatz.create({ alarmstichwort: 'F2Y - Wohnungsbrand', createdBy: userId }).value as Einsatz;

      await repository.save(aggregate);

      // When: Find by ID
      const result = await repository.findById(aggregate.id);

      // Then: Returns correct aggregate
      expect(result.isSuccess).toBe(true);
      const found = result.value;
      expect(found).not.toBeNull();
      expect(found!.id.value).toBe(aggregate.id.value);
      expect(found!.alarmstichwort).toBe('F2Y - Wohnungsbrand');
    });

    /**
     * Test 8: findById() returns null when not found
     *
     * **Business Rule:** null Return (NICHT Exception) bei Not Found
     * **Rationale:** Caller muss explizit prüfen (Type-Safe null handling)
     */
    it('should return null when not found', async () => {
      // Given: Non-existing ID
      const fakeId = EinsatzId.create(generateTestId()).value as EinsatzId;

      // When: Find by ID
      const result = await repository.findById(fakeId);

      // Then: Returns success with null (NOT error!)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    /**
     * Test 9: findActive() returns only non-archived Einsätze
     *
     * **Business Rule:** Archivierte Einsätze werden ausgefiltert
     * **Use Case:** Operative Liste zeigt nur aktive Einsätze
     */
    it('should return only active (non-archived) Einsätze', async () => {
      // Given: 2 aktive Einsätze + 1 archivierter
      const userId = UserId.create(testUserId).value as UserId;
      const einsatz1 = Einsatz.create({ alarmstichwort: 'F1 - Aktiv 1', createdBy: userId }).value as Einsatz;
      const einsatz2 = Einsatz.create({ alarmstichwort: 'F1 - Aktiv 2', createdBy: userId }).value as Einsatz;
      const einsatz3 = Einsatz.create({ alarmstichwort: 'F1 - Archiviert', createdBy: userId }).value as Einsatz;

      // Archive einsatz3
      einsatz3.archive(userId);

      await repository.save(einsatz1);
      await repository.save(einsatz2);
      await repository.save(einsatz3);

      // When: Find active
      const result = await repository.findActive();

      // Then: Returns only 2 active Einsätze
      expect(result.isSuccess).toBe(true);
      const active = result.value;
      expect(active.length).toBe(2);
      expect(active.some((e) => e.id.value === einsatz1.id.value)).toBe(true);
      expect(active.some((e) => e.id.value === einsatz2.id.value)).toBe(true);
      expect(active.some((e) => e.id.value === einsatz3.id.value)).toBe(false);
    });

    /**
     * Test 10: findActive() returns empty array when no active Einsätze
     *
     * **Business Rule:** Leere Liste ist valides Resultat
     */
    it('should return empty array when no active Einsätze', async () => {
      // Given: No active Einsätze (cleanup already done in afterEach)

      // When: Find active
      const result = await repository.findActive();

      // Then: Returns success with empty array
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
    });
  });

  // ========================================
  // AC4: EXISTS()
  // ========================================

  describe('AC4: exists()', () => {
    /**
     * Test 11: exists() returns true for existing Einsatz
     *
     * **Performance:** COUNT Query statt SELECT *
     */
    it('should return true for existing Einsatz', async () => {
      // Given: Saved aggregate
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = Einsatz.create({ alarmstichwort: 'F1 - Exists Test', createdBy: userId }).value as Einsatz;
      await repository.save(aggregate);

      // When: Check existence
      const result = await repository.exists(aggregate.id);

      // Then: Returns true
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(true);
    });

    /**
     * Test 12: exists() returns false for non-existing Einsatz
     */
    it('should return false for non-existing Einsatz', async () => {
      // Given: Non-existing ID
      const fakeId = EinsatzId.create(generateTestId()).value as EinsatzId;

      // When: Check existence
      const result = await repository.exists(fakeId);

      // Then: Returns false
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(false);
    });
  });

  // ========================================
  // AC5: TRANSACTION SUPPORT
  // ========================================

  describe('AC5: Transaction Support', () => {
    /**
     * Test 13: External transaction support (tx parameter)
     *
     * **Business Rule:** Repository kann externe Transaktionen verwenden
     * **Use Case:** Handler-Level Transactions über mehrere Repositories
     */
    it('should support external transaction (tx parameter)', async () => {
      // Given: Aggregate to save
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = Einsatz.create({ alarmstichwort: 'F1 - TX Test', createdBy: userId }).value as Einsatz;

      // When: Save using external transaction
      await prisma.$transaction(async (tx) => {
        await repository.save(aggregate, tx);
      });

      // Then: Data persisted
      const einsatz = await prisma.einsatz.findUnique({ where: { id: aggregate.id.value } });
      expect(einsatz).not.toBeNull();
    });

    /**
     * Test 14: Internal transaction when tx not provided
     *
     * **Business Rule:** Repository erstellt eigene Transaction wenn keine übergeben
     * **Pattern:** Auto-Transaction Wrapping
     */
    it('should use internal transaction when tx not provided', async () => {
      // Given: Aggregate to save
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = Einsatz.create({ alarmstichwort: 'F1 - Internal TX', createdBy: userId }).value as Einsatz;

      // When: Save without tx parameter (uses internal transaction)
      await repository.save(aggregate);

      // Then: Data persisted (internal transaction committed)
      const einsatz = await prisma.einsatz.findUnique({ where: { id: aggregate.id.value } });
      expect(einsatz).not.toBeNull();
    });
  });

  // ========================================
  // ADDITIONAL TESTS: ROUND-TRIP
  // ========================================

  describe('Round-Trip Tests', () => {
    /**
     * Test 15: Round-trip preservation (save → findById → verify)
     *
     * **Business Rule:** Aggregate State muss nach Load identisch sein
     * **Pattern:** Mapper Correctness Verification
     */
    it('should preserve Aggregate data in save + findById round-trip', async () => {
      // Given: Aggregate with all fields populated
      const userId = UserId.create(testUserId).value as UserId;
      const aggregate = Einsatz.create({ alarmstichwort: 'F2Y - Brand mit äöü ß € Sonderzeichen', createdBy: userId }).value as Einsatz;

      // Set optional fields
      aggregate.update({ bemerkung: 'Vollalarm - Alle Einheiten ausrücken' });

      // When: Save + retrieve
      await repository.save(aggregate);
      const result = await repository.findById(aggregate.id);

      // Then: All fields match
      const retrieved = result.value!;
      expect(retrieved).not.toBeNull();
      expect(retrieved.id.value).toBe(aggregate.id.value);
      expect(retrieved.alarmstichwort).toBe('F2Y - Brand mit äöü ß € Sonderzeichen');
      expect(retrieved.bemerkung).toBe('Vollalarm - Alle Einheiten ausrücken');
    });
  });
});
