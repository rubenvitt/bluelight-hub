import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO für Admin-Setup-Status
 */
export class AdminStatusDto {
  @ApiProperty({
    description: 'Gibt an, ob ein Admin-Setup verfügbar ist',
    example: true,
  })
  adminSetupAvailable!: boolean;

  @ApiProperty({
    description: 'Gibt an, ob bereits ein Admin mit Passwort existiert',
    example: false,
  })
  adminExists!: boolean;

  @ApiProperty({
    description: 'Gibt an, ob der aktuelle Benutzer für Admin-Setup berechtigt ist',
    example: true,
  })
  userEligible!: boolean;
}
