import { ApiProperty } from '@nestjs/swagger';
import { AuthUserResponseDto } from './auth-user-response.dto';

/**
 * Response DTO für den Auth-Check Endpoint
 *
 * Enthält entweder einen authentifizierten User oder null
 */
export class AuthCheckResponseDto {
  @ApiProperty({
    description: 'Der authentifizierte Benutzer oder null wenn nicht eingeloggt',
    type: AuthUserResponseDto,
    nullable: true,
    required: false,
  })
  user?: AuthUserResponseDto | null;

  @ApiProperty({
    description: 'Ob ein Benutzer authentifiziert ist',
    type: Boolean,
  })
  authenticated!: boolean;

  @ApiProperty({
    description: 'Ob der Benutzer als Administrator authentifiziert ist',
    type: Boolean,
    required: false,
  })
  isAdminAuthenticated?: boolean;
}
