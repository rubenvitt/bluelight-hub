import type { Result } from '@domain/common/result';
import type { UserId } from '@domain/value-objects/user-id';
import type { UserRole } from '@domain/value-objects/user-role';

/**
 * Port für JWT-basierte Authentifizierung.
 *
 * Dieser Port definiert die Schnittstelle für JWT Token Management im Rahmen
 * der Session-basierten Authentifizierung. Er ist GETRENNT vom ITokenServicePort
 * (Magic Link + Password Reset), da beide unterschiedliche Anwendungsfälle bedienen:
 *
 * **ITokenServicePort (Magic Link + Password Reset):**
 * - Einmalige, zeitlich begrenzte Token für Email-Verification und Password-Reset
 * - Token-Invalidation nach Verwendung (Single-Use)
 * - Speicherung in Datenbank oder JWT mit kurzer Gültigkeit
 *
 * **IJwtAuthServicePort (Session Auth):**
 * - JWT Access Tokens für authentifizierte Sessions (24h Gültigkeit)
 * - Stateless JWT (keine DB-Speicherung im MVP)
 * - Token-Validation bei jedem Request (via JWT Signature)
 * - Token-Revocation nur bei Logout (MVP: No-Op, Future: Redis Blacklist)
 *
 * **Warum zwei separate Ports:**
 * - Separation of Concerns: Verschiedene Token-Typen = verschiedene Interfaces
 * - Token-Lifecycle: Magic Links sind Single-Use, JWT Access Tokens sind Multi-Use
 * - Security Models: Magic Links sind DB-backed (revokable), JWT ist stateless (performant)
 * - Implementation Strategy: Verschiedene Adapter (DatabaseTokenService vs JwtTokenService)
 *
 * **Hexagonal Architecture:**
 * - Port (Domain Layer): Diese Interface definiert WAS gemacht werden soll
 * - Adapter (Infrastructure Layer): JwtTokenServiceAdapter implementiert WIE es gemacht wird
 * - Dependency Inversion: Domain hängt NICHT von JWT-Library ab (z.B. jsonwebtoken, jose)
 *
 * **JWT Token Claims:**
 * - sub (Subject): UserId als String
 * - role: UserRole für Authorization (RBAC Permissions)
 * - iat (Issued At): Timestamp der Token-Generierung
 * - exp (Expiration): Timestamp des Token-Ablaufs (24h nach iat)
 *
 * @example
 * ```typescript
 * // Generate JWT Token (Login Success)
 * const userId = UserId.create().value!;
 * const role = UserRole.ADMIN();
 * const token = await jwtAuthService.generateToken(userId, role);
 * // Returns: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxNjE2MzI1NDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
 *
 * // Validate JWT Token (Protected Route)
 * const tokenResult = await jwtAuthService.validateToken(token);
 * if (tokenResult.isSuccess) {
 *   const { userId, role } = tokenResult.value;
 *   console.log(`User ${userId.value} has role ${role.value}`);
 * } else {
 *   console.error('Invalid token:', tokenResult.error);
 * }
 *
 * // Revoke Token (Logout)
 * await jwtAuthService.revokeToken(token);
 * // MVP: No-Op (stateless JWT can't be revoked without Redis/DB)
 * // Future: Add token to Redis blacklist with TTL = remaining token lifetime
 * ```
 */
export interface IJwtAuthServicePort {
  /**
   * Generiert einen JWT Access Token für authentifizierten User.
   *
   * Dieser Token wird nach erfolgreicher Login-Validation generiert und
   * im Authorization Header an den Client zurückgegeben. Der Token enthält
   * UserId und Role Claims für RBAC-basierte Authorization.
   *
   * **Token Lifetime:**
   * - 24 Stunden Gültigkeit (Balance zwischen UX und Security)
   * - Keine Refresh Tokens im MVP (User muss sich nach 24h neu einloggen)
   * - Future: Refresh Token für verlängerte Sessions
   *
   * **Security Considerations:**
   * - Token MUSS mit Secret signiert werden (HMAC-SHA256 oder RSA)
   * - Secret MUSS in Environment Variable gespeichert sein (NICHT im Code!)
   * - Token MUSS im Authorization Header transportiert werden (NICHT in URL/Cookie)
   * - Token DARF KEINE sensitiven Daten enthalten (Passwort-Hash, Email, etc.)
   *
   * **Claims Structure:**
   * ```json
   * {
   *   "sub": "user-id-cuid",
   *   "role": "ADMIN",
   *   "iat": 1616239022,
   *   "exp": 1616325422
   * }
   * ```
   *
   * **Implementation Hints (Infrastructure Layer):**
   * - JWT Library: jsonwebtoken oder jose (bevorzugt jose für TypeScript)
   * - Secret: process.env.JWT_SECRET (min. 256 bits für HS256)
   * - Algorithm: HS256 (HMAC-SHA256) oder RS256 (RSA Public/Private Key)
   * - Expiration: '24h' oder 86400 (seconds)
   *
   * @param userId - UserId des authentifizierten Users
   * @param role - UserRole für Authorization Claims
   * @returns JWT Token String (24h gültig)
   *
   * @example
   * ```typescript
   * // Application Layer (Login Use Case)
   * async login(username: string, password: string): Promise<Result<string>> {
   *   // 1. Validate Credentials
   *   const userResult = await this.userRepository.findByUsername(username);
   *   if (userResult.isFailure) return Result.fail('Invalid credentials');
   *
   *   const user = userResult.value;
   *   const isValidPassword = await this.passwordService.verify(password, user.passwordHash);
   *   if (!isValidPassword) return Result.fail('Invalid credentials');
   *
   *   // 2. Generate JWT Token
   *   const token = await this.jwtAuthService.generateToken(user.id, user.role);
   *
   *   // 3. Return Token to Client
   *   return Result.ok(token);
   * }
   * ```
   */
  generateToken(userId: UserId, role: UserRole): Promise<string>;

