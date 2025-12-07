import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

/**
 * DTO für Admin-Benutzerinformationen
 *
 * Wird in verschiedenen Admin-bezogenen Responses verwendet.
 * Enthält nur die grundlegenden, nicht-sensitiven Benutzerinformationen.
 */
export class AdminUserDto {
  @ApiProperty({
    description: 'Eindeutige ID des Admin-Benutzers',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Benutzername des Admins',
    example: 'admin',
  })
  username!: string;

  @ApiProperty({
    description: 'Rolle des Benutzers',
    enum: UserRole,
    example: UserRole.ADMIN,
  })
  role!: UserRole;
}

/**
 * Erweiterte Admin-Benutzerinformationen für Setup-Responses
 *
 * Enthält zusätzliche Zeitstempel-Felder, die beim Admin-Setup relevant sind.
 */
export class AdminSetupUserDto extends AdminUserDto {
  @ApiProperty({
    description: 'Zeitpunkt der Kontoerstellung',
    example: '2024-01-01T12:00:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Zeitpunkt der letzten Aktualisierung',
    example: '2024-01-01T12:00:00Z',
  })
  updatedAt!: Date;
}
