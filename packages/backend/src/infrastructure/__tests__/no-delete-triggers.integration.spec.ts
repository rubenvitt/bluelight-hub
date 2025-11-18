/**
 * Integration Tests für PostgreSQL NO-DELETE Triggers (Story 1.8 Task 2).
 *
 * Diese Tests validieren die 4 BEFORE DELETE Triggers im PostgreSQL Schema:
 * 1. einsatz_no_delete - Verhindert DELETE auf einsaetze table
 * 2. etb_eintrag_no_delete - Verhindert DELETE auf etb_eintraege table
 * 3. lagekarte_poi_no_delete - Verhindert DELETE auf lagekarte_poi table
 * 4. user_no_delete - Verhindert DELETE auf "User" table
 *
 * **Infrastructure Layer Rationale:**
 * - Triggers sind PostgreSQL-spezifisch (NICHT framework-agnostic)
 * - Domain Layer Tests befinden sich in domain/aggregates/__tests__/
 * - Infrastructure Tests verwenden echte Database (NICHT mocked)
 *
 * **Test Strategy:**
 * - Prevent DELETE Operations (4 Tests): Validiert dass Trigger RAISE EXCEPTION werfen
 * - Allow Alternative Actions (3 Tests): Validiert dass UPDATE Operations erlaubt sind
 * - Given-When-Then BDD Style für maximale Lesbarkeit
 *
 * Epic 1 Story 1.8 | Task 2
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('NO-DELETE Triggers Integration Tests', () => {
  let testUserId: string; // System User for createdBy/updatedBy references
  const testRunId = Date.now(); // Unique ID für diesen Test Run (verhindert Collisions)

  /**
   * Setup: Erstellt einen System Test User für alle Foreign Key References.
   *
   * **Warum ein gemeinsamer Test User:**
   * - Alle Tables benötigen valid createdBy/updatedBy references
   * - Ein User verhindert FK Constraint Violations
   * - Cleanup ist einfacher (nur 1 User löschen statt viele)
   */
  beforeAll(async () => {
    // Cleanup from previous failed test runs (disable triggers temporarily)
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      await prisma.$executeRawUnsafe('DELETE FROM lagekarte_poi WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe('DELETE FROM lagekarte WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe('DELETE FROM etb_eintraege WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe('DELETE FROM einsatztagebuecher WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe('DELETE FROM einsaetze WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE username LIKE 'test-%'`);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }

    // Create test user for references (use raw SQL to bypass user_no_delete trigger on cleanup)
    const result = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "User" (id, username, "passwordHash", role, "isActive", "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid()::text,
        ${`test-system-user-${testRunId}`},
        'dummy-hash',
        'USER',
        true,
        NOW(),
        NOW()
      )
      RETURNING id
    `;
    testUserId = result[0].id;
  });

  /**
   * Teardown: Cleanup aller Test-Daten inkl. System User.
   *
   * **Reihenfolge ist wichtig (CASCADE vs. Restrict):**
   * 1. LagekartePoi (FK zu Lagekarte, ON DELETE CASCADE)
   * 2. Lagekarte (FK zu Einsatz, ON DELETE CASCADE)
   * 3. EtbEintrag (FK zu Einsatztagebuch, ON DELETE CASCADE)
   * 4. Einsatztagebuch (FK zu Einsatz, ON DELETE Restrict)
   * 5. Einsatz (FK zu User, ON DELETE Restrict)
   * 6. User (NO CASCADE, delete last)
   *
   * **Warum $executeRawUnsafe statt Prisma Client:**
   * - Bypass DELETE Triggers (würden Tests blockieren)
   * - Direct SQL DELETE ignores BEFORE DELETE triggers? NEIN!
   * - Triggers feuern auch bei raw SQL, daher disable triggers temporär
   */
  afterAll(async () => {
    // Disable triggers temporarily for cleanup (SUPERUSER required in prod!)
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');

    try {
      // Delete test data (FK constraints respected)
      await prisma.$executeRawUnsafe('DELETE FROM lagekarte_poi WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe('DELETE FROM lagekarte WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe('DELETE FROM etb_eintraege WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe('DELETE FROM einsatztagebuecher WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe('DELETE FROM einsaetze WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
      await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE username LIKE 'test-%'`);
    } finally {
      // Re-enable triggers
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
      await prisma.$disconnect();
    }
  });

  // ========================================
  // PREVENT DELETE OPERATIONS (4 Tests)
  // ========================================

  describe('Prevent DELETE Operations', () => {
    /**
     * Test 1: Einsatz DELETE Prevention
     *
     * **Business Rule:** Einsätze NIEMALS physisch löschen (10-Jahres-Aufbewahrung)
     * **Alternative:** status = ARCHIVIERT + archivedAt timestamp
     */
    it('should prevent direct DELETE on einsatz table', async () => {
      // Given: Einsatz exists in database with status ANGELEGT
      const einsatz = await prisma.einsatz.create({
        data: {
          alarmstichwort: 'B3 - Brand Wohnhaus',
          einsatzort: 'Hauptstraße 123, 12345 Berlin',
          status: 'ANGELEGT',
          createdBy: testUserId,
          updatedBy: testUserId,
        },
      });

      // When: Try to delete via Prisma Client
      const deletePromise = prisma.einsatz.delete({
        where: { id: einsatz.id },
      });

      // Then: Expect DRK Compliance Violation exception
      await expect(deletePromise).rejects.toThrow(/DRK Compliance Violation/);

      // Verify: Einsatz still exists in database (not deleted)
      const stillExists = await prisma.einsatz.findUnique({
        where: { id: einsatz.id },
      });
      expect(stillExists).not.toBeNull();
      expect(stillExists?.status).toBe('ANGELEGT');
    });

    /**
     * Test 2: ETB Eintrag DELETE Prevention (Raw SQL)
     *
     * **Business Rule:** ETB Einträge NIEMALS physisch löschen (Audit Trail)
     * **Alternative:** deletedAt + deletedBy (soft-delete pattern)
     * **Test Strategy:** Use raw SQL to bypass ORM (proof triggers work at DB level)
     */
    it('should prevent direct DELETE on etb_eintraege table via raw SQL', async () => {
      // Given: Create Einsatz → Einsatztagebuch → ETB Eintrag
      const einsatz = await prisma.einsatz.create({
        data: {
          alarmstichwort: 'H1 - Hilfeleistung',
          status: 'IN_BEARBEITUNG',
          createdBy: testUserId,
          updatedBy: testUserId,
        },
      });

      const etb = await prisma.einsatztagebuch.create({
        data: {
          einsatzId: einsatz.id,
          status: 'ACTIVE',
          createdBy: testUserId,
          updatedBy: testUserId,
        },
      });

      const eintrag = await prisma.etbEintrag.create({
        data: {
          etbId: etb.id,
          sequenceNumber: 1,
          kategorie: 'LAGE',
          text: 'Erste Lagemeldung vom Einsatzort',
          version: 1,
          createdBy: testUserId,
          updatedBy: testUserId,
        },
      });

      // When: Try to delete via raw SQL (bypasses Prisma validations)
      const deletePromise = prisma.$executeRaw`
        DELETE FROM etb_eintraege WHERE id = ${eintrag.id}
      `;

      // Then: Expect DRK Compliance Violation exception from trigger
      await expect(deletePromise).rejects.toThrow(/DRK Compliance Violation/);

      // Verify: ETB Eintrag still exists in database
      const stillExists = await prisma.etbEintrag.findUnique({
        where: { id: eintrag.id },
      });
      expect(stillExists).not.toBeNull();
      expect(stillExists?.deletedAt).toBeNull(); // Not soft-deleted yet
    });

    /**
     * Test 3: Lagekarte POI DELETE Prevention
     *
     * **Business Rule:** POIs können NUR durch Aggregate Business Logic entfernt werden
     * **Alternative:** KEINE soft-delete oder archival - strikt Domain Layer controlled
     */
    it('should prevent direct DELETE on lagekarte_poi table', async () => {
      // Given: Create Einsatz → Lagekarte → POI
      const einsatz = await prisma.einsatz.create({
        data: {
          alarmstichwort: 'TH - Technische Hilfeleistung',
          status: 'ANGELEGT',
          createdBy: testUserId,
          updatedBy: testUserId,
        },
      });

      const lagekarte = await prisma.lagekarte.create({
        data: {
          einsatzId: einsatz.id,
        },
      });

      const poi = await prisma.lagekartePoi.create({
        data: {
          lagekarteId: lagekarte.id,
          type: 'EINSATZORT',
          name: 'Haupteinsatzstelle',
          latitude: 52.52,
          longitude: 13.405,
          mgrs: '33UUU8990120100',
        },
      });

      // When: Try to delete via Prisma Client
      const deletePromise = prisma.lagekartePoi.delete({
        where: { id: poi.id },
      });

      // Then: Expect DRK Compliance Violation exception
      await expect(deletePromise).rejects.toThrow(/DRK Compliance Violation/);

      // Verify: POI still exists in database
      const stillExists = await prisma.lagekartePoi.findUnique({
        where: { id: poi.id },
      });
      expect(stillExists).not.toBeNull();
      expect(stillExists?.type).toBe('EINSATZORT');
    });

    /**
     * Test 4: User DELETE Prevention
     *
     * **Business Rule:** Benutzer NIEMALS physisch löschen (Audit Trail + DSGVO)
     * **Alternative:** isLocked = true + lockedManuallyAt (manual lock)
     * **NOTE:** isDeleted ist für DSGVO Anonymization (separate von Lock)
     */
    it('should prevent direct DELETE on User table', async () => {
      // Given: Regular User exists with role USER
      const user = await prisma.user.create({
        data: {
          username: `testuser-delete-prevention-${testRunId}`,
          passwordHash: 'hashed-password-dummy',
          role: 'USER',
          isActive: true,
        },
      });

      // When: Try to delete via Prisma Client
      const deletePromise = prisma.user.delete({
        where: { id: user.id },
      });

      // Then: Expect DRK Compliance Violation exception
      await expect(deletePromise).rejects.toThrow(/DRK Compliance Violation/);

      // Verify: User still exists, NOT soft-deleted, NOT locked
      const stillExists = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(stillExists).not.toBeNull();
      expect(stillExists?.isDeleted).toBe(false);
      expect(stillExists?.isLocked).toBe(false);
    });
  });

  // ========================================
  // ALLOW ALTERNATIVE ACTIONS (3 Tests)
  // ========================================

  describe('Allow Alternative Actions', () => {
    /**
     * Test 5: Einsatz Archival via UPDATE
     *
     * **Business Rule:** Einsatz archival is ALLOWED via status change
     * **Trigger:** Should NOT fire on UPDATE operations
     * **Flow:** ABGESCHLOSSEN → ARCHIVIERT (valid transition)
     */
    it('should allow Einsatz archival via UPDATE to status=ARCHIVIERT', async () => {
      // Given: Einsatz with status ABGESCHLOSSEN (ready for archival)
      const einsatz = await prisma.einsatz.create({
        data: {
          alarmstichwort: 'B2 - Brand PKW',
          einsatzort: 'Parkplatz Einkaufszentrum',
          status: 'ABGESCHLOSSEN',
          createdBy: testUserId,
          updatedBy: testUserId,
        },
      });

      // When: Update to ARCHIVIERT (no DELETE, only UPDATE)
      await prisma.einsatz.update({
        where: { id: einsatz.id },
        data: {
          status: 'ARCHIVIERT',
          archivedAt: new Date(),
          archivedBy: testUserId,
        },
      });

      // Then: Update succeeds (no trigger fires)
      const updated = await prisma.einsatz.findUnique({
        where: { id: einsatz.id },
      });

      // Verify: Status changed to ARCHIVIERT, archivedAt set
      expect(updated?.status).toBe('ARCHIVIERT');
      expect(updated?.archivedAt).not.toBeNull();
      expect(updated?.archivedBy).toBe(testUserId);
    });

    /**
     * Test 6: ETB Eintrag Soft-Delete via UPDATE
     *
     * **Business Rule:** ETB Einträge können soft-deleted werden (deletedAt flag)
     * **Trigger:** Should NOT fire on UPDATE operations
     * **Flow:** deletedAt: null → deletedAt: Date (soft-delete)
     */
    it('should allow ETB Eintrag soft-delete via UPDATE to deletedAt', async () => {
      // Given: Create Einsatz → ETB → Eintrag (NOT deleted yet)
      const einsatz = await prisma.einsatz.create({
        data: {
          alarmstichwort: 'TH - Ölspur',
          status: 'IN_BEARBEITUNG',
          createdBy: testUserId,
          updatedBy: testUserId,
        },
      });

      const etb = await prisma.einsatztagebuch.create({
        data: {
          einsatzId: einsatz.id,
          status: 'ACTIVE',
          createdBy: testUserId,
          updatedBy: testUserId,
        },
      });

      const eintrag = await prisma.etbEintrag.create({
        data: {
          etbId: etb.id,
          sequenceNumber: 1,
          kategorie: 'MASSNAHME',
          text: 'Ölbindemittel ausgebracht',
          version: 1,
          createdBy: testUserId,
          updatedBy: testUserId,
        },
      });

      // When: Soft-delete via UPDATE (set deletedAt + deletedBy)
      await prisma.etbEintrag.update({
        where: { id: eintrag.id },
        data: {
          deletedAt: new Date(),
          deletedBy: testUserId,
        },
      });

      // Then: Update succeeds (no trigger fires)
      const updated = await prisma.etbEintrag.findUnique({
        where: { id: eintrag.id },
      });

      // Verify: Soft-deleted (deletedAt set), record still exists physically
      expect(updated).not.toBeNull();
      expect(updated?.deletedAt).not.toBeNull();
      expect(updated?.deletedBy).toBe(testUserId);
    });

    /**
     * Test 7: User Locking via UPDATE
     *
     * **Business Rule:** Benutzer können gesperrt werden (isLocked flag)
     * **Trigger:** Should NOT fire on UPDATE operations
     * **Flow:** isLocked: false → isLocked: true (manual lock)
     *
     * **WICHTIG:** isLocked ist NICHT isDeleted!
     * - isLocked: Temporary admin lock (reversible)
     * - isDeleted: DSGVO anonymization (permanent)
     */
    it('should allow User locking via UPDATE to isLocked=true', async () => {
      // Given: Active User with isLocked = false (NOT locked yet)
      const user = await prisma.user.create({
        data: {
          username: `testuser-locking-${testRunId}`,
          passwordHash: 'hashed-password-dummy',
          role: 'USER',
          isActive: true,
          isLocked: false,
        },
      });

      // When: Update to isLocked = true (manual admin lock)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          isLocked: true,
          lockedManuallyAt: new Date(),
          lockedManuallyBy: testUserId,
          lockReason: 'Suspicious activity detected - manual lock for investigation',
        },
      });

      // Then: Update succeeds (no trigger fires)
      const updated = await prisma.user.findUnique({
        where: { id: user.id },
      });

      // Verify: User locked (isLocked = true), still exists, NOT deleted
      expect(updated?.isLocked).toBe(true);
      expect(updated?.lockedManuallyAt).not.toBeNull();
      expect(updated?.lockedManuallyBy).toBe(testUserId);
      expect(updated?.lockReason).toContain('Suspicious activity');
      expect(updated?.isDeleted).toBe(false); // NOT deleted, only locked
    });
  });
});
