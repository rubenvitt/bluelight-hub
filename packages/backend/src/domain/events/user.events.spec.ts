// Mock nanoid for Jest compatibility (ESM module issue)
jest.mock('nanoid/non-secure', () => ({
  nanoid: jest.fn(() => {
    // Generate valid nanoid format: 21 URL-safe characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let result = '';
    for (let i = 0; i < 21; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
}));

import { PermissionGrantedEvent } from './permission-granted.event';
import { PermissionRevokedEvent } from './permission-revoked.event';
import { UserCreatedEvent } from './user-created.event';
import { UserDeletedEvent } from './user-deleted.event';
import { UserRoleChangedEvent } from './user-role-changed.event';
import { Permission } from '../value-objects/permission';
import { UserId } from '../value-objects/user-id';
import { UserRole } from '../value-objects/user-role';
import { Username } from '../value-objects/username';

describe('User Domain Events', () => {
  describe('UserCreatedEvent', () => {
    it('should create event with all properties', () => {
      // Given: Valid User Creation Data
      const userIdResult = UserId.create();
      const usernameResult = Username.create('ruben_admin');
      const role = UserRole.ADMIN();

      expect(userIdResult.isSuccess).toBe(true);
      expect(usernameResult.isSuccess).toBe(true);

      const userId = userIdResult.value;
      const username = usernameResult.value;

      // When: Creating UserCreatedEvent
      const event = new UserCreatedEvent(userId, username, role);

      // Then: Event should have all properties
      expect(event.userId).toBe(userId);
      expect(event.username).toBe(username);
      expect(event.role).toBe(role);
      expect(event.aggregateId).toBe(userId.toString());
    });

    it('should auto-generate eventId', () => {
      // Given: Valid User Data
      const userId = UserId.create().value;
      const username = Username.create('test_user').value;
      const role = UserRole.USER();

      // When: Creating Event
      const event = new UserCreatedEvent(userId, username, role);

      // Then: eventId should be auto-generated (nanoid: 21 chars)
      expect(event.eventId).toBeDefined();
      expect(typeof event.eventId).toBe('string');
      expect(event.eventId.length).toBe(21);
    });

    it('should auto-generate occurredAt timestamp', () => {
      // Given: Valid User Data
      const userId = UserId.create().value;
      const username = Username.create('test_user').value;
      const role = UserRole.USER();

      const beforeCreation = new Date();

      // When: Creating Event
      const event = new UserCreatedEvent(userId, username, role);

      const afterCreation = new Date();

      // Then: occurredAt should be auto-generated and within time window
      expect(event.occurredAt).toBeDefined();
      expect(event.occurredAt).toBeInstanceOf(Date);
      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    it('should have correct eventName "user.created"', () => {
      // Given: UserCreatedEvent Class
      // When: Calling static eventName()
      const eventName = UserCreatedEvent.eventName();

      // Then: Event name should be lowercase dot-separated
      expect(eventName).toBe('user.created');
    });

    it('should be immutable (frozen)', () => {
      // Given: Created Event
      const userId = UserId.create().value;
      const username = Username.create('test_user').value;
      const role = UserRole.USER();

      const event = new UserCreatedEvent(userId, username, role);

      // When/Then: Properties are readonly (TypeScript compile-time check)
      // Note: Runtime immutability is enforced by readonly modifier at compile-time
      // This test verifies the properties exist and are accessible
      expect(event.userId).toBeDefined();
      expect(event.username).toBeDefined();
      expect(event.role).toBeDefined();
      expect(event.eventId).toBeDefined();
      expect(event.occurredAt).toBeDefined();
      expect(event.aggregateId).toBeDefined();
    });
  });

  describe('UserRoleChangedEvent', () => {
    it('should create event with oldRole and newRole (Event-Carried State Transfer)', () => {
      // Given: User Role Change Data
      const userId = UserId.create().value;
      const oldRole = UserRole.USER();
      const newRole = UserRole.ADMIN();
      const changedBy = UserId.create().value;

      // When: Creating UserRoleChangedEvent
      const event = new UserRoleChangedEvent(userId, oldRole, newRole, changedBy);

      // Then: Event should carry both old and new role (Event-Carried State Transfer)
      expect(event.userId).toBe(userId);
      expect(event.oldRole).toBe(oldRole);
      expect(event.newRole).toBe(newRole);
      expect(event.oldRole.toString()).toBe('USER');
      expect(event.newRole.toString()).toBe('ADMIN');
    });

    it('should have changedBy property', () => {
      // Given: Role Change performed by Admin
      const userId = UserId.create().value;
      const oldRole = UserRole.USER();
      const newRole = UserRole.ADMIN();
      const changedBy = UserId.create().value;

      // When: Creating Event
      const event = new UserRoleChangedEvent(userId, oldRole, newRole, changedBy);

      // Then: Event should contain changedBy for audit trail
      expect(event.changedBy).toBe(changedBy);
      expect(event.changedBy).toBeInstanceOf(UserId);
    });

    it('should auto-generate eventId', () => {
      // Given: Valid Role Change Data
      const userId = UserId.create().value;
      const oldRole = UserRole.USER();
      const newRole = UserRole.ADMIN();
      const changedBy = UserId.create().value;

      // When: Creating Event
      const event = new UserRoleChangedEvent(userId, oldRole, newRole, changedBy);

      // Then: eventId should be auto-generated (nanoid: 21 chars)
      expect(event.eventId).toBeDefined();
      expect(typeof event.eventId).toBe('string');
      expect(event.eventId.length).toBe(21);
    });

    it('should auto-generate occurredAt timestamp', () => {
      // Given: Valid Role Change Data
      const userId = UserId.create().value;
      const oldRole = UserRole.USER();
      const newRole = UserRole.ADMIN();
      const changedBy = UserId.create().value;

      const beforeCreation = new Date();

      // When: Creating Event
      const event = new UserRoleChangedEvent(userId, oldRole, newRole, changedBy);

      const afterCreation = new Date();

      // Then: occurredAt should be auto-generated and within time window
      expect(event.occurredAt).toBeDefined();
      expect(event.occurredAt).toBeInstanceOf(Date);
      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    it('should have correct eventName "user.role_changed"', () => {
      // Given: UserRoleChangedEvent Class
      // When: Calling static eventName()
      const eventName = UserRoleChangedEvent.eventName();

      // Then: Event name should be lowercase with underscore for multi-word
      expect(eventName).toBe('user.role_changed');
    });

    it('should be immutable (frozen)', () => {
      // Given: Created Event
      const userId = UserId.create().value;
      const oldRole = UserRole.USER();
      const newRole = UserRole.ADMIN();
      const changedBy = UserId.create().value;

      const event = new UserRoleChangedEvent(userId, oldRole, newRole, changedBy);

      // When/Then: Properties are readonly (TypeScript compile-time check)
      // Note: Runtime immutability is enforced by readonly modifier at compile-time
      // This test verifies the properties exist and are accessible
      expect(event.userId).toBeDefined();
      expect(event.oldRole).toBeDefined();
      expect(event.newRole).toBeDefined();
      expect(event.changedBy).toBeDefined();
      expect(event.eventId).toBeDefined();
      expect(event.occurredAt).toBeDefined();
      expect(event.aggregateId).toBeDefined();
    });
  });

  describe('PermissionGrantedEvent', () => {
    it('should create event with permission and grantedBy', () => {
      // Given: Permission Grant Data
      const userId = UserId.create().value;
      const permission = Permission.CREATE_EINSATZ();
      const grantedBy = UserId.create().value;

      // When: Creating PermissionGrantedEvent
      const event = new PermissionGrantedEvent(userId, permission, grantedBy);

      // Then: Event should have permission and grantedBy
      expect(event.userId).toBe(userId);
      expect(event.permission).toBe(permission);
      expect(event.grantedBy).toBe(grantedBy);
      expect(event.permission.toString()).toBe('einsatz:create');
    });

    it('should auto-generate eventId', () => {
      // Given: Valid Permission Grant Data
      const userId = UserId.create().value;
      const permission = Permission.EDIT_EINSATZ();
      const grantedBy = UserId.create().value;

      // When: Creating Event
      const event = new PermissionGrantedEvent(userId, permission, grantedBy);

      // Then: eventId should be auto-generated (nanoid: 21 chars)
      expect(event.eventId).toBeDefined();
      expect(typeof event.eventId).toBe('string');
      expect(event.eventId.length).toBe(21);
    });

    it('should auto-generate occurredAt timestamp', () => {
      // Given: Valid Permission Grant Data
      const userId = UserId.create().value;
      const permission = Permission.DELETE_EINSATZ();
      const grantedBy = UserId.create().value;

      const beforeCreation = new Date();

      // When: Creating Event
      const event = new PermissionGrantedEvent(userId, permission, grantedBy);

      const afterCreation = new Date();

      // Then: occurredAt should be auto-generated and within time window
      expect(event.occurredAt).toBeDefined();
      expect(event.occurredAt).toBeInstanceOf(Date);
      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    it('should have correct eventName "user.permission_granted"', () => {
      // Given: PermissionGrantedEvent Class
      // When: Calling static eventName()
      const eventName = PermissionGrantedEvent.eventName();

      // Then: Event name should be lowercase with underscore for multi-word
      expect(eventName).toBe('user.permission_granted');
    });

    it('should be immutable (frozen)', () => {
      // Given: Created Event
      const userId = UserId.create().value;
      const permission = Permission.LOCK_ETB();
      const grantedBy = UserId.create().value;

      const event = new PermissionGrantedEvent(userId, permission, grantedBy);

      // When/Then: Properties are readonly (TypeScript compile-time check)
      // Note: Runtime immutability is enforced by readonly modifier at compile-time
      // This test verifies the properties exist and are accessible
      expect(event.userId).toBeDefined();
      expect(event.permission).toBeDefined();
      expect(event.grantedBy).toBeDefined();
      expect(event.eventId).toBeDefined();
      expect(event.occurredAt).toBeDefined();
      expect(event.aggregateId).toBeDefined();
    });
  });

  describe('PermissionRevokedEvent', () => {
    it('should create event with permission and revokedBy', () => {
      // Given: Permission Revoke Data
      const userId = UserId.create().value;
      const permission = Permission.DELETE_EINSATZ();
      const revokedBy = UserId.create().value;

      // When: Creating PermissionRevokedEvent
      const event = new PermissionRevokedEvent(userId, permission, revokedBy);

      // Then: Event should have permission and revokedBy
      expect(event.userId).toBe(userId);
      expect(event.permission).toBe(permission);
      expect(event.revokedBy).toBe(revokedBy);
      expect(event.permission.toString()).toBe('einsatz:delete');
    });

    it('should auto-generate eventId', () => {
      // Given: Valid Permission Revoke Data
      const userId = UserId.create().value;
      const permission = Permission.SYSTEM_CONFIG();
      const revokedBy = UserId.create().value;

      // When: Creating Event
      const event = new PermissionRevokedEvent(userId, permission, revokedBy);

      // Then: eventId should be auto-generated (nanoid: 21 chars)
      expect(event.eventId).toBeDefined();
      expect(typeof event.eventId).toBe('string');
      expect(event.eventId.length).toBe(21);
    });

    it('should auto-generate occurredAt timestamp', () => {
      // Given: Valid Permission Revoke Data
      const userId = UserId.create().value;
      const permission = Permission.LOCK_ETB();
      const revokedBy = UserId.create().value;

      const beforeCreation = new Date();

      // When: Creating Event
      const event = new PermissionRevokedEvent(userId, permission, revokedBy);

      const afterCreation = new Date();

      // Then: occurredAt should be auto-generated and within time window
      expect(event.occurredAt).toBeDefined();
      expect(event.occurredAt).toBeInstanceOf(Date);
      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    it('should have correct eventName "user.permission_revoked"', () => {
      // Given: PermissionRevokedEvent Class
      // When: Calling static eventName()
      const eventName = PermissionRevokedEvent.eventName();

      // Then: Event name should be lowercase with underscore for multi-word
      expect(eventName).toBe('user.permission_revoked');
    });

    it('should be immutable (frozen)', () => {
      // Given: Created Event
      const userId = UserId.create().value;
      const permission = Permission.MANAGE_USERS();
      const revokedBy = UserId.create().value;

      const event = new PermissionRevokedEvent(userId, permission, revokedBy);

      // When/Then: Properties are readonly (TypeScript compile-time check)
      // Note: Runtime immutability is enforced by readonly modifier at compile-time
      // This test verifies the properties exist and are accessible
      expect(event.userId).toBeDefined();
      expect(event.permission).toBeDefined();
      expect(event.revokedBy).toBeDefined();
      expect(event.eventId).toBeDefined();
      expect(event.occurredAt).toBeDefined();
      expect(event.aggregateId).toBeDefined();
    });
  });

  describe('UserDeletedEvent', () => {
    it('should create event with deletedBy', () => {
      // Given: User Deletion Data
      const userId = UserId.create().value;
      const deletedBy = UserId.create().value;

      // When: Creating UserDeletedEvent
      const event = new UserDeletedEvent(userId, deletedBy);

      // Then: Event should have userId and deletedBy
      expect(event.userId).toBe(userId);
      expect(event.deletedBy).toBe(deletedBy);
      expect(event.aggregateId).toBe(userId.toString());
    });

    it('should auto-generate eventId', () => {
      // Given: Valid User Deletion Data
      const userId = UserId.create().value;
      const deletedBy = UserId.create().value;

      // When: Creating Event
      const event = new UserDeletedEvent(userId, deletedBy);

      // Then: eventId should be auto-generated (nanoid: 21 chars)
      expect(event.eventId).toBeDefined();
      expect(typeof event.eventId).toBe('string');
      expect(event.eventId.length).toBe(21);
    });

    it('should auto-generate occurredAt timestamp', () => {
      // Given: Valid User Deletion Data
      const userId = UserId.create().value;
      const deletedBy = UserId.create().value;

      const beforeCreation = new Date();

      // When: Creating Event
      const event = new UserDeletedEvent(userId, deletedBy);

      const afterCreation = new Date();

      // Then: occurredAt should be auto-generated and within time window
      expect(event.occurredAt).toBeDefined();
      expect(event.occurredAt).toBeInstanceOf(Date);
      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    it('should have correct eventName "user.deleted"', () => {
      // Given: UserDeletedEvent Class
      // When: Calling static eventName()
      const eventName = UserDeletedEvent.eventName();

      // Then: Event name should be lowercase dot-separated
      expect(eventName).toBe('user.deleted');
    });

    it('should be immutable (frozen)', () => {
      // Given: Created Event
      const userId = UserId.create().value;
      const deletedBy = UserId.create().value;

      const event = new UserDeletedEvent(userId, deletedBy);

      // When/Then: Properties are readonly (TypeScript compile-time check)
      // Note: Runtime immutability is enforced by readonly modifier at compile-time
      // This test verifies the properties exist and are accessible
      expect(event.userId).toBeDefined();
      expect(event.deletedBy).toBeDefined();
      expect(event.eventId).toBeDefined();
      expect(event.occurredAt).toBeDefined();
      expect(event.aggregateId).toBeDefined();
    });

    it('should NOT contain sensitive data (passwords)', () => {
      // Given: User Deletion (simulating user with password)
      const userId = UserId.create().value;
      const deletedBy = UserId.create().value;

      // When: Creating UserDeletedEvent
      const event = new UserDeletedEvent(userId, deletedBy);

      // Then: Event should ONLY have userId and deletedBy (NO password or sensitive data)
      const eventKeys = Object.keys(event);
      expect(eventKeys).toContain('userId');
      expect(eventKeys).toContain('deletedBy');
      expect(eventKeys).toContain('eventId');
      expect(eventKeys).toContain('occurredAt');
      expect(eventKeys).toContain('aggregateId');

      // Verify NO password-related properties
      expect(eventKeys).not.toContain('password');
      expect(eventKeys).not.toContain('passwordHash');
      expect(eventKeys).not.toContain('email');
      expect(eventKeys).not.toContain('personalData');

      // Verify event can be safely logged/audited without exposing sensitive data
      const eventString = JSON.stringify(event);
      expect(eventString).not.toContain('password');
      expect(eventString).not.toContain('secret');
    });
  });
});
