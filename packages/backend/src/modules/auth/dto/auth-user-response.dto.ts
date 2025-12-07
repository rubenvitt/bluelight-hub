import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

/**
 * DTO für sichere User-Responses (Auth Module)
 *
 * Enthält nur öffentliche Felder und schließt sensitive
 * Informationen wie passwordHash, failedLoginCount etc. aus
 */
export class AuthUserResponseDto {
  @ApiProperty({
    description: 'Eindeutige ID des Benutzers',
    example: '453GsDyW0KssEuIW2lo2G',
  })
  id!: string;

  @ApiProperty({
    description: 'Benutzername',
    example: 'max_mustermann',
  })
  username!: string;

  @ApiProperty({
    description: 'Rolle des Benutzers',
    enum: UserRole,
    example: UserRole.USER,
  })
  role!: UserRole;

  @ApiProperty({
    description: 'Gibt an, ob der Benutzer aktiv ist',
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'Zeitpunkt der letzten Anmeldung',
    required: false,
    nullable: true,
  })
  lastLoginAt!: Date | null;

  @ApiProperty({
    description: 'Zeitpunkt der Erstellung',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Zeitpunkt der letzten Aktualisierung',
  })
  updatedAt!: Date;
}
