import type { DeleteUserResponseDto } from './delete-user-response.dto';

/**
 * Erstellt eine Lösch-Response für einen Benutzer
 *
 * @param id - Die ID des gelöschten Benutzers
 * @returns Lösch-Response-DTO
 */
export function toDeleteUserResponseDto(id: string): DeleteUserResponseDto {
  return {
    id,
    deleted: true,
  };
}
