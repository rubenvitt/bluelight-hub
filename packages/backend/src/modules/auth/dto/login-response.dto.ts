import { ApiProperty } from '@nestjs/swagger';

/**
 * Login Response DTO
 *
 * Response für erfolgreichen Login via LoginCommand.
 * Token wird zusätzlich als HTTP-Only Cookie gesetzt.
 */
export class LoginResponseDto {
  @ApiProperty({
    description: 'JWT Access Token (24h gültig)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  token!: string;
}
