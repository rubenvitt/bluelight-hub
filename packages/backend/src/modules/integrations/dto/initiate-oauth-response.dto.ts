/**
 * InitiateOAuthResponseDto - Response DTO fuer OAuth Flow Initiation.
 *
 * @module modules/integrations/dto
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO fuer OAuth Flow Initiation.
 *
 * Enthaelt die Authorization URL, zu der der Admin navigieren muss,
 * um den OAuth2 Flow abzuschliessen.
 */
export class InitiateOAuthResponseDto {
  /**
   * Authorization URL fuer OAuth2 Flow.
   *
   * Der Admin muss zu dieser URL navigieren, um HiOrg-Server Zugriff zu gewaehren.
   */
  @ApiProperty({
    description: 'Authorization URL fuer OAuth2 Flow',
    example: 'https://hiorg-server.de/oauth2/authorize?client_id=...&state=...',
  })
  authorizationUrl!: string;
}