  /**
   * Validiert einen JWT Token und extrahiert Claims.
   *
   * Dieser Service wird bei jedem Request zu geschützten Routen aufgerufen
   * (via AuthGuard/Middleware). Er prüft die Token-Signatur und Expiration
   * und gibt die UserId und Role Claims zurück.
   *
   * **Validation Checks:**
   * 1. Signature Verification: Token MUSS mit Secret signiert sein
   * 2. Expiration Check: Token DARF NICHT abgelaufen sein
   * 3. Claims Extraction: sub (UserId) und role MÜSSEN vorhanden sein
   * 4. UserId Validation: sub MUSS valider UserId sein (Nanoid Format)
   * 5. Role Validation: role MUSS valider UserRole sein (SUPER_ADMIN, ADMIN, USER)
   *
   * **Error Scenarios:**
   * - Token malformed (kein gültiges JWT Format)
   * - Signature invalid (Token wurde manipuliert oder falscher Secret)
   * - Token expired (Expiration Timestamp überschritten)
   * - Claims invalid (sub oder role fehlt/ungültig)
   *
   * **Warum Result<T> Pattern:**
   * - Explizite Fehlerbehandlung im Application Layer
   * - Keine Exceptions (Performance + Flow Control)
   * - Type-Safe Errors (Error Messages via Result.fail())
   *
   * **AuthGuard Integration:**
   * ```typescript
   * @Injectable()
   * export class JwtAuthGuard implements CanActivate {
   *   async canActivate(context: ExecutionContext): Promise<boolean> {
   *     const request = context.switchToHttp().getRequest();
   *     const token = this.extractTokenFromHeader(request);
   *     if (!token) return false;
   *
   *     const result = await this.jwtAuthService.validateToken(token);
   *     if (result.isFailure) return false;
   *
   *     // Attach user to request for Controller access
   *     request.user = result.value;
   *     return true;
   *   }
   * }
   * ```
   *
   * @param token - JWT Token String aus Authorization Header
   * @returns Result mit { userId, role } bei Erfolg, Fehler bei ungültigem Token
   *
   * @example
   * ```typescript
   * // AuthGuard (Infrastructure Layer)
   * const authHeader = request.headers.authorization; // "Bearer eyJhbGc..."
   * const token = authHeader.split(' ')[1]; // Extract token after "Bearer "
   *
   * const result = await this.jwtAuthService.validateToken(token);
   * if (result.isSuccess) {
   *   const { userId, role } = result.value;
   *   request.user = { userId: userId.value, role: role.value };
   * } else {
   *   throw new UnauthorizedException('Invalid token');
   * }
   * ```
   */
  validateToken(token: string): Promise<Result<{ userId: UserId; role: UserRole }>>;

  /**
   * Widerruft einen Token (für Logout).
   *
   * **MVP Implementation: No-Op (Stateless JWT)**
   * - Stateless JWTs können NICHT serverseitig revoked werden
   * - Token bleibt gültig bis Expiration (24h)
   * - Client MUSS Token aus localStorage/sessionStorage löschen
   * - Security Risk: Token kann gestohlen und wiederverwendet werden
   *
   * **Future Implementation: Redis Token Blacklist**
   * - Token wird in Redis Blacklist gespeichert (Key: Token Hash, TTL: remaining lifetime)
   * - validateToken() prüft Blacklist vor Claims-Extraktion
   * - Ermöglicht echtes Logout (Token wird ungültig gemacht)
   * - Trade-off: Performance vs Security (Redis Query bei jedem Request)
   *
   * **Warum No-Op im MVP:**
   * - Simplicity: Keine Redis-Abhängigkeit im MVP
   * - Performance: Keine zusätzliche DB/Redis Query bei jedem Request
   * - Security: 24h Token Lifetime ist akzeptables Risiko für MVP
   * - Future-Proof: Interface erlaubt spätere Implementation ohne Breaking Changes
   *
   * **Client-Side Logout:**
   * ```typescript
   * // Frontend (after calling logout endpoint)
   * localStorage.removeItem('jwt_token');
   * // Token ist noch 24h gültig, aber Client hat ihn vergessen
   * ```
   *
   * **Future Redis Implementation:**
   * ```typescript
   * async revokeToken(token: string): Promise<void> {
   *   // 1. Hash Token (prevent storing raw token in Redis)
   *   const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
   *
   *   // 2. Calculate remaining TTL
   *   const decoded = jwt.decode(token) as { exp: number };
   *   const ttl = decoded.exp - Math.floor(Date.now() / 1000);
   *   if (ttl <= 0) return; // Token already expired
   *
   *   // 3. Add to Redis Blacklist
   *   await redis.set(`blacklist:${tokenHash}`, '1', 'EX', ttl);
   * }
   * ```
   *
   * @param token - JWT Token String (wird im MVP ignoriert)
   * @returns Promise<void> (immer erfolgreich im MVP)
   */
  revokeToken(token: string): Promise<void>;
}

/**
 * Dependency Injection Token für IJwtAuthServicePort.
 *
 * Wird in NestJS Modulen verwendet um den Port zu injecten:
 * ```typescript
 * @Module({
 *   providers: [
 *     {
 *       provide: JWT_AUTH_SERVICE_PORT,
 *       useClass: JwtTokenServiceAdapter,
 *     },
 *   ],
 * })
 * ```
 */
export const JWT_AUTH_SERVICE_PORT = Symbol('IJwtAuthServicePort');
