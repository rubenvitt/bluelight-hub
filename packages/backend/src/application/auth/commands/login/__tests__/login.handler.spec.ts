import { LoginHandler } from '../login.handler';
import { LoginCommand } from '../login.command';
import type { IUserRepository } from '@domain/repositories/i-user.repository';
import type { IJwtAuthServicePort } from '@domain/ports/i-jwt-auth-service.port';
import { UserId } from '@domain/value-objects/user-id';
import { Username } from '@domain/value-objects/username';
import { UserRole } from '@domain/value-objects/user-role';
import type { UserAggregate } from '@domain/aggregates/user.aggregate';
import { Result } from '@domain/common/result';
import * as bcrypt from 'bcrypt';

/**
 * Unit Tests für LoginHandler.
 *
 * Diese Tests validieren die Application Layer Implementation des Login-Prozesses
 * mit gemocktem IUserRepository und IJwtAuthServicePort.
 *
 * **Test Coverage:**
 * - execute() Method: Erfolgreiche Login-Szenarien (USER passwordless, ADMIN mit Passwort)
 * - Error Cases: User nicht gefunden, Account gesperrt, fehlende/falsche Passwörter
 * - Edge Cases: Username case-insensitivity, ungültiger Username-Format
 *
 * **Mocking Strategy:**
 * - IUserRepository: Vollständig gemockt (findByUsername, getPasswordHash)
 * - IJwtAuthServicePort: Vollständig gemockt (generateToken)
 * - bcrypt: Gemockt via jest.spyOn
 *
 * **Test Patterns:**
 * - AAA Pattern: Arrange → Act → Assert
 * - Mock Reset: beforeEach() cleared alle Mocks
 * - Given-When-Then Comments für Lesbarkeit
 */
