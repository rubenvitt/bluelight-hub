import { Permission } from './permission';
import { UserRole } from './user-role';

describe('UserRole', () => {
  describe('create() - Factory Method', () => {
    it('should create UserRole with valid value SUPER_ADMIN', () => {
      // Given: Valid role value SUPER_ADMIN
      const value = 'SUPER_ADMIN';

      // When: Creating UserRole
      const result = UserRole.create(value);

      // Then: Creation succeeds
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(UserRole);
      expect(result.value?.value).toBe('SUPER_ADMIN');
    });

    it('should create UserRole with valid value ADMIN', () => {
      // Given: Valid role value ADMIN
      const value = 'ADMIN';

      // When: Creating UserRole
      const result = UserRole.create(value);

      // Then: Creation succeeds
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(UserRole);
      expect(result.value?.value).toBe('ADMIN');
    });

    it('should create UserRole with valid value USER', () => {
      // Given: Valid role value USER
      const value = 'USER';

      // When: Creating UserRole
      const result = UserRole.create(value);

      // Then: Creation succeeds
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(UserRole);
      expect(result.value?.value).toBe('USER');
    });

    it('should fail with invalid role value', () => {
      // Given: Invalid role value
      const value = 'MODERATOR';

      // When: Creating UserRole
      const result = UserRole.create(value);

      // Then: Creation fails with descriptive error
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Ungültige Role');
      expect(result.error).toContain('MODERATOR');
      expect(result.error).toContain('SUPER_ADMIN, ADMIN, USER');
    });

    it('should fail with lowercase role value', () => {
      // Given: Lowercase role value (nur UPPERCASE erlaubt)
      const value = 'admin';

      // When: Creating UserRole
      const result = UserRole.create(value);

      // Then: Creation fails (nur UPPERCASE erlaubt)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Ungültige Role');
      expect(result.error).toContain('admin');
    });
  });

  describe('Static Convenience Factories', () => {
    it('should create SUPER_ADMIN role via static factory', () => {
      // Given: No parameters needed
      // When: Creating SUPER_ADMIN via static factory
      const role = UserRole.SUPER_ADMIN();

      // Then: SUPER_ADMIN role is created
      expect(role).toBeInstanceOf(UserRole);
      expect(role.value).toBe('SUPER_ADMIN');
    });

    it('should create ADMIN role via static factory', () => {
      // Given: No parameters needed
      // When: Creating ADMIN via static factory
      const role = UserRole.ADMIN();

      // Then: ADMIN role is created
      expect(role).toBeInstanceOf(UserRole);
      expect(role.value).toBe('ADMIN');
    });

    it('should create USER role via static factory', () => {
      // Given: No parameters needed
      // When: Creating USER via static factory
      const role = UserRole.USER();

      // Then: USER role is created
      expect(role).toBeInstanceOf(UserRole);
      expect(role.value).toBe('USER');
    });
  });

  describe('hasPermission() - RBAC Permission Hierarchy', () => {
    describe('SUPER_ADMIN Role', () => {
      it('should have ALL permissions (user:read, einsatz:create, etc.)', () => {
        // Given: SUPER_ADMIN role
        const role = UserRole.SUPER_ADMIN();

        // When: Checking various permissions
        const userRead = Permission.create('user:read').value!;
        const userCreate = Permission.create('user:create').value!;
        const einsatzCreate = Permission.create('einsatz:create').value!;
        const fahrzeugDelete = Permission.create('fahrzeug:delete').value!;
        const dienstUpdate = Permission.create('dienst:update').value!;
        const etbLock = Permission.create('etb:lock').value!;
        const systemConfig = Permission.create('system:config').value!;

        // Then: Has ALL permissions (matches *:*)
        expect(role.hasPermission(userRead)).toBe(true);
        expect(role.hasPermission(userCreate)).toBe(true);
        expect(role.hasPermission(einsatzCreate)).toBe(true);
        expect(role.hasPermission(fahrzeugDelete)).toBe(true);
        expect(role.hasPermission(dienstUpdate)).toBe(true);
        expect(role.hasPermission(etbLock)).toBe(true);
        expect(role.hasPermission(systemConfig)).toBe(true);
      });

      it('should match wildcard *:* pattern', () => {
        // Given: SUPER_ADMIN role
        const role = UserRole.SUPER_ADMIN();

        // When: Checking custom/unknown permissions
        const customAction = Permission.create('custom:action').value!;
        const unknownResource = Permission.create('unknown:read').value!;

        // Then: Matches wildcard pattern (SUPER_ADMIN has *:*)
        expect(role.hasPermission(customAction)).toBe(true);
        expect(role.hasPermission(unknownResource)).toBe(true);
      });
    });

    describe('ADMIN Role', () => {
      it('should have user:* permissions (user:read, user:create, etc.)', () => {
        // Given: ADMIN role
        const role = UserRole.ADMIN();

        // When: Checking user:* permissions
        const userRead = Permission.create('user:read').value!;
        const userCreate = Permission.create('user:create').value!;
        const userUpdate = Permission.create('user:update').value!;
        const userDelete = Permission.create('user:delete').value!;
        const userReadSelf = Permission.create('user:read_self').value!;

        // Then: Has ALL user:* permissions
        expect(role.hasPermission(userRead)).toBe(true);
        expect(role.hasPermission(userCreate)).toBe(true);
        expect(role.hasPermission(userUpdate)).toBe(true);
        expect(role.hasPermission(userDelete)).toBe(true);
        expect(role.hasPermission(userReadSelf)).toBe(true);
      });

      it('should have einsatz:* permissions', () => {
        // Given: ADMIN role
        const role = UserRole.ADMIN();

        // When: Checking einsatz:* permissions
        const einsatzRead = Permission.create('einsatz:read').value!;
        const einsatzCreate = Permission.create('einsatz:create').value!;
        const einsatzUpdate = Permission.create('einsatz:update').value!;
        const einsatzDelete = Permission.create('einsatz:delete').value!;

        // Then: Has ALL einsatz:* permissions
        expect(role.hasPermission(einsatzRead)).toBe(true);
        expect(role.hasPermission(einsatzCreate)).toBe(true);
        expect(role.hasPermission(einsatzUpdate)).toBe(true);
        expect(role.hasPermission(einsatzDelete)).toBe(true);
      });

      it('should have fahrzeug:* permissions', () => {
        // Given: ADMIN role
        const role = UserRole.ADMIN();

        // When: Checking fahrzeug:* permissions
        const fahrzeugRead = Permission.create('fahrzeug:read').value!;
        const fahrzeugCreate = Permission.create('fahrzeug:create').value!;
        const fahrzeugUpdate = Permission.create('fahrzeug:update').value!;
        const fahrzeugDelete = Permission.create('fahrzeug:delete').value!;

        // Then: Has ALL fahrzeug:* permissions
        expect(role.hasPermission(fahrzeugRead)).toBe(true);
        expect(role.hasPermission(fahrzeugCreate)).toBe(true);
        expect(role.hasPermission(fahrzeugUpdate)).toBe(true);
        expect(role.hasPermission(fahrzeugDelete)).toBe(true);
      });

      it('should have dienst:* permissions', () => {
        // Given: ADMIN role
        const role = UserRole.ADMIN();

        // When: Checking dienst:* permissions
        const dienstRead = Permission.create('dienst:read').value!;
        const dienstCreate = Permission.create('dienst:create').value!;
        const dienstUpdate = Permission.create('dienst:update').value!;
        const dienstDelete = Permission.create('dienst:delete').value!;

        // Then: Has ALL dienst:* permissions
        expect(role.hasPermission(dienstRead)).toBe(true);
        expect(role.hasPermission(dienstCreate)).toBe(true);
        expect(role.hasPermission(dienstUpdate)).toBe(true);
        expect(role.hasPermission(dienstDelete)).toBe(true);
      });

      it('should NOT have etb:lock permission', () => {
        // Given: ADMIN role
        const role = UserRole.ADMIN();

        // When: Checking etb:lock permission (not in user:*, einsatz:*, fahrzeug:*, dienst:*)
        const etbLock = Permission.create('etb:lock').value!;

        // Then: Does NOT have permission (no etb:* for ADMIN)
        expect(role.hasPermission(etbLock)).toBe(false);
      });

      it('should NOT have system:* permissions', () => {
        // Given: ADMIN role
        const role = UserRole.ADMIN();

        // When: Checking system:* permissions
        const systemConfig = Permission.create('system:config').value!;
        const systemBackup = Permission.create('system:backup').value!;

        // Then: Does NOT have system:* permissions
        expect(role.hasPermission(systemConfig)).toBe(false);
        expect(role.hasPermission(systemBackup)).toBe(false);
      });
    });

    describe('USER Role', () => {
      it('should have user:read_self permission', () => {
        // Given: USER role
        const role = UserRole.USER();

        // When: Checking user:read_self permission
        const userReadSelf = Permission.create('user:read_self').value!;

        // Then: Has user:read_self permission
        expect(role.hasPermission(userReadSelf)).toBe(true);
      });

      it('should NOT have user:read permission', () => {
        // Given: USER role
        const role = UserRole.USER();

        // When: Checking user:read permission (USER can only read_self, not others)
        const userRead = Permission.create('user:read').value!;

        // Then: Does NOT have user:read permission
        expect(role.hasPermission(userRead)).toBe(false);
      });

      it('should NOT have einsatz:create permission', () => {
        // Given: USER role
        const role = UserRole.USER();

        // When: Checking einsatz:create permission
        const einsatzCreate = Permission.create('einsatz:create').value!;

        // Then: Does NOT have einsatz:create permission
        expect(role.hasPermission(einsatzCreate)).toBe(false);
      });

      it('should NOT have user:create permission', () => {
        // Given: USER role
        const role = UserRole.USER();

        // When: Checking user:create permission
        const userCreate = Permission.create('user:create').value!;

        // Then: Does NOT have user:create permission (only read_self)
        expect(role.hasPermission(userCreate)).toBe(false);
      });

      it('should NOT have user:update permission', () => {
        // Given: USER role
        const role = UserRole.USER();

        // When: Checking user:update permission
        const userUpdate = Permission.create('user:update').value!;

        // Then: Does NOT have user:update permission
        expect(role.hasPermission(userUpdate)).toBe(false);
      });

      it('should NOT have fahrzeug:read permission', () => {
        // Given: USER role
        const role = UserRole.USER();

        // When: Checking fahrzeug:read permission
        const fahrzeugRead = Permission.create('fahrzeug:read').value!;

        // Then: Does NOT have fahrzeug:read permission
        expect(role.hasPermission(fahrzeugRead)).toBe(false);
      });

      it('should NOT have dienst:read permission', () => {
        // Given: USER role
        const role = UserRole.USER();

        // When: Checking dienst:read permission
        const dienstRead = Permission.create('dienst:read').value!;

        // Then: Does NOT have dienst:read permission
        expect(role.hasPermission(dienstRead)).toBe(false);
      });
    });
  });

  describe('equals() - Equality', () => {
    it('should return true for same role', () => {
      // Given: Two ADMIN roles
      const role1 = UserRole.ADMIN();
      const role2 = UserRole.ADMIN();

      // When: Comparing roles
      const isEqual = role1.equals(role2);

      // Then: Roles are equal (same value)
      expect(isEqual).toBe(true);
    });

    it('should return false for different roles', () => {
      // Given: ADMIN and USER roles
      const admin = UserRole.ADMIN();
      const user = UserRole.USER();

      // When: Comparing roles
      const isEqual = admin.equals(user);

      // Then: Roles are NOT equal (different values)
      expect(isEqual).toBe(false);
    });

    it('should return false when comparing with null', () => {
      // Given: ADMIN role and null
      const admin = UserRole.ADMIN();

      // When: Comparing with null
      const isEqual = admin.equals(null as unknown as UserRole);

      // Then: Not equal to null
      expect(isEqual).toBe(false);
    });

    it('should return false when comparing with undefined', () => {
      // Given: ADMIN role and undefined
      const admin = UserRole.ADMIN();

      // When: Comparing with undefined
      const isEqual = admin.equals(undefined as unknown as UserRole);

      // Then: Not equal to undefined
      expect(isEqual).toBe(false);
    });

    it('should return true when comparing same instance', () => {
      // Given: Same instance
      const admin = UserRole.ADMIN();

      // When: Comparing with itself
      const isEqual = admin.equals(admin);

      // Then: Equal to itself
      expect(isEqual).toBe(true);
    });

    it('should return true for roles created via different factories with same value', () => {
      // Given: SUPER_ADMIN created via static factory and create()
      const superAdmin1 = UserRole.SUPER_ADMIN();
      const superAdmin2 = UserRole.create('SUPER_ADMIN').value!;

      // When: Comparing roles
      const isEqual = superAdmin1.equals(superAdmin2);

      // Then: Roles are equal (same value, different creation methods)
      expect(isEqual).toBe(true);
    });
  });

  describe('toString() - String Representation', () => {
    it('should return role value for SUPER_ADMIN', () => {
      // Given: SUPER_ADMIN role
      const role = UserRole.SUPER_ADMIN();

      // When: Converting to string
      const str = role.toString();

      // Then: Returns role value
      expect(str).toBe('SUPER_ADMIN');
    });

    it('should return role value for ADMIN', () => {
      // Given: ADMIN role
      const role = UserRole.ADMIN();

      // When: Converting to string
      const str = role.toString();

      // Then: Returns role value
      expect(str).toBe('ADMIN');
    });

    it('should return role value for USER', () => {
      // Given: USER role
      const role = UserRole.USER();

      // When: Converting to string
      const str = role.toString();

      // Then: Returns role value
      expect(str).toBe('USER');
    });

    it('should work in string interpolation', () => {
      // Given: ADMIN role
      const role = UserRole.ADMIN();

      // When: Using in string interpolation
      const message = `User has role: ${role}`;

      // Then: toString() is called implicitly
      expect(message).toBe('User has role: ADMIN');
    });
  });

  describe('Immutability', () => {
    it('should freeze props object', () => {
      // Given: ADMIN role
      const role = UserRole.ADMIN();

      // When: Attempting to modify props
      const modifyProps = () => {
        // @ts-expect-error - Testing runtime immutability
        role.props.value = 'HACKED';
      };

      // Then: Props are frozen (throws in strict mode)
      expect(Object.isFrozen(role.props)).toBe(true);
      expect(modifyProps).toThrow(TypeError);
      // Value should remain unchanged
      expect(role.value).toBe('ADMIN');
    });

    it('should not allow adding new properties to props', () => {
      // Given: USER role
      const role = UserRole.USER();

      // When: Attempting to add new property
      const addProperty = () => {
        // @ts-expect-error - Testing runtime immutability
        role.props.newProp = 'value';
      };

      // Then: Cannot add new properties (frozen object)
      expect(Object.isFrozen(role.props)).toBe(true);
      expect(addProperty).toThrow(TypeError);
      // @ts-expect-error - Checking that property was not added
      expect(role.props.newProp).toBeUndefined();
    });
  });
});
