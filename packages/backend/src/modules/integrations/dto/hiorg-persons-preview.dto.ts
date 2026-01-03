/**
 * HiOrgPersonsPreviewDto - Response DTOs für Personen-Vorschau.
 *
 * @module modules/integrations/dto
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * Einzelne Person in der Vorschau.
 *
 * WARUM reduzierte Daten:
 * - Vorschau zeigt nur die wichtigsten Felder
 * - Vollständige Daten werden erst beim Import geladen
 * - Performance: Weniger Daten = schnellere Response
 */
export class HiOrgPersonPreviewItemDto {
  @ApiProperty({
    description: 'Benutzername in HiOrg',
    example: 'mmustermann',
  })
  username!: string;

  @ApiProperty({
    description: 'Mitgliedsnummer (falls vorhanden)',
    example: '12345',
    required: false,
  })
  mitgliednr?: string;

  @ApiProperty({
    description: 'Vorname',
    example: 'Max',
  })
  vorname!: string;

  @ApiProperty({
    description: 'Nachname',
    example: 'Mustermann',
  })
  nachname!: string;

  @ApiProperty({
    description: 'Anzahl der Qualifikationen',
    example: 3,
  })
  qualifikationenCount!: number;

  @ApiProperty({
    description: 'Anzahl der Ausbildungen',
    example: 2,
  })
  ausbildungenCount!: number;
}

/**
 * Response DTO für Personen-Vorschau.
 */
export class HiOrgPersonsPreviewResponseDto {
  @ApiProperty({
    description: 'Gesamtzahl der gefundenen Personen',
    example: 42,
  })
  totalCount!: number;

  @ApiProperty({
    description: 'Liste der Personen',
    type: [HiOrgPersonPreviewItemDto],
  })
  persons!: HiOrgPersonPreviewItemDto[];
}
