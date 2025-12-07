import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

/**
 * Role enum for user roles
 */
export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  USER = 'USER',
}

/**
 * DTO for authenticated user information
 * Decoupled from Prisma model to maintain clean API contracts
 */
export class AuthUserDto {
  @ApiProperty({
    description: 'Eindeutige ID des Benutzers',
    example: '453GsDyW0KssEuIW2lo2G',
  })
  @IsString()
  id!: string;

  @ApiProperty({
    description: 'Benutzername',
    example: 'max_mustermann',
  })
  @IsString()
  username!: string;

  @ApiProperty({
    description: 'Rolle des Benutzers',
    enum: Role,
    example: Role.USER,
  })
  @IsEnum(Role)
  role!: Role;

  @ApiProperty({
    description: 'Gibt an, ob der Benutzer aktiv ist',
    example: true,
  })
  @IsBoolean()
  isActive!: boolean;

  @ApiProperty({
    description: 'Zeitpunkt der Erstellung (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @Transform(({ value }) => (value instanceof Date ? value.toISOString() : value))
  @IsDateString()
  createdAt!: string;

  @ApiPropertyOptional({
    description: 'Zeitpunkt der Erstellung (NATO DTG Format für Rückwärtskompatibilität)',
    example: '011200ZJAN24',
    required: false,
  })
  @IsOptional()
  @IsString()
  createdAtNato?: string;
}
