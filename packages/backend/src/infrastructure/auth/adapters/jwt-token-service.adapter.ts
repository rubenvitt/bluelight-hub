import { Injectable, Logger } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { IJwtAuthServicePort } from '@domain/ports/i-jwt-auth-service.port';
import { UserId } from '@domain/value-objects/user-id';
import { UserRole } from '@domain/value-objects/user-role';
import { Result } from '@domain/common/result';

/**
 * JWT Payload Struktur.
 *
 * Diese Struktur definiert die Claims, die im JWT Token gespeichert werden.
 * Sie folgt dem Standard JWT Claims Format (RFC 7519).
 */
interface JwtPayload {
  /** Subject: UserId als String (Standard JWT Claim) */
  sub: string;
  /** Role: UserRole-Wert für RBAC Authorization */
  role: string;
  /** Issued At: Unix Timestamp der Token-Generierung (Standard JWT Claim) */
  iat: number;
}

/**
 * JWT-basierte Implementierung des IJwtAuthServicePort.
 *
 * Dieser Adapter implementiert die Domain-Port-Schnittstelle für JWT-basierte
 * Authentifizierung und nutzt dabei @nestjs/jwt für Token-Operationen.
 *
 * **Architektur-Pattern:**
 * - Port (Domain Layer): IJwtAuthServicePort definiert WAS gemacht werden soll
 * - Adapter (Infrastructure Layer): JwtTokenServiceAdapter implementiert WIE es gemacht wird
 * - Dependency Inversion: Domain hängt NICHT von JWT-Library ab (Hexagonal Architecture)
 *
 * **Token-Strategie:**
 * - Generiert stateless JWT Access Tokens (24h Gültigkeit)
 * - Signiert mit HMAC-SHA256 (HS256) via JWT_SECRET
 * - Token enthält nur nicht-sensitive Daten (userId, role)
 * - Keine Refresh Tokens im MVP (Future Enhancement)
 *
 * **Token Revocation:**
 * - MVP: No-Op (stateless JWT kann nicht serverseitig invalidiert werden)
 * - Future: Redis Token Blacklist für sofortige Invalidierung
 *
 * **Security Considerations:**
 * - JWT_SECRET MUSS in Environment Variable konfiguriert sein
 * - Token MUSS im Authorization Header transportiert werden (nicht in URL/Cookie)
 * - Token enthält KEINE sensitiven Daten (Passwort-Hash, Email, etc.)
 * - 24h Expiration Time ist Balance zwischen UX und Security
 *
 * @example
 * ```typescript
 * // Token generieren (nach erfolgreicher Login-Validation)
 * const userId = UserId.create('user-123-cuid').value!;
 * const role = UserRole.ADMIN();
 * const token = await adapter.generateToken(userId, role);
 *
 * // Token validieren (in AuthGuard)
 * const result = await adapter.validateToken(token);
 * if (result.isSuccess) {
 *   const { userId, role } = result.value;
 *   console.log(`Authenticated: ${userId.value} with role ${role.value}`);
 * }
 *
 * // Token widerrufen (Logout)
 * await adapter.revokeToken(token); // MVP: No-Op
 * ```
 */
@Injectable()
export class JwtTokenServiceAdapter implements IJwtAuthServicePort {
  private readonly logger = new Logger(JwtTokenServiceAdapter.name);

  constructor(private readonly jwtService: JwtService) {}

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
   * **Security:**
   * - Secret MUSS konfiguriert sein (sonst Error)
   * - HS256 Algorithm (HMAC-SHA256)
   * - Kein Passwort-Hash oder andere sensitive Daten im Token
   *
   * @param userId - UserId des authentifizierten Users
   * @param role - UserRole für Authorization Claims
   * @returns JWT Token String (24h gültig)
   * @throws Error wenn JWT_SECRET nicht konfiguriert ist
   */
  async generateToken(userId: UserId, role: UserRole): Promise<string> {
    const payload: JwtPayload = {
      sub: userId.value,
      role: role.value,
      iat: Math.floor(Date.now() / 1000),
    };

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    return this.jwtService.signAsync(payload, {
      secret,
      expiresIn: '24h',
    });
  }

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
   * 4. UserId Validation: sub MUSS valider UserId sein (Cuid Format)
   * 5. Role Validation: role MUSS valider UserRole sein (SUPER_ADMIN, ADMIN, USER)
   *
   * **Error Scenarios:**
   * - Token malformed → Result.fail('Invalid token')
   * - Signature invalid → Result.fail('Invalid token')
   * - Token expired → Result.fail('Token expired')
   * - Claims invalid → Result.fail('Invalid userId/role in token')
   *
   * **Warum Result<T> Pattern:**
   * - Explizite Fehlerbehandlung im Application Layer
   * - Keine Exceptions für Flow Control (bessere Performance)
   * - Type-Safe Errors (Error Messages via Result.fail())
   *
   * @param token - JWT Token String aus Authorization Header
   * @returns Result mit { userId, role } bei Erfolg, Fehler bei ungültigem Token
   */
  async validateToken(token: string): Promise<Result<{ userId: UserId; role: UserRole }>> {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return Result.fail('JWT_SECRET not configured');
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, { secret });

