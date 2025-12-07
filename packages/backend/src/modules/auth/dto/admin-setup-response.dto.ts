import { ApiProperty } from '@nestjs/swagger';
import { AdminSetupUserDto } from './admin-user.dto';

/**
 * Response DTO für die Admin-Setup-Operation
 *
 * Wird zurückgegeben, wenn das Admin-Passwort erfolgreich eingerichtet wurde.
 * Enthält die Erfolgsmeldung und die aktualisierten Benutzerdaten.
 */
export class AdminSetupResponseDto {
  @ApiProperty({
    description: 'Erfolgsmeldung für das Admin-Setup',
    example: 'Admin-Setup erfolgreich durchgeführt',
  })
  message!: string;

  @ApiProperty({
    description: 'Aktualisierte Admin-Benutzerdaten ohne sensitive Informationen',
    type: AdminSetupUserDto,
  })
  user!: AdminSetupUserDto;
}