describe('LoginHandler', () => {
  let handler: LoginHandler;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockJwtService: jest.Mocked<IJwtAuthServicePort>;

  beforeEach(() => {
    // Mock Repository
    mockUserRepository = {
      findByUsername: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      findAll: jest.fn(),
      existsByUsername: jest.fn(),
      countSuperAdmins: jest.fn(),
      getPasswordHash: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;

    // Mock JWT Service
    mockJwtService = {
      generateToken: jest.fn(),
      validateToken: jest.fn(),
      revokeToken: jest.fn(),
    } as unknown as jest.Mocked<IJwtAuthServicePort>;

    handler = new LoginHandler(mockUserRepository, mockJwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks(); // Restore bcrypt.compare spy
  });

  /**
   * Helper: Erstellt einen Mock User Aggregate
   */
  const createMockUser = (overrides: { username?: string; role?: UserRole; isLocked?: boolean } = {}): UserAggregate => {
    const userId = UserId.create().value as UserId;
    const username = overrides.username ? (Username.create(overrides.username).value as Username) : (Username.create('testuser').value as Username);
    const role = overrides.role ?? UserRole.USER();
    const isLocked = overrides.isLocked ?? false;

    return {
      id: userId,
      username: username,
      role: role,
      isLocked: isLocked,
    } as UserAggregate;
  };

  describe('execute()', () => {
    it('sollte JWT Token zurückgeben bei gültigem USER Login (PASSWORDLESS)', async () => {
      // Given
      const command = LoginCommand.create('testuser').value!;
      const mockUser = createMockUser({ username: 'testuser', role: UserRole.USER() });
      const expectedToken = 'mock.jwt.token';

      mockUserRepository.findByUsername.mockResolvedValue(Result.ok(mockUser));
      mockJwtService.generateToken.mockResolvedValue(expectedToken);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(expectedToken);
      expect(mockUserRepository.findByUsername).toHaveBeenCalledTimes(1);
      expect(mockJwtService.generateToken).toHaveBeenCalledWith(mockUser.id, mockUser.role);
      // Bei USER sollte KEIN Password Check stattfinden
      expect(mockUserRepository.getPasswordHash).not.toHaveBeenCalled();
    });

    it('sollte JWT Token zurückgeben bei gültigem ADMIN Login mit Passwort', async () => {
      // Given
      const password = 'secure_password';
      const command = LoginCommand.create('adminuser', password).value!;
      const mockUser = createMockUser({ username: 'adminuser', role: UserRole.ADMIN() });
      const expectedToken = 'admin.jwt.token';
      // Hash das gleiche Passwort wie im Command für echte bcrypt Validierung
      const passwordHash = await bcrypt.hash(password, 10);

      mockUserRepository.findByUsername.mockResolvedValue(Result.ok(mockUser));
      mockUserRepository.getPasswordHash.mockResolvedValue(Result.ok(passwordHash));
      mockJwtService.generateToken.mockResolvedValue(expectedToken);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(expectedToken);
      expect(mockUserRepository.getPasswordHash).toHaveBeenCalledWith(mockUser.id);
      // bcrypt.compare wird intern aufgerufen (echte bcrypt Validierung)
      expect(mockJwtService.generateToken).toHaveBeenCalledWith(mockUser.id, mockUser.role);
    });

    it('sollte Fehler zurückgeben wenn User nicht existiert', async () => {
      // Given
      const command = LoginCommand.create('nonexistent').value!;
      mockUserRepository.findByUsername.mockResolvedValue(Result.ok(null));

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Benutzer nicht gefunden');
      expect(mockJwtService.generateToken).not.toHaveBeenCalled();
    });

    it('sollte Fehler zurückgeben wenn Account gesperrt ist (isLocked)', async () => {
      // Given
      const command = LoginCommand.create('lockeduser').value!;
      const mockUser = createMockUser({ username: 'lockeduser', isLocked: true });

      mockUserRepository.findByUsername.mockResolvedValue(Result.ok(mockUser));

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Benutzerkonto gesperrt');
      expect(mockJwtService.generateToken).not.toHaveBeenCalled();
    });

    it('sollte Fehler zurückgeben wenn ADMIN ohne Passwort einloggt', async () => {
      // Given
      const command = LoginCommand.create('adminuser').value!; // Kein Passwort
      const mockUser = createMockUser({ username: 'adminuser', role: UserRole.ADMIN() });

      mockUserRepository.findByUsername.mockResolvedValue(Result.ok(mockUser));

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Passwort ist für Admin-Accounts erforderlich');
      expect(mockJwtService.generateToken).not.toHaveBeenCalled();
    });

    it('sollte Fehler zurückgeben bei falschem Passwort', async () => {
      // Given
      const command = LoginCommand.create('adminuser', 'wrong_password').value!;
      const mockUser = createMockUser({ username: 'adminuser', role: UserRole.ADMIN() });
      const passwordHash = await bcrypt.hash('correct_password', 10);

      mockUserRepository.findByUsername.mockResolvedValue(Result.ok(mockUser));
      mockUserRepository.getPasswordHash.mockResolvedValue(Result.ok(passwordHash));

      // Mock bcrypt.compare → false (falsches Passwort)
      jest.spyOn(bcrypt, 'compare').mockImplementation((() => Promise.resolve(false)) as any);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Ungültiges Passwort');
      expect(mockJwtService.generateToken).not.toHaveBeenCalled();
    });

    it('sollte Username case-insensitive behandeln', async () => {
      // Given
      const command = LoginCommand.create('TestUser').value!; // Mixed Case
      // LoginCommand.create() normalisiert zu lowercase → "testuser"
      const mockUser = createMockUser({ username: 'testuser', role: UserRole.USER() });
      const expectedToken = 'mock.jwt.token';

      mockUserRepository.findByUsername.mockResolvedValue(Result.ok(mockUser));
      mockJwtService.generateToken.mockResolvedValue(expectedToken);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      // Prüfe dass findByUsername mit lowercase Username aufgerufen wurde
      const calledUsername = mockUserRepository.findByUsername.mock.calls[0][0];
      expect(calledUsername.value).toBe('testuser');
    });

    it('sollte Fehler zurückgeben bei ungültigem Username-Format', async () => {
      // Given
      const command = LoginCommand.create('ab').value!; // Zu kurz (min 3 Zeichen)

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Username ungültig');
      expect(mockUserRepository.findByUsername).not.toHaveBeenCalled();
    });

    it('sollte Fehler zurückgeben wenn Repository Fehler wirft', async () => {
      // Given
      const command = LoginCommand.create('testuser').value!;
      mockUserRepository.findByUsername.mockResolvedValue(Result.fail('Database connection failed'));

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Benutzer nicht gefunden'); // Sanitized error message
      expect(mockJwtService.generateToken).not.toHaveBeenCalled();
    });

    it('sollte Fehler zurückgeben wenn getPasswordHash fehlschlägt', async () => {
      // Given
      const command = LoginCommand.create('adminuser', 'password').value!;
      const mockUser = createMockUser({ username: 'adminuser', role: UserRole.ADMIN() });

      mockUserRepository.findByUsername.mockResolvedValue(Result.ok(mockUser));
      mockUserRepository.getPasswordHash.mockResolvedValue(Result.fail('Database error'));

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Login fehlgeschlagen'); // Sanitized error message
      expect(mockJwtService.generateToken).not.toHaveBeenCalled();
    });

    it('sollte Fehler zurückgeben wenn JWT Token Generierung fehlschlägt', async () => {
      // Given
      const command = LoginCommand.create('testuser').value!;
      const mockUser = createMockUser({ username: 'testuser', role: UserRole.USER() });

      mockUserRepository.findByUsername.mockResolvedValue(Result.ok(mockUser));
      mockJwtService.generateToken.mockRejectedValue(new Error('JWT service unavailable'));

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Login fehlgeschlagen'); // Sanitized error message
    });

    it('sollte JWT Token zurückgeben bei gültigem SUPER_ADMIN Login mit Passwort', async () => {
      // Given
      const password = 'super_secure_password';
      const command = LoginCommand.create('superadmin', password).value!;
      const mockUser = createMockUser({ username: 'superadmin', role: UserRole.SUPER_ADMIN() });
      const expectedToken = 'super.jwt.token';
      // Hash das gleiche Passwort wie im Command für echte bcrypt Validierung
      const passwordHash = await bcrypt.hash(password, 10);

      mockUserRepository.findByUsername.mockResolvedValue(Result.ok(mockUser));
      mockUserRepository.getPasswordHash.mockResolvedValue(Result.ok(passwordHash));
      mockJwtService.generateToken.mockResolvedValue(expectedToken);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(expectedToken);
      expect(mockUserRepository.getPasswordHash).toHaveBeenCalledWith(mockUser.id);
      // bcrypt.compare wird intern aufgerufen (echte bcrypt Validierung)
      expect(mockJwtService.generateToken).toHaveBeenCalledWith(mockUser.id, mockUser.role);
    });

    it('sollte Fehler zurückgeben wenn SUPER_ADMIN ohne Passwort einloggt', async () => {
      // Given
      const command = LoginCommand.create('superadmin').value!; // Kein Passwort
      const mockUser = createMockUser({ username: 'superadmin', role: UserRole.SUPER_ADMIN() });

      mockUserRepository.findByUsername.mockResolvedValue(Result.ok(mockUser));

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Passwort ist für Admin-Accounts erforderlich');
      expect(mockJwtService.generateToken).not.toHaveBeenCalled();
    });
  });
});