      // UserId rekonstruieren (Cuid Format Validation)
      const userIdResult = UserId.create(payload.sub);
      if (userIdResult.isFailure) {
        return Result.fail('Invalid userId in token');
      }

      // UserRole rekonstruieren (SUPER_ADMIN | ADMIN | USER)
      const roleResult = UserRole.create(payload.role);
      if (roleResult.isFailure) {
        return Result.fail('Invalid role in token');
      }

      return Result.ok({
        userId: userIdResult.value as UserId,
        role: roleResult.value as UserRole,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Token expired (exp Claim überschritten)
      if (message.includes('expired')) {
        this.logger.debug('Token expired');
        return Result.fail('Token expired');
      }

      // Token malformed oder invalid signature
      if (message.includes('invalid') || message.includes('malformed')) {
        this.logger.debug('Invalid token');
        return Result.fail('Invalid token');
      }

      // Unerwarteter Fehler (sollte nicht passieren)
      this.logger.error('Token validation failed', { error: message });
      return Result.fail('Token validation failed');
    }
  }

  /**
   * Widerruft einen Token (für Logout).
   *
   * **MVP Implementation: No-Op (Stateless JWT)**
   *
   * Stateless JWTs können NICHT serverseitig revoked werden, da sie keine
   * Verbindung zur Datenbank haben. Der Token bleibt gültig bis zur Expiration (24h).
   *
   * **Warum No-Op im MVP:**
   * - Simplicity: Keine Redis-Abhängigkeit im MVP
   * - Performance: Keine zusätzliche DB/Redis Query bei jedem Request
   * - Security: 24h Token Lifetime ist akzeptables Risiko für MVP
   * - Future-Proof: Interface erlaubt spätere Implementation ohne Breaking Changes
   *
   * **Client-Side Logout:**
   * Der Client MUSS den Token aus localStorage/sessionStorage löschen, damit
   * er nicht mehr verwendet werden kann. Der Token ist technisch noch 24h gültig,
   * aber der Client hat ihn "vergessen".
   *
   * **Future Enhancement: Redis Token Blacklist**
   *
   * Für echtes serverseitiges Logout kann eine Redis Blacklist implementiert werden:
   *
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
   *
   * // validateToken() muss Blacklist prüfen:
   * async validateToken(token: string): Promise<Result<...>> {
   *   const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
   *   const isBlacklisted = await redis.exists(`blacklist:${tokenHash}`);
   *   if (isBlacklisted) return Result.fail('Token revoked');
   *   // ... rest of validation
   * }
   * ```
   *
   * **Trade-offs:**
   * - Performance: Redis Query bei jedem Request (langsamer als stateless)
   * - Complexity: Redis Dependency + Cluster Setup für Production
   * - Security: Sofortige Token-Invalidierung (wichtig für kompromittierte Tokens)
   *
   * @param _token - JWT Token String (wird im MVP ignoriert)
   * @returns Promise<void> (immer erfolgreich im MVP)
   */
  async revokeToken(_token: string): Promise<void> {
    // MVP: No-Op
    // Stateless JWT kann nicht serverseitig invalidiert werden
    //
    // Future Enhancement Options:
    // 1. Redis Token Blacklist: Store revoked token IDs until expiry
    // 2. Token Version: Store version in User, increment on logout
    // 3. Short-lived Tokens: Reduce expiry to minimize revocation window
    this.logger.debug('Token revocation requested (No-Op in MVP)');
  }
}
