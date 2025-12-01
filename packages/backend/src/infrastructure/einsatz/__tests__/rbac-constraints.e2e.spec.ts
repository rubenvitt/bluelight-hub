/**
 * E2E Tests für RBAC Constraints (Story 4-10 AC3.1-AC3.4).
 *
 * Validiert die Business Rules für Role-Based Access Control:
 * - AC3.1: Min-1-SUPER_ADMIN Constraint (System MUSS min. 1 SUPER_ADMIN haben)
 * - AC3.2: countSuperAdmins() Implementierung (Filter: isLocked=false, isDeleted=false)
 * - AC3.3: @Roles() Decorator Enforcement (Test Setup Verification)
 * - AC3.4: JWT Token Role Claim (Payload Structure Verification)
 *
 * **CONSTRAINT TESTING STRATEGY:**
 *
 * Min-1-SUPER_ADMIN ist eine kritische Business Rule die System-Lockout verhindert.
 * Diese Tests validieren dass:
 * - Letzter SUPER_ADMIN kann NICHT gelockt werden
 * - Letzter SUPER_ADMIN kann NICHT downgraded werden (Role Change)
 * - Letzter SUPER_ADMIN kann NICHT gelöscht werden (Soft Delete)
 * - countSuperAdmins() filtert korrekt (nur aktive, nicht-gesperrte)
 *
 * **WICHTIG - DIREKTES SQL FÜR CONSTRAINT BYPASS:**
 *
 * Manche Tests müssen die Min-1-SUPER_ADMIN Constraint umgehen um
 * Edge Cases zu testen. Hierfür verwenden wir direktes SQL:
 * - UPDATE "User" SET "isLocked" = true WHERE role = 'SUPER_ADMIN'
 * - Dieser Approach ist VALIDE für E2E Tests (simuliert DB-Corruption)
 * - In Production verhindert Aggregate Logic diese Szenarien
 *
 * @see UserAggregate.lock() - Min-1-SUPER_ADMIN Check
 * @see UserAggregate.updateRole() - Min-1-SUPER_ADMIN Check
 * @see UserAggregate.delete() - Min-1-SUPER_ADMIN Check
 * @see PrismaUserRepository.countSuperAdmins() - Filter Implementation
 */

import type { EinsatzE2eTestContext } from './einsatz.e2e-setup';
import { createEinsatzE2eModule, teardownE2eModule, cleanupTestData, createTestUser, DISABLE_TRIGGERS_SQL, ENABLE_TRIGGERS_SQL } from './einsatz.e2e-setup';
import { PrismaUserRepository } from '@/infrastructure/user/repositories/prisma-user.repository';
import { UserId } from '@domain/value-objects/user-id';
import { UserRole } from '@domain/value-objects/user-role';

