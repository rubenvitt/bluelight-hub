import { Result } from '@domain/common/result';
import type { IUserRepository } from '@domain/repositories/i-user.repository';
import type { IJwtAuthServicePort } from '@domain/ports/i-jwt-auth-service.port';
import { Username } from '@domain/value-objects/username';
import { UserRole } from '@domain/value-objects/user-role';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { USER_REPOSITORY, JWT_AUTH_SERVICE } from '@infrastructure/di-tokens';
import type { LoginCommand } from './login.command';
import * as bcrypt from 'bcrypt';

/**
 * Handler für LoginCommand.
 *
 * Orchestriert die User-Authentifizierung mit folgenden Schritten:
 * 1. Username Validierung (Format + Existence Check)
 * 2. Account Status Check (isLocked = false)
 * 3. Password Validierung (nur für ADMIN/SUPER_ADMIN Roles)
 * 4. JWT Token Generierung bei erfolgreicher Auth
 *
 * **PASSWORDLESS Auth für USER Role:**
 * - USER-Accounts können OHNE Passwort einloggen (nur Username)
 * - ADMIN/SUPER_ADMIN-Accounts erfordern IMMER Passwort-Validierung
 * - Passwort-Check erfolgt via bcrypt.compare() gegen passwordHash
 *
 * **Account Locking:**
 * - Gesperrte Accounts (isLocked = true) können sich NICHT einloggen
 * - Error Message: "Benutzerkonto gesperrt"
 * - Unlock via Admin-Command erforderlich
 *
 * **Security:**
 * - Sanitized Error Messages (keine internen IDs in User-Fehlern)
 * - bcrypt für Password Hashing (verhindert Plaintext Storage)
 * - JWT Token mit 24h Expiration (Balance zwischen UX und Security)
 *
 * @example
 * ```typescript
 * // ADMIN Login (Passwort erforderlich)
 * const adminCommand = LoginCommand.create('admin', 'secure_password').value!;
 * const adminResult = await handler.execute(adminCommand);
 * if (adminResult.isSuccess) {
 *   const token = adminResult.value; // JWT Token String
 * }
 *
 * // USER Login (Passwortlos)
 * const userCommand = LoginCommand.create('ruben_user').value!;
 * const userResult = await handler.execute(userCommand);
 * if (userResult.isSuccess) {
 *   const token = userResult.value; // JWT Token String
 * }
 * ```
 */
@Injectable()
export class LoginHandler {
  private readonly logger = new Logger(LoginHandler.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(JWT_AUTH_SERVICE)
    private readonly jwtService: IJwtAuthServicePort,
  ) {}

  /**
   * Führt Login-Command aus und gibt JWT Token zurück.
   *
   * @param command - LoginCommand mit Username und optional Password
   * @returns Result<string> - Success mit JWT Token oder Failure mit Error
   */
  async execute(command: LoginCommand): Promise<Result<string>> {
    // Step 1: Validate Username format
    const usernameResult = Username.create(command.username);
    if (usernameResult.isFailure) {
      return Result.fail<string>(usernameResult.error ?? 'Ungültiger Username');
    }
    const username = usernameResult.value;
    if (!username) {
      this.logger.error('Unexpected null Username after successful validation', {
        command: command.constructor.name,
      });
      return Result.fail<string>('Invalid Username result');
    }

    // Step 2: Find User by Username
    const userResult = await this.userRepository.findByUsername(username);
    if (userResult.isFailure) {
      // Server-side logging with diagnostic context
      this.logger.warn('User lookup failed during login', {
        username: username.value,
        error: userResult.error,
      });
      // User-facing sanitized message (NO internal details)
      return Result.fail<string>('Benutzer nicht gefunden');
    }

    const user = userResult.value;
    if (!user) {
      // User not found in DB
      this.logger.warn('User not found during login', {
        username: username.value,
      });
      return Result.fail<string>('Benutzer nicht gefunden');
    }

    // Step 3: Check if Account is locked
    if (user.isLocked) {
      this.logger.warn('Login attempt for locked account', {
        userId: user.id.value,
        username: username.value,
      });
      return Result.fail<string>('Benutzerkonto gesperrt');
    }

    // Step 4: Password Validation (nur für ADMIN/SUPER_ADMIN)
    const role = user.role;
    const isAdmin = role.equals(UserRole.ADMIN());
    const isSuperAdmin = role.equals(UserRole.SUPER_ADMIN());

    if (isAdmin || isSuperAdmin) {
      // ADMIN/SUPER_ADMIN benötigt Passwort
      if (!command.password) {
        this.logger.warn('Admin login attempt without password', {
          userId: user.id.value,
          role: role.value,
        });
        return Result.fail<string>('Passwort ist für Admin-Accounts erforderlich');
      }

      // bcrypt Password Verification
      // user.passwordHash ist bcrypt hash (aus DB)
      // command.password ist plaintext password (von User eingegeben)
      const passwordHash = await this.userRepository.getPasswordHash(user.id);
      if (passwordHash.isFailure || !passwordHash.value) {
        this.logger.error('Failed to retrieve password hash during login', {
          userId: user.id.value,
          error: passwordHash.error,
        });
        return Result.fail<string>('Login fehlgeschlagen');
      }

      const passwordValid = await bcrypt.compare(command.password, passwordHash.value);
      if (!passwordValid) {
        this.logger.warn('Invalid password during login', {
          userId: user.id.value,
        });
        return Result.fail<string>('Ungültiges Passwort');
      }
    }
    // USER Role: Passwortlos (kein Password Check)

    // Step 5: Generate JWT Token
    try {
      const token = await this.jwtService.generateToken(user.id, user.role);
      this.logger.log('Login successful', {
        userId: user.id.value,
        role: role.value,
      });
      return Result.ok(token);
    } catch (error) {
      this.logger.error('Failed to generate JWT token during login', {
        error: error instanceof Error ? error.message : String(error),
        userId: user.id.value,
      });
      return Result.fail<string>('Login fehlgeschlagen');
    }
  }
}
