/**
 * HiOrgCredentialsResponseDto - Response DTO für Credentials-Abfrage.
 *
 * @module modules/integrations/dto
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO für HiOrg-Server Credentials.
 *
 * Zeigt den OAuth2-Verbindungsstatus an.
 */
export class HiOrgCredentialsResponseDto {
  @ApiProperty({
    description: 'Sind OAuth2 Tokens konfiguriert?',
    example: true,
  })
  hasOAuthTokens!: boolean;

  @ApiProperty({
    description: 'Ist die Integration aktiv?',
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'Zeitpunkt des letzten erfolgreichen Verbindungstests',
    example: '2025-01-15T10:30:00.000Z',
    required: false,
    nullable: true,
  })
  lastTestedAt?: Date | null;

  @ApiProperty({
    description: 'Zeitpunkt der letzten Synchronisation',
    example: '2025-01-15T11:00:00.000Z',
    required: false,
    nullable: true,
  })
  lastSyncAt?: Date | null;

  @ApiProperty({
    description: 'Ist OAuth2 serverseitig konfiguriert? (HIORG_OAUTH_CLIENT_ID vorhanden)',
    example: true,
  })
  isOAuthConfigured!: boolean;
}