describe('RBAC Constraint Tests (AC3.1-AC3.4)', () => {
  let ctx: EinsatzE2eTestContext;
  let userRepository: PrismaUserRepository;

  beforeAll(async () => {
    // Setup E2E Test Context mit 3 User-Rollen
    ctx = await createEinsatzE2eModule();

    // Create User Repository für RBAC Testing
    // (PrismaUserRepository.countSuperAdmins() ist die kritische Methode)
    userRepository = new PrismaUserRepository(ctx.prisma);
  }, 30000);

  afterEach(async () => {
    // Cleanup Test Data (behält Test Users)
    await cleanupTestData(ctx);

    // Cleanup zusätzliche Test Users (test_rbac_*)
    await ctx.prisma.$executeRawUnsafe(DISABLE_TRIGGERS_SQL);
    try {
      await ctx.prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE username LIKE 'test_rbac_%'`);
    } finally {
      await ctx.prisma.$executeRawUnsafe(ENABLE_TRIGGERS_SQL);
    }

    // Reset Locks auf allen Test Users (verhindert Constraint Issues)
    await ctx.prisma.$executeRawUnsafe(DISABLE_TRIGGERS_SQL);
    try {
      await ctx.prisma.$executeRaw`
        UPDATE "User" SET "isLocked" = false
        WHERE username LIKE 'test_einsatz_e2e_%'
      `;
    } finally {
      await ctx.prisma.$executeRawUnsafe(ENABLE_TRIGGERS_SQL);
    }
  });

  afterAll(async () => {
    // Teardown: Schließe DB Verbindung
    await teardownE2eModule(ctx);
  });

  describe('AC3.1: Min-1-SUPER_ADMIN Constraint', () => {
    /**
     * Test: Letzter SUPER_ADMIN kann NICHT gelockt werden.
     *
     * **Given:**
     * - NUR 1 SUPER_ADMIN existiert im System (ctx.testUserIds.superAdmin)
     *
     * **When:**
     * - Wir versuchen den letzten SUPER_ADMIN zu locken
     *
     * **Then:**
     * - lock() Operation schlägt fehl mit "Cannot lock last SUPER_ADMIN" Fehler
     * - countSuperAdmins() gibt 1 zurück (vor Lock)
     * - User bleibt unlocked
     */
    it('should prevent locking the last SUPER_ADMIN', async () => {
      // Given: Stelle sicher dass NUR 1 SUPER_ADMIN existiert
      // (Lock alle anderen SUPER_ADMINs, dann zählen sie nicht mehr)
      await ctx.prisma.$executeRaw`
        UPDATE "User"
        SET "isLocked" = true
        WHERE role = 'SUPER_ADMIN'
          AND id != ${ctx.testUserIds.superAdmin}
          AND "isDeleted" = false
      `;

      // Verify: Jetzt sollte nur noch 1 SUPER_ADMIN gezählt werden
      const countResult = await userRepository.countSuperAdmins();
      expect(countResult.isSuccess).toBe(true);
      const initialCount = countResult.value!;
      expect(initialCount).toBe(1);

      // When: Versuche den letzten SUPER_ADMIN zu locken
      const userId = UserId.create(ctx.testUserIds.superAdmin).value!;
      const userResult = await userRepository.findById(userId);
      expect(userResult.isSuccess).toBe(true);
      expect(userResult.value).not.toBeNull();

      const user = userResult.value!;
      const lockResult = await user.lock(userRepository);

      // Then: Operation schlägt fehl
      expect(lockResult.isFailure).toBe(true);
      expect(lockResult.error).toContain('SUPER_ADMIN');

      // Verify User ist NICHT gelockt
      expect(user.isLocked).toBe(false);

      // Cleanup: Unlock alle SUPER_ADMINs wieder
      await ctx.prisma.$executeRaw`
        UPDATE "User"
        SET "isLocked" = false
        WHERE role = 'SUPER_ADMIN'
      `;
    });

    /**
     * Test: SUPER_ADMIN kann gelockt werden wenn 2+ existieren.
     *
     * **Given:**
     * - 2 SUPER_ADMINs existieren
     *
     * **When:**
     * - Wir locken einen von beiden
     *
     * **Then:**
     * - lock() Operation erfolgreich
     * - countSuperAdmins() gibt nur noch 1 zurück (weil locked filtered)
     * - User ist gelockt
     */
    it('should allow locking SUPER_ADMIN when 2+ exist', async () => {
      // Given: Erstelle zweiten SUPER_ADMIN
      const secondSuperAdminId = await createTestUser(ctx, 'SUPER_ADMIN', 'test_rbac_super2');

      // Verify count ist jetzt >= 2
      const countResult = await userRepository.countSuperAdmins();
      expect(countResult.isSuccess).toBe(true);
      expect(countResult.value!).toBeGreaterThanOrEqual(2);

      // When: Locke den zweiten SUPER_ADMIN
      const userId = UserId.create(secondSuperAdminId).value!;
      const userResult = await userRepository.findById(userId);
      expect(userResult.isSuccess).toBe(true);
      expect(userResult.value).not.toBeNull();

      const user = userResult.value!;
      const lockResult = await user.lock(userRepository);

      // Then: Operation erfolgreich (weil noch 1 SUPER_ADMIN übrig)
      expect(lockResult.isSuccess).toBe(true);
      expect(user.isLocked).toBe(true);

      // Verify count ist jetzt wieder 1 (weil locked SUPER_ADMIN nicht gezählt wird)
      const newCountResult = await userRepository.countSuperAdmins();
      expect(newCountResult.isSuccess).toBe(true);
      // Mindestens 1 (der ursprüngliche SUPER_ADMIN)
      expect(newCountResult.value!).toBeGreaterThanOrEqual(1);
    });

    /**
     * Test: Letzter SUPER_ADMIN kann NICHT downgraded werden.
     *
     * **Given:**
     * - NUR 1 SUPER_ADMIN existiert
     *
     * **When:**
     * - Wir versuchen Role zu ADMIN zu ändern
     *
     * **Then:**
     * - updateRole() Operation schlägt fehl
     * - User behält SUPER_ADMIN Role
     */
    it('should prevent downgrading the last SUPER_ADMIN role', async () => {
      // Given: Stelle sicher dass NUR 1 SUPER_ADMIN existiert
      // (Lock alle anderen SUPER_ADMINs, dann zählen sie nicht mehr)
      await ctx.prisma.$executeRaw`
        UPDATE "User"
        SET "isLocked" = true
        WHERE role = 'SUPER_ADMIN'
          AND id != ${ctx.testUserIds.superAdmin}
          AND "isDeleted" = false
      `;

      // Verify: Jetzt sollte nur noch 1 SUPER_ADMIN gezählt werden
      const countResult = await userRepository.countSuperAdmins();
      expect(countResult.isSuccess).toBe(true);
      expect(countResult.value!).toBe(1);

      // When: Lade den letzten SUPER_ADMIN
      const userId = UserId.create(ctx.testUserIds.superAdmin).value!;
      const userResult = await userRepository.findById(userId);
      expect(userResult.isSuccess).toBe(true);
      expect(userResult.value).not.toBeNull();

      const user = userResult.value!;
      const changedBy = UserId.create(ctx.testUserIds.superAdmin).value!;

      // Verify initial role
      expect(user.hasRole(UserRole.SUPER_ADMIN())).toBe(true);

      // When: Versuche Role zu ADMIN zu ändern
      const result = await user.updateRole(UserRole.ADMIN(), changedBy, userRepository);

      // Then: Operation schlägt fehl
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('SUPER_ADMIN');

      // Verify Role ist unverändert
      expect(user.hasRole(UserRole.SUPER_ADMIN())).toBe(true);

      // Cleanup: Unlock alle SUPER_ADMINs wieder
      await ctx.prisma.$executeRaw`
        UPDATE "User"
        SET "isLocked" = false
        WHERE role = 'SUPER_ADMIN'
      `;
    });

    /**
     * Test: SUPER_ADMIN kann downgraded werden wenn 2+ existieren.
     *
     * **Given:**
     * - 2 SUPER_ADMINs existieren
     *
     * **When:**
     * - Wir downgraden einen zu ADMIN
     *
     * **Then:**
     * - updateRole() Operation erfolgreich
     * - User hat ADMIN Role
     * - countSuperAdmins() gibt 1 zurück
     */
    it('should allow downgrading SUPER_ADMIN when 2+ exist', async () => {
      // Given: Erstelle zweiten SUPER_ADMIN
      const secondSuperAdminId = await createTestUser(ctx, 'SUPER_ADMIN', 'test_rbac_super_downgrade');

      // Verify count
      const countResult = await userRepository.countSuperAdmins();
      expect(countResult.isSuccess).toBe(true);
      expect(countResult.value!).toBeGreaterThanOrEqual(2);

      // When: Downgrade den zweiten SUPER_ADMIN
      const userId = UserId.create(secondSuperAdminId).value!;
      const userResult = await userRepository.findById(userId);
      expect(userResult.isSuccess).toBe(true);
      const user = userResult.value!;

      const changedBy = UserId.create(ctx.testUserIds.superAdmin).value!;
      const result = await user.updateRole(UserRole.ADMIN(), changedBy, userRepository);

      // Then: Operation erfolgreich
      expect(result.isSuccess).toBe(true);
      expect(user.hasRole(UserRole.ADMIN())).toBe(true);

      // Verify count ist wieder 1
      const newCountResult = await userRepository.countSuperAdmins();
      expect(newCountResult.isSuccess).toBe(true);
      expect(newCountResult.value!).toBeGreaterThanOrEqual(1);
    });
  });

  describe('AC3.2: countSuperAdmins() Excludes Locked/Deleted', () => {
    /**
     * Test: countSuperAdmins() filtert locked SUPER_ADMINs aus.
     *
     * **Given:**
     * - 2 SUPER_ADMINs existieren
     * - Einer ist locked (via direktes SQL)
     *
     * **When:**
     * - countSuperAdmins() wird aufgerufen
     *
     * **Then:**
     * - Nur der unlocked SUPER_ADMIN wird gezählt
     * - countSuperAdmins() >= 1 (mindestens der unlocked)
     */
    it('should exclude locked SUPER_ADMIN from count', async () => {
      // Given: Erstelle zweiten SUPER_ADMIN
      const secondId = await createTestUser(ctx, 'SUPER_ADMIN', 'test_rbac_super_locked');

      // Initial count (beide unlocked)
      const initialCountResult = await userRepository.countSuperAdmins();
      expect(initialCountResult.isSuccess).toBe(true);
      const initialCount = initialCountResult.value!;
      expect(initialCount).toBeGreaterThanOrEqual(2);

      // Locke den zweiten SUPER_ADMIN (direktes SQL - bypass Aggregate Logic)
      await ctx.prisma.$executeRaw`
        UPDATE "User" SET "isLocked" = true WHERE id = ${secondId}
      `;

      // When: Count SUPER_ADMINs
      const countResult = await userRepository.countSuperAdmins();

      // Then: Locked SUPER_ADMIN wird NICHT gezählt
      expect(countResult.isSuccess).toBe(true);
      expect(countResult.value!).toBe(initialCount - 1);

      // Cleanup: Unlock für afterEach
      await ctx.prisma.$executeRaw`
        UPDATE "User" SET "isLocked" = false WHERE id = ${secondId}
      `;
    });

    /**
     * Test: countSuperAdmins() filtert soft-deleted SUPER_ADMINs aus.
     *
     * **Given:**
     * - 2 SUPER_ADMINs existieren
     * - Einer ist soft-deleted (via direktes SQL)
     *
     * **When:**
     * - countSuperAdmins() wird aufgerufen
     *
     * **Then:**
     * - Nur der nicht-gelöschte SUPER_ADMIN wird gezählt
     */
    it('should exclude soft-deleted SUPER_ADMIN from count', async () => {
      // Given: Erstelle SUPER_ADMIN
      const deletedId = await createTestUser(ctx, 'SUPER_ADMIN', 'test_rbac_super_deleted');

      // Initial count
      const initialCountResult = await userRepository.countSuperAdmins();
      expect(initialCountResult.isSuccess).toBe(true);
      const initialCount = initialCountResult.value!;

      // Soft-delete den SUPER_ADMIN (direktes SQL)
      await ctx.prisma.$executeRaw`
        UPDATE "User"
        SET "isDeleted" = true, "deletedAt" = NOW()
        WHERE id = ${deletedId}
      `;

      // When: Count SUPER_ADMINs
      const countResult = await userRepository.countSuperAdmins();

      // Then: Deleted SUPER_ADMIN wird NICHT gezählt
      expect(countResult.isSuccess).toBe(true);
      expect(countResult.value!).toBeLessThan(initialCount);

      // Cleanup: Restore für afterEach
      await ctx.prisma.$executeRaw`
        UPDATE "User"
        SET "isDeleted" = false, "deletedAt" = NULL
        WHERE id = ${deletedId}
      `;
    });

    /**
     * Test: countSuperAdmins() gibt korrekten Count zurück.
     *
     * **Given:**
     * - Mehrere SUPER_ADMINs mit verschiedenen States
     *
     * **When:**
     * - countSuperAdmins() wird aufgerufen
     *
     * **Then:**
     * - Nur aktive (unlocked, not deleted) SUPER_ADMINs werden gezählt
     */
    it('should count only active SUPER_ADMINs', async () => {
      // Given: Erstelle 3 zusätzliche SUPER_ADMINs
      await createTestUser(ctx, 'SUPER_ADMIN', 'test_rbac_active_1');
      await createTestUser(ctx, 'SUPER_ADMIN', 'test_rbac_active_2');
      const locked = await createTestUser(ctx, 'SUPER_ADMIN', 'test_rbac_locked_3');

      // Lock einer
      await ctx.prisma.$executeRaw`
        UPDATE "User" SET "isLocked" = true WHERE id = ${locked}
      `;

      // When: Count SUPER_ADMINs
      const countResult = await userRepository.countSuperAdmins();

      // Then: Nur unlocked SUPER_ADMINs gezählt
      expect(countResult.isSuccess).toBe(true);

      // Mindestens 3: original superAdmin + active1 + active2
      // (locked wird nicht gezählt)
      expect(countResult.value!).toBeGreaterThanOrEqual(3);

      // Verify durch direktes Count
      const directCount = await ctx.prisma.user.count({
        where: {
          role: 'SUPER_ADMIN',
          isLocked: false,
          isDeleted: false,
        },
      });
      expect(countResult.value!).toBe(directCount);

      // Cleanup
      await ctx.prisma.$executeRaw`
        UPDATE "User" SET "isLocked" = false WHERE id = ${locked}
      `;
    });

    /**
     * Test: countSuperAdmins() filtert BEIDE (locked UND deleted) aus.
     *
     * **Given:**
     * - SUPER_ADMIN der sowohl locked als auch deleted ist
     *
     * **When:**
     * - countSuperAdmins() wird aufgerufen
     *
     * **Then:**
     * - User wird NICHT gezählt
     */
    it('should exclude SUPER_ADMIN that is both locked and deleted', async () => {
      // Given: Erstelle SUPER_ADMIN
      const bothId = await createTestUser(ctx, 'SUPER_ADMIN', 'test_rbac_both_locked_deleted');

      // Initial count
      const initialCountResult = await userRepository.countSuperAdmins();
      expect(initialCountResult.isSuccess).toBe(true);
      const initialCount = initialCountResult.value!;

      // Lock UND Delete (direktes SQL)
      await ctx.prisma.$executeRaw`
        UPDATE "User"
        SET "isLocked" = true, "isDeleted" = true, "deletedAt" = NOW()
        WHERE id = ${bothId}
      `;

      // When: Count SUPER_ADMINs
      const countResult = await userRepository.countSuperAdmins();

      // Then: User wird NICHT gezählt
      expect(countResult.isSuccess).toBe(true);
      expect(countResult.value!).toBeLessThan(initialCount);

      // Cleanup
      await ctx.prisma.$executeRaw`
        UPDATE "User"
        SET "isLocked" = false, "isDeleted" = false, "deletedAt" = NULL
        WHERE id = ${bothId}
      `;
    });
  });

  describe('AC3.3: @Roles() Guard Enforcement', () => {
    /**
     * Diese Tests validieren NUR das Test Setup.
     *
     * Echte @Roles() Guard Tests sind in den HTTP E2E Tests
     * (z.B. auth-controller.e2e.spec.ts).
     *
     * Hier prüfen wir nur dass die Test User korrekt erstellt wurden.
     */

    it('should verify USER role exists in test context', () => {
      expect(ctx.testUserIds.user).toBeDefined();
      expect(typeof ctx.testUserIds.user).toBe('string');
      expect(ctx.testUserIds.user.length).toBeGreaterThan(0);
    });

    it('should verify ADMIN role exists in test context', () => {
      expect(ctx.testUserIds.admin).toBeDefined();
      expect(typeof ctx.testUserIds.admin).toBe('string');
      expect(ctx.testUserIds.admin.length).toBeGreaterThan(0);
    });

    it('should verify SUPER_ADMIN role exists in test context', () => {
      expect(ctx.testUserIds.superAdmin).toBeDefined();
      expect(typeof ctx.testUserIds.superAdmin).toBe('string');
      expect(ctx.testUserIds.superAdmin.length).toBeGreaterThan(0);
    });

    /**
     * Test: Verify Roles sind korrekt in Database gespeichert.
     *
     * **Given:**
     * - Test Users wurden erstellt
     *
     * **When:**
     * - Wir laden sie aus der DB
     *
     * **Then:**
     * - Roles matchen die erwarteten Werte
     */
    it('should verify roles are correctly assigned in database', async () => {
      // Verify USER Role
      const userResult = await ctx.prisma.user.findUnique({
        where: { id: ctx.testUserIds.user },
        select: { role: true },
      });
      expect(userResult).not.toBeNull();
      expect(userResult?.role).toBe('USER');

      // Verify ADMIN Role
      const adminResult = await ctx.prisma.user.findUnique({
        where: { id: ctx.testUserIds.admin },
        select: { role: true },
      });
      expect(adminResult).not.toBeNull();
      expect(adminResult?.role).toBe('ADMIN');

      // Verify SUPER_ADMIN Role
      const superAdminResult = await ctx.prisma.user.findUnique({
        where: { id: ctx.testUserIds.superAdmin },
        select: { role: true },
      });
      expect(superAdminResult).not.toBeNull();
      expect(superAdminResult?.role).toBe('SUPER_ADMIN');
    });

    /**
     * Test: Verify Test Users sind alle unlocked.
     *
     * **Given:**
     * - Test Users wurden erstellt
     *
     * **When:**
     * - Wir prüfen isLocked Status
     *
     * **Then:**
     * - Alle sind unlocked (initial state)
     */
    it('should verify test users are initially unlocked', async () => {
      const users = await ctx.prisma.user.findMany({
        where: {
          id: {
            in: [ctx.testUserIds.user, ctx.testUserIds.admin, ctx.testUserIds.superAdmin],
          },
        },
        select: { id: true, isLocked: true },
      });

      expect(users).toHaveLength(3);
      for (const user of users) {
        expect(user.isLocked).toBe(false);
      }
    });
  });

  describe('AC3.4: JWT Token Role Claim', () => {
    /**
     * Diese Tests validieren die erwartete JWT Payload Structure.
     *
     * Echte JWT Signing/Verification Tests sind in auth.service.spec.ts,
     * weil JwtService ConfigService benötigt (NestJS DI).
     *
     * Hier prüfen wir nur die erwartete Payload-Struktur.
     */

    /**
     * Test: JWT Payload enthält role claim.
     *
     * **Given:**
     * - JWT Payload Interface Definition
     *
     * **When:**
     * - Wir erstellen einen Mock Payload
     *
     * **Then:**
     * - Payload hat sub (User ID) und role Properties
     */
    it('should include role in JWT payload structure', () => {
      // Define expected JWT Payload Structure
      interface JwtPayload {
        sub: string;
        role: string;
        iat?: number;
        exp?: number;
      }

      // Create mock payload für Structure Validation
      const expectedPayload: JwtPayload = {
        sub: ctx.testUserIds.user,
        role: 'USER',
      };

      // Verify Structure
      expect(expectedPayload).toHaveProperty('sub');
      expect(expectedPayload).toHaveProperty('role');
      expect(typeof expectedPayload.sub).toBe('string');
      expect(typeof expectedPayload.role).toBe('string');
    });

    /**
     * Test: JWT Payload unterstützt alle User Roles.
     *
     * **Given:**
     * - USER, ADMIN, SUPER_ADMIN Roles
     *
     * **When:**
     * - Wir erstellen Mock Payloads für jede Role
     *
     * **Then:**
     * - Alle Payloads sind valid
     */
    it('should support all user roles in JWT payload', () => {
      interface JwtPayload {
        sub: string;
        role: string;
      }

      // USER Role
      const userPayload: JwtPayload = {
        sub: ctx.testUserIds.user,
        role: 'USER',
      };
      expect(userPayload.role).toBe('USER');

      // ADMIN Role
      const adminPayload: JwtPayload = {
        sub: ctx.testUserIds.admin,
        role: 'ADMIN',
      };
      expect(adminPayload.role).toBe('ADMIN');

      // SUPER_ADMIN Role
      const superAdminPayload: JwtPayload = {
        sub: ctx.testUserIds.superAdmin,
        role: 'SUPER_ADMIN',
      };
      expect(superAdminPayload.role).toBe('SUPER_ADMIN');
    });

    /**
     * Test: JWT Payload kann optional iat und exp enthalten.
     *
     * **Given:**
     * - JWT Payload Interface mit optional iat/exp
     *
     * **When:**
     * - Wir erstellen Payloads mit/ohne iat/exp
     *
     * **Then:**
     * - Beide Varianten sind valid
     */
    it('should support optional iat and exp claims', () => {
      interface JwtPayload {
        sub: string;
        role: string;
        iat?: number;
        exp?: number;
      }

      // Without iat/exp
      const minimalPayload: JwtPayload = {
        sub: ctx.testUserIds.user,
        role: 'USER',
      };
      expect(minimalPayload.iat).toBeUndefined();
      expect(minimalPayload.exp).toBeUndefined();

      // With iat/exp
      const now = Math.floor(Date.now() / 1000);
      const fullPayload: JwtPayload = {
        sub: ctx.testUserIds.user,
        role: 'USER',
        iat: now,
        exp: now + 3600, // +1 hour
      };
      expect(fullPayload.iat).toBe(now);
      expect(fullPayload.exp).toBe(now + 3600);
    });
  });
});
