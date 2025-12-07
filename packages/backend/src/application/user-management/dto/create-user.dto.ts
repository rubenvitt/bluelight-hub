import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Data Transfer Object für die Erstellung eines neuen Benutzers über die Admin-API
 *
 * Wird von Super-Administratoren verwendet, um neue Benutzer mit spezifischen Rollen anzulegen.
 */
export class CreateUserDto {
  /**
   * Der eindeutige Benutzername für den neuen Account
   *
   * Erlaubt sind nur Buchstaben (a-z, A-Z), Zahlen (0-9), Unterstriche (_) und Punkte (.).
   * Der Benutzername muss zwischen 3 und 30 Zeichen lang sein.
   *
   * @example "max_mustermann"
   */
  @ApiProperty({
    description: 'Eindeutiger Benutzername für den neuen Benutzer (nur Buchstaben, Zahlen, Unterstriche und Punkte erlaubt)',
    example: 'max_mustermann',
    minLength: 3,
    maxLength: 30,
    pattern: '^[a-zA-Z0-9._]+$',
  })
  @IsString()
  @MinLength(3, { message: 'Benutzername muss mindestens 3 Zeichen lang sein' })
  @MaxLength(30, { message: 'Benutzername darf maximal 30 Zeichen lang sein' })
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message: 'Benutzername darf nur Buchstaben, Zahlen, Unterstriche und Punkte enthalten',
  })
  username!: string;

  /**
   * Die Rolle des neuen Benutzers im System
   *
   * @example UserRole.USER
   * @default UserRole.USER
   */
  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Rolle des neuen Benutzers (z.B. SUPER_ADMIN, ADMIN, USER). Ohne Angabe wird die Standardrolle USER vergeben.',
    example: UserRole.USER,
    default: UserRole.USER,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Ungültige Rolle. Erlaubte Werte sind: SUPER_ADMIN, ADMIN, USER' })
  role?: UserRole;
}
