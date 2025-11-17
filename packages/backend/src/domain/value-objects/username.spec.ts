import { Username } from './username';

describe('Username', () => {
  describe('create() - Factory Method', () => {
    describe('Valid Cases', () => {
      it('should create Username with valid 3-char value', () => {
        // Given: Minimum valid length (3 characters)
        const input = 'abc';

        // When: Creating Username
        const result = Username.create(input);

        // Then: Should succeed
        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
        expect(result.value).toBeInstanceOf(Username);
        expect(result.value.value).toBe('abc');
      });

      it('should create Username with valid 50-char value', () => {
        // Given: Maximum valid length (50 characters)
        const input = 'a'.repeat(50);

        // When: Creating Username
        const result = Username.create(input);

        // Then: Should succeed
        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
        expect(result.value).toBeInstanceOf(Username);
        expect(result.value.value).toBe(input);
      });

      it('should create Username with alphanumeric chars', () => {
        // Given: Valid alphanumeric combination
        const input = 'User123';

        // When: Creating Username
        const result = Username.create(input);

        // Then: Should succeed and normalize to lowercase
        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
        expect(result.value).toBeInstanceOf(Username);
        expect(result.value.value).toBe('user123');
      });

      it('should create Username with underscores', () => {
        // Given: Valid username with underscores
        const input = 'user_name_123';

        // When: Creating Username
        const result = Username.create(input);

        // Then: Should succeed
        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
        expect(result.value).toBeInstanceOf(Username);
        expect(result.value.value).toBe('user_name_123');
      });

      it('should normalize to lowercase on creation', () => {
        // Given: Mixed case username
        const input = 'RubenVitt';

        // When: Creating Username
        const result = Username.create(input);

        // Then: Should succeed and convert to lowercase
        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
        expect(result.value).toBeInstanceOf(Username);
        expect(result.value.value).toBe('rubenvitt');
      });
    });

    describe('Invalid Cases', () => {
      it('should fail with too short username (<3 chars)', () => {
        // Given: Username with 2 characters (below minimum)
        const input = 'ab';

        // When: Creating Username
        const result = Username.create(input);

        // Then: Should fail with validation error
        expect(result.isFailure).toBe(true);
        expect(result.isSuccess).toBe(false);
        expect(result.error).toBe('Username ungültig: Muss 3-50 Zeichen sein (alphanumerisch oder Underscore)');
      });

      it('should fail with too long username (>50 chars)', () => {
        // Given: Username with 51 characters (above maximum)
        const input = 'a'.repeat(51);

        // When: Creating Username
        const result = Username.create(input);

        // Then: Should fail with validation error
        expect(result.isFailure).toBe(true);
        expect(result.isSuccess).toBe(false);
        expect(result.error).toBe('Username ungültig: Muss 3-50 Zeichen sein (alphanumerisch oder Underscore)');
      });

      it('should fail with spaces', () => {
        // Given: Username containing spaces
        const input = 'user name';

        // When: Creating Username
        const result = Username.create(input);

        // Then: Should fail with validation error
        expect(result.isFailure).toBe(true);
        expect(result.isSuccess).toBe(false);
        expect(result.error).toBe('Username ungültig: Muss 3-50 Zeichen sein (alphanumerisch oder Underscore)');
      });

      it('should fail with special characters (@, -, ., etc.)', () => {
        // Given: Username with various special characters
        const testCases = ['user@name', 'user-name', 'user.name', 'user!name', 'user#name', 'user$name', 'user%name', 'user&name'];

        for (const input of testCases) {
          // When: Creating Username
          const result = Username.create(input);

          // Then: Should fail with validation error
          expect(result.isFailure).toBe(true);
          expect(result.isSuccess).toBe(false);
          expect(result.error).toBe('Username ungültig: Muss 3-50 Zeichen sein (alphanumerisch oder Underscore)');
        }
      });

      it('should fail with empty string', () => {
        // Given: Empty string
        const input = '';

        // When: Creating Username
        const result = Username.create(input);

        // Then: Should fail with validation error
        expect(result.isFailure).toBe(true);
        expect(result.isSuccess).toBe(false);
        expect(result.error).toBe('Username ungültig: Muss 3-50 Zeichen sein (alphanumerisch oder Underscore)');
      });
    });
  });

  describe('equals() - Case-Insensitive Equality', () => {
    it('should return true for same username (case-insensitive)', () => {
      // Given: Two usernames with same normalized value
      const username1Result = Username.create('testuser');
      const username2Result = Username.create('testuser');

      // When: Comparing usernames
      const areEqual = username1Result.value.equals(username2Result.value);

      // Then: Should be equal
      expect(areEqual).toBe(true);
    });

    it('should return true for "Ruben" === "ruben" (case-insensitive)', () => {
      // Given: Two usernames with different cases but same normalized value
      const username1Result = Username.create('Ruben');
      const username2Result = Username.create('ruben');

      // When: Comparing usernames
      const areEqual = username1Result.value.equals(username2Result.value);

      // Then: Should be equal (both normalized to lowercase)
      expect(areEqual).toBe(true);
      expect(username1Result.value.value).toBe('ruben');
      expect(username2Result.value.value).toBe('ruben');
    });

    it('should return false for different usernames', () => {
      // Given: Two different usernames
      const username1Result = Username.create('user1');
      const username2Result = Username.create('user2');

      // When: Comparing usernames
      const areEqual = username1Result.value.equals(username2Result.value);

      // Then: Should not be equal
      expect(areEqual).toBe(false);
    });
  });

  describe('toString() - String Representation', () => {
    it('should return lowercase normalized value', () => {
      // Given: Username created with mixed case
      const input = 'TestUser123';
      const result = Username.create(input);

      // When: Converting to string
      const stringValue = result.value.toString();

      // Then: Should return lowercase normalized value
      expect(stringValue).toBe('testuser123');
      expect(stringValue).toBe(result.value.value);
    });
  });

  describe('Immutability', () => {
    it('should freeze props object', () => {
      // Given: Created Username
      const result = Username.create('testuser');
      const username = result.value;

      // When: Attempting to modify props
      const modifyProps = () => {
        // biome-ignore lint/suspicious/noExplicitAny: Testing immutability
        (username as any).props.value = 'modified';
      };

      // Then: Should throw error (object is frozen)
      expect(modifyProps).toThrow();
      expect(username.value).toBe('testuser');
    });
  });
});
