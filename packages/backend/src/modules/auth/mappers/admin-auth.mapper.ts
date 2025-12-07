import type { User } from '@prisma/client';
import type { AdminLoginResponseDto } from '../dto/admin-login-response.dto';
import type { AdminSetupResponseDto } from '../dto/admin-setup-response.dto';
import type { AdminStatusDto } from '../dto/admin-status.dto';
import type { AdminTokenVerificationDto } from '../dto/admin-token-verification.dto';
import type { AdminSetupUserDto } from '../dto/admin-user.dto';

/**
 * Erstellt eine Admin-Login-Response
 *
 * @param user - Der eingeloggte Admin-Benutzer
 * @returns Admin-Login-Response-DTO
 */
export function toAdminLoginResponseDto(user: Pick<User, 'id' | 'username' | 'role'>): AdminLoginResponseDto {
  return {
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  };
}

/**
 * Erstellt eine Admin-Setup-Response
 *
 * @param user - Der Admin-Benutzer (ohne passwordHash)
 * @returns Admin-Setup-Response-DTO
 */
export function toAdminSetupResponseDto(user: Omit<User, 'passwordHash'>): AdminSetupResponseDto {
  const setupUser: AdminSetupUserDto = {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return {
    message: 'Admin-Setup erfolgreich durchgeführt',
    user: setupUser,
  };
}

/**
 * Erstellt eine Admin-Status-Response
 *
 * @param adminExists - Ob ein Admin existiert
 * @param userEligible - Ob der Benutzer berechtigt ist
 * @returns Admin-Status-Response-DTO
 */
export function toAdminStatusResponseDto(adminExists: boolean, userEligible: boolean): AdminStatusDto {
  return {
    adminSetupAvailable: userEligible,
    adminExists,
    userEligible,
  };
}

/**
 * Erstellt eine Admin-Token-Verifikation-Response
 *
 * @returns Admin-Token-Verifikation-Response-DTO
 */
export function toAdminTokenVerificationDto(ok = true): AdminTokenVerificationDto {
  return {
    ok: ok,
  };
}
