import type { LogoutResponseDto } from '../dto/logout-response.dto';
import type { RefreshResponseDto } from '../dto/refresh-response.dto';

/**
 * Erstellt eine Logout-Response
 *
 * @returns Logout-Response-DTO
 */
export function toLogoutResponseDto(): LogoutResponseDto {
  return {
    message: 'Erfolgreich abgemeldet',
  };
}

/**
 * Erstellt eine Token-Refresh-Response
 *
 * Hinweis: Access- und Refresh-Token werden als HttpOnly-Cookies gesetzt;
 * die Response enthält nur den Erfolgsstatus.
 * @returns Refresh-Response-DTO
 */
export function toRefreshResponseDto(): RefreshResponseDto {
  return {
    success: true,
  };
}
