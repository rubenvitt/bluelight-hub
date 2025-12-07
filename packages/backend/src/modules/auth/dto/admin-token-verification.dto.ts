import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO für die Admin-Token-Verifikation-Response
 */
export class AdminTokenVerificationDto {
  @ApiProperty({
    description: 'Bestätigung, dass das Admin-Token gültig ist',
    example: true,
  })
  ok!: boolean;
}
