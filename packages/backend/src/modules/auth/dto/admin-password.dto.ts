import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * Data Transfer Object für die Admin-Anmeldung nur mit Passwort
 *
 * Wird verwendet wenn ein bereits angemeldeter Benutzer seine Admin-Rechte
 * durch Eingabe seines Passworts aktivieren möchte.
 */
export class AdminPasswordDto {
  /**
   * Das Passwort des Admin-Accounts
   *
   * @example "SecureAdminPassword123!"
   */
  @ApiProperty({
    description: 'Passwort des Admin-Accounts',
    example: 'SecureAdminPassword123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Das Passwort muss mindestens 8 Zeichen lang sein' })
  password!: string;
}
