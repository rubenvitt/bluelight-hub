/**
 * Unit Tests für HiOrgTokenRefreshService.
 *
 * Testet automatisches Token-Refresh für HiOrg-Server OAuth2.
 *
 * @module application/integrations/services/__tests__
 */

import { Result } from '@domain/common/result';
import { IntegrationCredential, INTEGRATION_TYPES, INTEGRATION_ERROR_CODES } from '@domain/integrations';
import type { IIntegrationCredentialRepository } from '@domain/integrations/repositories/i-integration-credential.repository';
import type { IEncryptionPort } from '@domain/ports/i-encryption.port';
import type { IOAuth2Port, OAuth2TokenResponse } from '@domain/ports/i-oauth2.port';
import type { IHiOrgOAuthConfigPort, HiOrgOAuthClientCredentials } from '@domain/ports/i-hiorg-oauth-config.port';
import { HiOrgTokenRefreshService } from '../hiorg-token-refresh.service';

describe('HiOrgTokenRefreshService', () => {
  let service: HiOrgTokenRefreshService;
  let mockEncryption: jest.Mocked<IEncryptionPort>;
  let mockRepository: jest.Mocked<IIntegrationCredentialRepository>;
  let mockOAuth2: jest.Mocked<IOAuth2Port>;
  let mockOAuthConfig: jest.Mocked<IHiOrgOAuthConfigPort>;

  // Test-Fixture: Gültige Credentials mit nicht abgelaufenem Token
  const createValidCredential = (overrides?: Partial<{ isExpired: boolean; hasRefreshToken: boolean }>): IntegrationCredential => {
    const expiresAt = overrides?.isExpired ? new Date(Date.now() - 3600 * 1000) : new Date(Date.now() + 3600 * 1000);

    return IntegrationCredential.fromPersistence({
      id: 'test-id',
      type: INTEGRATION_TYPES.HIORG_SERVER,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      encryptedAccessToken: 'encrypted-access-token',
      encryptedRefreshToken: overrides?.hasRefreshToken !== false ? 'encrypted-refresh-token' : undefined,
      accessTokenExpiresAt: expiresAt,
    });
  };

  const clientCredentials: HiOrgOAuthClientCredentials = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
  };

  const tokenResponse: OAuth2TokenResponse = {
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
    expiresIn: 3600,
    tokenType: 'Bearer',
    scope: 'read write',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockEncryption = {
      encrypt: jest.fn((value) => `encrypted:${value}`),
      decrypt: jest.fn((value) => value.replace('encrypted:', '')),
    };

    mockRepository = {
      findByType: jest.fn(),
      save: jest.fn(),
      deleteByType: jest.fn(),
    };

    mockOAuth2 = {
      generateAuthorizationUrl: jest.fn(),
      exchangeCodeForTokens: jest.fn(),
      refreshAccessToken: jest.fn(),
    };

    mockOAuthConfig = {
      isConfigured: jest.fn().mockReturnValue(true),
      getClientCredentials: jest.fn().mockReturnValue(clientCredentials),
    };

    service = new HiOrgTokenRefreshService(mockEncryption, mockRepository, mockOAuth2, mockOAuthConfig);
  });

  describe('getValidAccessToken', () => {
    it('should return decrypted access token when token is still valid', async () => {
      // Given: Gültige Credentials mit nicht abgelaufenem Token
      const credential = createValidCredential({ isExpired: false });
      mockRepository.findByType.mockResolvedValue(Result.ok(credential));
      mockEncryption.decrypt.mockReturnValue('decrypted-access-token');

      // When
      const result = await service.getValidAccessToken();

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.accessToken).toBe('decrypted-access-token');
      expect(result.value!.wasRefreshed).toBe(false);
      expect(mockOAuth2.refreshAccessToken).not.toHaveBeenCalled();
    });

    it('should automatically refresh token when expired and return new access token', async () => {
      // Given: Credentials mit abgelaufenem Token und Refresh Token
      const expiredCredential = createValidCredential({ isExpired: true, hasRefreshToken: true });
      const refreshedCredential = createValidCredential({ isExpired: false, hasRefreshToken: true });

      mockRepository.findByType.mockResolvedValue(Result.ok(expiredCredential));
      mockOAuth2.refreshAccessToken.mockResolvedValue(Result.ok(tokenResponse));
      mockRepository.save.mockResolvedValue(Result.ok(refreshedCredential));
      mockEncryption.decrypt.mockReturnValue('new-access-token');

      // When
      const result = await service.getValidAccessToken();

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.wasRefreshed).toBe(true);
      expect(mockOAuth2.refreshAccessToken).toHaveBeenCalledWith({
        refreshToken: expect.any(String),
        clientId: clientCredentials.clientId,
        clientSecret: clientCredentials.clientSecret,
        tokenUrl: expect.stringContaining('hiorg-server.de'),
      });
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should fail when no credentials are configured', async () => {
      // Given: Keine Credentials
      mockRepository.findByType.mockResolvedValue(Result.ok(undefined));

      // When
      const result = await service.getValidAccessToken();

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(INTEGRATION_ERROR_CODES.CREDENTIALS_NOT_FOUND);
    });

    it('should fail when token expired but no refresh token available', async () => {
      // Given: Abgelaufenes Token ohne Refresh Token
      const expiredCredential = createValidCredential({ isExpired: true, hasRefreshToken: false });
      mockRepository.findByType.mockResolvedValue(Result.ok(expiredCredential));

      // When
      const result = await service.getValidAccessToken();

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(INTEGRATION_ERROR_CODES.OAUTH_TOKEN_REFRESH_FAILED);
      expect(result.error).toContain('Kein Refresh Token vorhanden');
    });

    it('should fail when refresh token is invalid/revoked', async () => {
      // Given: Abgelaufenes Token, Refresh schlägt fehl
      const expiredCredential = createValidCredential({ isExpired: true, hasRefreshToken: true });
      mockRepository.findByType.mockResolvedValue(Result.ok(expiredCredential));
      mockOAuth2.refreshAccessToken.mockResolvedValue(Result.fail('Token revoked'));

      // When
      const result = await service.getValidAccessToken();

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(INTEGRATION_ERROR_CODES.OAUTH_TOKEN_REFRESH_FAILED);
      expect(result.error).toContain('erneut mit HiOrg-Server verbinden');
    });

    it('should fail when OAuth2 client credentials are not configured', async () => {
      // Given: Token abgelaufen, aber keine Client Credentials
      const expiredCredential = createValidCredential({ isExpired: true, hasRefreshToken: true });
      mockRepository.findByType.mockResolvedValue(Result.ok(expiredCredential));
      mockOAuthConfig.getClientCredentials.mockReturnValue(undefined);

      // When
      const result = await service.getValidAccessToken();

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(INTEGRATION_ERROR_CODES.OAUTH_NOT_CONFIGURED);
    });

    it('should fail when credentials have no OAuth tokens at all', async () => {
      // Given: Credentials ohne OAuth Tokens
      const credentialWithoutTokens = IntegrationCredential.fromPersistence({
        id: 'test-id',
        type: INTEGRATION_TYPES.HIORG_SERVER,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        // Keine OAuth Tokens
      });
      mockRepository.findByType.mockResolvedValue(Result.ok(credentialWithoutTokens));

      // When
      const result = await service.getValidAccessToken();

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('OAuth2-Verbindung');
    });

    it('should preserve existing refresh token if provider does not return new one', async () => {
      // Given: Provider gibt keinen neuen Refresh Token zurück
      const expiredCredential = createValidCredential({ isExpired: true, hasRefreshToken: true });
      const tokenWithoutRefresh: OAuth2TokenResponse = {
        ...tokenResponse,
        refreshToken: undefined, // Kein neuer Refresh Token
      };

      mockRepository.findByType.mockResolvedValue(Result.ok(expiredCredential));
      mockOAuth2.refreshAccessToken.mockResolvedValue(Result.ok(tokenWithoutRefresh));
      mockRepository.save.mockImplementation(async (cred) => Result.ok(cred));
      mockEncryption.decrypt.mockReturnValue('new-access-token');

      // When
      const result = await service.getValidAccessToken();

      // Then
      expect(result.isSuccess).toBe(true);
      // Der alte Refresh Token sollte erhalten bleiben (updateOAuthTokens preserviert ihn)
      expect(mockEncryption.encrypt).not.toHaveBeenCalledWith(undefined);
    });
  });
});
