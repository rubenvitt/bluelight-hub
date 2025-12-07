import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO für die Logout-Response
 */
export class LogoutResponseDto {
  @ApiProperty({
    description: 'Erfolgsmeldung nach dem Logout',
    example: 'Erfolgreich abgemeldet',
  })
  message!: string;
}
