import type { Result } from '@domain/common/result';
import type { UserId } from '../../value-objects/user-id';

/**
 * Token Service Port Interface (Hexagonal Architecture).
 *
 * Definiert die Schnittstelle für Token-Generation und -Validierung ohne technische
 * Implementierungsdetails. Die konkrete Umsetzung erfolgt in der Infrastructure Layer
 * (z.B. JwtTokenService, DatabaseTokenService).
 *
 * **Warum Port Interface:**
 * - Dependency Inversion: Domain Layer hängt von Abstraktion ab, nicht von JWT/Crypto-Library
 * - Testability: Mock-Service für Unit Tests ohne echte Token-Generierung
 * - Flexibility: Token-Strategie kann geändert werden (JWT → Database Tokens) ohne Domain zu ändern
 * - Security: Crypto-Details bleiben in Infrastructure Layer
 *
 * **Unified Authentication Strategy:**
 *
 * Bluelight-Hub verwendet ZWEI verschiedene Auth-Strategien basierend auf User Role:
 *
 * 1. **USER Role (Passwordless Authentication):**
 *    - Einsatzkräfte nutzen Passwordless Auth via Email Magic Link
 *    - KEIN Password wird gespeichert (Security + UX Benefit)
 *    - Flow: User klickt "Login" → Email mit Magic Link → Token Validation → Session
 *    - Token Type: Email Verification Token (einmalig, zeitlich begrenzt)
 *
 * 2. **ADMIN/SUPER_ADMIN Roles (Password-Based Authentication):**
 *    - Administratoren nutzen klassische Username + Password Login
 *    - Password wird gehasht gespeichert (bcrypt/argon2 in Infrastructure Layer)
 *    - Password Reset Flow: Forgot Password → Email mit Reset Link → Set New Password
 *    - Token Type: Password Reset Token (einmalig, zeitlich begrenzt)
 *
 * **Warum unterschiedliche Strategien:**
 * - USER: Einsatzkräfte benötigen schnellen Zugriff (kein Passwort merken)
 * - ADMIN: Admins benötigen höhere Sicherheit (2FA, Password Policies)
 * - Separation of Concerns: Verschiedene Rollen = verschiedene Security-Anforderungen
 *
 * **Token Security Requirements:**
 * - MUSS kryptographisch sicher sein (crypto.randomBytes() oder JWT mit Secret)
 * - MUSS zeitlich begrenzt sein (z.B. 15min für Magic Link, 1h für Password Reset)
 * - MUSS einmalig verwendbar sein (Token Invalidation nach Verwendung)
 * - MUSS UserId eindeutig zuordnen können
 *
 * @example
 * ```typescript
 * // Passwordless Login (USER Role)
 * async sendMagicLink(email: Email): Promise<Result<void>> {
 *   const userResult = await this.userRepository.findByEmail(email);
 *   if (userResult.isFailure || !userResult.value) {
 *     return Result.fail('User not found');
 *   }
 *
 *   if (!userResult.value.role.equals(UserRole.USER())) {
 *     return Result.fail('Magic links only for USER role');
 *   }
 *
 *   const tokenResult = await this.tokenService.generateEmailVerificationToken(userResult.value.id);
 *   if (tokenResult.isFailure) return tokenResult;
 *
 *   await this.emailService.sendMagicLink(email, tokenResult.value);
 *   return Result.ok();
 * }
 *
 * // Password Reset (ADMIN/SUPER_ADMIN)
 * async sendPasswordResetEmail(email: Email): Promise<Result<void>> {
 *   const userResult = await this.userRepository.findByEmail(email);
 *   if (userResult.isFailure || !userResult.value) {
 *     return Result.fail('User not found');
 *   }
 *
 *   if (userResult.value.role.equals(UserRole.USER())) {
 *     return Result.fail('Password reset not available for USER role (use magic link)');
 *   }
 *
 *   const tokenResult = await this.tokenService.generatePasswordResetToken(userResult.value.id);
 *   if (tokenResult.isFailure) return tokenResult;
 *
 *   await this.emailService.sendPasswordResetLink(email, tokenResult.value);
 *   return Result.ok();
 * }
 * ```
 */
export interface ITokenServicePort {
  /**
   * Generiert einen Password Reset Token für ADMIN/SUPER_ADMIN Rollen.
   *
   * **Use Case:**
   * - Administrator hat Passwort vergessen
   * - "Forgot Password" Flow: Email mit Reset Link
   * - Token wird in Email-Link eingebettet: `/reset-password?token=xyz`
   *
   * **Security Requirements:**
   * - Token MUSS kryptographisch sicher sein (min. 128bit Entropy)
   * - Token MUSS zeitlich begrenzt sein (empfohlen: 1 Stunde)
   * - Token MUSS einmalig verwendbar sein (Invalidation nach Verwendung)
   * - Token MUSS UserId eindeutig zuordnen können
   *
   * **Warum NICHT für USER Role:**
   * - USER Role nutzt Passwordless Auth (kein Passwort gespeichert)
   * - USER muss `generateEmailVerificationToken()` verwenden (Magic Link)
   * - Verhindert Verwechslung der Auth-Strategien
   *
   * **Implementation Hints (Infrastructure Layer):**
   * - JWT: Sign with Secret, embed userId in payload, set expiration
   * - Database: Store token hash, userId, expiresAt, usedAt columns
   * - Crypto: Use crypto.randomBytes(32).toString('hex')
   *
   * **Application Layer Responsibility:**
   * - MUSS prüfen dass User Role != USER ist
   * - MUSS Email senden mit Reset Link
   * - MUSS Token nach Verwendung invalidieren
   *
   * @param userId - UserId Value Object des Users der Passwort zurücksetzen will
   * @returns Result<string> - Success mit Token String, Failure bei Generierungsfehler
   */
  generatePasswordResetToken(userId: UserId): Promise<Result<string>>;

