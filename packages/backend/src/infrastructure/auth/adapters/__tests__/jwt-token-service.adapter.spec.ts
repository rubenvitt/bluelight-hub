import { Test, type TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { JwtTokenServiceAdapter } from '../jwt-token-service.adapter';
import { UserId } from '@domain/value-objects/user-id';
import { UserRole } from '@domain/value-objects/user-role';

/**
 * Unit Tests für JwtTokenServiceAdapter.
 *
 * Diese Tests validieren die Infrastructure Layer Implementation des
 * IJwtAuthServicePort mit gemocktem JwtService.
 *
 * **Test Coverage:**
 * - generateToken() Method: Token-Generierung, Payload-Validierung, Expiry, Secret-Handling, Error Cases
 * - validateToken() Method: Valid Token, Expired Token, Invalid Signature, Malformed Token, Invalid Claims
 * - revokeToken() Method: No-Op Verhalten (MVP)
 *
 * **Mocking Strategy:**
 * - JwtService: Vollständig gemockt (signAsync, verifyAsync)
 * - JWT_SECRET: Wird von process.env.JWT_SECRET gelesen
 *
 * **Test Patterns:**
 * - AAA Pattern: Arrange → Act → Assert
 * - Mock Reset: beforeEach() cleared alle Mocks
 * - Given-When-Then Comments für Lesbarkeit
 */
describe('JwtTokenServiceAdapter', () => {
  let adapter: JwtTokenServiceAdapter;
  let mockJwtService: jest.Mocked<JwtService>;

  const TEST_SECRET = 'test-jwt-secret-for-unit-tests';

  beforeEach(async () => {
    // Set environment variable for tests
    process.env.JWT_SECRET = TEST_SECRET;

    mockJwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtTokenServiceAdapter, { provide: JwtService, useValue: mockJwtService }],
    }).compile();

    adapter = module.get<JwtTokenServiceAdapter>(JwtTokenServiceAdapter);
  });

  afterEach(() => {
    // Clean up environment variable and mocks
    delete process.env.JWT_SECRET;
    jest.clearAllMocks();
  });

  describe('generateToken()', () => {
    it('should generate a valid JWT token', async () => {
      // Given
      const userId = UserId.create().value as UserId;
      const role = UserRole.USER();
      const expectedToken = 'mock.jwt.token';
      mockJwtService.signAsync.mockResolvedValue(expectedToken);

      // When
      const token = await adapter.generateToken(userId, role);

      // Then
      expect(token).toBe(expectedToken);
      expect(mockJwtService.signAsync).toHaveBeenCalledTimes(1);
    });

    it('should include correct payload (sub, role, iat)', async () => {
      // Given
      const userId = UserId.create().value as UserId;
      const role = UserRole.ADMIN();
      mockJwtService.signAsync.mockResolvedValue('token');

      // When
      await adapter.generateToken(userId, role);

      // Then
      const [payload] = mockJwtService.signAsync.mock.calls[0];
      expect(payload).toMatchObject({
        sub: userId.value,
        role: role.value,
      });
      expect(payload.iat).toBeDefined();
      expect(typeof payload.iat).toBe('number');
    });

    it('should use 24h expiry', async () => {
      // Given
      const userId = UserId.create().value as UserId;
      const role = UserRole.USER();
      mockJwtService.signAsync.mockResolvedValue('token');

      // When
      await adapter.generateToken(userId, role);

      // Then
      const [, options] = mockJwtService.signAsync.mock.calls[0];
      expect(options.expiresIn).toBe('24h');
    });

    it('should use JWT_SECRET from ConfigService', async () => {
      // Given
      const userId = UserId.create().value as UserId;
      const role = UserRole.USER();
      mockJwtService.signAsync.mockResolvedValue('token');

      // When
      await adapter.generateToken(userId, role);

      // Then
      expect(mockConfigService.get).toHaveBeenCalledWith('JWT_SECRET');
      const [, options] = mockJwtService.signAsync.mock.calls[0];
      expect(options.secret).toBe(TEST_SECRET);
    });

    it('should throw error if JWT_SECRET not configured', async () => {
      // Given
      mockConfigService.get.mockReturnValue(undefined);
      const userId = UserId.create().value as UserId;
      const role = UserRole.USER();

      // When/Then
      await expect(adapter.generateToken(userId, role)).rejects.toThrow('JWT_SECRET not configured');
    });
  });

  describe('validateToken()', () => {
    it('should return Result.ok with userId and role for valid token', async () => {
      // Given
      const mockUserId = UserId.create().value as UserId;
      const mockRole = 'ADMIN';
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: mockUserId.value,
        role: mockRole,
        iat: Math.floor(Date.now() / 1000),
      });

      // When
      const result = await adapter.validateToken('valid.jwt.token');

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value?.userId.value).toBe(mockUserId.value);
      expect(result.value?.role.value).toBe(mockRole);
    });

    it('should return Result.fail for expired token', async () => {
      // Given
      mockJwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      // When
      const result = await adapter.validateToken('expired.jwt.token');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('expired');
    });

    it('should return Result.fail for invalid signature', async () => {
      // Given
      mockJwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));

      // When
      const result = await adapter.validateToken('tampered.jwt.token');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid token');
    });

    it('should return Result.fail for malformed token', async () => {
      // Given
      mockJwtService.verifyAsync.mockRejectedValue(new Error('jwt malformed'));

      // When
      const result = await adapter.validateToken('not-a-jwt');

      // Then
      expect(result.isFailure).toBe(true);
    });

    it('should return Result.fail for invalid userId in payload', async () => {
      // Given
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: 'invalid-user-id-format', // Not a valid nanoid
        role: 'USER',
        iat: Math.floor(Date.now() / 1000),
      });

      // When
      const result = await adapter.validateToken('token-with-bad-userid');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('userId');
    });

    it('should return Result.fail for invalid role in payload', async () => {
      // Given
      const mockUserId = UserId.create().value as UserId;
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: mockUserId.value,
        role: 'INVALID_ROLE', // Not a valid UserRole
        iat: Math.floor(Date.now() / 1000),
      });

      // When
      const result = await adapter.validateToken('token-with-bad-role');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('role');
    });

    it('should return Result.fail if JWT_SECRET not configured', async () => {
      // Given
      mockConfigService.get.mockReturnValue(undefined);

      // When
      const result = await adapter.validateToken('any.token');

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('JWT_SECRET not configured');
    });
  });

  describe('revokeToken()', () => {
    it('should be a no-op and return void', async () => {
      // Given
      const token = 'any.jwt.token';

      // When
      const result = await adapter.revokeToken(token);

      // Then: No error thrown, returns void (undefined)
      expect(result).toBeUndefined();
    });

    it('should not call any external service (MVP No-Op)', async () => {
      // Given
      const token = 'any.jwt.token';

      // When
      await adapter.revokeToken(token);

      // Then
      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
      expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
    });
  });
});
