/**
 * HiOrgConnectionInfoDto - Response DTO für Verbindungstest.
 *
 * @module modules/integrations/dto
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO für HiOrg-Server Verbindungstest.
 *
 * Enthält Informationen über die Organisation aus der HiOrg-API.
 */
export class HiOrgConnectionInfoDto {
  @ApiProperty({
    description: 'Name der Organisation (aus HiOrg)',
    example: 'DLRG Ortsgruppe Musterhausen e.V.',
  })
  organisationName!: string;

  @ApiProperty({
    description: 'Verbindung erfolgreich?',
    example: true,
  })
  connected!: boolean;

  @ApiProperty({
    description: 'Zeitpunkt des Tests',
    example: '2025-01-15T10:30:00.000Z',
  })
  testedAt!: Date;
}
