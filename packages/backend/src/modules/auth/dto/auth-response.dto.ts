import { ApiProperty } from '@nestjs/swagger';
import { AuthUserDto } from './auth-user.dto';

/**
 * Unified Auth Response DTO
 *
 * Antwort für erfolgreiche Authentifizierung (Login oder neue Registrierung)
 */
export class AuthResponseDto {
  @ApiProperty({
    description: 'Gibt an, ob ein neuer Benutzer angelegt wurde',
    example: false,
  })
  isNewUser!: boolean;

  @ApiProperty({
    description: 'Benutzerinformationen (ohne sensible Daten)',
    type: AuthUserDto,
  })
  user!: AuthUserDto;
}
