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
 * Unit Tests fuer PrismaUserMapper (Infrastructure Layer).
 *
 * Diese Tests validieren die bidirektionale Transformation zwischen:
 * - Domain Layer: UserAggregate mit Value Objects (UserId, Username, UserRole)
 * - Infrastructure Layer: Prisma User mit primitiven Typen
 *
 * **Test Strategy:**
 * - Einzelne Mapper-Methoden isoliert testen (toAggregate, toPersistence)
 * - Round-Trip Tests: Domain → Prisma → Domain = strukturell gleich
 * - Role Mapping Tests: UserRole VO ↔ Prisma UserRole Enum
 * - Username Normalization: Username wird lowercase in DB gespeichert
 * - Edge Cases: isLocked, soft delete, invalid IDs
 *
 * Epic 4 Story 4-7 | Hexagonale Architektur Migration - Authentication Lifecycle
 */

import { UserAggregate } from '@domain/aggregates/user.aggregate';
import { Username } from '@domain/value-objects/username';
import { UserRole } from '@domain/value-objects/user-role';
import type { UserRole as PrismaUserRole } from '@prisma/client';
import { PrismaUserMapper, type UserWithRelations } from '../prisma-user.mapper';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Erstellt eine valide CUID2-Format Test-ID fuer Tests.
 * CUID2 Format: 20-30 Zeichen, lowercase a-z0-9, beginnt mit Kleinbuchstabe.
 *
 * @param suffix - Optionaler Suffix fuer Eindeutigkeit (wird lowercased)
 * @returns Ein valider 25-Zeichen CUID2-aehnlicher String
 */
function createValidTestId(suffix = ''): string {
  // Base: valid CUID2 prefix (20 chars)
  const base = 'clw3h8x9y0000qwertyui';
  // Suffix: lowercase alphanumeric only, padded to 5 chars
  const safeSuffix = suffix
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .padEnd(5, '0')
    .slice(0, 5);
  return base + safeSuffix; // Total: 25 chars
}

/**
 * Erstellt ein Mock Prisma User Objekt fuer Tests.
 *
 * @param overrides - Optionale Felder zum Ueberschreiben
 * @returns Mock PrismaUser
 */
function createMockPrismaUser(overrides: Partial<UserWithRelations> = {}): UserWithRelations {
  return {
    id: createValidTestId('usr01'),
    username: 'testuser',
    email: 'test@example.com',
    passwordHash: null,
    name: 'Test User',
    role: 'USER' as PrismaUserRole,
    isActive: true,
    isLocked: false,
    isDeleted: false,
    lockedManuallyAt: null,
    lockedManuallyBy: null,
    lockReason: null,
    lockedUntil: null,
    failedLoginCount: 0,
    lastLoginAt: null,
    deletedAt: null,
    deletedBy: null,
    createdAt: new Date('2025-01-01T10:00:00Z'),
    updatedAt: new Date('2025-01-01T10:00:00Z'),
    ...overrides,
  };
}

/**
 * Erstellt ein Domain User Aggregate fuer Tests.
 *
 * @param overrides - Optionale Werte zum Ueberschreiben
 * @returns UserAggregate
 */
function createDomainUser(overrides: { username?: string; role?: UserRole } = {}): UserAggregate {
  const usernameResult = Username.create(overrides.username ?? 'TestUser'); // Mixed case
  const userResult = UserAggregate.create(usernameResult.value as Username, overrides.role ?? UserRole.USER());

  return userResult.value as UserAggregate;
}

// ============================================================================
// PRISMA USER MAPPER TESTS - toAggregate()
// ============================================================================

