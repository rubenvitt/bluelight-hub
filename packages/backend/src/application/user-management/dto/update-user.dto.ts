import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Data Transfer Object für die Aktualisierung eines bestehenden Benutzers über die Admin-API
 *
 * Wird von Super-Administratoren verwendet, um Benutzerinformationen zu aktualisieren.
 * Alle Felder sind optional - nur die übergebenen Felder werden aktualisiert.
 */
export class UpdateUserDto {
  /**
   * Der neue Benutzername für den Account
   *
   * Erlaubt sind nur Buchstaben (a-z, A-Z), Zahlen (0-9), Unterstriche (_) und Punkte (.).
   * Der Benutzername muss zwischen 3 und 30 Zeichen lang sein.
   *
   * @example "max_mustermann_neu"
   */
  @ApiPropertyOptional({
    description: 'Neuer Benutzername (nur Buchstaben, Zahlen, Unterstriche und Punkte erlaubt)',
    example: 'max_mustermann_neu',
    minLength: 3,
    maxLength: 30,
    pattern: '^[a-zA-Z0-9._]+$',
  })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Benutzername muss mindestens 3 Zeichen lang sein' })
  @MaxLength(30, { message: 'Benutzername darf maximal 30 Zeichen lang sein' })
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message: 'Benutzername darf nur Buchstaben, Zahlen, Unterstriche und Punkte enthalten',
  })
  username?: string;

  /**
   * Die neue Rolle des Benutzers im System
   *
   * @example UserRole.ADMIN
   */
  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Neue Rolle des Benutzers (z.B. SUPER_ADMIN, ADMIN, USER)',
    example: UserRole.ADMIN,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Ungültige Rolle. Erlaubte Werte sind: SUPER_ADMIN, ADMIN, USER' })
  role?: UserRole;
}
