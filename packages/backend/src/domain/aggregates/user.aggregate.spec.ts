import { UserAggregate } from './user.aggregate';
import { UserId } from '@domain/value-objects/user-id';
import { Username } from '@domain/value-objects/username';
import { UserRole } from '@domain/value-objects/user-role';
import { Permission } from '@domain/value-objects/permission';
import { Result } from '@domain/common/result';
import type { IUserRepository } from '@domain/repositories/i-user.repository';
import { UserCreatedEvent } from '@domain/events/user-created.event';
import { UserRoleChangedEvent } from '@domain/events/user-role-changed.event';
import { PermissionGrantedEvent } from '@domain/events/permission-granted.event';
import { PermissionRevokedEvent } from '@domain/events/permission-revoked.event';
import { UserDeletedEvent } from '@domain/events/user-deleted.event';

// Mock nanoid for Jest compatibility (ESM module issue)
jest.mock('nanoid/non-secure', () => ({
  nanoid: jest.fn((length?: number) => {
    // Generate valid nanoid format with specified length
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    const targetLength = length || 21;
    let result = '';
    for (let i = 0; i < targetLength; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
}));

describe('UserAggregate', () => {
  // Test Helper: Mock Repository
  let mockRepository: IUserRepository;

  beforeEach(() => {
    // Reset mock repository before each test
    mockRepository = {
      findById: jest.fn(),
      findByUsername: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      countSuperAdmins: jest.fn().mockResolvedValue(Result.ok(2)), // Default: 2 SUPER_ADMINs im System
      existsByUsername: jest.fn().mockResolvedValue(Result.ok(false)),
    };
  });

  describe('create() - Factory Method', () => {
    it('should create User with valid props', () => {
      // Given: Valid username and role
      const username = Username.create('ruben_admin').value!;
      const role = UserRole.ADMIN();

      // When: Create User
      const result = UserAggregate.create(username, role);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      const user = result.value!;
      expect(user.id).toBeInstanceOf(UserId);
      expect(user.username).toBe(username);
      expect(user.role).toBe(role);
      expect(user.permissions).toEqual([]); // No custom permissions
      expect(user.isLocked).toBe(false); // Account active
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should emit UserCreatedEvent on creation', () => {
      // Given: Valid username and role
      const username = Username.create('ruben_admin').value!;
      const role = UserRole.ADMIN();

      // When: Create User
      const result = UserAggregate.create(username, role);

      // Then: UserCreatedEvent emitted
      const user = result.value!;
      const events = user.getDomainEvents();
      expect(events.length).toBe(1);
      expect(events[0]).toBeInstanceOf(UserCreatedEvent);
      expect((events[0] as UserCreatedEvent).userId).toBe(user.id);
      expect((events[0] as UserCreatedEvent).username).toBe(username);
      expect((events[0] as UserCreatedEvent).role).toBe(role);
    });

    it('should allow custom permissions override', () => {
      // Given: Valid username, role, and custom permissions
      const username = Username.create('ruben_admin').value!;
      const role = UserRole.USER();
      const customPermissions = [Permission.LOCK_ETB(), Permission.CREATE_EINSATZ()];

      // When: Create User with custom permissions
      const result = UserAggregate.create(username, role, customPermissions);

      // Then: Custom permissions set
      const user = result.value!;
      expect(user.permissions.length).toBe(2);
      expect(user.permissions[0]).toBe(customPermissions[0]);
      expect(user.permissions[1]).toBe(customPermissions[1]);
    });

    it('should fail if UserId generation fails', () => {
      // Given: Mock UserId.create() to fail
      const originalCreate = UserId.create;
      // biome-ignore lint/suspicious/noExplicitAny: Test mock requires any type
      (UserId.create as any) = jest.fn(() => Result.fail('UserId generation failed'));

      const username = Username.create('ruben_admin').value!;
      const role = UserRole.ADMIN();

      // When: Create User with failing UserId generation
      const result = UserAggregate.create(username, role);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('UserId generation failed');

      // Cleanup: Restore original UserId.create
      UserId.create = originalCreate;
    });
  });

  describe('updateRole() - Role Assignment with Min-1-SUPER_ADMIN Check', () => {
    it('should change role and emit UserRoleChangedEvent', async () => {
      // Given: User with ADMIN role
      const username = Username.create('ruben_admin').value!;
      const user = UserAggregate.create(username, UserRole.ADMIN()).value!;
      user.clearDomainEvents(); // Clear creation event

      const newRole = UserRole.SUPER_ADMIN();
      const changedBy = UserId.create().value!;

      // When: Change role to SUPER_ADMIN
      const result = await user.updateRole(newRole, changedBy, mockRepository);

      // Then: Success and event emitted
      expect(result.isSuccess).toBe(true);
      expect(user.role).toBe(newRole);

      const events = user.getDomainEvents();
      expect(events.length).toBe(1);
      expect(events[0]).toBeInstanceOf(UserRoleChangedEvent);
      const roleEvent = events[0] as UserRoleChangedEvent;
      expect(roleEvent.userId).toBe(user.id);
      expect(roleEvent.oldRole.value).toBe('ADMIN');
      expect(roleEvent.newRole.value).toBe('SUPER_ADMIN');
      expect(roleEvent.changedBy).toBe(changedBy);
    });

    it('should NOT emit event on no-op (same role)', async () => {
      // Given: User with ADMIN role
      const username = Username.create('ruben_admin').value!;
      const user = UserAggregate.create(username, UserRole.ADMIN()).value!;
      user.clearDomainEvents();

      const sameRole = UserRole.ADMIN();
      const changedBy = UserId.create().value!;

      // When: Change to same role
      const result = await user.updateRole(sameRole, changedBy, mockRepository);

      // Then: Success but no event (no-op)
      expect(result.isSuccess).toBe(true);
      expect(user.role.value).toBe('ADMIN');
      expect(user.getDomainEvents().length).toBe(0); // No event emitted
    });

    it('should fail if demoting last SUPER_ADMIN (countSuperAdmins = 1)', async () => {
      // Given: User is SUPER_ADMIN and only 1 SUPER_ADMIN in system
      const username = Username.create('ruben_admin').value!;
      const user = UserAggregate.create(username, UserRole.SUPER_ADMIN()).value!;

      mockRepository.countSuperAdmins = jest.fn().mockResolvedValue(Result.ok(1)); // Only 1 SUPER_ADMIN

      const newRole = UserRole.ADMIN();
      const changedBy = UserId.create().value!;

      // When: Try to demote last SUPER_ADMIN
      const result = await user.updateRole(newRole, changedBy, mockRepository);

      // Then: Failure (Min-1-SUPER_ADMIN Constraint violated)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Cannot demote last SUPER_ADMIN');
      expect(user.role.value).toBe('SUPER_ADMIN'); // Role unchanged
    });

    it('should succeed if demoting SUPER_ADMIN with ≥2 total SUPER_ADMINs', async () => {
      // Given: User is SUPER_ADMIN and 2+ SUPER_ADMINs in system
      const username = Username.create('ruben_admin').value!;
      const user = UserAggregate.create(username, UserRole.SUPER_ADMIN()).value!;

      mockRepository.countSuperAdmins = jest.fn().mockResolvedValue(Result.ok(3)); // 3 SUPER_ADMINs

      const newRole = UserRole.ADMIN();
      const changedBy = UserId.create().value!;

      // When: Demote SUPER_ADMIN
      const result = await user.updateRole(newRole, changedBy, mockRepository);

      // Then: Success (Min-1-SUPER_ADMIN Constraint satisfied)
      expect(result.isSuccess).toBe(true);
      expect(user.role.value).toBe('ADMIN');
    });

    it('should fail if repository.countSuperAdmins() fails', async () => {
      // Given: User is SUPER_ADMIN and repository.countSuperAdmins() fails
      const username = Username.create('ruben_admin').value!;
      const user = UserAggregate.create(username, UserRole.SUPER_ADMIN()).value!;

      mockRepository.countSuperAdmins = jest.fn().mockResolvedValue(Result.fail('Database error'));

      const newRole = UserRole.ADMIN();
      const changedBy = UserId.create().value!;

      // When: Try to change role with failing repository
      const result = await user.updateRole(newRole, changedBy, mockRepository);

      // Then: Failure (repository error propagated)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Database error');
    });
  });

  describe('grantPermission() - Permission Grant', () => {
    it('should grant permission and emit PermissionGrantedEvent', () => {
      // Given: User without custom permissions
      const username = Username.create('ruben_user').value!;
      const user = UserAggregate.create(username, UserRole.USER()).value!;
      user.clearDomainEvents();

      const permission = Permission.LOCK_ETB();
      const grantedBy = UserId.create().value!;

      // When: Grant permission
      const result = user.grantPermission(permission, grantedBy);

      // Then: Success and event emitted
      expect(result.isSuccess).toBe(true);
      expect(user.permissions.length).toBe(1);
      expect(user.permissions[0]).toBe(permission);

      const events = user.getDomainEvents();
      expect(events.length).toBe(1);
      expect(events[0]).toBeInstanceOf(PermissionGrantedEvent);
      const grantEvent = events[0] as PermissionGrantedEvent;
      expect(grantEvent.userId).toBe(user.id);
      expect(grantEvent.permission).toBe(permission);
      expect(grantEvent.grantedBy).toBe(grantedBy);
    });

    it('should fail if permission already granted (idempotency)', () => {
      // Given: User with granted permission
      const username = Username.create('ruben_user').value!;
      const permission = Permission.LOCK_ETB();
      const user = UserAggregate.create(username, UserRole.USER(), [permission]).value!;

      const grantedBy = UserId.create().value!;

      // When: Try to grant same permission again
      const result = user.grantPermission(permission, grantedBy);

      // Then: Failure (idempotency check)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Permission already granted');
      expect(user.permissions.length).toBe(1); // Unchanged
    });
  });

  describe('revokePermission() - Permission Revoke', () => {
    it('should revoke permission and emit PermissionRevokedEvent', () => {
      // Given: User with granted permission
      const username = Username.create('ruben_user').value!;
      const permission = Permission.LOCK_ETB();
      const user = UserAggregate.create(username, UserRole.USER(), [permission]).value!;
      user.clearDomainEvents();

      const revokedBy = UserId.create().value!;

      // When: Revoke permission
      const result = user.revokePermission(permission, revokedBy);

      // Then: Success and event emitted
      expect(result.isSuccess).toBe(true);
      expect(user.permissions.length).toBe(0); // Permission removed

      const events = user.getDomainEvents();
      expect(events.length).toBe(1);
      expect(events[0]).toBeInstanceOf(PermissionRevokedEvent);
      const revokeEvent = events[0] as PermissionRevokedEvent;
      expect(revokeEvent.userId).toBe(user.id);
      expect(revokeEvent.permission).toBe(permission);
      expect(revokeEvent.revokedBy).toBe(revokedBy);
    });

    it('should fail if permission not granted', () => {
      // Given: User without the permission
      const username = Username.create('ruben_user').value!;
      const user = UserAggregate.create(username, UserRole.USER()).value!;

      const permission = Permission.LOCK_ETB();
      const revokedBy = UserId.create().value!;

      // When: Try to revoke non-granted permission
      const result = user.revokePermission(permission, revokedBy);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Permission not granted');
    });
  });

  describe('lock() - Account Locking with Min-1-SUPER_ADMIN Check', () => {
    it('should lock user (sets isLocked=true)', async () => {
      // Given: Active user (ADMIN)
      const username = Username.create('ruben_admin').value!;
      const user = UserAggregate.create(username, UserRole.ADMIN()).value!;

      // When: Lock user
      const result = await user.lock(mockRepository);

      // Then: Success (user locked)
      expect(result.isSuccess).toBe(true);
      expect(user.isLocked).toBe(true);
    });

    it('should fail if locking last SUPER_ADMIN (countSuperAdmins = 1)', async () => {
      // Given: User is SUPER_ADMIN and only 1 SUPER_ADMIN in system
      const username = Username.create('ruben_admin').value!;
      const user = UserAggregate.create(username, UserRole.SUPER_ADMIN()).value!;

      mockRepository.countSuperAdmins = jest.fn().mockResolvedValue(Result.ok(1)); // Only 1 SUPER_ADMIN

      // When: Try to lock last SUPER_ADMIN
      const result = await user.lock(mockRepository);

      // Then: Failure (Min-1-SUPER_ADMIN Constraint violated)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Cannot lock last SUPER_ADMIN');
      expect(user.isLocked).toBe(false); // Unchanged
    });

    it('should succeed if locking SUPER_ADMIN with ≥2 total SUPER_ADMINs', async () => {
      // Given: User is SUPER_ADMIN and 2+ SUPER_ADMINs in system
      const username = Username.create('ruben_admin').value!;
      const user = UserAggregate.create(username, UserRole.SUPER_ADMIN()).value!;

      mockRepository.countSuperAdmins = jest.fn().mockResolvedValue(Result.ok(2)); // 2 SUPER_ADMINs

      // When: Lock SUPER_ADMIN
      const result = await user.lock(mockRepository);

      // Then: Success (Min-1-SUPER_ADMIN Constraint satisfied)
      expect(result.isSuccess).toBe(true);
      expect(user.isLocked).toBe(true);
    });
  });

  describe('unlock() - Account Unlocking', () => {
    it('should unlock user (sets isLocked=false)', async () => {
      // Given: Locked user
      const username = Username.create('ruben_admin').value!;
      const user = UserAggregate.create(username, UserRole.ADMIN()).value!;
      await user.lock(mockRepository);

      // When: Unlock user
      const result = user.unlock();

      // Then: Success (user unlocked)
      expect(result.isSuccess).toBe(true);
      expect(user.isLocked).toBe(false);
    });

    it('should be no-op if user not locked', () => {
      // Given: Active user (not locked)
      const username = Username.create('ruben_admin').value!;
      const user = UserAggregate.create(username, UserRole.ADMIN()).value!;

      // When: Unlock already active user
      const result = user.unlock();

      // Then: Success (no-op)
      expect(result.isSuccess).toBe(true);
      expect(user.isLocked).toBe(false);
    });
  });

  describe('delete() - Soft Delete with Min-1-SUPER_ADMIN Check', () => {
    it('should emit UserDeletedEvent', async () => {
      // Given: Active user (ADMIN)
      const username = Username.create('ruben_admin').value!;
      const user = UserAggregate.create(username, UserRole.ADMIN()).value!;
      user.clearDomainEvents();

      const deletedBy = UserId.create().value!;

      // When: Delete user
      const result = await user.delete(deletedBy, mockRepository);

      // Then: Success and event emitted
      expect(result.isSuccess).toBe(true);

      const events = user.getDomainEvents();
      expect(events.length).toBe(1);
      expect(events[0]).toBeInstanceOf(UserDeletedEvent);
      const deleteEvent = events[0] as UserDeletedEvent;
      expect(deleteEvent.userId).toBe(user.id);
      expect(deleteEvent.deletedBy).toBe(deletedBy);
    });

    it('should fail if deleting last SUPER_ADMIN (countSuperAdmins = 1)', async () => {
      // Given: User is SUPER_ADMIN and only 1 SUPER_ADMIN in system
      const username = Username.create('ruben_admin').value!;
      const user = UserAggregate.create(username, UserRole.SUPER_ADMIN()).value!;

      mockRepository.countSuperAdmins = jest.fn().mockResolvedValue(Result.ok(1)); // Only 1 SUPER_ADMIN

      const deletedBy = UserId.create().value!;

      // When: Try to delete last SUPER_ADMIN
      const result = await user.delete(deletedBy, mockRepository);

      // Then: Failure (Min-1-SUPER_ADMIN Constraint violated)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Cannot delete last SUPER_ADMIN');
    });

    it('should succeed if deleting SUPER_ADMIN with ≥2 total SUPER_ADMINs', async () => {
      // Given: User is SUPER_ADMIN and 2+ SUPER_ADMINs in system
      const username = Username.create('ruben_admin').value!;
      const user = UserAggregate.create(username, UserRole.SUPER_ADMIN()).value!;

      mockRepository.countSuperAdmins = jest.fn().mockResolvedValue(Result.ok(3)); // 3 SUPER_ADMINs

      const deletedBy = UserId.create().value!;

      // When: Delete SUPER_ADMIN
      const result = await user.delete(deletedBy, mockRepository);

      // Then: Success (Min-1-SUPER_ADMIN Constraint satisfied)
      expect(result.isSuccess).toBe(true);
    });

    it('should fail if user is locked', async () => {
      // Given: Locked user
      const username = Username.create('ruben_admin').value!;
      const user = UserAggregate.create(username, UserRole.ADMIN()).value!;
      await user.lock(mockRepository);

      const deletedBy = UserId.create().value!;

      // When: Try to delete locked user
      const result = await user.delete(deletedBy, mockRepository);

      // Then: Failure (locked users cannot be deleted)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Cannot delete locked user');
    });
  });

  describe('hasRole() - Role Check Helper', () => {
    it('should return true for matching role', () => {
      // Given: User with ADMIN role
      const username = Username.create('ruben_admin').value!;
      const user = UserAggregate.create(username, UserRole.ADMIN()).value!;

      // When: Check for ADMIN role
      const hasAdmin = user.hasRole(UserRole.ADMIN());

      // Then: true
      expect(hasAdmin).toBe(true);
    });

    it('should return false for different role', () => {
      // Given: User with ADMIN role
      const username = Username.create('ruben_admin').value!;
      const user = UserAggregate.create(username, UserRole.ADMIN()).value!;

      // When: Check for USER role
      const hasUser = user.hasRole(UserRole.USER());

      // Then: false
      expect(hasUser).toBe(false);
    });
  });

  describe('hasPermission() - Permission Check (role defaults + custom grants)', () => {
    it('should include role default permissions', () => {
      // Given: User with ADMIN role (has user:* default)
      const username = Username.create('ruben_admin').value!;
      const user = UserAggregate.create(username, UserRole.ADMIN()).value!;

      const userReadPermission = Permission.create('user:read').value!;

      // When: Check for user:read permission
      const hasPermission = user.hasPermission(userReadPermission);

      // Then: true (ADMIN has user:* which matches user:read)
      expect(hasPermission).toBe(true);
    });

    it('should include custom granted permissions', () => {
      // Given: User with USER role + custom LOCK_ETB permission
      const username = Username.create('ruben_user').value!;
      const permission = Permission.LOCK_ETB();
      const user = UserAggregate.create(username, UserRole.USER(), [permission]).value!;

      // When: Check for etb:lock permission
      const hasPermission = user.hasPermission(permission);

      // Then: true (custom granted)
      expect(hasPermission).toBe(true);
    });

    it('should combine role defaults + custom grants', () => {
      // Given: User with ADMIN role + custom LOCK_ETB permission
      const username = Username.create('ruben_admin').value!;
      const customPermission = Permission.LOCK_ETB();
      const user = UserAggregate.create(username, UserRole.ADMIN(), [customPermission]).value!;

      const userReadPermission = Permission.create('user:read').value!;

      // When: Check for both permissions
      const hasRoleDefault = user.hasPermission(userReadPermission); // Role default
      const hasCustom = user.hasPermission(customPermission); // Custom grant

      // Then: Both true
      expect(hasRoleDefault).toBe(true); // ADMIN has user:*
      expect(hasCustom).toBe(true); // Custom granted
    });

    it('should return false for permission not granted', () => {
      // Given: User with USER role (only user:read_self)
      const username = Username.create('ruben_user').value!;
      const user = UserAggregate.create(username, UserRole.USER()).value!;

      const einsatzCreatePermission = Permission.CREATE_EINSATZ();

      // When: Check for einsatz:create permission
      const hasPermission = user.hasPermission(einsatzCreatePermission);

      // Then: false (USER does NOT have einsatz:*)
      expect(hasPermission).toBe(false);
    });

    it('should return true for SUPER_ADMIN wildcard (*:*)', () => {
      // Given: User with SUPER_ADMIN role (*:*)
      const username = Username.create('ruben_super').value!;
      const user = UserAggregate.create(username, UserRole.SUPER_ADMIN()).value!;

      const anyPermission = Permission.create('custom:action').value!;

      // When: Check for any permission
      const hasPermission = user.hasPermission(anyPermission);

      // Then: true (SUPER_ADMIN has *:*)
      expect(hasPermission).toBe(true);
    });
  });

  describe('Event Accumulation', () => {
    it('should accumulate events from create() + updateRole()', async () => {
      // Given: User creation
      const username = Username.create('ruben_admin').value!;
      const user = UserAggregate.create(username, UserRole.ADMIN()).value!;

      // When: Update role
      const newRole = UserRole.SUPER_ADMIN();
      const changedBy = UserId.create().value!;
      await user.updateRole(newRole, changedBy, mockRepository);

      // Then: 2 events accumulated
      const events = user.getDomainEvents();
      expect(events.length).toBe(2);
      expect(events[0]).toBeInstanceOf(UserCreatedEvent);
      expect(events[1]).toBeInstanceOf(UserRoleChangedEvent);
    });

    it('should accumulate events from create() + grantPermission() + revokePermission()', () => {
      // Given: User creation
      const username = Username.create('ruben_user').value!;
      const user = UserAggregate.create(username, UserRole.USER()).value!;

      const permission = Permission.LOCK_ETB();
      const grantedBy = UserId.create().value!;
      const revokedBy = UserId.create().value!;

      // When: Grant + Revoke permission
      user.grantPermission(permission, grantedBy);
      user.revokePermission(permission, revokedBy);

      // Then: 3 events accumulated
      const events = user.getDomainEvents();
      expect(events.length).toBe(3);
      expect(events[0]).toBeInstanceOf(UserCreatedEvent);
      expect(events[1]).toBeInstanceOf(PermissionGrantedEvent);
      expect(events[2]).toBeInstanceOf(PermissionRevokedEvent);
    });

    it('should accumulate events from create() + lock() + unlock()', async () => {
      // Given: User creation
      const username = Username.create('ruben_admin').value!;
      const user = UserAggregate.create(username, UserRole.ADMIN()).value!;

      // When: Lock + Unlock (NO events for lock/unlock)
      await user.lock(mockRepository);
      user.unlock();

      // Then: Only UserCreatedEvent (lock/unlock do NOT emit events)
      const events = user.getDomainEvents();
      expect(events.length).toBe(1);
      expect(events[0]).toBeInstanceOf(UserCreatedEvent);
    });

    it('should accumulate events from create() + delete()', async () => {
      // Given: User creation
      const username = Username.create('ruben_admin').value!;
      const user = UserAggregate.create(username, UserRole.ADMIN()).value!;

      const deletedBy = UserId.create().value!;

      // When: Delete user
      await user.delete(deletedBy, mockRepository);

      // Then: 2 events accumulated
      const events = user.getDomainEvents();
      expect(events.length).toBe(2);
      expect(events[0]).toBeInstanceOf(UserCreatedEvent);
      expect(events[1]).toBeInstanceOf(UserDeletedEvent);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple permission grants', () => {
      // Given: User with USER role
      const username = Username.create('ruben_user').value!;
      const user = UserAggregate.create(username, UserRole.USER()).value!;

      const perm1 = Permission.LOCK_ETB();
      const perm2 = Permission.CREATE_EINSATZ();
      const perm3 = Permission.EDIT_EINSATZ();
      const grantedBy = UserId.create().value!;

      // When: Grant multiple permissions
      user.grantPermission(perm1, grantedBy);
      user.grantPermission(perm2, grantedBy);
      user.grantPermission(perm3, grantedBy);

      // Then: All permissions granted
      expect(user.permissions.length).toBe(3);
      expect(user.hasPermission(perm1)).toBe(true);
      expect(user.hasPermission(perm2)).toBe(true);
      expect(user.hasPermission(perm3)).toBe(true);
    });

    it('should handle grant + revoke + grant cycle', () => {
      // Given: User with USER role
      const username = Username.create('ruben_user').value!;
      const user = UserAggregate.create(username, UserRole.USER()).value!;

      const permission = Permission.LOCK_ETB();
      const grantedBy = UserId.create().value!;
      const revokedBy = UserId.create().value!;

      // When: Grant → Revoke → Grant again
      user.grantPermission(permission, grantedBy);
      user.revokePermission(permission, revokedBy);
      const secondGrant = user.grantPermission(permission, grantedBy);

      // Then: Second grant succeeds (permission was revoked)
      expect(secondGrant.isSuccess).toBe(true);
      expect(user.permissions.length).toBe(1);
      expect(user.hasPermission(permission)).toBe(true);
    });

    it('should handle lock + unlock cycle', async () => {
      // Given: User with ADMIN role
      const username = Username.create('ruben_admin').value!;
      const user = UserAggregate.create(username, UserRole.ADMIN()).value!;

      // When: Lock → Unlock → Lock
      await user.lock(mockRepository);
      expect(user.isLocked).toBe(true);

      user.unlock();
      expect(user.isLocked).toBe(false);

      await user.lock(mockRepository);
      expect(user.isLocked).toBe(true);

      // Then: Lock cycle works
      expect(user.isLocked).toBe(true);
    });

    it('should preserve permissions after role change', async () => {
      // Given: User with ADMIN role + custom LOCK_ETB permission
      const username = Username.create('ruben_admin').value!;
      const customPermission = Permission.LOCK_ETB();
      const user = UserAggregate.create(username, UserRole.ADMIN(), [customPermission]).value!;

      const newRole = UserRole.SUPER_ADMIN();
      const changedBy = UserId.create().value!;

      // When: Change role to SUPER_ADMIN
      await user.updateRole(newRole, changedBy, mockRepository);

      // Then: Custom permissions preserved
      expect(user.permissions.length).toBe(1);
      expect(user.permissions[0]).toBe(customPermission);
      expect(user.hasPermission(customPermission)).toBe(true);
    });

    it('should return shallow copy of permissions (mutation-safe)', () => {
      // Given: User with custom permissions
      const username = Username.create('ruben_user').value!;
      const permission = Permission.LOCK_ETB();
      const user = UserAggregate.create(username, UserRole.USER(), [permission]).value!;

      // When: Get permissions and mutate array
      const permissions1 = user.permissions;
      permissions1.push(Permission.CREATE_EINSATZ()); // Mutate copy

      // Then: Original permissions unchanged
      const permissions2 = user.permissions;
      expect(permissions2.length).toBe(1); // Still only 1 permission
      expect(permissions2[0]).toBe(permission);
    });
  });
});
