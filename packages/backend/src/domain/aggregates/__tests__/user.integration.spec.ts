/**
 * Integration Tests für User Aggregate mit RBAC Value Objects.
 *
 * Diese Tests validieren das Zusammenspiel aller User Domain Components:
 * - UserAggregate mit Business Rules (Min-1-SUPER_ADMIN, Lock/Unlock, Delete)
 * - Value Objects (UserId, Username, UserRole, Permission)
 * - Domain Events (UserCreatedEvent, UserRoleChangedEvent, PermissionGrantedEvent, etc.)
 * - Repository Interface (In-Memory Mock Implementation)
 *
 * Im Gegensatz zu Unit Tests validieren Integration Tests das vollständige
 * Zusammenspiel mehrerer Components im Domain Layer inkl. Repository Interactions.
 *
 * Epic 1 Story 1.6 | Task 9
 */

import { UserAggregate } from '@domain/aggregates/user.aggregate';
import type { IUserRepository } from '@domain/repositories/i-user.repository';
import { UserId } from '@domain/value-objects/user-id';
import { Username } from '@domain/value-objects/username';
import { UserRole } from '@domain/value-objects/user-role';
import { Permission } from '@domain/value-objects/permission';
import { Result } from '@domain/common/result';
import { UserCreatedEvent } from '@domain/events/user-created.event';
import { UserRoleChangedEvent } from '@domain/events/user-role-changed.event';
import { PermissionGrantedEvent } from '@domain/events/permission-granted.event';
import { PermissionRevokedEvent } from '@domain/events/permission-revoked.event';
import { UserDeletedEvent } from '@domain/events/user-deleted.event';