  /**
   * Generiert einen Email Verification Token für USER Role (Magic Link).
   *
   * **Use Case:**
   * - Einsatzkraft will sich einloggen (Passwordless Auth)
   * - "Login via Email" Flow: Email mit Magic Link
   * - Token wird in Email-Link eingebettet: `/auth/verify?token=xyz`
   *
   * **Unified Auth Strategy:**
   * - USER Role: KEIN Passwort, NUR Magic Link Login
   * - ADMIN/SUPER_ADMIN: Passwort-basiert, Magic Link NICHT verfügbar
   *
   * **Warum Passwordless für USER:**
   * - UX: Einsatzkräfte können sich kein komplexes Passwort merken
   * - Security: Kein schwaches Passwort, kein Passwort-Reuse
   * - Speed: Schneller Login im Einsatzfall (nur Email öffnen)
   * - Mobile: Einfacher auf Mobilgeräten (kein Passwort-Eingabe)
   *
   * **Security Requirements:**
   * - Token MUSS kryptographisch sicher sein (min. 128bit Entropy)
   * - Token MUSS zeitlich begrenzt sein (empfohlen: 15 Minuten)
   * - Token MUSS einmalig verwendbar sein (Invalidation nach Verwendung)
   * - Token MUSS UserId eindeutig zuordnen können
   *
   * **Implementation Hints (Infrastructure Layer):**
   * - JWT: Sign with Secret, embed userId in payload, set short expiration
   * - Database: Store token hash, userId, expiresAt, usedAt columns
   * - Crypto: Use crypto.randomBytes(32).toString('hex')
   *
   * **Application Layer Responsibility:**
   * - MUSS prüfen dass User Role == USER ist
   * - MUSS Email senden mit Magic Link
   * - MUSS Token nach Verwendung invalidieren
   * - MUSS Session erstellen nach erfolgreicher Validierung
   *
   * **Naming Clarification:**
   * - "Email Verification" ist historisch gewachsen (ursprünglich für Email-Bestätigung)
   * - In Bluelight-Hub wird es für Magic Link Login verwendet
   * - Alternative Namen wären: generateMagicLinkToken(), generatePasswordlessToken()
   * - Behalten wir bei für Konsistenz mit NestJS/Passport Konventionen
   *
   * @param userId - UserId Value Object des Users der sich einloggen will
   * @returns Result<string> - Success mit Token String, Failure bei Generierungsfehler
   */
  generateEmailVerificationToken(userId: UserId): Promise<Result<string>>;

  /**
   * Validiert einen Token und gibt die zugeordnete UserId zurück.
   *
   * **Unified Validation:**
   * - Validiert BEIDE Token-Typen (Password Reset + Email Verification)
   * - Infrastructure Layer entscheidet basierend auf Token-Format/Metadaten
   * - Application Layer prüft dann ob Token-Typ zur User Role passt
   *
   * **Validation Requirements:**
   * - Token MUSS kryptographisch valide sein (Signature/Hash Check)
   * - Token MUSS noch gültig sein (nicht abgelaufen)
   * - Token MUSS noch nicht verwendet worden sein (Single-Use Enforcement)
   * - Token MUSS einer existierenden UserId zugeordnet sein
   *
   * **Error Scenarios:**
   * - Token invalid (falsche Signature, ungültiges Format)
   * - Token expired (Zeitfenster überschritten)
   * - Token already used (Already Consumed)
   * - Token nicht gefunden (bei Database-Implementation)
   * - UserId nicht mehr existent (User wurde gelöscht)
   *
   * **Warum KEINE Token-Type Unterscheidung im Return:**
   * - Infrastructure Layer kennt Token-Type Details
   * - Domain Layer interessiert nur UserId
   * - Application Layer prüft User Role und entscheidet über weiteren Flow
   *
   * **Application Layer Flow:**
   * ```typescript
   * async verifyToken(token: string): Promise<Result<Session>> {
   *   // 1. Validate Token
   *   const userIdResult = await this.tokenService.validateToken(token);
   *   if (userIdResult.isFailure) return userIdResult;
   *
   *   // 2. Load User
   *   const userResult = await this.userRepository.findById(userIdResult.value);
   *   if (userResult.isFailure || !userResult.value) {
   *     return Result.fail('User not found');
   *   }
   *
   *   // 3. Invalidate Token (Single-Use Enforcement)
   *   await this.tokenService.invalidateToken(token);
   *
   *   // 4. Create Session
   *   return await this.sessionService.createSession(userResult.value);
   * }
   * ```
   *
   * **Implementation Hints (Infrastructure Layer):**
   * - JWT: Verify signature, check expiration, extract userId from payload
   * - Database: Query by token hash, check expiresAt, check usedAt, return userId
   * - MUSS Token invalidieren nach erfolgreicher Verwendung (Mark as used)
   *
   * @param token - Token String aus Email-Link oder Reset-Formular
   * @returns Result<UserId> - Success mit UserId Value Object, Failure bei Validierungsfehler
   */
  validateToken(token: string): Promise<Result<UserId>>;
}
