import type { User } from '@prisma/client';
import type { AuthUserResponseDto } from '../dto/auth-user-response.dto';

/**
 * Konvertiert ein Prisma User-Objekt in einen sicheren AuthUserResponseDto
 *
 * Entfernt sensitive Felder wie:
 * - passwordHash
 * - failedLoginCount
 * - lockedUntil
 *
 * @param user - Das vollständige User-Objekt aus der Datenbank
 * @returns Gefiltertes User-Objekt für API-Responses
 */
export function toUserResponseDto(user: User): AuthUserResponseDto {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
