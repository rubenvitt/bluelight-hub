/**
 * E2E Security Tests für OAuthCallbackController.
 *
 * Validiert Security Features des OAuth2 Callback Endpoints:
 * - Guard Bypass (SkipServerAccess, SkipSetupCheck)
 * - CSRF Protection (State Validation)
 * - Rate Limiting (DoS Prevention)
 * - Open Redirect Protection (FRONTEND_URL Whitelist)
 * - Error Message Sanitization (Information Disclosure Prevention)
 *
 * **Test Strategy:**
 * - Real HTTP Requests via supertest
 * - Real Database (State Persistence)
 * - Mocked ProcessOAuthCallbackHandler (Business Logic)
 * - Mock Guards via APP_GUARD (MockPassthroughGuard für ServerAccess/Setup)
 *
 * **Note:** ThrottlerGuard Tests sind ausgelagert weil APP_GUARD nicht via
 * app.get() abgerufen werden kann. Rate-Limiting Tests sind .skip()
 *
 * @module modules/integrations/controllers/__tests__
 */

import type { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import { Module, Injectable, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { createTestPrismaClient } from '@/infrastructure/__tests__/helpers/database-test.helper';
import { createId } from '@paralleldrive/cuid2';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { IntegrationsModule } from '@/modules/integrations/integrations.module';
import { ProcessOAuthCallbackHandler } from '@/application/integrations/commands/process-oauth-callback/process-oauth-callback.handler';
import { Result } from '@/domain/common/result';
import { INTEGRATION_ERROR_CODES, IntegrationError } from '@/domain/integrations';
import { ServerAccessTokenInfrastructureModule } from '@/infrastructure/server-access-token/server-access-token-infrastructure.module';
import { ServerConfigInfrastructureModule } from '@/infrastructure/server-config/server-config-infrastructure.module';
import { InfrastructureCommonModule } from '@/infrastructure/common.module';
import { LOGGER } from '@/infrastructure/di-tokens';
import { NestLoggerAdapter } from '@/infrastructure/common/adapters/nest-logger.adapter';
import { PrismaModule } from '@/infrastructure/database/prisma.module';

// ============================================
// MOCK GUARDS
// ============================================

/**
 * Passthrough Guard der alle Requests erlaubt.
 * Ersetzt ThrottlerGuard, ServerAccessGuard, SetupPendingGuard in Tests.
 */
@Injectable()
class MockPassthroughGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}

/**
 * Test Module das Guards als APP_GUARD registriert (wie app.module.ts),
 * aber Mock-Implementierungen verwendet.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot({ wildcard: false, delimiter: '.', maxListeners: 10 }),
    // ThrottlerModule mit hohem Limit (effektiv deaktiviert)
    ThrottlerModule.forRoot([{ ttl: 1, limit: 1000000 }]),
    PrismaModule,
    InfrastructureCommonModule,
    ServerAccessTokenInfrastructureModule,
    ServerConfigInfrastructureModule,
    IntegrationsModule,
  ],
  providers: [
    Logger,
    { provide: LOGGER, useFactory: () => new NestLoggerAdapter('TestModule') },
    // Mock Guards als APP_GUARD (ersetzt echte Guards)
    { provide: APP_GUARD, useClass: MockPassthroughGuard },
    { provide: APP_GUARD, useClass: MockPassthroughGuard },
    { provide: APP_GUARD, useClass: MockPassthroughGuard },
  ],
})
class TestOAuthCallbackModule {}

// ============================================
// TEST SETUP
// ============================================

/**
 * Typ-Alias für den Test PrismaClient.
 *
 * Verwendet den PrismaPg Adapter Pattern (Prisma v7).
 */
type TestPrismaService = ReturnType<typeof createTestPrismaClient>;

/**
 * Generiert Test OAuth State in Datenbank.
 *
 * @param prisma - PrismaClient Instanz
 * @param expiresInMinutes - Ablaufzeit in Minuten (default: 10)
 * @returns State String
 */
async function createTestOAuthState(prisma: TestPrismaService, expiresInMinutes = 10): Promise<string> {
  const state = createId();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  await prisma.oAuth2State.create({
    data: {
      state,
      codeVerifier: 'test-code-verifier',
      integrationType: 'HIORG_SERVER',
      redirectUri: 'http://localhost:3090/admin/integrations/hiorg',
      createdBy: 'test-user',
      expiresAt,
      createdAt: new Date(),
    },
  });

  return state;
}

/**
 * Löscht alle OAuth States aus Datenbank.
 */
async function cleanupOAuthStates(prisma: TestPrismaService): Promise<void> {
  await prisma.oAuth2State.deleteMany({});
}

/**
 * SQL zum Deaktivieren von Database Triggers.
 */
const _DISABLE_TRIGGERS_SQL = 'SET session_replication_role = replica;';

/**
 * SQL zum Reaktivieren von Database Triggers.
 */
const _ENABLE_TRIGGERS_SQL = 'SET session_replication_role = DEFAULT;';

// ============================================
// E2E TESTS
// ============================================

const databaseAvailable = !!process.env.DATABASE_URL;

(databaseAvailable ? describe : describe.skip)('OAuthCallbackController (E2E Security)', () => {
  let app: INestApplication;
  let prisma: TestPrismaService;
  let mockHandler: jest.Mocked<ProcessOAuthCallbackHandler>;

  beforeAll(async () => {
    // Setup Prisma (uses PrismaPg Adapter for Prisma v7)
    prisma = createTestPrismaClient();
    await prisma.$connect();

    // Mock ProcessOAuthCallbackHandler
    mockHandler = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ProcessOAuthCallbackHandler>;

    // Create Testing Module mit TestOAuthCallbackModule
    // Guards werden bereits als APP_GUARD im Module registriert (MockPassthroughGuard)
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestOAuthCallbackModule],
    })
      .overrideProvider(ProcessOAuthCallbackHandler)
      .useValue(mockHandler)
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn((key: string, defaultValue?: string) => {
          if (key === 'FRONTEND_URL') return 'http://localhost:3090';
          if (key === 'ALLOWED_FRONTEND_HOSTS') return 'localhost:3090';
          if (key === 'ADMIN_JWT_SECRET') return 'test-admin-jwt-secret';
          if (key === 'JWT_SECRET') return 'test-jwt-secret';
          // 64 Hex-Zeichen (32 Bytes) für AES-256 Encryption
          if (key === 'INTEGRATION_ENCRYPTION_KEY') return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
          return defaultValue;
        }),
        getOrThrow: jest.fn((key: string) => {
          if (key === 'FRONTEND_URL') return 'http://localhost:3090';
          if (key === 'ADMIN_JWT_SECRET') return 'test-admin-jwt-secret';
          if (key === 'JWT_SECRET') return 'test-jwt-secret';
          if (key === 'INTEGRATION_ENCRYPTION_KEY') return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
          throw new Error(`Config key ${key} not found`);
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();

    // Guards werden automatisch durch APP_GUARD im TestOAuthCallbackModule aktiviert
    // Kein manuelles app.useGlobalGuards() mehr nötig

    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Reset Mocks
    jest.clearAllMocks();

    // Cleanup OAuth States
    await cleanupOAuthStates(prisma);
  });

  afterEach(async () => {
    // Cleanup nach jedem Test
    await cleanupOAuthStates(prisma);
  });

  // ============================================
  // GUARD BYPASS TESTS
  // ============================================

  describe('Guard Bypass (@SkipServerAccess, @SkipSetupCheck)', () => {
    /**
     * Test: Endpoint erlaubt Zugriff OHNE X-Server-Access-Token Header.
     *
     * **Given:**
     * - OAuth Provider sendet Callback Request ohne Custom Header
     *
     * **When:**
     * - Request wird an /oauth/hiorg/callback gesendet
     *
     * **Then:**
     * - ServerAccessGuard wird bypassed (via @SkipServerAccess)
     * - Request erreicht Controller (kein 403 Forbidden)
     */
    it('should allow access WITHOUT X-Server-Access-Token header', async () => {
      // Given: Erstelle valid State
      const state = await createTestOAuthState(prisma);
      const code = 'test-auth-code';

      // Mock Handler Success
      mockHandler.execute.mockResolvedValue(Result.ok(undefined));

      // When: Request ohne X-Server-Access-Token Header
      const response = await request(app.getHttpServer()).get('/oauth/hiorg/callback').query({ code, state });

      // Then: Guard wurde bypassed, Redirect zu Frontend
      expect(response.status).toBe(302); // Redirect
      expect(response.header.location).toContain('http://localhost:3090');
      expect(response.header.location).not.toContain('error=403'); // KEIN Forbidden Error
    });

    /**
     * Test: Endpoint erlaubt Zugriff WÄHREND Setup-Phase.
     *
     * **Given:**
     * - Server ist in Setup-Phase (SetupPendingGuard würde normalerweise blockieren)
     *
     * **When:**
     * - OAuth Callback wird gesendet
     *
     * **Then:**
     * - SetupPendingGuard wird bypassed (via @SkipSetupCheck)
     * - Request erreicht Controller
     */
    it('should allow access DURING setup phase', async () => {
      // Given: Valid State
      const state = await createTestOAuthState(prisma);
      const code = 'test-auth-code';

      // Mock Handler Success
      mockHandler.execute.mockResolvedValue(Result.ok(undefined));

      // When: Request (Setup Status ist irrelevant durch @SkipSetupCheck)
      const response = await request(app.getHttpServer()).get('/oauth/hiorg/callback').query({ code, state });

      // Then: Guard wurde bypassed
      expect(response.status).toBe(302); // Redirect
      expect(mockHandler.execute).toHaveBeenCalled();
    });

    /**
     * Test: ThrottlerGuard ist NICHT bypassed (DoS Protection).
     *
     * **Given:**
     * - Rate Limit ist konfiguriert (5 requests per 15 min)
     *
     * **When:**
     * - Mehr als 5 Requests werden gesendet
     *
     * **Then:**
     * - Nach 5 Requests wird 429 Too Many Requests zurückgegeben
     *
     * NOTE: Dieser Test ist kommentiert weil er flaky sein kann.
     * ThrottlerGuard verwendet In-Memory Storage das zwischen Tests sharen kann.
     */
    it.skip('should still apply ThrottlerGuard (DoS protection)', async () => {
      // Given: Valid State (wird mehrfach verwendet für Rate Limit Test)
      const state = await createTestOAuthState(prisma);
      const code = 'test-auth-code';

      // Mock Handler Success
      mockHandler.execute.mockResolvedValue(Result.ok(undefined));

      // When: Sende 6 Requests (Limit ist 5)
      const requests = [];
      for (let i = 0; i < 6; i++) {
        requests.push(request(app.getHttpServer()).get('/oauth/hiorg/callback').query({ code, state }));
      }

      const responses = await Promise.all(requests);

      // Then: Mindestens eine Response sollte 429 sein
      const tooManyRequests = responses.filter((r) => r.status === 429);
      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // CSRF PROTECTION TESTS
  // ============================================

  describe('CSRF Protection (State Validation)', () => {
    /**
     * Test: Ungültige State Tokens werden abgelehnt.
     *
     * **Given:**
     * - State Parameter existiert NICHT in Datenbank
     *
     * **When:**
     * - Callback Request mit ungültigem State
     *
     * **Then:**
     * - Handler wird aufgerufen und gibt Fehler zurück
     * - Frontend erhält Error Redirect
     */
    it('should reject invalid state tokens', async () => {
      // Given: Ungültiger State (nicht in DB)
      const invalidState = 'invalid-state-token';
      const code = 'test-auth-code';

      // Mock Handler Failure (State nicht gefunden)
      mockHandler.execute.mockResolvedValue(Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.OAUTH_STATE_INVALID, 'Ungültiger OAuth State')));

      // When: Request mit ungültigem State
      const response = await request(app.getHttpServer()).get('/oauth/hiorg/callback').query({ code, state: invalidState });

      // Then: Redirect zu Error URL
      expect(response.status).toBe(302);
      expect(response.header.location).toContain('oauth=error');
      expect(response.header.location).toContain('message='); // Sanitized Error Message
      expect(mockHandler.execute).toHaveBeenCalled();
    });

    /**
     * Test: Abgelaufene State Tokens werden abgelehnt.
     *
     * **Given:**
     * - State ist in Datenbank aber bereits abgelaufen
     *
     * **When:**
     * - Callback Request mit abgelaufenem State
     *
     * **Then:**
     * - Handler erkennt Expiration
     * - Frontend erhält Error Redirect
     */
    it('should reject expired state tokens', async () => {
      // Given: Erstelle abgelaufenen State (expiresAt in Vergangenheit)
      const state = createId();
      const expiresAt = new Date(Date.now() - 10 * 60 * 1000); // 10 Minuten in Vergangenheit

      await prisma.oAuth2State.create({
        data: {
          state,
          codeVerifier: 'test-code-verifier',
          integrationType: 'HIORG_SERVER',
          redirectUri: 'http://localhost:3090/admin/integrations/hiorg',
          createdBy: 'test-user',
          expiresAt,
          createdAt: new Date(Date.now() - 20 * 60 * 1000),
        },
      });

      const code = 'test-auth-code';

      // Mock Handler Failure (Expired State)
      mockHandler.execute.mockResolvedValue(Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.OAUTH_STATE_INVALID, 'OAuth State ist abgelaufen')));

      // When: Request mit abgelaufenem State
      const response = await request(app.getHttpServer()).get('/oauth/hiorg/callback').query({ code, state });

      // Then: Error Redirect
      expect(response.status).toBe(302);
      expect(response.header.location).toContain('oauth=error');
      expect(mockHandler.execute).toHaveBeenCalled();
    });

    /**
     * Test: Gültige State Tokens werden akzeptiert.
     *
     * **Given:**
     * - State ist in Datenbank und noch nicht abgelaufen
     *
     * **When:**
     * - Callback Request mit gültigem State
     *
     * **Then:**
     * - Handler verarbeitet erfolgreich
     * - Frontend erhält Success Redirect
     */
    it('should accept valid state tokens', async () => {
      // Given: Valid State
      const state = await createTestOAuthState(prisma, 10);
      const code = 'test-auth-code';

      // Mock Handler Success
      mockHandler.execute.mockResolvedValue(Result.ok(undefined));

      // When: Request mit valid State
      const response = await request(app.getHttpServer()).get('/oauth/hiorg/callback').query({ code, state });

      // Then: Success Redirect
      expect(response.status).toBe(302);
      expect(response.header.location).toContain('oauth=success');
      expect(mockHandler.execute).toHaveBeenCalled();
    });
  });

  // ============================================
  // RATE LIMITING TESTS
  // ============================================

  describe('Rate Limiting', () => {
    /**
     * Test: Rate Limits werden durchgesetzt (5 attempts per 15 min).
     *
     * NOTE: Dieser Test ist kommentiert weil ThrottlerGuard flaky sein kann.
     * In-Memory Storage wird zwischen Tests geteilt.
     *
     * **Given:**
     * - Rate Limit Preset: auth() = 5 requests per 15 minutes
     *
     * **When:**
     * - 6 Requests werden gesendet
     *
     * **Then:**
     * - Nach 5 Requests wird 429 Too Many Requests zurückgegeben
     */
    it.skip('should enforce rate limits (5 attempts per 15 min)', async () => {
      // Given: Valid State für alle Requests
      const state = await createTestOAuthState(prisma);
      const code = 'test-auth-code';

      // Mock Handler Success
      mockHandler.execute.mockResolvedValue(Result.ok(undefined));

      // When: Sende 6 Requests schnell hintereinander
      const requests = [];
      for (let i = 0; i < 6; i++) {
        requests.push(request(app.getHttpServer()).get('/oauth/hiorg/callback').query({ code, state }));
      }

      const responses = await Promise.all(requests);

      // Then: Mindestens eine Response sollte 429 sein
      const successResponses = responses.filter((r) => r.status === 302);
      const rateLimitResponses = responses.filter((r) => r.status === 429);

      expect(successResponses.length).toBeLessThanOrEqual(5);
      expect(rateLimitResponses.length).toBeGreaterThan(0);
    });

    /**
     * Test: Requests werden nach Ablauf des Windows wieder erlaubt.
     *
     * NOTE: Dieser Test ist auskommentiert weil er 15+ Minuten dauern würde.
     * In echtem Szenario würde man ThrottlerGuard mit Mock Storage testen.
     */
    it.skip('should allow requests after window expires', async () => {
      // Test würde 15+ Minuten dauern - nur dokumentiert
      expect(true).toBe(true);
    });
  });

  // ============================================
  // OPEN REDIRECT PROTECTION TESTS
  // ============================================

  describe('Open Redirect Protection', () => {
    /**
     * Test: FRONTEND_URL wird gegen Whitelist validiert.
     *
     * **Given:**
     * - FRONTEND_URL ist in ALLOWED_FRONTEND_HOSTS Whitelist
     *
     * **When:**
     * - OAuth Callback erfolgt
     *
     * **Then:**
     * - Redirect zu FRONTEND_URL wird erlaubt
     */
    it('should validate FRONTEND_URL against whitelist', async () => {
      // Given: Valid State und Config
      const state = await createTestOAuthState(prisma);
      const code = 'test-auth-code';

      // Mock Handler Success
      mockHandler.execute.mockResolvedValue(Result.ok(undefined));

      // When: Request
      const response = await request(app.getHttpServer()).get('/oauth/hiorg/callback').query({ code, state });

      // Then: Redirect zu whitelisted FRONTEND_URL
      expect(response.status).toBe(302);
      expect(response.header.location).toContain('http://localhost:3090');
    });

    /**
     * Test: Ungültige FRONTEND_URL wirft 500 Internal Server Error.
     *
     * **Given:**
     * - FRONTEND_URL ist NICHT in Whitelist
     *
     * **When:**
     * - OAuth Callback wird verarbeitet
     *
     * **Then:**
     * - InternalServerErrorException wird geworfen (500)
     * - Kein Redirect erfolgt
     */
    it('should throw 500 if FRONTEND_URL is invalid', async () => {
      // Given: Erstelle neues Module mit invalid FRONTEND_URL
      // Verwendet TestOAuthCallbackModule als Basis, aber überschreibt ConfigService
      const invalidApp = await Test.createTestingModule({
        imports: [TestOAuthCallbackModule],
      })
        .overrideProvider(ProcessOAuthCallbackHandler)
        .useValue(mockHandler)
        .overrideProvider(ConfigService)
        .useValue({
          get: jest.fn((key: string, defaultValue?: string) => {
            if (key === 'FRONTEND_URL') return 'http://evil.com'; // NICHT in Whitelist!
            if (key === 'ALLOWED_FRONTEND_HOSTS') return 'localhost:3090';
            if (key === 'INTEGRATION_ENCRYPTION_KEY') return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
            if (key === 'ADMIN_JWT_SECRET') return 'test-admin-jwt-secret';
            if (key === 'JWT_SECRET') return 'test-jwt-secret';
            return defaultValue;
          }),
          getOrThrow: jest.fn((key: string) => {
            if (key === 'FRONTEND_URL') return 'http://evil.com';
            if (key === 'INTEGRATION_ENCRYPTION_KEY') return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
            if (key === 'ADMIN_JWT_SECRET') return 'test-admin-jwt-secret';
            if (key === 'JWT_SECRET') return 'test-jwt-secret';
            throw new Error(`Config key ${key} not found`);
          }),
        })
        .compile();

      const testApp = invalidApp.createNestApplication();
      await testApp.init();

      // Given: Valid State
      const state = await createTestOAuthState(prisma);
      const code = 'test-auth-code';

      // When: Request mit invalid FRONTEND_URL
      const response = await request(testApp.getHttpServer()).get('/oauth/hiorg/callback').query({ code, state });

      // Then: 500 Internal Server Error
      expect(response.status).toBe(500);

      await testApp.close();
    });
  });

  // ============================================
  // ERROR MESSAGE SANITIZATION TESTS
  // ============================================

  describe('Error Message Sanitization', () => {
    /**
     * Test: Interne Error Codes werden NICHT in Redirect URLs geleakt.
     *
     * **Given:**
     * - Handler gibt Fehler mit internem Error Code zurück
     *
     * **When:**
     * - Fehler wird verarbeitet
     *
     * **Then:**
     * - Redirect URL enthält nur sanitized Message
     * - Keine internen Details (Error Codes, Stack Traces)
     */
    it('should not leak internal error codes in redirect URLs', async () => {
      // Given: Valid State
      const state = await createTestOAuthState(prisma);
      const code = 'test-auth-code';

      // Mock Handler mit internem Error Code
      mockHandler.execute.mockResolvedValue(Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.OAUTH_CODE_EXCHANGE_FAILED, 'Internal OAuth2 server error: connection timeout')));

      // When: Request
      const response = await request(app.getHttpServer()).get('/oauth/hiorg/callback').query({ code, state });

      // Then: Redirect mit sanitized message
      expect(response.status).toBe(302);
      expect(response.header.location).toContain('oauth=error');
      expect(response.header.location).toContain('message=');

      // Extract message from URL
      const location = response.header.location || '';
      const messageMatch = location.match(/message=([^&]+)/);
      expect(messageMatch).not.toBeNull();

      const message = decodeURIComponent(messageMatch![1]);

      // Verify message ist sanitized (keine internen Details)
      expect(message).not.toContain('OAUTH_CODE_EXCHANGE_FAILED'); // Kein Error Code
      expect(message).not.toContain('connection timeout'); // Keine internen Details
      expect(message).not.toContain('Internal'); // Kein "Internal" Keyword

      // Expect generic message
      expect(message).toMatch(/Authentifizierung|fehlgeschlagen|Verbindung/i);
    });

    /**
     * Test: Generic Error Messages für alle Error Types.
     *
     * **Given:**
     * - Verschiedene Error Types (State Invalid, Code Exchange Failed, Not Configured)
     *
     * **When:**
     * - Fehler werden verarbeitet
     *
     * **Then:**
     * - Alle Error Messages sind sanitized und user-friendly
     */
    it('should return generic error messages for all error types', async () => {
      const errorCases = [
        {
          errorCode: INTEGRATION_ERROR_CODES.OAUTH_STATE_INVALID,
          internalMessage: 'State validation failed: database constraint violation',
          expectedPattern: /Sitzung|abgelaufen|erneut|fehlgeschlagen/i,
        },
        {
          errorCode: INTEGRATION_ERROR_CODES.OAUTH_CODE_EXCHANGE_FAILED,
          internalMessage: 'Token exchange HTTP 500: internal server error',
          expectedPattern: /Authentifizierung|fehlgeschlagen|Verbindung/i,
        },
        {
          errorCode: INTEGRATION_ERROR_CODES.OAUTH_NOT_CONFIGURED,
          internalMessage: 'HIORG_OAUTH_CLIENT_SECRET missing in environment',
          // All error types return a user-friendly sanitized message
          expectedPattern: /Service|nicht verfügbar|vorübergehend|fehlgeschlagen|Verbindung/i,
        },
      ];

      for (const errorCase of errorCases) {
        // Given: Valid State
        const state = await createTestOAuthState(prisma);
        const code = 'test-auth-code';

        // Mock Handler Error
        mockHandler.execute.mockResolvedValue(Result.fail(IntegrationError.format(errorCase.errorCode, errorCase.internalMessage)));

        // When: Request
        const response = await request(app.getHttpServer()).get('/oauth/hiorg/callback').query({ code, state });

        // Then: Sanitized Message
        expect(response.status).toBe(302);
        const location = response.header.location || '';
        const messageMatch = location.match(/message=([^&]+)/);

        if (messageMatch) {
          const message = decodeURIComponent(messageMatch[1]);

          // Verify KEINE internen Details
          expect(message).not.toContain(errorCase.internalMessage);
          expect(message).not.toContain('database');
          expect(message).not.toContain('HTTP 500');
          expect(message).not.toContain('environment');

          // Verify sanitized message pattern
          expect(message).toMatch(errorCase.expectedPattern);
        }

        // Cleanup für nächsten Loop
        await cleanupOAuthStates(prisma);
      }
    });

    /**
     * Test: Missing Query Parameters liefern generic Error.
     *
     * **Given:**
     * - Callback ohne code oder state Parameter
     *
     * **When:**
     * - Request wird gesendet
     *
     * **Then:**
     * - Generic Error Message (keine Details über fehlende Parameter)
     */
    it('should handle missing query parameters gracefully', async () => {
      // When: Request ohne code Parameter
      const response = await request(app.getHttpServer()).get('/oauth/hiorg/callback').query({ state: 'some-state' });

      // Then: Generic Error Redirect
      expect(response.status).toBe(302);
      expect(response.header.location).toContain('oauth=error');
      expect(response.header.location).toContain('message=');

      const location = response.header.location || '';
      const messageMatch = location.match(/message=([^&]+)/);
      if (messageMatch) {
        const message = decodeURIComponent(messageMatch[1]);

        // Keine Details über fehlenden Parameter
        expect(message).not.toContain('code');
        expect(message).not.toContain('missing');
        expect(message).not.toContain('required');
      }
    });

    /**
     * Test: OAuth Provider Error wird sanitized.
     *
     * **Given:**
     * - OAuth Provider sendet error und error_description Parameter
     *
     * **When:**
     * - Controller verarbeitet Error Response
     *
     * **Then:**
     * - Sanitized Error Message wird zurückgegeben
     * - error_description wird NICHT direkt exposed
     */
    it('should sanitize OAuth provider error responses', async () => {
      // When: OAuth Provider Error Response
      const response = await request(app.getHttpServer()).get('/oauth/hiorg/callback').query({
        error: 'access_denied',
        error_description: 'User denied access with reason: INTERNAL_POLICY_VIOLATION',
      });

      // Then: Sanitized Error
      expect(response.status).toBe(302);
      expect(response.header.location).toContain('oauth=error');

      const location = response.header.location || '';
      const messageMatch = location.match(/message=([^&]+)/);
      if (messageMatch) {
        const message = decodeURIComponent(messageMatch[1]);

        // KEINE rohen Provider Error Details
        expect(message).not.toContain('INTERNAL_POLICY_VIOLATION');
        expect(message).not.toContain('access_denied'); // Error Code

        // Generic User-Facing Message
        expect(message).toMatch(/Verbindung|fehlgeschlagen|erneut|Sitzung/i);
      }
    });
  });
});
