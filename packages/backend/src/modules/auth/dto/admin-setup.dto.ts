import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsStrongPassword, MaxLength } from 'class-validator';

/**
 * Data Transfer Object für die Admin-Setup-Konfiguration
 *
 * Validiert die Eingabedaten für das Setup des Admin-Accounts.
 * Wird verwendet, um das Passwort für einen Admin-Account zu setzen.
 */
export class AdminSetupDto {
  /**
   * Das Passwort für den Admin-Account
   *
   * @example "SecurePassword123!"
   */
  @ApiProperty({
    description: 'Passwort für den Admin-Account',
    example: 'SecurePassword123!',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MaxLength(128, { message: 'Das Passwort darf maximal 128 Zeichen lang sein' })
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  password!: string;
}
