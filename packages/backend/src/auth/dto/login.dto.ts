import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Login Request DTO (CQRS Version)
 *
 * DTO für User Login via LoginCommand:
 * - PASSWORDLESS für USER Role (nur Username)
 * - PASSWORD-REQUIRED für ADMIN/SUPER_ADMIN Role
 */
export class LoginDto {
  @ApiProperty({
    description: 'Username des Users (wird zu lowercase normalisiert)',
    example: 'max_mustermann',
    minLength: 3,
    maxLength: 30,
    pattern: '^[A-Za-z0-9_-]+$',
  })
  @IsString({ message: 'Username muss ein Text sein' })
  @IsNotEmpty({ message: 'Username darf nicht leer sein' })
  @MinLength(3, { message: 'Username muss mindestens 3 Zeichen lang sein' })
  @MaxLength(30, { message: 'Username darf maximal 30 Zeichen lang sein' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username darf nur Buchstaben, Zahlen, Unterstriche und Bindestriche enthalten',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  username!: string;

  @ApiPropertyOptional({
    description: 'Passwort (nur für ADMIN/SUPER_ADMIN Accounts erforderlich)',
    example: 'admin-password-123',
    required: false,
  })
  @IsString()
  @IsOptional()
  password?: string;
}
