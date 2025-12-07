import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO für die Registrierungs-Antwort
 */
export class RegisterResponseDto {
  @ApiProperty({
    description: 'Eindeutige ID des Benutzers',
    example: '453GsDyW0KssEuIW2lo2G',
  })
  id!: string;

  @ApiProperty({
    description: 'Benutzername',
    example: 'john_doe',
  })
  username!: string;

  @ApiProperty({
    description: 'Rolle des Benutzers',
    example: 'USER',
  })
  role!: string;

  @ApiProperty({
    description: 'Gibt an, ob der Benutzer aktiv ist',
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'Zeitpunkt der Erstellung',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt!: string;
}