describe('PrismaUserMapper', () => {
  describe('toAggregate() - Basic Reconstruction', () => {
    it('sollte Prisma User zu Domain Aggregate rekonstruieren', () => {
      // Given: Valid Prisma User
      const prismaUser = createMockPrismaUser({
        id: createValidTestId('usr01'),
        username: 'testuser',
        role: 'ADMIN' as PrismaUserRole,
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaUserMapper.toAggregate(prismaUser);

      // Then: Aggregate hat korrekte Properties
      expect(aggregate).toBeInstanceOf(UserAggregate);
      expect(aggregate.id.value).toBe(prismaUser.id);
      expect(aggregate.username.value).toBe('testuser');
      expect(aggregate.role.value).toBe('ADMIN');
    });

    it('sollte Timestamps korrekt rekonstruieren', () => {
      // Given: Prisma User mit Timestamps
      const createdAt = new Date('2025-01-01T08:00:00Z');
      const updatedAt = new Date('2025-01-05T15:30:00Z');
      const prismaUser = createMockPrismaUser({
        createdAt,
        updatedAt,
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaUserMapper.toAggregate(prismaUser);

      // Then: Aggregate hat korrekte Timestamps
      expect(aggregate.createdAt).toEqual(createdAt);
      expect(aggregate.updatedAt).toEqual(updatedAt);
    });

    it('sollte Domain Events nach Reconstruction geleert haben', () => {
      // Given: Prisma User
      const prismaUser = createMockPrismaUser();

      // When: toAggregate() aufgerufen
      const aggregate = PrismaUserMapper.toAggregate(prismaUser);

      // Then: Aggregate hat keine uncommitted Domain Events
      // (Factory emittiert UserCreatedEvent, aber Mapper cleared diese)
      expect(aggregate.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('toAggregate() - Role Mapping', () => {
    it('sollte Role SUPER_ADMIN korrekt mappen', () => {
      // Given: Prisma User mit Role SUPER_ADMIN
      const prismaUser = createMockPrismaUser({
        role: 'SUPER_ADMIN' as PrismaUserRole,
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaUserMapper.toAggregate(prismaUser);

      // Then: Domain Role ist SUPER_ADMIN
      expect(aggregate.role.value).toBe('SUPER_ADMIN');
    });

    it('sollte Role ADMIN korrekt mappen', () => {
      // Given: Prisma User mit Role ADMIN
      const prismaUser = createMockPrismaUser({
        role: 'ADMIN' as PrismaUserRole,
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaUserMapper.toAggregate(prismaUser);

      // Then: Domain Role ist ADMIN
      expect(aggregate.role.value).toBe('ADMIN');
    });

    it('sollte Role USER korrekt mappen', () => {
      // Given: Prisma User mit Role USER
      const prismaUser = createMockPrismaUser({
        role: 'USER' as PrismaUserRole,
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaUserMapper.toAggregate(prismaUser);

      // Then: Domain Role ist USER
      expect(aggregate.role.value).toBe('USER');
    });

    it('sollte alle Role-Varianten korrekt mappen (USER, ADMIN, SUPER_ADMIN)', () => {
      // Test alle Role-Mappings
      const roleVariants: PrismaUserRole[] = ['USER', 'ADMIN', 'SUPER_ADMIN'];

      for (const role of roleVariants) {
        // Given: Prisma User mit spezifischer Role
        const prismaUser = createMockPrismaUser({ role });

        // When: toAggregate() aufgerufen
        const aggregate = PrismaUserMapper.toAggregate(prismaUser);

        // Then: Role ist korrekt gemapped
        expect(aggregate.role.value).toBe(role);
      }
    });
  });

  describe('toAggregate() - Lock State', () => {
    it('sollte isLocked=true korrekt rekonstruieren', () => {
      // Given: Prisma User mit isLocked=true
      const prismaUser = createMockPrismaUser({
        isLocked: true,
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaUserMapper.toAggregate(prismaUser);

      // Then: Domain isLocked ist true
      expect(aggregate.isLocked).toBe(true);
    });

    it('sollte isLocked=false korrekt rekonstruieren', () => {
      // Given: Prisma User mit isLocked=false
      const prismaUser = createMockPrismaUser({
        isLocked: false,
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaUserMapper.toAggregate(prismaUser);

      // Then: Domain isLocked ist false
      expect(aggregate.isLocked).toBe(false);
    });
  });

  describe('toAggregate() - Error Handling', () => {
    it('sollte Fehler werfen bei ungültiger UserId', () => {
      // Given: Prisma User mit ungültiger ID (zu kurz)
      const prismaUser = createMockPrismaUser({
        id: 'invalid', // Zu kurz fuer CUID2
      });

      // When/Then: toAggregate() wirft Error
      expect(() => {
        PrismaUserMapper.toAggregate(prismaUser);
      }).toThrow('Invalid UserId');
    });

    it('sollte Fehler werfen bei ungültigem Username', () => {
      // Given: Prisma User mit ungültigem Username (zu kurz)
      const prismaUser = createMockPrismaUser({
        username: 'ab', // Zu kurz (min. 3 Zeichen)
      });

      // When/Then: toAggregate() wirft Error
      expect(() => {
        PrismaUserMapper.toAggregate(prismaUser);
      }).toThrow('Invalid Username');
    });

    it('sollte Fehler werfen bei unbekannter Role', () => {
      // Given: Prisma User mit unbekannter Role (simuliert DB-Corruption)
      const prismaUser = createMockPrismaUser({
        role: 'UNKNOWN_ROLE' as PrismaUserRole,
      });

      // When/Then: toAggregate() wirft Error
      expect(() => {
        PrismaUserMapper.toAggregate(prismaUser);
      }).toThrow('Unknown UserRole');
    });
  });

  // ============================================================================
  // PRISMA USER MAPPER TESTS - toPersistence()
  // ============================================================================

  describe('toPersistence() - Basic Conversion', () => {
    it('sollte Domain Aggregate zu Persistence Data konvertieren', () => {
      // Given: Domain User Aggregate
      const user = createDomainUser({
        username: 'TestUser',
        role: UserRole.USER(),
      });

      // When: toPersistence() aufgerufen
      const persistData = PrismaUserMapper.toPersistence(user);

      // Then: Persistence Data hat korrekte Struktur
      expect(persistData.id).toBe(user.id.value);
      expect(persistData.username).toBe('testuser'); // lowercase normalisiert
      expect(persistData.role).toBe('USER');
      expect(persistData.isLocked).toBe(false);
    });

    it('sollte Username zu lowercase normalisieren', () => {
      // Given: Domain Aggregate mit Mixed-Case Username
      const user = createDomainUser({
        username: 'TestUser', // Mixed case
      });

      // When: toPersistence() aufgerufen
      const persistData = PrismaUserMapper.toPersistence(user);

      // Then: Username ist lowercase
      expect(persistData.username).toBe('testuser');
    });

    it('sollte Timestamps korrekt uebernehmen', () => {
      // Given: Domain Aggregate (mit auto-generierten Timestamps)
      const user = createDomainUser();

      // When: toPersistence() aufgerufen
      const persistData = PrismaUserMapper.toPersistence(user);

      // Then: Timestamps sind uebernommen
      expect(persistData.createdAt).toEqual(user.createdAt);
      expect(persistData.updatedAt).toEqual(user.updatedAt);
    });

    it('sollte Default Values fuer Prisma-Schema setzen', () => {
      // Given: Domain Aggregate
      const user = createDomainUser();

      // When: toPersistence() aufgerufen
      const persistData = PrismaUserMapper.toPersistence(user);

      // Then: Default Values sind gesetzt
      expect(persistData.passwordHash).toBeNull();
      expect(persistData.isActive).toBe(true); // !isLocked
      expect(persistData.lastLoginAt).toBeNull();
      expect(persistData.failedLoginCount).toBe(0);
      expect(persistData.lockedUntil).toBeNull();
      expect(persistData.isDeleted).toBe(false);
      expect(persistData.deletedAt).toBeNull();
      expect(persistData.deletedBy).toBeNull();
    });
  });

  describe('toPersistence() - Role Mapping', () => {
    it('sollte Role SUPER_ADMIN zu Prisma Enum mappen', () => {
      // Given: Domain Aggregate mit SUPER_ADMIN Role
      const usernameResult = Username.create('superadmin');
      const user = UserAggregate.create(usernameResult.value as Username, UserRole.SUPER_ADMIN()).value as UserAggregate;

      // When: toPersistence() aufgerufen
      const persistData = PrismaUserMapper.toPersistence(user);

      // Then: Prisma Role ist SUPER_ADMIN
      expect(persistData.role).toBe('SUPER_ADMIN');
    });

    it('sollte Role ADMIN zu Prisma Enum mappen', () => {
      // Given: Domain Aggregate mit ADMIN Role
      const usernameResult = Username.create('admin');
      const user = UserAggregate.create(usernameResult.value as Username, UserRole.ADMIN()).value as UserAggregate;

      // When: toPersistence() aufgerufen
      const persistData = PrismaUserMapper.toPersistence(user);

      // Then: Prisma Role ist ADMIN
      expect(persistData.role).toBe('ADMIN');
    });

    it('sollte Role USER zu Prisma Enum mappen', () => {
      // Given: Domain Aggregate mit USER Role
      const user = createDomainUser({
        role: UserRole.USER(),
      });

      // When: toPersistence() aufgerufen
      const persistData = PrismaUserMapper.toPersistence(user);

      // Then: Prisma Role ist USER
      expect(persistData.role).toBe('USER');
    });
  });

  describe('toPersistence() - Lock State Mapping', () => {
    it('sollte isLocked=false korrekt mappen', () => {
      // Given: Domain Aggregate (default nicht gesperrt)
      const user = createDomainUser();

      // When: toPersistence() aufgerufen
      const persistData = PrismaUserMapper.toPersistence(user);

      // Then: isLocked ist false
      expect(persistData.isLocked).toBe(false);
      expect(persistData.lockedManuallyAt).toBeNull();
    });

    it('sollte isLocked=true korrekt mappen', () => {
      // Given: Prisma User mit isLocked=true rekonstruieren
      const prismaUser = createMockPrismaUser({
        isLocked: true,
      });
      const aggregate = PrismaUserMapper.toAggregate(prismaUser);

      // When: toPersistence() aufgerufen
      const persistData = PrismaUserMapper.toPersistence(aggregate);

      // Then: isLocked ist true, lockedManuallyAt ist gesetzt
      expect(persistData.isLocked).toBe(true);
      expect(persistData.lockedManuallyAt).toBeInstanceOf(Date);
    });
  });

  // ============================================================================
  // ROUND-TRIP TESTS
  // ============================================================================

  describe('Round-Trip Tests', () => {
    it('sollte Aggregate Daten bei Domain -> Prisma -> Domain Konvertierung erhalten', () => {
      // Given: Original Prisma User erstellen
      const originalPrisma = createMockPrismaUser({
        id: createValidTestId('usr99'),
        username: 'testuser',
        role: 'ADMIN' as PrismaUserRole,
        isLocked: false,
      });

      // When: Prisma -> Domain -> Prisma
      const aggregate = PrismaUserMapper.toAggregate(originalPrisma);
      const persistData = PrismaUserMapper.toPersistence(aggregate);

      // Simuliere DB-Row aus Persistence Data
      const simulatedDbRow: UserWithRelations = {
        ...originalPrisma,
        username: persistData.username,
        role: persistData.role,
        isLocked: persistData.isLocked,
        createdAt: persistData.createdAt,
        updatedAt: persistData.updatedAt,
      };

      const reconstructedAggregate = PrismaUserMapper.toAggregate(simulatedDbRow);

      // Then: Rekonstruiertes Aggregate entspricht Original
      expect(reconstructedAggregate.id.value).toBe(originalPrisma.id);
      expect(reconstructedAggregate.username.value).toBe(originalPrisma.username);
      expect(reconstructedAggregate.role.value).toBe(originalPrisma.role);
      expect(reconstructedAggregate.isLocked).toBe(originalPrisma.isLocked);
    });

    it('sollte Round-Trip mit allen Role-Varianten korrekt handhaben', () => {
      const roleVariants: PrismaUserRole[] = ['USER', 'ADMIN', 'SUPER_ADMIN'];

      for (const role of roleVariants) {
        // Given: Prisma User mit spezifischer Role
        const prismaUser = createMockPrismaUser({ role });
        const originalAggregate = PrismaUserMapper.toAggregate(prismaUser);

        // When: Round-Trip
        const persistData = PrismaUserMapper.toPersistence(originalAggregate);
        const simulatedDbRow: UserWithRelations = {
          ...prismaUser,
          role: persistData.role,
        };
        const reconstructedAggregate = PrismaUserMapper.toAggregate(simulatedDbRow);

        // Then: Role bleibt erhalten
        expect(reconstructedAggregate.role.value).toBe(role);
      }
    });

    it('sollte Round-Trip mit isLocked=true korrekt handhaben', () => {
      // Given: Prisma User mit isLocked=true
      const prismaUser = createMockPrismaUser({
        isLocked: true,
        lockedManuallyAt: new Date('2025-01-15T10:00:00Z'),
        lockedManuallyBy: createValidTestId('usr02'),
        lockReason: 'Security violation',
      });
      const originalAggregate = PrismaUserMapper.toAggregate(prismaUser);

      // When: Round-Trip
      const persistData = PrismaUserMapper.toPersistence(originalAggregate);
      const simulatedDbRow: UserWithRelations = {
        ...prismaUser,
        isLocked: persistData.isLocked,
      };
      const reconstructedAggregate = PrismaUserMapper.toAggregate(simulatedDbRow);

      // Then: isLocked bleibt erhalten
      expect(reconstructedAggregate.isLocked).toBe(true);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('sollte Locked User korrekt handhaben', () => {
      // Given: Prisma User mit isLocked=true und allen Lock-Feldern
      const prismaUser = createMockPrismaUser({
        isLocked: true,
        lockedManuallyAt: new Date('2025-01-10T15:00:00Z'),
        lockedManuallyBy: createValidTestId('usr02'),
        lockReason: 'Suspicious activity detected',
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaUserMapper.toAggregate(prismaUser);

      // Then: Aggregate hat isLocked=true
      expect(aggregate.isLocked).toBe(true);

      // When: toPersistence() aufgerufen
      const persistData = PrismaUserMapper.toPersistence(aggregate);

      // Then: Lock State ist persistiert
      expect(persistData.isLocked).toBe(true);
      expect(persistData.lockedManuallyAt).toBeInstanceOf(Date);
    });

    it('sollte Soft-Deleted User korrekt handhaben (Rekonstruktion erlaubt)', () => {
      // Given: Prisma User mit isDeleted=true (Soft Delete)
      const prismaUser = createMockPrismaUser({
        isDeleted: true,
        deletedAt: new Date('2025-01-20T12:00:00Z'),
        deletedBy: createValidTestId('usr02'),
      });

      // When: toAggregate() aufgerufen
      const aggregate = PrismaUserMapper.toAggregate(prismaUser);

      // Then: Aggregate ist rekonstruiert (isDeleted ist DB-Konzept, nicht Domain)
      expect(aggregate).toBeDefined();
      expect(aggregate.id.value).toBe(prismaUser.id);
    });

    it('sollte Username Case-Sensitivity bei Round-Trip handhaben', () => {
      // Given: Prisma User mit lowercase username
      const prismaUser = createMockPrismaUser({
        username: 'testuser', // lowercase in DB
      });
      const aggregate = PrismaUserMapper.toAggregate(prismaUser);

      // When: toPersistence() aufgerufen
      const persistData = PrismaUserMapper.toPersistence(aggregate);

      // Then: Username bleibt lowercase
      expect(persistData.username).toBe('testuser');

      // When: Aggregate mit Mixed-Case Username erstellen
      const usernameResult = Username.create('TestUser'); // Mixed case
      const newAggregate = UserAggregate.create(usernameResult.value as Username, UserRole.USER()).value as UserAggregate;
      const newPersistData = PrismaUserMapper.toPersistence(newAggregate);

      // Then: Username wird zu lowercase normalisiert
      expect(newPersistData.username).toBe('testuser'); // lowercase
    });

    it('sollte isActive invertiert zu isLocked mappen', () => {
      // Given: Domain User mit isLocked=false
      const user = createDomainUser();

      // When: toPersistence() aufgerufen
      const persistData = PrismaUserMapper.toPersistence(user);

      // Then: isActive ist true (invertiert zu isLocked)
      expect(persistData.isActive).toBe(true); // !isLocked

      // Given: Prisma User mit isLocked=true rekonstruieren
      const prismaUser = createMockPrismaUser({
        isLocked: true,
      });
      const lockedAggregate = PrismaUserMapper.toAggregate(prismaUser);

      // When: toPersistence() aufgerufen
      const lockedPersistData = PrismaUserMapper.toPersistence(lockedAggregate);

      // Then: isActive ist false (invertiert zu isLocked)
      expect(lockedPersistData.isActive).toBe(false); // !isLocked
    });

    it('sollte null/undefined fuer optionale Felder korrekt handhaben', () => {
      // Given: Minimales Domain Aggregate (nur required Felder)
      const user = createDomainUser({
        username: 'MinimalUser',
        role: UserRole.USER(),
      });

      // When: toPersistence() aufgerufen
      const persistData = PrismaUserMapper.toPersistence(user);

      // Then: Optionale Felder sind null
      expect(persistData.passwordHash).toBeNull();
      expect(persistData.lastLoginAt).toBeNull();
      expect(persistData.lockedUntil).toBeNull();
      expect(persistData.deletedAt).toBeNull();
      expect(persistData.deletedBy).toBeNull();
      expect(persistData.lockedManuallyAt).toBeNull(); // isLocked=false → null
    });
  });
});
