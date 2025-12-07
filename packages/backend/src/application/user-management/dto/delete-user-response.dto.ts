import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO für Lösch-Operationen
 *
 * Bestätigt erfolgreiche Löschung eines Benutzers.
 */
export class DeleteUserResponseDto {
  /**
   * ID des gelöschten Benutzers
   */
  @ApiProperty({
    description: 'ID des gelöschten Benutzers',
    example: 'user123',
  })
  id!: string;

  /**
   * Bestätigung der Löschung
   */
  @ApiProperty({
    description: 'Bestätigung der Löschung',
    example: true,
  })
  deleted!: boolean;
}
