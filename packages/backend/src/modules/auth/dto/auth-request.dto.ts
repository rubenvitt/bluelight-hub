import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Unified Auth Request DTO
 *
 * Vereinheitlichtes DTO für Login und automatische Registrierung.
 * Nur der Username ist erforderlich - Passwörter sind nur für Admin-Accounts relevant.
 */
export class AuthRequestDto {
  @ApiProperty({
    description: 'Benutzername für Login oder automatische Registrierung',
    example: 'max_mustermann',
    minLength: 3,
    maxLength: 30,
    pattern: '^[A-Za-z0-9_-]+$',
  })
  @IsString({ message: 'Benutzername muss ein Text sein' })
  @IsNotEmpty({ message: 'Benutzername darf nicht leer sein' })
  @MinLength(3, { message: 'Benutzername muss mindestens 3 Zeichen lang sein' })
  @MaxLength(30, { message: 'Benutzername darf maximal 30 Zeichen lang sein' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Benutzername darf nur Buchstaben, Zahlen, Unterstriche und Bindestriche enthalten',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  username!: string;

  @ApiPropertyOptional({
    description: 'Passwort (nur für Admin-Account Login erforderlich)',
    example: 'admin-password-123',
    required: false,
  })
  @IsString()
  @IsOptional()
  password?: string;
}