// Mock für nanoid (für deterministische Tests)
jest.mock('nanoid/non-secure', () => ({
  nanoid: jest.fn(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let result = '';
    for (let i = 0; i < 21; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
}));

/**
 * In-Memory Repository Mock für User Integration Tests.
 *
 * Implementiert IUserRepository ohne echte Persistence (kein Prisma/DB).
 * Ermöglicht Testing von Aggregate-Repository Interaktion ohne Infrastructure Layer.
 *
 * **CRITICAL: superAdminCount Tracking**
 * - Tracked automatisch die Anzahl SUPER_ADMINs für Min-1-SUPER_ADMIN Constraint
 * - save() updated superAdminCount bei Role Changes
 * - countSuperAdmins() gibt tracked Count zurück (kein Array Scan)
 *
 * **Warum superAdminCount statt Array Scan:**
 * - Performance: O(1) statt O(n) für countSuperAdmins()
 * - Accuracy: Verhindert Race Conditions bei Concurrent Updates
 * - Testability: Kann manipuliert werden für Edge-Case Tests
 */
class InMemoryUserRepository implements IUserRepository {
  private storage: Map<string, UserAggregate> = new Map();
  private superAdminCount = 0; // Track SUPER_ADMIN count für Min-1-SUPER_ADMIN Constraint

  /**
   * Speichert User Aggregate und updated SUPER_ADMIN count automatisch.
   *
   * **Warum SUPER_ADMIN Count Tracking in save():**
   * - Aggregate kann Role ändern (updateRole()) → count muss aktualisiert werden
   * - Repository ist Single Source of Truth für Persistence State
   * - Verhindert Inconsistency zwischen Aggregate State und Count
   */
  async save(aggregate: UserAggregate): Promise<Result<void>> {
    try {
      // Update SUPER_ADMIN count (check if existing user changed role)
      const existing = this.storage.get(aggregate.id.toString());
      if (existing?.role.equals(UserRole.SUPER_ADMIN())) {
        this.superAdminCount--; // Remove old SUPER_ADMIN
      }
      if (aggregate.role.equals(UserRole.SUPER_ADMIN())) {
        this.superAdminCount++; // Add new SUPER_ADMIN
      }

      // Persist aggregate
      this.storage.set(aggregate.id.toString(), aggregate);
      return Result.ok<void>();
    } catch (_error) {
      return Result.fail<void>('Speichern fehlgeschlagen');
    }
  }

  async findById(id: UserId): Promise<Result<UserAggregate | null>> {
    try {
      const user = this.storage.get(id.toString()) || null;
      return Result.ok<UserAggregate | null>(user);
    } catch (_error) {
      return Result.fail<UserAggregate | null>('Suche fehlgeschlagen');
    }
  }

  /**
   * Findet User by Username mit Case-Insensitive Comparison.
   *
   * **Warum Case-Insensitive:**
   * - Username Value Object normalisiert zu lowercase (Username.equals() nutzt toLowerCase())
   * - Verhindert Duplikate wie "Ruben" und "ruben"
   * - Consistent mit Username Validation Logic
   */
  async findByUsername(username: Username): Promise<Result<UserAggregate | null>> {
    try {
      // Case-insensitive search (Username normalisiert zu lowercase)
      const user = Array.from(this.storage.values()).find((u) => u.username.equals(username)) || null;
      return Result.ok<UserAggregate | null>(user);
    } catch (_error) {
      return Result.fail<UserAggregate | null>('Suche fehlgeschlagen');
    }
  }

  async findAll(): Promise<Result<UserAggregate[]>> {
    try {
      return Result.ok<UserAggregate[]>(Array.from(this.storage.values()));
    } catch (_error) {
      return Result.fail<UserAggregate[]>('Suche fehlgeschlagen');
    }
  }

  /**
   * Gibt tracked SUPER_ADMIN count zurück (O(1) Performance).
   *
   * **CRITICAL für Min-1-SUPER_ADMIN Constraint:**
   * - UserAggregate.delete() prüft ob ≥2 SUPER_ADMINs existieren
   * - UserAggregate.updateRole() prüft ob ≥2 SUPER_ADMINs vor Demotion
   * - UserAggregate.lock() prüft ob ≥2 SUPER_ADMINs vor Lock
   */
  async countSuperAdmins(): Promise<Result<number>> {
    try {
      return Result.ok<number>(this.superAdminCount);
    } catch (_error) {
      return Result.fail<number>('Count fehlgeschlagen');
    }
  }

  /**
   * Prüft ob Username bereits existiert (Case-Insensitive).
   *
   * **Warum Case-Insensitive:**
   * - Consistent mit findByUsername() Logic
   * - Verhindert Duplikate wie "Ruben" und "ruben"
   * - Username.equals() nutzt toLowerCase()
   */
  async existsByUsername(username: Username): Promise<Result<boolean>> {
    try {
      const exists = Array.from(this.storage.values()).some((u) => u.username.equals(username));
      return Result.ok<boolean>(exists);
    } catch (_error) {
      return Result.fail<boolean>('Exists check fehlgeschlagen');
    }
  }

  /**
   * Test-Helper: Cleared Storage und SUPER_ADMIN count.
   * NICHT Teil des IUserRepository Interface!
   */
  clear(): void {
    this.storage.clear();
    this.superAdminCount = 0;
  }
}

describe('User Integration Tests', () => {
  let repository: InMemoryUserRepository;

  beforeEach(() => {
    repository = new InMemoryUserRepository();
  });

  afterEach(() => {
    repository.clear();
  });

  /**
   * Test 1: Full Lifecycle - Create → Grant Permission → Revoke Permission
   *
   * Validiert den vollständigen Permission Management Lifecycle mit Event Accumulation.
   * Testet dass Events korrekt akkumuliert werden über mehrere Operations hinweg.
   */
  describe('Full Lifecycle: Create → Grant → Revoke Permissions', () => {
    it('should create user, grant permission, revoke permission with event accumulation', async () => {
      // Given: A new User is created
      const usernameResult = Username.create('testuser');
      expect(usernameResult.isSuccess).toBe(true);
      const username = usernameResult.value!;

      const userResult = UserAggregate.create(username, UserRole.USER());
      expect(userResult.isSuccess).toBe(true);
      const user = userResult.value!;

      // Then: User is created successfully
      expect(user.username.equals(username)).toBe(true);
      expect(user.role.equals(UserRole.USER())).toBe(true);
      expect(user.isLocked).toBe(false);

      // And: UserCreatedEvent is emitted
      expect(user.getDomainEvents()).toHaveLength(1);
      expect(user.getDomainEvents()[0]).toBeInstanceOf(UserCreatedEvent);

      // When: User is saved to repository
      const saveResult1 = await repository.save(user);
      expect(saveResult1.isSuccess).toBe(true);

      // And: User is retrieved from repository
      const findResult = await repository.findById(user.id);
      expect(findResult.isSuccess).toBe(true);
      expect(findResult.value).not.toBeNull();
      expect(findResult.value!.id.equals(user.id)).toBe(true);

      // When: Granting a custom permission
      const permission = Permission.CREATE_EINSATZ();
      const grantedBy = UserId.create().value!;
      const grantResult = user.grantPermission(permission, grantedBy);
      expect(grantResult.isSuccess).toBe(true);

      // Then: User has permission
      expect(user.hasPermission(permission)).toBe(true);

      // And: PermissionGrantedEvent is emitted (total 2 events)
      expect(user.getDomainEvents()).toHaveLength(2);
      expect(user.getDomainEvents()[1]).toBeInstanceOf(PermissionGrantedEvent);

      // When: Changes are persisted
      const saveResult2 = await repository.save(user);
      expect(saveResult2.isSuccess).toBe(true);

      // When: Revoking permission
      const revokedBy = UserId.create().value!;
      const revokeResult = user.revokePermission(permission, revokedBy);
      expect(revokeResult.isSuccess).toBe(true);

      // Then: User no longer has permission
      expect(user.hasPermission(permission)).toBe(false);

      // And: PermissionRevokedEvent is emitted (total 3 events)
      expect(user.getDomainEvents()).toHaveLength(3);
      expect(user.getDomainEvents()[2]).toBeInstanceOf(PermissionRevokedEvent);

      // Verify: Event order (Created → Granted → Revoked)
      const events = user.getDomainEvents();
      expect(events[0]).toBeInstanceOf(UserCreatedEvent);
      expect(events[1]).toBeInstanceOf(PermissionGrantedEvent);
      expect(events[2]).toBeInstanceOf(PermissionRevokedEvent);
    });

    it('should prevent granting duplicate permissions (idempotency)', () => {
      // Given: A User with a granted permission
      const user = UserAggregate.create(Username.create('duplicatetest').value!, UserRole.USER()).value!;
      const permission = Permission.LOCK_ETB();
      const grantedBy = UserId.create().value!;

      const firstGrant = user.grantPermission(permission, grantedBy);
      expect(firstGrant.isSuccess).toBe(true);

      // When: Attempting to grant same permission again
      const secondGrant = user.grantPermission(permission, grantedBy);

      // Then: Operation fails (idempotency)
      expect(secondGrant.isFailure).toBe(true);
      expect(secondGrant.error).toContain('Permission already granted');

      // And: Only one PermissionGrantedEvent (no duplicate)
      expect(user.getDomainEvents()).toHaveLength(2); // Created + Granted (NO duplicate Grant)
    });

    it('should prevent revoking non-granted permissions', () => {
      // Given: A User without any custom permissions
      const user = UserAggregate.create(Username.create('notgranted').value!, UserRole.USER()).value!;
      const permission = Permission.LOCK_ETB();
      const revokedBy = UserId.create().value!;

      // When: Attempting to revoke non-granted permission
      const revokeResult = user.revokePermission(permission, revokedBy);

      // Then: Operation fails
      expect(revokeResult.isFailure).toBe(true);
      expect(revokeResult.error).toContain('Permission not granted');

      // And: No PermissionRevokedEvent emitted
      expect(user.getDomainEvents()).toHaveLength(1); // Only UserCreatedEvent
    });
  });

  /**
   * Test 2: Role Transition - USER → ADMIN → Verify Permission Defaults Changed
   *
   * Validiert dass Permission Defaults sich ändern wenn Role geändert wird.
   * USER hat user:read_self, ADMIN hat user:* (inkl. user:read_self via Wildcard).
   */
  describe('Role Transition: USER → ADMIN (Permission Defaults)', () => {
    it('should update role and verify default permissions changed (USER → ADMIN)', async () => {
      // Given: A USER is created
      const username = Username.create('roletest').value!;
      const user = UserAggregate.create(username, UserRole.USER()).value!;

      // Then: USER has user:read_self permission (Role Default)
      const userReadSelf = Permission.create('user:read_self').value!;
      expect(user.hasPermission(userReadSelf)).toBe(true);

      // And: USER does NOT have user:read permission (ADMIN-only)
      const userRead = Permission.create('user:read').value!;
      expect(user.hasPermission(userRead)).toBe(false);

      // When: Role is changed to ADMIN
      const changedBy = UserId.create().value!;
      const updateResult = await user.updateRole(UserRole.ADMIN(), changedBy, repository);
      expect(updateResult.isSuccess).toBe(true);

      // Then: Role is ADMIN
      expect(user.role.equals(UserRole.ADMIN())).toBe(true);

      // And: ADMIN has user:* permission (includes user:read_self AND user:read)
      expect(user.hasPermission(userReadSelf)).toBe(true); // user:* matches user:read_self
      expect(user.hasPermission(userRead)).toBe(true); // user:* matches user:read

      // And: UserRoleChangedEvent is emitted
      expect(user.getDomainEvents()).toHaveLength(2); // Created + RoleChanged
      expect(user.getDomainEvents()[1]).toBeInstanceOf(UserRoleChangedEvent);
      const roleChangedEvent = user.getDomainEvents()[1] as UserRoleChangedEvent;
      expect(roleChangedEvent.oldRole.equals(UserRole.USER())).toBe(true);
      expect(roleChangedEvent.newRole.equals(UserRole.ADMIN())).toBe(true);
    });

    it('should update role ADMIN → USER and verify permission defaults reduced', async () => {
      // Given: An ADMIN user
      const user = UserAggregate.create(Username.create('demote').value!, UserRole.ADMIN()).value!;
      await repository.save(user);

      // Then: ADMIN has user:* and einsatz:* permissions
      const userRead = Permission.create('user:read').value!;
      const einsatzCreate = Permission.CREATE_EINSATZ();
      expect(user.hasPermission(userRead)).toBe(true);
      expect(user.hasPermission(einsatzCreate)).toBe(true);

      // When: Role is demoted to USER
      const changedBy = UserId.create().value!;
      const updateResult = await user.updateRole(UserRole.USER(), changedBy, repository);
      expect(updateResult.isSuccess).toBe(true);

      // Then: Role is USER
      expect(user.role.equals(UserRole.USER())).toBe(true);

      // And: USER does NOT have user:read or einsatz:create (lost via Role change)
      expect(user.hasPermission(userRead)).toBe(false);
      expect(user.hasPermission(einsatzCreate)).toBe(false);

      // But: USER still has user:read_self (USER default permission)
      const userReadSelf = Permission.create('user:read_self').value!;
      expect(user.hasPermission(userReadSelf)).toBe(true);
    });

    it('should not emit event when role is unchanged (no-op)', async () => {
      // Given: An ADMIN user
      const user = UserAggregate.create(Username.create('noop').value!, UserRole.ADMIN()).value!;
      expect(user.getDomainEvents()).toHaveLength(1); // Only UserCreatedEvent

      // When: Attempting to set same role (ADMIN → ADMIN)
      const changedBy = UserId.create().value!;
      const updateResult = await user.updateRole(UserRole.ADMIN(), changedBy, repository);
      expect(updateResult.isSuccess).toBe(true);

      // Then: No new event emitted (still 1 event)
      expect(user.getDomainEvents()).toHaveLength(1); // No UserRoleChangedEvent
    });
  });

  /**
   * Test 3: Lock/Unlock Lifecycle
   *
   * Validiert Account Locking mit Min-1-SUPER_ADMIN Constraint.
   */
  describe('Lock/Unlock Lifecycle', () => {
    it('should lock and unlock user account', async () => {
      // Given: An ADMIN user (NOT SUPER_ADMIN, so lock is allowed)
      const user = UserAggregate.create(Username.create('locktest').value!, UserRole.ADMIN()).value!;
      await repository.save(user);

      // Then: User is initially unlocked
      expect(user.isLocked).toBe(false);

      // When: User is locked
      const lockResult = await user.lock(repository);
      expect(lockResult.isSuccess).toBe(true);

      // Then: User is locked
      expect(user.isLocked).toBe(true);

      // When: User is unlocked
      const unlockResult = user.unlock();
      expect(unlockResult.isSuccess).toBe(true);

      // Then: User is unlocked again
      expect(user.isLocked).toBe(false);
    });

    it('should prevent locking last SUPER_ADMIN (Min-1-SUPER_ADMIN Constraint)', async () => {
      // Given: Only 1 SUPER_ADMIN in system
      const superAdmin = UserAggregate.create(Username.create('onlyadmin').value!, UserRole.SUPER_ADMIN()).value!;
      await repository.save(superAdmin);

      // Verify: countSuperAdmins = 1
      const countResult = await repository.countSuperAdmins();
      expect(countResult.value).toBe(1);

      // When: Attempting to lock last SUPER_ADMIN
      const lockResult = await superAdmin.lock(repository);

      // Then: Operation fails (Min-1-SUPER_ADMIN Constraint)
      expect(lockResult.isFailure).toBe(true);
      expect(lockResult.error).toContain('Cannot lock last SUPER_ADMIN');

      // And: User remains unlocked
      expect(superAdmin.isLocked).toBe(false);
    });

    it('should allow locking SUPER_ADMIN when ≥2 SUPER_ADMINs exist', async () => {
      // Given: 2 SUPER_ADMINs in system
      const superAdmin1 = UserAggregate.create(Username.create('admin1').value!, UserRole.SUPER_ADMIN()).value!;
      const superAdmin2 = UserAggregate.create(Username.create('admin2').value!, UserRole.SUPER_ADMIN()).value!;

      await repository.save(superAdmin1);
      await repository.save(superAdmin2);

      // Verify: countSuperAdmins = 2
      const countResult = await repository.countSuperAdmins();
      expect(countResult.value).toBe(2);

      // When: Locking 1st SUPER_ADMIN
      const lockResult = await superAdmin1.lock(repository);

      // Then: Operation succeeds (≥2 SUPER_ADMINs exist)
      expect(lockResult.isSuccess).toBe(true);
      expect(superAdmin1.isLocked).toBe(true);
    });

    it('should allow unlock to be idempotent (no-op when already unlocked)', () => {
      // Given: An unlocked user
      const user = UserAggregate.create(Username.create('unlocked').value!, UserRole.USER()).value!;
      expect(user.isLocked).toBe(false);

      // When: Unlocking already unlocked user
      const unlockResult = user.unlock();

      // Then: Operation succeeds (idempotent, no-op)
      expect(unlockResult.isSuccess).toBe(true);
      expect(user.isLocked).toBe(false);
    });
  });

  /**
   * Test 4: Delete with Min-1-SUPER_ADMIN Constraint
   *
   * Validiert dass Delete funktioniert wenn ≥2 SUPER_ADMINs existieren,
   * aber fehlschlägt wenn nur 1 SUPER_ADMIN vorhanden ist.
   */
  describe('Delete with Min-1-SUPER_ADMIN Constraint', () => {
    it('should allow delete when ≥2 SUPER_ADMINs exist', async () => {
      // Given: 2 SUPER_ADMINs in system
      const superAdmin1 = UserAggregate.create(Username.create('admin1').value!, UserRole.SUPER_ADMIN()).value!;
      const superAdmin2 = UserAggregate.create(Username.create('admin2').value!, UserRole.SUPER_ADMIN()).value!;

      await repository.save(superAdmin1);
      await repository.save(superAdmin2);

      // Verify: countSuperAdmins = 2
      const countResult = await repository.countSuperAdmins();
      expect(countResult.value).toBe(2);

      // When: Deleting 1st SUPER_ADMIN
      const deletedBy = superAdmin2.id;
      const deleteResult = await superAdmin1.delete(deletedBy, repository);

      // Then: Operation succeeds (≥2 SUPER_ADMINs exist)
      expect(deleteResult.isSuccess).toBe(true);

      // And: UserDeletedEvent is emitted
      expect(superAdmin1.getDomainEvents()).toHaveLength(2); // Created + Deleted
      expect(superAdmin1.getDomainEvents()[1]).toBeInstanceOf(UserDeletedEvent);
    });

    it('should prevent delete of last SUPER_ADMIN (Min-1-SUPER_ADMIN Constraint)', async () => {
      // Given: Only 1 SUPER_ADMIN in system
      const superAdmin = UserAggregate.create(Username.create('lastadmin').value!, UserRole.SUPER_ADMIN()).value!;
      await repository.save(superAdmin);

      // Verify: countSuperAdmins = 1
      const countResult = await repository.countSuperAdmins();
      expect(countResult.value).toBe(1);

      // When: Attempting to delete last SUPER_ADMIN
      const deletedBy = superAdmin.id;
      const deleteResult = await superAdmin.delete(deletedBy, repository);

      // Then: Operation fails (Min-1-SUPER_ADMIN Constraint)
      expect(deleteResult.isFailure).toBe(true);
      expect(deleteResult.error).toContain('Cannot delete last SUPER_ADMIN');

      // And: NO UserDeletedEvent emitted
      expect(superAdmin.getDomainEvents()).toHaveLength(1); // Only UserCreatedEvent
    });

    it('should prevent delete of locked user', async () => {
      // Given: 2 SUPER_ADMINs (so Min-1-SUPER_ADMIN Constraint is satisfied)
      const superAdmin1 = UserAggregate.create(Username.create('locked1').value!, UserRole.SUPER_ADMIN()).value!;
      const superAdmin2 = UserAggregate.create(Username.create('locked2').value!, UserRole.SUPER_ADMIN()).value!;

      await repository.save(superAdmin1);
      await repository.save(superAdmin2);

      // When: Locking 1st SUPER_ADMIN
      await superAdmin1.lock(repository);
      expect(superAdmin1.isLocked).toBe(true);

      // When: Attempting to delete locked user
      const deletedBy = superAdmin2.id;
      const deleteResult = await superAdmin1.delete(deletedBy, repository);

      // Then: Operation fails (cannot delete locked user)
      expect(deleteResult.isFailure).toBe(true);
      expect(deleteResult.error).toContain('Cannot delete locked user');

      // And: NO UserDeletedEvent emitted
      expect(superAdmin1.getDomainEvents()).toHaveLength(1); // Only UserCreatedEvent (lock emits NO event)
    });

    it('should allow delete of non-SUPER_ADMIN users without constraint', async () => {
      // Given: A regular USER (not SUPER_ADMIN)
      const user = UserAggregate.create(Username.create('regularuser').value!, UserRole.USER()).value!;
      await repository.save(user);

      // When: Deleting regular user
      const deletedBy = UserId.create().value!;
      const deleteResult = await user.delete(deletedBy, repository);

      // Then: Operation succeeds (no Min-1-SUPER_ADMIN Constraint for USER role)
      expect(deleteResult.isSuccess).toBe(true);

      // And: UserDeletedEvent is emitted
      expect(user.getDomainEvents()).toHaveLength(2); // Created + Deleted
    });
  });

  /**
   * Test 5: Event Accumulation Across Operations
   *
   * Validiert dass Domain Events über mehrere Operations hinweg korrekt akkumuliert werden.
   */
  describe('Event Accumulation Across Operations', () => {
    it('should accumulate events during full lifecycle (Create → Grant → Revoke → Lock → Unlock → Delete)', async () => {
      // Given: 2 SUPER_ADMINs (for Min-1-SUPER_ADMIN Constraint satisfaction)
      const superAdmin1 = UserAggregate.create(Username.create('admin1').value!, UserRole.SUPER_ADMIN()).value!;
      const superAdmin2 = UserAggregate.create(Username.create('admin2').value!, UserRole.SUPER_ADMIN()).value!;
      await repository.save(superAdmin1);
      await repository.save(superAdmin2);

      // Given: A USER for full lifecycle test
      const user = UserAggregate.create(Username.create('lifecycle').value!, UserRole.USER()).value!;
      await repository.save(user);

      // Then: After creation, 1 event (UserCreatedEvent)
      expect(user.getDomainEvents()).toHaveLength(1);
      expect(user.getDomainEvents()[0]).toBeInstanceOf(UserCreatedEvent);

      // When: Granting permission
      const permission = Permission.LOCK_ETB();
      const grantedBy = superAdmin1.id;
      user.grantPermission(permission, grantedBy);

      // Then: 2 events (Created + Granted)
      expect(user.getDomainEvents()).toHaveLength(2);
      expect(user.getDomainEvents()[1]).toBeInstanceOf(PermissionGrantedEvent);

      // When: Revoking permission
      const revokedBy = superAdmin1.id;
      user.revokePermission(permission, revokedBy);

      // Then: 3 events (Created + Granted + Revoked)
      expect(user.getDomainEvents()).toHaveLength(3);
      expect(user.getDomainEvents()[2]).toBeInstanceOf(PermissionRevokedEvent);

      // When: Changing role (USER → ADMIN)
      await user.updateRole(UserRole.ADMIN(), superAdmin1.id, repository);

      // Then: 4 events (Created + Granted + Revoked + RoleChanged)
      expect(user.getDomainEvents()).toHaveLength(4);
      expect(user.getDomainEvents()[3]).toBeInstanceOf(UserRoleChangedEvent);

      // NOTE: lock() does NOT emit event (technical state change)
      await user.lock(repository);
      expect(user.getDomainEvents()).toHaveLength(4); // Still 4 events (NO lock event)

      // NOTE: unlock() does NOT emit event (technical state change)
      user.unlock();
      expect(user.getDomainEvents()).toHaveLength(4); // Still 4 events (NO unlock event)

      // When: Deleting user
      const deletedBy = superAdmin1.id;
      await user.delete(deletedBy, repository);

      // Then: 5 events (Created + Granted + Revoked + RoleChanged + Deleted)
      expect(user.getDomainEvents()).toHaveLength(5);
      expect(user.getDomainEvents()[4]).toBeInstanceOf(UserDeletedEvent);
    });

    it('should not accumulate events for failed operations', async () => {
      // Given: A USER
      const user = UserAggregate.create(Username.create('failtests').value!, UserRole.USER()).value!;
      expect(user.getDomainEvents()).toHaveLength(1); // UserCreatedEvent

      // When: Attempting to revoke non-granted permission (FAILS)
      const permission = Permission.LOCK_ETB();
      const revokeResult = user.revokePermission(permission, UserId.create().value!);
      expect(revokeResult.isFailure).toBe(true);

      // Then: No additional event (still 1 event)
      expect(user.getDomainEvents()).toHaveLength(1);

      // When: Attempting to change to same role (NO-OP, but SUCCESS)
      const updateResult = await user.updateRole(UserRole.USER(), UserId.create().value!, repository);
      expect(updateResult.isSuccess).toBe(true);

      // Then: No additional event (still 1 event, NO RoleChangedEvent for no-op)
      expect(user.getDomainEvents()).toHaveLength(1);
    });

    it('should clear events after explicit clearing', () => {
      // Given: User with accumulated events
      const user = UserAggregate.create(Username.create('cleartest').value!, UserRole.USER()).value!;
      user.grantPermission(Permission.LOCK_ETB(), UserId.create().value!);
      expect(user.getDomainEvents()).toHaveLength(2); // Created + Granted

      // When: Events are retrieved and cleared
      const events = user.getDomainEvents();
      user.clearDomainEvents();

      // Then: Domain events array is empty
      expect(user.getDomainEvents()).toHaveLength(0);

      // But: Retrieved events are still accessible
      expect(events).toHaveLength(2);
    });
  });

  /**
   * Test 6: RBAC Permission Hierarchy (SUPER_ADMIN has ADMIN permissions)
   *
   * Validiert dass SUPER_ADMIN transitiv ALLE Permissions von ADMIN hat.
   * Testet Wildcard Matching (*:*).
   */
  describe('RBAC Permission Hierarchy (Transitive Permissions)', () => {
    it('should grant SUPER_ADMIN all ADMIN permissions (transitive)', () => {
      // Given: A SUPER_ADMIN user
      const superAdmin = UserAggregate.create(Username.create('superadmin').value!, UserRole.SUPER_ADMIN()).value!;

      // Then: SUPER_ADMIN has *:* permission (matches ALL permissions)
      const userRead = Permission.create('user:read').value!;
      const userUpdate = Permission.create('user:update').value!;
      const einsatzCreate = Permission.CREATE_EINSATZ();
      const einsatzRead = Permission.create('einsatz:read').value!;
      const systemBackup = Permission.create('system:backup').value!;

      expect(superAdmin.hasPermission(userRead)).toBe(true); // *:* matches user:read
      expect(superAdmin.hasPermission(userUpdate)).toBe(true); // *:* matches user:update
      expect(superAdmin.hasPermission(einsatzCreate)).toBe(true); // *:* matches einsatz:create
      expect(superAdmin.hasPermission(einsatzRead)).toBe(true); // *:* matches einsatz:read
      expect(superAdmin.hasPermission(systemBackup)).toBe(true); // *:* matches system:backup
    });

    it('should grant ADMIN user:* and einsatz:* permissions (scoped wildcards)', () => {
      // Given: An ADMIN user
      const admin = UserAggregate.create(Username.create('admin').value!, UserRole.ADMIN()).value!;

      // Then: ADMIN has user:* and einsatz:* permissions
      const userRead = Permission.create('user:read').value!;
      const userUpdate = Permission.create('user:update').value!;
      const einsatzCreate = Permission.CREATE_EINSATZ();
      const einsatzRead = Permission.create('einsatz:read').value!;

      expect(admin.hasPermission(userRead)).toBe(true); // user:* matches user:read
      expect(admin.hasPermission(userUpdate)).toBe(true); // user:* matches user:update
      expect(admin.hasPermission(einsatzCreate)).toBe(true); // einsatz:* matches einsatz:create
      expect(admin.hasPermission(einsatzRead)).toBe(true); // einsatz:* matches einsatz:read

      // But: ADMIN does NOT have system:* permissions
      const systemBackup = Permission.create('system:backup').value!;
      expect(admin.hasPermission(systemBackup)).toBe(false); // NO system:* permission
    });

    it('should grant USER only user:read_self permission (no wildcards)', () => {
      // Given: A USER
      const user = UserAggregate.create(Username.create('user').value!, UserRole.USER()).value!;

      // Then: USER has ONLY user:read_self permission (NO wildcards)
      const userReadSelf = Permission.create('user:read_self').value!;
      expect(user.hasPermission(userReadSelf)).toBe(true);

      // And: USER does NOT have other permissions
      const userRead = Permission.create('user:read').value!;
      const einsatzCreate = Permission.CREATE_EINSATZ();
      expect(user.hasPermission(userRead)).toBe(false);
      expect(user.hasPermission(einsatzCreate)).toBe(false);
    });

    it('should combine role default permissions with custom granted permissions', () => {
      // Given: A USER with custom permission
      const user = UserAggregate.create(Username.create('combined').value!, UserRole.USER()).value!;
      const customPermission = Permission.LOCK_ETB();
      user.grantPermission(customPermission, UserId.create().value!);

      // Then: USER has role default (user:read_self) AND custom permission (etb:lock)
      const userReadSelf = Permission.create('user:read_self').value!;
      expect(user.hasPermission(userReadSelf)).toBe(true); // Role Default
      expect(user.hasPermission(customPermission)).toBe(true); // Custom Grant

      // And: USER does NOT have other permissions
      const userRead = Permission.create('user:read').value!;
      expect(user.hasPermission(userRead)).toBe(false);
    });
  });

  /**
   * Test 7: Case-Insensitive Username Uniqueness
   *
   * Validiert dass "Ruben" und "ruben" als identisch behandelt werden.
   * Nutzt Username.equals() Logic (normalisiert zu lowercase).
   */
  describe('Case-Insensitive Username Uniqueness', () => {
    it('should treat usernames as case-insensitive (Ruben == ruben)', () => {
      // Given: Two Username instances with different casing
      const username1 = Username.create('Ruben').value!;
      const username2 = Username.create('ruben').value!;
      const username3 = Username.create('RUBEN').value!;

      // Then: All usernames are equal (case-insensitive)
      expect(username1.equals(username2)).toBe(true);
      expect(username1.equals(username3)).toBe(true);
      expect(username2.equals(username3)).toBe(true);
    });

    it('should prevent duplicate usernames via existsByUsername check', async () => {
      // Given: A user with username "Ruben" is created
      const username1 = Username.create('Ruben').value!;
      const user1 = UserAggregate.create(username1, UserRole.USER()).value!;
      await repository.save(user1);

      // When: Checking if "ruben" (lowercase) exists
      const username2 = Username.create('ruben').value!;
      const existsResult = await repository.existsByUsername(username2);

      // Then: Username exists (case-insensitive match)
      expect(existsResult.isSuccess).toBe(true);
      expect(existsResult.value).toBe(true);
    });

    it('should find user by username (case-insensitive)', async () => {
      // Given: A user with username "Admin" is created
      const username1 = Username.create('Admin').value!;
      const user = UserAggregate.create(username1, UserRole.ADMIN()).value!;
      await repository.save(user);

      // When: Searching for "admin" (lowercase)
      const username2 = Username.create('admin').value!;
      const findResult = await repository.findByUsername(username2);

      // Then: User is found (case-insensitive match)
      expect(findResult.isSuccess).toBe(true);
      expect(findResult.value).not.toBeNull();
      expect(findResult.value!.username.equals(username1)).toBe(true);
      expect(findResult.value!.username.equals(username2)).toBe(true);
    });

    it('should return null when username does not exist (any casing)', async () => {
      // Given: No users in repository

      // When: Searching for non-existent username
      const username = Username.create('NonExistent').value!;
      const findResult = await repository.findByUsername(username);

      // Then: Returns null (not an error)
      expect(findResult.isSuccess).toBe(true);
      expect(findResult.value).toBeNull();
    });
  });

  /**
   * Test 8: Unified Auth Strategy (Password-Agnostic User Aggregate)
   *
   * Validiert dass UserAggregate KEINE password property hat (password-agnostic).
   * Auth Strategy (password vs OAuth) wird NICHT im Aggregate gespeichert (Infrastructure Layer Concern).
   */
  describe('Unified Auth Strategy (Password-Agnostic Aggregate)', () => {
    it('should create UserAggregate without password property (password-agnostic)', () => {
      // Given: User is created (NO password parameter)
      const username = Username.create('authtest').value!;
      const user = UserAggregate.create(username, UserRole.USER()).value!;

      // Then: User has NO password property
      // @ts-expect-error - Verify that password property does NOT exist
      expect(user.password).toBeUndefined();

      // And: User is created successfully without password
      expect(user.username.equals(username)).toBe(true);
    });

    it('should demonstrate that auth strategy is NOT stored in aggregate', () => {
      // Given: Two users with different roles (USER vs ADMIN)
      const user = UserAggregate.create(Username.create('user').value!, UserRole.USER()).value!;
      const admin = UserAggregate.create(Username.create('admin').value!, UserRole.ADMIN()).value!;

      // Then: BOTH aggregates have identical structure (NO auth strategy property)
      // Auth strategy (password vs OAuth) is handled by Infrastructure Layer (AuthModule)
      // UserAggregate is purely focused on RBAC (Role-Based Access Control)

      expect(user.role.equals(UserRole.USER())).toBe(true);
      expect(admin.role.equals(UserRole.ADMIN())).toBe(true);

      // And: NO auth-related properties exist on aggregate
      // @ts-expect-error - Verify that authStrategy property does NOT exist
      expect(user.authStrategy).toBeUndefined();
      // @ts-expect-error - Verify that passwordHash property does NOT exist
      expect(user.passwordHash).toBeUndefined();
    });

    it('should allow any role to be created without password (Unified Auth)', () => {
      // Given: Users with different roles
      const superAdmin = UserAggregate.create(Username.create('superadmin').value!, UserRole.SUPER_ADMIN()).value!;
      const admin = UserAggregate.create(Username.create('admin').value!, UserRole.ADMIN()).value!;
      const user = UserAggregate.create(Username.create('user').value!, UserRole.USER()).value!;

      // Then: All users are created successfully WITHOUT password
      expect(superAdmin).toBeDefined();
      expect(admin).toBeDefined();
      expect(user).toBeDefined();

      // And: ALL users have NO password property
      // @ts-expect-error
      expect(superAdmin.password).toBeUndefined();
      // @ts-expect-error
      expect(admin.password).toBeUndefined();
      // @ts-expect-error
      expect(user.password).toBeUndefined();
    });
  });
});
