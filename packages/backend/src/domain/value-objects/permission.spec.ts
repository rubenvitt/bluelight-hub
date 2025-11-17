import { Permission } from './permission';

describe('Permission', () => {
  describe('create() - Factory Method', () => {
    describe('Valid Cases', () => {
      it('should create Permission with valid format "user:read"', () => {
        // Given: Ein valider Permission String im Format "resource:action"
        const value = 'user:read';

        // When: Permission wird via create() erstellt
        const result = Permission.create(value);

        // Then: Result ist Success und Permission hat korrekten Value
        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
        expect(result.value).toBeInstanceOf(Permission);
        expect(result.value.value).toBe(value);
        expect(result.value.toString()).toBe(value);
      });

      it('should create Permission with underscores "einsatz_detail:create"', () => {
        // Given: Ein valider Permission String mit Underscores
        const value = 'einsatz_detail:create';

        // When: Permission wird via create() erstellt
        const result = Permission.create(value);

        // Then: Result ist Success (Underscores sind erlaubt)
        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
        expect(result.value.value).toBe(value);
      });

      it('should create Permission with wildcard "user:*"', () => {
        // Given: Ein valider Wildcard Permission String
        const value = 'user:*';

        // When: Permission wird via create() erstellt
        const result = Permission.create(value);

        // Then: Result ist Success (Wildcards sind erlaubt)
        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
        expect(result.value.value).toBe(value);
      });

      it('should create Permission with full wildcard "*:*"', () => {
        // Given: Ein valider Full-Wildcard Permission String
        const value = '*:*';

        // When: Permission wird via create() erstellt
        const result = Permission.create(value);

        // Then: Result ist Success
        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
        expect(result.value.value).toBe(value);
      });
    });

    describe('Invalid Cases', () => {
      it('should fail with missing colon', () => {
        // Given: Ein invalider Permission String ohne Doppelpunkt
        const value = 'userread';

        // When: Permission wird via create() erstellt
        const result = Permission.create(value);

        // Then: Result ist Failure mit Fehlermeldung
        expect(result.isFailure).toBe(true);
        expect(result.isSuccess).toBe(false);
        expect(result.error).toContain('Ungültiges Permission Format');
        expect(result.error).toContain(value);
      });

      it('should fail with uppercase letters', () => {
        // Given: Ein invalider Permission String mit Uppercase
        const value = 'User:Read';

        // When: Permission wird via create() erstellt
        const result = Permission.create(value);

        // Then: Result ist Failure (lowercase only!)
        expect(result.isFailure).toBe(true);
        expect(result.isSuccess).toBe(false);
        expect(result.error).toContain('Ungültiges Permission Format');
      });

      it('should fail with numbers', () => {
        // Given: Ein invalider Permission String mit Zahlen
        const value = 'user123:read456';

        // When: Permission wird via create() erstellt
        const result = Permission.create(value);

        // Then: Result ist Failure (nur Buchstaben + Underscore erlaubt)
        expect(result.isFailure).toBe(true);
        expect(result.isSuccess).toBe(false);
        expect(result.error).toContain('Ungültiges Permission Format');
      });

      it('should fail with special chars (except underscore)', () => {
        // Given: Ein invalider Permission String mit Special Characters
        const value = 'user-admin:read!';

        // When: Permission wird via create() erstellt
        const result = Permission.create(value);

        // Then: Result ist Failure (nur Underscore erlaubt, keine anderen Special Chars)
        expect(result.isFailure).toBe(true);
        expect(result.isSuccess).toBe(false);
        expect(result.error).toContain('Ungültiges Permission Format');
      });

      it('should fail with empty resource', () => {
        // Given: Ein invalider Permission String mit leerem Resource-Teil
        const value = ':read';

        // When: Permission wird via create() erstellt
        const result = Permission.create(value);

        // Then: Result ist Failure
        expect(result.isFailure).toBe(true);
        expect(result.isSuccess).toBe(false);
      });

      it('should fail with empty action', () => {
        // Given: Ein invalider Permission String mit leerem Action-Teil
        const value = 'user:';

        // When: Permission wird via create() erstellt
        const result = Permission.create(value);

        // Then: Result ist Failure
        expect(result.isFailure).toBe(true);
        expect(result.isSuccess).toBe(false);
      });
    });
  });

  describe('Static Convenience Factories', () => {
    it('should create CREATE_EINSATZ permission via static factory', () => {
      // When: CREATE_EINSATZ Static Factory wird aufgerufen
      const permission = Permission.CREATE_EINSATZ();

      // Then: Permission hat korrekten Value "einsatz:create"
      expect(permission).toBeInstanceOf(Permission);
      expect(permission.value).toBe('einsatz:create');
      expect(permission.toString()).toBe('einsatz:create');
    });

    it('should create EDIT_EINSATZ permission via static factory', () => {
      // When: EDIT_EINSATZ Static Factory wird aufgerufen
      const permission = Permission.EDIT_EINSATZ();

      // Then: Permission hat korrekten Value "einsatz:update"
      expect(permission).toBeInstanceOf(Permission);
      expect(permission.value).toBe('einsatz:update');
    });

    it('should create DELETE_EINSATZ permission via static factory', () => {
      // When: DELETE_EINSATZ Static Factory wird aufgerufen
      const permission = Permission.DELETE_EINSATZ();

      // Then: Permission hat korrekten Value "einsatz:delete"
      expect(permission).toBeInstanceOf(Permission);
      expect(permission.value).toBe('einsatz:delete');
    });

    it('should create LOCK_ETB permission via static factory', () => {
      // When: LOCK_ETB Static Factory wird aufgerufen
      const permission = Permission.LOCK_ETB();

      // Then: Permission hat korrekten Value "etb:lock"
      expect(permission).toBeInstanceOf(Permission);
      expect(permission.value).toBe('etb:lock');
    });

    it('should create MANAGE_USERS permission with wildcard', () => {
      // When: MANAGE_USERS Static Factory wird aufgerufen
      const permission = Permission.MANAGE_USERS();

      // Then: Permission hat korrekten Wildcard Value "user:*"
      expect(permission).toBeInstanceOf(Permission);
      expect(permission.value).toBe('user:*');
      expect(permission.toString()).toBe('user:*');
    });

    it('should create SYSTEM_CONFIG permission with wildcard', () => {
      // When: SYSTEM_CONFIG Static Factory wird aufgerufen
      const permission = Permission.SYSTEM_CONFIG();

      // Then: Permission hat korrekten Wildcard Value "system:*"
      expect(permission).toBeInstanceOf(Permission);
      expect(permission.value).toBe('system:*');
    });
  });

  describe('matches() - Wildcard Matching', () => {
    describe('Exact Matching (No Wildcards)', () => {
      it('should match exact permission', () => {
        // Given: Eine Permission "user:read"
        const permission = Permission.create('user:read').value;

        // When: matches() wird mit exakt gleicher Permission aufgerufen
        const result = permission.matches('user:read');

        // Then: Result ist true (exact match)
        expect(result).toBe(true);
      });

      it('should NOT match different permission', () => {
        // Given: Eine Permission "user:read"
        const permission = Permission.create('user:read').value;

        // When: matches() wird mit anderer Permission aufgerufen
        const result = permission.matches('user:write');

        // Then: Result ist false (keine Übereinstimmung)
        expect(result).toBe(false);
      });

      it('should NOT match different resource', () => {
        // Given: Eine Permission "user:read"
        const permission = Permission.create('user:read').value;

        // When: matches() wird mit Permission für andere Resource aufgerufen
        const result = permission.matches('einsatz:read');

        // Then: Result ist false (Resource stimmt nicht überein)
        expect(result).toBe(false);
      });
    });

    describe('Wildcard Pattern: "resource:*"', () => {
      it('should match wildcard pattern "user:*" with "user:read"', () => {
        // Given: Eine Permission "user:read"
        const permission = Permission.create('user:read').value;

        // When: matches() wird mit Wildcard Pattern "user:*" aufgerufen
        const result = permission.matches('user:*');

        // Then: Result ist true (Wildcard matcht alle user:-Actions)
        expect(result).toBe(true);
      });

      it('should match wildcard pattern "user:*" with "user:create"', () => {
        // Given: Eine Permission "user:create"
        const permission = Permission.create('user:create').value;

        // When: matches() wird mit Wildcard Pattern "user:*" aufgerufen
        const result = permission.matches('user:*');

        // Then: Result ist true
        expect(result).toBe(true);
      });

      it('should match wildcard pattern "user:*" with "user:delete"', () => {
        // Given: Eine Permission "user:delete"
        const permission = Permission.create('user:delete').value;

        // When: matches() wird mit Wildcard Pattern "user:*" aufgerufen
        const result = permission.matches('user:*');

        // Then: Result ist true
        expect(result).toBe(true);
      });

      it('should NOT match wildcard pattern "einsatz:*" with "user:read"', () => {
        // Given: Eine Permission "user:read"
        const permission = Permission.create('user:read').value;

        // When: matches() wird mit Wildcard Pattern "einsatz:*" aufgerufen
        const result = permission.matches('einsatz:*');

        // Then: Result ist false (Resource stimmt nicht überein)
        expect(result).toBe(false);
      });
    });

    describe('Wildcard Pattern: "*:action"', () => {
      it('should match wildcard pattern "*:read" with "user:read"', () => {
        // Given: Eine Permission "user:read"
        const permission = Permission.create('user:read').value;

        // When: matches() wird mit Wildcard Pattern "*:read" aufgerufen
        const result = permission.matches('*:read');

        // Then: Result ist true (Wildcard matcht alle Resources mit Action "read")
        expect(result).toBe(true);
      });

      it('should match wildcard pattern "*:read" with "einsatz:read"', () => {
        // Given: Eine Permission "einsatz:read"
        const permission = Permission.create('einsatz:read').value;

        // When: matches() wird mit Wildcard Pattern "*:read" aufgerufen
        const result = permission.matches('*:read');

        // Then: Result ist true
        expect(result).toBe(true);
      });

      it('should NOT match wildcard pattern "*:read" with "user:write"', () => {
        // Given: Eine Permission "user:write"
        const permission = Permission.create('user:write').value;

        // When: matches() wird mit Wildcard Pattern "*:read" aufgerufen
        const result = permission.matches('*:read');

        // Then: Result ist false (Action stimmt nicht überein)
        expect(result).toBe(false);
      });
    });

    describe('Wildcard Pattern: "*:*" (Super Admin)', () => {
      it('should match wildcard pattern "*:*" with any permission', () => {
        // Given: Eine Permission "user:read"
        const permission = Permission.create('user:read').value;

        // When: matches() wird mit Full-Wildcard Pattern "*:*" aufgerufen
        const result = permission.matches('*:*');

        // Then: Result ist true (Super Admin matcht ALLES)
        expect(result).toBe(true);
      });

      it('should match wildcard pattern "*:*" with "einsatz:delete"', () => {
        // Given: Eine Permission "einsatz:delete"
        const permission = Permission.create('einsatz:delete').value;

        // When: matches() wird mit Full-Wildcard Pattern "*:*" aufgerufen
        const result = permission.matches('*:*');

        // Then: Result ist true
        expect(result).toBe(true);
      });

      it('should match wildcard pattern "*:*" with "system:config"', () => {
        // Given: Eine Permission "system:config"
        const permission = Permission.create('system:config').value;

        // When: matches() wird mit Full-Wildcard Pattern "*:*" aufgerufen
        const result = permission.matches('*:*');

        // Then: Result ist true
        expect(result).toBe(true);
      });
    });

    describe('Edge Cases', () => {
      it('should handle underscore in resource name correctly', () => {
        // Given: Eine Permission mit Underscore "einsatz_detail:read"
        const permission = Permission.create('einsatz_detail:read').value;

        // When: matches() wird mit Wildcard Pattern "einsatz_detail:*" aufgerufen
        const result = permission.matches('einsatz_detail:*');

        // Then: Result ist true (Underscore ist Teil des Resource-Namens)
        expect(result).toBe(true);
      });

      it('should NOT match partial resource name', () => {
        // Given: Eine Permission "user_admin:read"
        const permission = Permission.create('user_admin:read').value;

        // When: matches() wird mit Pattern "user:*" aufgerufen (ohne "_admin")
        const result = permission.matches('user:*');

        // Then: Result ist false (Resource-Name muss EXAKT übereinstimmen)
        expect(result).toBe(false);
      });
    });
  });

  describe('toString() - String Representation', () => {
    it('should return permission value', () => {
      // Given: Eine Permission "user:read"
      const permission = Permission.create('user:read').value;

      // When: toString() wird aufgerufen
      const result = permission.toString();

      // Then: Result ist der Permission Value
      expect(result).toBe('user:read');
    });

    it('should return permission value for wildcard', () => {
      // Given: Eine Wildcard Permission "user:*"
      const permission = Permission.create('user:*').value;

      // When: toString() wird aufgerufen
      const result = permission.toString();

      // Then: Result ist der Wildcard Permission Value
      expect(result).toBe('user:*');
    });
  });

  describe('equals() - Equality', () => {
    it('should return true for same permission', () => {
      // Given: Zwei Permissions mit gleichem Value "user:read"
      const permission1 = Permission.create('user:read').value;
      const permission2 = Permission.create('user:read').value;

      // When: equals() wird aufgerufen
      const result = permission1.equals(permission2);

      // Then: Result ist true (gleicher Value)
      expect(result).toBe(true);
    });

    it('should return false for different permissions', () => {
      // Given: Zwei Permissions mit unterschiedlichem Value
      const permission1 = Permission.create('user:read').value;
      const permission2 = Permission.create('user:write').value;

      // When: equals() wird aufgerufen
      const result = permission1.equals(permission2);

      // Then: Result ist false (unterschiedliche Values)
      expect(result).toBe(false);
    });

    it('should return true for wildcard permissions', () => {
      // Given: Zwei Wildcard Permissions mit gleichem Value "user:*"
      const permission1 = Permission.create('user:*').value;
      const permission2 = Permission.create('user:*').value;

      // When: equals() wird aufgerufen
      const result = permission1.equals(permission2);

      // Then: Result ist true
      expect(result).toBe(true);
    });

    it('should return false for different wildcard permissions', () => {
      // Given: Zwei Wildcard Permissions mit unterschiedlichem Value
      const permission1 = Permission.create('user:*').value;
      const permission2 = Permission.create('einsatz:*').value;

      // When: equals() wird aufgerufen
      const result = permission1.equals(permission2);

      // Then: Result ist false
      expect(result).toBe(false);
    });
  });

  describe('Immutability', () => {
    it('should freeze props object', () => {
      // Given: Eine Permission "user:read"
      const permission = Permission.create('user:read').value;

      // When: Versuch die Props zu ändern
      // Then: Props sind frozen (TypeScript verhindert Zugriff, Object.isFrozen prüft Runtime)
      // @ts-expect-error - Accessing private property for immutability test
      expect(Object.isFrozen(permission.props)).toBe(true);
    });
  });

  describe('Static Factories - Complete Coverage', () => {
    it('should create all 6 standard permissions correctly', () => {
      // When: Alle 6 Static Factories werden aufgerufen
      const createEinsatz = Permission.CREATE_EINSATZ();
      const editEinsatz = Permission.EDIT_EINSATZ();
      const deleteEinsatz = Permission.DELETE_EINSATZ();
      const lockEtb = Permission.LOCK_ETB();
      const manageUsers = Permission.MANAGE_USERS();
      const systemConfig = Permission.SYSTEM_CONFIG();

      // Then: Alle Permissions haben korrekte Values
      expect(createEinsatz.value).toBe('einsatz:create');
      expect(editEinsatz.value).toBe('einsatz:update');
      expect(deleteEinsatz.value).toBe('einsatz:delete');
      expect(lockEtb.value).toBe('etb:lock');
      expect(manageUsers.value).toBe('user:*');
      expect(systemConfig.value).toBe('system:*');
    });

    it('should create unique instances for each static factory call', () => {
      // When: Static Factory mehrfach aufgerufen wird
      const permission1 = Permission.CREATE_EINSATZ();
      const permission2 = Permission.CREATE_EINSATZ();

      // Then: Zwei unterschiedliche Instanzen (aber gleicher Value)
      expect(permission1).not.toBe(permission2); // Unterschiedliche Objekt-Referenz
      expect(permission1.equals(permission2)).toBe(true); // Gleicher Value
    });
  });
});
