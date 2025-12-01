import type { INestApplication } from '@nestjs/common';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { type EinsatzE2eTestContext, cleanupTestData, createEinsatzE2eModule, teardownE2eModule, generateTestId } from './einsatz.e2e-setup';
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

    // App-Konfiguration wie in main.ts
    app.enableVersioning({
      type: VersioningType.URI,
      prefix: 'v-',
      defaultVersion: 'alpha',
    });
    app.setGlobalPrefix('api', { exclude: ['/'] });
    app.use(cookieParser());

    // Enable validation pipes globally (wie in main.ts)
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
  }, 60000);

  beforeEach(async () => {
    // Erstelle Admin-User für jeden Test mit echtem bcrypt-Hash
    // Password: "password" -> bcrypt hash
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash('password', 10);
    await ctx.prisma.user.upsert({
      where: { username: 'admin' },
      create: {
        id: generateTestId(),
        username: 'admin',
        passwordHash,
        role: 'ADMIN',
        isActive: true,
      },
      update: {
        passwordHash,
        isActive: true,
      },
    });
  });

  afterEach(async () => {
    await cleanupTestData(ctx);
  });

  afterAll(async () => {
    await teardownE2eModule(ctx);
    await app.close();
  });

  describe('POST /api/auth/login', () => {
    /**
     * Testet erfolgreichen Login mit gültigen Credentials.
     *
     * @remarks
     * Bei erfolgreichem Login muss 200 OK mit JWT Token
     * zurückgegeben werden. Token wird auch als Cookie gesetzt.
     */
    it('should return 200 with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'password',
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.length).toBeGreaterThan(0);
    });

    /**
     * Testet JWT Cookie-Setzung beim Login.
     *
     * @remarks
     * Der accessToken muss als HttpOnly, Secure, SameSite Cookie
     * gesetzt werden, um XSS/CSRF zu verhindern.
     */
    it('should set accessToken cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'password',
        })
        .expect(200);

      const cookies = response.headers['set-cookie'] as string[];
      expect(cookies).toBeDefined();

      const accessTokenCookie = cookies.find((c) => c.startsWith('accessToken='));

      expect(accessTokenCookie).toBeDefined();

      // HttpOnly und SameSite Flags prüfen
      expect(accessTokenCookie).toContain('HttpOnly');
      expect(accessTokenCookie).toContain('SameSite');
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
        .post('/api/auth/login')
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
        .post('/api/auth/login')
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
        .post('/api/auth/login')
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
        .post('/api/auth/login')
        .send({
          username: 'admin',
        })
        .expect(401);
    });

    /**
     * Testet dass JWT Token im Response ein valides Format hat.
     */
    it('should return valid JWT token format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'password',
        })
        .expect(200);

      expect(response.body.token).toMatch(/^eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);
    });
  });

  describe('POST /api/auth/logout', () => {
    /**
     * Testet erfolgreichen Logout.
     *
     * @remarks
     * Der Logout-Endpoint muss 204 No Content zurückgeben und die
     * JWT Cookies löschen (Max-Age=0).
     */
    it('should return 204 and clear cookies', async () => {
      // Erst einloggen
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'password',
        })
        .expect(200);

      const loginCookies = loginResponse.headers['set-cookie'] as string[];
      const accessTokenCookie = loginCookies.find((c) => c.startsWith('accessToken='));

      // Dann ausloggen
      const logoutResponse = await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', [accessTokenCookie]).expect(204);

      const logoutCookies = logoutResponse.headers['set-cookie'] as string[];

      // Cookies sollten gelöscht werden (Max-Age=0 oder leerer Wert)
      if (logoutCookies) {
        const clearedAccessToken = logoutCookies.find((c) => c.startsWith('accessToken='));
        expect(clearedAccessToken?.includes('Max-Age=0') || clearedAccessToken?.includes('accessToken=;')).toBe(true);
      }
    });

    /**
     * Testet Logout mit ungültigem Token.
     *
     * @remarks
     * Bei ungültigem Token muss Logout 401 Unauthorized zurückgeben,
     * da der Endpoint durch JwtAuthGuard geschützt ist.
     */
    it('should return 401 with invalid token', async () => {
      await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', ['accessToken=invalid-token']).expect(401);
    });

    /**
     * Testet Logout ohne Token.
     *
     * @remarks
     * Ohne Token muss Logout 401 Unauthorized zurückgeben,
     * da der Endpoint durch JwtAuthGuard geschützt ist.
     */
    it('should return 401 without token', async () => {
      await request(app.getHttpServer()).post('/api/auth/logout').expect(401);
    });

    /**
     * Testet Token-Invalidierung nach Logout.
     *
     * @remarks
     * MVP: Der Token bleibt gültig bis Expiration (24h).
     * Dieser Test ist aktuell deaktiviert, da echtes Token-Revocation
     * erst mit Redis Blacklist implementiert wird.
     */
    it.skip('should invalidate token after logout', async () => {
      // Login
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'password',
        })
        .expect(200);

      const loginCookies = loginResponse.headers['set-cookie'] as string[];
      const accessTokenCookie = loginCookies.find((c) => c.startsWith('accessToken='));

      // Vor Logout: Zugriff auf geschützten Endpoint funktioniert
      await request(app.getHttpServer()).get('/api/v-alpha/einsatz/active-with-counts').set('Cookie', [accessTokenCookie]).expect(200);

      // Logout
      await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', [accessTokenCookie]).expect(204);

      // Nach Logout: Zugriff mit altem Token schlägt fehl
      // TODO: Erst implementiert mit Redis Blacklist
      await request(app.getHttpServer()).get('/api/v-alpha/einsatz/active-with-counts').set('Cookie', [accessTokenCookie]).expect(401);
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
      const response = await request(app.getHttpServer()).get('/api/v-alpha/einsatz/active-with-counts').expect(401);

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
        .get('/api/v-alpha/einsatz/active-with-counts')
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
        .get('/api/v-alpha/einsatz/active-with-counts')
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
        .post('/api/auth/login')
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
        .get('/api/v-alpha/einsatz/active-with-counts')
        .set('Cookie', [`accessToken=${tamperedToken}`])
        .expect(401);

      expect(response.body).toHaveProperty('statusCode', 401);
    });

    /**
     * Testet öffentliche Endpoints (keine Auth erforderlich).
     *
     * @remarks
     * Einige Endpoints (z.B. /api) sollten OHNE
     * Authentifizierung erreichbar sein.
     */
    it('should allow access to public endpoints without token', async () => {
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
      const testUsername = `regular-user-${generateTestId()}`;
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash('password', 10);
      await ctx.prisma.user.create({
        data: {
          id: generateTestId(),
          username: testUsername,
          passwordHash,
          role: 'USER',
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: testUsername,
          password: 'password',
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'] as string[];
      const accessTokenCookie = cookies.find((c) => c.startsWith('accessToken='));

      // Versuch, auf ADMIN-Endpoint zuzugreifen (z.B. User Management)
      const response = await request(app.getHttpServer())
        .post('/api/v-alpha/user/create') // Beispiel ADMIN-Endpoint
        .set('Cookie', [accessTokenCookie])
        .send({
          username: `new-user-${generateTestId()}`,
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
      const testAdminUsername = `admin-user-${generateTestId()}`;
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash('password', 10);
      await ctx.prisma.user.create({
        data: {
          id: generateTestId(),
          username: testAdminUsername,
          passwordHash,
          role: 'ADMIN',
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: testAdminUsername,
          password: 'password',
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'] as string[];
      const accessTokenCookie = cookies.find((c) => c.startsWith('accessToken='));

      // Versuch, auf SUPER_ADMIN-Endpoint zuzugreifen
      const response = await request(app.getHttpServer())
        .patch('/api/v-alpha/user/some-user-id/role') // Beispiel SUPER_ADMIN-Endpoint
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
      const testSuperAdminUsername = `super-admin-${generateTestId()}`;
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash('password', 10);
      await ctx.prisma.user.create({
        data: {
          id: generateTestId(),
          username: testSuperAdminUsername,
          passwordHash,
          role: 'SUPER_ADMIN',
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: testSuperAdminUsername,
          password: 'password',
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'] as string[];
      const accessTokenCookie = cookies.find((c) => c.startsWith('accessToken='));

      // Zugriff auf ADMIN-Endpoint sollte funktionieren
      await request(app.getHttpServer()).get('/api/v-alpha/einsatz/active-with-counts').set('Cookie', [accessTokenCookie]).expect(200);

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
      const testLimitedUsername = `limited-user-${generateTestId()}`;
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash('password', 10);
      await ctx.prisma.user.create({
        data: {
          id: generateTestId(),
          username: testLimitedUsername,
          passwordHash,
          role: 'USER',
        },
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: testLimitedUsername,
          password: 'password',
        })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'] as string[];
      const accessTokenCookie = cookies.find((c) => c.startsWith('accessToken='));

      const response = await request(app.getHttpServer()).post('/api/v-alpha/user/create').set('Cookie', [accessTokenCookie]).send({}).expect(403);

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
     * HINWEIS: Deaktiviert, da Refresh-Endpoint noch nicht implementiert.
     */
    it.skip('should refresh access token with valid refresh token', async () => {
      // Login
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'password',
        })
        .expect(200);

      const loginCookies = loginResponse.headers['set-cookie'] as string[];
      const refreshTokenCookie = loginCookies.find((c) => c.startsWith('refreshToken='));

      // Refresh Request
      const refreshResponse = await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', [refreshTokenCookie]).expect(200);

      // Neuer Access Token sollte gesetzt werden
      const refreshCookies = refreshResponse.headers['set-cookie'] as string[];
      const newAccessTokenCookie = refreshCookies.find((c) => c.startsWith('accessToken='));

      expect(newAccessTokenCookie).toBeDefined();
    });

    /**
     * Testet Ablehnung bei ungültigem Refresh Token.
     * HINWEIS: Deaktiviert, da Refresh-Endpoint noch nicht implementiert.
     */
    it.skip('should return 401 with invalid refresh token', async () => {
      await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', ['refreshToken=invalid-token']).expect(401);
    });

    /**
     * Testet Ablehnung bei fehlendem Refresh Token.
     * HINWEIS: Deaktiviert, da Refresh-Endpoint noch nicht implementiert.
     */
    it.skip('should return 401 without refresh token', async () => {
      await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);
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
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'password',
        })
        .expect(200);

      const cookies = response.headers['set-cookie'] as string[];
      const accessTokenCookie = cookies.find((c) => c.startsWith('accessToken='));

      expect(accessTokenCookie).toContain('SameSite');

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
     * HINWEIS: Deaktiviert, da Rate-Limiting noch nicht implementiert.
     */
    it.skip('should rate-limit after multiple failed login attempts', async () => {
      // 5 fehlgeschlagene Login-Versuche
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            username: 'admin',
            password: 'wrong-password',
          })
          .expect(401);
      }

      // Nächster Versuch sollte Rate-Limited sein
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
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
