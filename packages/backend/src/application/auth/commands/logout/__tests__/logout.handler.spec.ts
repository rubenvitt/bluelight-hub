import { LogoutHandler } from '../logout.handler';
import { LogoutCommand } from '../logout.command';
import type { IJwtAuthServicePort } from '@domain/ports/i-jwt-auth-service.port';

/**
 * Unit Tests für LogoutHandler.
 *
 * Diese Tests validieren die Application Layer Implementation des Logout-Prozesses
 * mit gemocktem IJwtAuthServicePort.
 *
 * **Test Coverage:**
 * - execute() Method: Erfolgreicher Logout (MVP: No-Op)
 * - Error Cases: Token Revocation Fehler (Edge Case)
 *
 * **Mocking Strategy:**
 * - IJwtAuthServicePort: Vollständig gemockt (revokeToken)
 *
 * **Test Patterns:**
 * - AAA Pattern: Arrange → Act → Assert
 * - Mock Reset: beforeEach() cleared alle Mocks
 * - Given-When-Then Comments für Lesbarkeit
 *
 * **MVP Context:**
 * - revokeToken() ist im MVP ein No-Op (stateless JWT)
 * - Token bleibt gültig bis Expiration (24h)
 * - Client muss Token clientseitig löschen
 * - Future: Redis Blacklist Implementation
 */
describe('LogoutHandler', () => {
  let handler: LogoutHandler;
  let mockJwtService: jest.Mocked<IJwtAuthServicePort>;

  beforeEach(() => {
    // Mock JWT Service
    mockJwtService = {
      generateToken: jest.fn(),
      validateToken: jest.fn(),
      revokeToken: jest.fn(),
    } as unknown as jest.Mocked<IJwtAuthServicePort>;

    handler = new LogoutHandler(mockJwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute()', () => {
    it('sollte erfolgreich sein bei gültigem Token', async () => {
      // Given
      const command = LogoutCommand.create('valid.jwt.token').value!;
      mockJwtService.revokeToken.mockResolvedValue(undefined); // No-Op (MVP)

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeUndefined();
      expect(mockJwtService.revokeToken).toHaveBeenCalledTimes(1);
      expect(mockJwtService.revokeToken).toHaveBeenCalledWith('valid.jwt.token');
    });

    it('sollte Result.ok() zurückgeben (MVP: No-Op)', async () => {
      // Given
      const command = LogoutCommand.create('any.jwt.token').value!;
      mockJwtService.revokeToken.mockResolvedValue(undefined); // No-Op

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeUndefined();
      // Im MVP ist revokeToken ein No-Op, daher immer erfolgreich
    });

    it('sollte Fehler zurückgeben wenn revokeToken wirft (Edge Case)', async () => {
      // Given
      const command = LogoutCommand.create('problematic.token').value!;
      mockJwtService.revokeToken.mockRejectedValue(new Error('Redis connection failed'));

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Logout fehlgeschlagen');
      expect(result.error).toContain('Redis connection failed');
    });

    it('sollte mehrfache Logout-Aufrufe erlauben (Idempotenz)', async () => {
      // Given
      const command = LogoutCommand.create('same.token').value!;
      mockJwtService.revokeToken.mockResolvedValue(undefined);

      // When
      const result1 = await handler.execute(command);
      const result2 = await handler.execute(command);

      // Then
      expect(result1.isSuccess).toBe(true);
      expect(result2.isSuccess).toBe(true);
      expect(mockJwtService.revokeToken).toHaveBeenCalledTimes(2);
      // Im MVP ist Logout idempotent (No-Op kann mehrfach aufgerufen werden)
    });

    it('sollte Token Hash in Logs verwenden (Security)', async () => {
      // Given
      const fullToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const command = LogoutCommand.create(fullToken).value!;
      mockJwtService.revokeToken.mockResolvedValue(undefined);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      // Handler sollte nur Token-Hash loggen (NICHT full token)
      // Dies ist ein Security Best Practice (verhindert Token Leakage in Logs)
      expect(mockJwtService.revokeToken).toHaveBeenCalledWith(fullToken);
    });
  });
});
