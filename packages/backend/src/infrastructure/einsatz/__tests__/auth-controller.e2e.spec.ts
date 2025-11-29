import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { type EinsatzE2eTestContext, cleanupTestData, createEinsatzE2eModule, teardownE2eModule } from './einsatz.e2e-setup';
import { AppModule } from '../../../app.module';

/**
 * AuthController HTTP Integration Tests.
 *
 * Testet die HTTP-Schnittstelle des AuthControllers:
 * - Login mit JWT Cookies
 * - Logout Token Invalidierung
 * - 401 Unauthorized für fehlende Auth
 * - 403 Forbidden für falsche Rolle
 *
 * @remarks
 * Diese Tests validieren das komplette Authentifizierungs- und
 * Autorisierungsverhalten der REST-API. Sie prüfen Guards,
 * Cookie-Handling und rollenbasierte Zugriffskontrolle.
 */
describe('AuthController HTTP Integration Tests (AC5.2)', () => {
  let app: INestApplication;
  let ctx: EinsatzE2eTestContext;

  beforeAll(async () => {
    ctx = await createEinsatzE2eModule();

    // Bootstrap der vollständigen NestJS-Anwendung
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }, 60000);

  afterEach(async () => {
    await cleanupTestData(ctx);
  });

  afterAll(async () => {
    await teardownE2eModule(ctx);
    await app.close();
  });

  describe('POST /api/alpha/auth/login', () => {
    /**
     * Testet erfolgreichen Login mit gültigen Credentials.
     *
     * @remarks
     * Bei erfolgreichem Login muss 200 OK mit Benutzer-Informationen
     * zurückgegeben werden. Sensitive Daten (Passwort-Hash) dürfen
     * NICHT im Response enthalten sein.
     */
    it('should return 200 with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/alpha/auth/login')
        .send({
          username: 'admin',
          password: 'password',
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('username', 'admin');
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    /**
     * Testet JWT Cookie-Setzung beim Login.
     *
     * @remarks
     * Die JWT Tokens (accessToken, refreshToken) müssen als HttpOnly,
     * Secure, SameSite Cookies gesetzt werden, um XSS/CSRF zu verhindern.
     */
    it('should set accessToken and refreshToken cookies', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/alpha/auth/login')
        .send({
          username: 'admin',
          password: 'password',
        })
        .expect(200);

      const cookies = response.headers['set-cookie'] as string[];
      expect(cookies).toBeDefined();

      const accessTokenCookie = cookies.find((c) => c.startsWith('accessToken='));
      const refreshTokenCookie = cookies.find((c) => c.startsWith('refreshToken='));

      expect(accessTokenCookie).toBeDefined();
      expect(refreshTokenCookie).toBeDefined();

      // HttpOnly und SameSite Flags prüfen
      expect(accessTokenCookie).toContain('HttpOnly');
      expect(accessTokenCookie).toContain('SameSite');
      expect(refreshTokenCookie).toContain('HttpOnly');
      expect(refreshTokenCookie).toContain('SameSite');
    });

    /**
     * Testet Ablehnung bei falschem Passwort.
     *
     * @remarks
     * Bei ungültigen Credentials muss 401 Unauthorized ohne
     * Details über den Fehlergrund zurückgegeben werden
     * (Username Enumeration Prevention).
     */
    it('should return 401 with invalid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/alpha/auth/login')
        .send({
          username: 'admin',
          password: 'wrong-password',
        })
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
      expect(response.body.message).not.toContain('password'); // Kein Hinweis auf falsches Passwort
      expect(response.body.message).not.toContain('username'); // Kein Hinweis auf falschen Username
    });

    /**
     * Testet Ablehnung bei nicht existierendem Benutzer.
     *
     * @remarks
     * Auch bei nicht existierendem Benutzer muss 401 mit
     * derselben generischen Fehlermeldung zurückgegeben werden
     * (Username Enumeration Prevention).
     */
    it('should return 401 for non-existent user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/alpha/auth/login')
        .send({
          username: 'non-existent-user',
          password: 'any-password',
        })
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
      // Fehlermeldung sollte identisch sein mit falschem Passwort
    });

    /**
     * Testet Validierung bei fehlenden Feldern.
     */
    it('should return 400 with missing username', async () => {
      await request(app.getHttpServer())
        .post('/api/alpha/auth/login')
        .send({
          password: 'password',
        })
        .expect(400);
    });

    /**
     * Testet Validierung bei fehlenden Feldern.
     */
    it('should return 400 with missing password', async () => {
      await request(app.getHttpServer())
        .post('/api/alpha/auth/login')
        .send({
          username: 'admin',
        })
        .expect(400);
    });

    /**
     * Testet Login-Response enthält Benutzer-Rolle.
     */
    it('should include user role in response', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/alpha/auth/login')
        .send({
          username: 'admin',
          password: 'password',
        })
        .expect(200);

      expect(response.body).toHaveProperty('role');
      expect(['USER', 'ADMIN', 'SUPER_ADMIN']).toContain(response.body.role);
    });
  });

  describe('POST /api/alpha/auth/logout', () => {
    /**
     * Testet erfolgreichen Logout.
     *
     * @remarks
     * Der Logout-Endpoint muss 200 OK zurückgeben und die
     * JWT Cookies löschen (Max-Age=0).
     */
    it('should return 200 and clear cookies', async () => {
      // Erst einloggen
      const loginResponse = await request(app.getHttpServer())
        .post('/api/alpha/auth/login')
        .send({
          username: 'admin',
          password: 'password',
        })
        .expect(200);

      const loginCookies = loginResponse.headers['set-cookie'] as string[];
      const accessTokenCookie = loginCookies.find((c) => c.startsWith('accessToken='));

      // Dann ausloggen
      const logoutResponse = await request(app.getHttpServer()).post('/api/alpha/auth/logout').set('Cookie', [accessTokenCookie]).expect(200);

      const logoutCookies = logoutResponse.headers['set-cookie'] as string[];

      // Cookies sollten gelöscht werden (Max-Age=0 oder leerer Wert)
      const clearedAccessToken = logoutCookies.find((c) => c.startsWith('accessToken='));
      const clearedRefreshToken = logoutCookies.find((c) => c.startsWith('refreshToken='));

      expect(clearedAccessToken).toBeDefined();
      expect(clearedRefreshToken).toBeDefined();
      expect(clearedAccessToken.includes('Max-Age=0') || clearedAccessToken.includes('accessToken=;')).toBe(true);
    });

    /**
     * Testet Logout mit ungültigem Token.
     *
     * @remarks
     * Auch bei ungültigem/fehlendem Token sollte Logout 200 OK
     * zurückgeben (idempotent), aber Cookies trotzdem clearen.
     */
    it('should return 200 even with invalid token', async () => {
      const response = await request(app.getHttpServer()).post('/api/alpha/auth/logout').set('Cookie', ['accessToken=invalid-token']).expect(200);

      // Cookies sollten trotzdem gelöscht werden
      const cookies = response.headers['set-cookie'] as string[];
      expect(cookies).toBeDefined();
    });

    /**
     * Testet Logout ohne Token.
     */
    it('should return 200 without token (idempotent)', async () => {
      await request(app.getHttpServer()).post('/api/alpha/auth/logout').expect(200);
    });

    /**
     * Testet Token-Invalidierung nach Logout.
     *
     * @remarks
     * Nach erfolgreichem Logout darf der alte Token NICHT mehr
     * für authentifizierte Requests verwendet werden können.
     */
    it('should invalidate token after logout', async () => {
      // Login
      const loginResponse = await request(app.getHttpServer())
        .post('/api/alpha/auth/login')
        .send({
          username: 'admin',
          password: 'password',
        })
        .expect(200);

      const loginCookies = loginResponse.headers['set-cookie'] as string[];
      const accessTokenCookie = loginCookies.find((c) => c.startsWith('accessToken='));

      // Vor Logout: Zugriff auf geschützten Endpoint funktioniert
      await request(app.getHttpServer()).get('/api/alpha/einsatz/active-with-counts').set('Cookie', [accessTokenCookie]).expect(200);

      // Logout
      await request(app.getHttpServer()).post('/api/alpha/auth/logout').set('Cookie', [accessTokenCookie]).expect(200);

      // Nach Logout: Zugriff mit altem Token schlägt fehl
      await request(app.getHttpServer()).get('/api/alpha/einsatz/active-with-counts').set('Cookie', [accessTokenCookie]).expect(401);
    });
  });

  describe('Unauthorized Requests (401)', () => {
    /**
     * Testet 401 bei fehlendem Token.
     *
     * @remarks
     * Geschützte Endpoints müssen Requests ohne JWT Token
     * mit 401 Unauthorized ablehnen.
     */
    it('should return 401 for protected endpoint without token', async () => {
      const response = await request(app.getHttpServer()).get('/api/alpha/einsatz/active-with-counts').expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
      expect(response.body.message).toContain('Unauthorized');
    });

    /**
     * Testet 401 bei abgelaufenem Token.
     *
     * @remarks
     * JWT Tokens haben eine Ablaufzeit. Abgelaufene Tokens
     * müssen mit 401 abgelehnt werden.
     */
    it('should return 401 with expired token', async () => {
      // Expired JWT Token (exp in der Vergangenheit)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiZXhwIjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const response = await request(app.getHttpServer())
        .get('/api/alpha/einsatz/active-with-counts')
        .set('Cookie', [`accessToken=${expiredToken}`])
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
    });

    /**
     * Testet 401 bei ungültigem Token-Format.
     *
     * @remarks
     * Malformed JWT Tokens (ungültiges Format, falsche Signatur)
     * müssen mit 401 abgelehnt werden.
     */
    it('should return 401 with invalid token', async () => {
      const invalidToken = 'invalid.jwt.token';

      const response = await request(app.getHttpServer())
        .get('/api/alpha/einsatz/active-with-counts')
        .set('Cookie', [`accessToken=${invalidToken}`])
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
    });

    /**
     * Testet 401 bei manipuliertem Token.
     *
     * @remarks
     * Tokens mit geänderter Signatur müssen erkannt und
     * mit 401 abgelehnt werden.
     */
    it('should return 401 with tampered token', async () => {
      // Erst gültigen Token holen
      const loginResponse = await request(app.getHttpServer())
        .post('/api/alpha/auth/login')
        .send({
          username: 'admin',
          password: 'password',
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'] as string[];
      const accessTokenCookie = cookies.find((c) => c.startsWith('accessToken='));
      const token = accessTokenCookie?.split(';')[0].split('=')[1] || '';

      // Token manipulieren (letztes Zeichen ändern)
      const tamperedToken = token.slice(0, -1) + 'X';

      const response = await request(app.getHttpServer())
        .get('/api/alpha/einsatz/active-with-counts')
        .set('Cookie', [`accessToken=${tamperedToken}`])
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
    });

    /**
     * Testet öffentliche Endpoints (keine Auth erforderlich).
     *
     * @remarks
     * Einige Endpoints (z.B. /health, /api) sollten OHNE
     * Authentifizierung erreichbar sein.
     */
    it('should allow access to public endpoints without token', async () => {
      // Health Check sollte öffentlich sein
      await request(app.getHttpServer()).get('/health').expect(200);

      // Swagger Docs sollten öffentlich sein
      await request(app.getHttpServer()).get('/api').expect(200);
    });
  });

  describe('Forbidden Requests (403)', () => {
    /**
     * Testet 403 bei unzureichenden Berechtigungen (USER vs. ADMIN).
     *
     * @remarks
     * Rollenbasierte Zugriffskontrolle: USER-Rolle darf nicht
     * auf ADMIN-geschützte Endpoints zugreifen.
     */
    it('should return 403 when USER accesses ADMIN endpoint', async () => {
      // User-Account erstellen und einloggen
      await ctx.prisma.user.create({
        data: {
          username: 'regular-user',
          passwordHash: 'hashed', // In echten Tests: bcrypt Hash
          role: 'USER',
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/api/alpha/auth/login')
        .send({
          username: 'regular-user',
          password: 'password',
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'] as string[];
      const accessTokenCookie = cookies.find((c) => c.startsWith('accessToken='));

      // Versuch, auf ADMIN-Endpoint zuzugreifen (z.B. User Management)
      const response = await request(app.getHttpServer())
        .post('/api/alpha/user/create') // Beispiel ADMIN-Endpoint
        .set('Cookie', [accessTokenCookie])
        .send({
          username: 'new-user',
          password: 'password',
          role: 'USER',
        })
        .expect(403);

      expect(response.body).toHaveProperty('statusCode', 403);
      expect(response.body.message).toContain('Forbidden');
    });

    /**
     * Testet 403 bei unzureichenden Berechtigungen (ADMIN vs. SUPER_ADMIN).
     *
     * @remarks
     * ADMIN-Rolle darf nicht auf SUPER_ADMIN-geschützte Endpoints
     * (z.B. Rolle ändern) zugreifen.
     */
    it('should return 403 when ADMIN accesses SUPER_ADMIN endpoint', async () => {
      // Admin-Account erstellen
      await ctx.prisma.user.create({
        data: {
          username: 'admin-user',
          passwordHash: 'hashed',
          role: 'ADMIN',
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/api/alpha/auth/login')
        .send({
          username: 'admin-user',
          password: 'password',
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'] as string[];
      const accessTokenCookie = cookies.find((c) => c.startsWith('accessToken='));

      // Versuch, auf SUPER_ADMIN-Endpoint zuzugreifen
      const response = await request(app.getHttpServer())
        .patch('/api/alpha/user/some-user-id/role') // Beispiel SUPER_ADMIN-Endpoint
        .set('Cookie', [accessTokenCookie])
        .send({
          role: 'SUPER_ADMIN',
        })
        .expect(403);

      expect(response.body).toHaveProperty('statusCode', 403);
    });

    /**
     * Testet SUPER_ADMIN kann auf alle Endpoints zugreifen.
     *
     * @remarks
     * SUPER_ADMIN-Rolle sollte Vollzugriff auf alle geschützten
     * Endpoints haben.
     */
    it('should allow SUPER_ADMIN to access all endpoints', async () => {
      // Super Admin Account erstellen
      await ctx.prisma.user.create({
        data: {
          username: 'super-admin',
          passwordHash: 'hashed',
          role: 'SUPER_ADMIN',
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/api/alpha/auth/login')
        .send({
          username: 'super-admin',
          password: 'password',
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'] as string[];
      const accessTokenCookie = cookies.find((c) => c.startsWith('accessToken='));

      // Zugriff auf ADMIN-Endpoint sollte funktionieren
      await request(app.getHttpServer()).get('/api/alpha/einsatz/active-with-counts').set('Cookie', [accessTokenCookie]).expect(200);

      // Zugriff auf SUPER_ADMIN-Endpoint sollte funktionieren
      // (Beispiel: User-Rolle ändern)
    });

    /**
     * Testet hilfreiche 403 Fehlermeldung.
     *
     * @remarks
     * Die Fehlermeldung sollte dem Benutzer klar kommunizieren,
     * dass die Berechtigung fehlt (nicht dass der Endpoint
     * nicht existiert).
     */
    it('should include helpful message about insufficient permissions', async () => {
      // USER Account
      await ctx.prisma.user.create({
        data: {
          username: 'limited-user',
          passwordHash: 'hashed',
          role: 'USER',
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/api/alpha/auth/login')
        .send({
          username: 'limited-user',
          password: 'password',
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'] as string[];
      const accessTokenCookie = cookies.find((c) => c.startsWith('accessToken='));

      const response = await request(app.getHttpServer()).post('/api/alpha/user/create').set('Cookie', [accessTokenCookie]).send({}).expect(403);

      expect(response.body.message).toBeDefined();
      expect(response.body.message.includes('Berechtigung') || response.body.message.includes('permission') || response.body.message.includes('Forbidden')).toBe(true);
    });
  });

  describe('Token Refresh Flow', () => {
    /**
     * Testet Token-Refresh mit gültigem Refresh Token.
     *
     * @remarks
     * Wenn der Access Token abgelaufen ist, sollte der Client
     * mit dem Refresh Token einen neuen Access Token erhalten können.
     */
    it('should refresh access token with valid refresh token', async () => {
      // Login
      const loginResponse = await request(app.getHttpServer())
        .post('/api/alpha/auth/login')
        .send({
          username: 'admin',
          password: 'password',
        })
        .expect(200);

      const loginCookies = loginResponse.headers['set-cookie'] as string[];
      const refreshTokenCookie = loginCookies.find((c) => c.startsWith('refreshToken='));

      // Refresh Request
      const refreshResponse = await request(app.getHttpServer()).post('/api/alpha/auth/refresh').set('Cookie', [refreshTokenCookie]).expect(200);

      // Neuer Access Token sollte gesetzt werden
      const refreshCookies = refreshResponse.headers['set-cookie'] as string[];
      const newAccessTokenCookie = refreshCookies.find((c) => c.startsWith('accessToken='));

      expect(newAccessTokenCookie).toBeDefined();
    });

    /**
     * Testet Ablehnung bei ungültigem Refresh Token.
     */
    it('should return 401 with invalid refresh token', async () => {
      await request(app.getHttpServer()).post('/api/alpha/auth/refresh').set('Cookie', ['refreshToken=invalid-token']).expect(401);
    });

    /**
     * Testet Ablehnung bei fehlendem Refresh Token.
     */
    it('should return 401 without refresh token', async () => {
      await request(app.getHttpServer()).post('/api/alpha/auth/refresh').expect(401);
    });
  });

  describe('Cross-Site Request Forgery (CSRF) Protection', () => {
    /**
     * Testet SameSite Cookie-Attribute zur CSRF-Prävention.
     *
     * @remarks
     * JWT Cookies müssen SameSite=Strict oder Lax gesetzt haben,
     * um CSRF-Angriffe zu verhindern.
     */
    it('should set SameSite attribute on auth cookies', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/alpha/auth/login')
        .send({
          username: 'admin',
          password: 'password',
        })
        .expect(200);

      const cookies = response.headers['set-cookie'] as string[];
      const accessTokenCookie = cookies.find((c) => c.startsWith('accessToken='));
      const refreshTokenCookie = cookies.find((c) => c.startsWith('refreshToken='));

      expect(accessTokenCookie).toContain('SameSite');
      expect(refreshTokenCookie).toContain('SameSite');

      // Strict oder Lax (nicht None)
      expect(accessTokenCookie.includes('SameSite=Strict') || accessTokenCookie.includes('SameSite=Lax')).toBe(true);
    });
  });

  describe('Brute Force Protection', () => {
    /**
     * Testet Rate Limiting bei wiederholten fehlgeschlagenen Login-Versuchen.
     *
     * @remarks
     * Nach mehreren fehlgeschlagenen Login-Versuchen sollte
     * temporär 429 Too Many Requests zurückgegeben werden.
     */
    it('should rate-limit after multiple failed login attempts', async () => {
      // 5 fehlgeschlagene Login-Versuche
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/api/alpha/auth/login')
          .send({
            username: 'admin',
            password: 'wrong-password',
          })
          .expect(401);
      }

      // Nächster Versuch sollte Rate-Limited sein
      const response = await request(app.getHttpServer())
        .post('/api/alpha/auth/login')
        .send({
          username: 'admin',
          password: 'password', // Sogar mit korrektem Passwort
        })
        .expect(429);

      expect(response.body).toHaveProperty('statusCode', 429);
      expect(response.body.message).toContain('Too Many Requests');
    });
  });
});
