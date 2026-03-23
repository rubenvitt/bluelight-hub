import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO fuer eine einzelne Navigations-Berechtigung.
 *
 * Repraesentiert den Zugang zu einem Navigationsbereich
 * basierend auf der UserRole des authentifizierten Benutzers.
 */
export class NavigationPermissionDto {
  @ApiProperty({
    description: 'Identifikator des Navigationsbereichs',
    example: 'stammdaten',
  })
  area!: string;

  @ApiProperty({
    description: 'Ob der Bereich fuer die aktuelle Rolle zugaenglich ist',
    example: true,
  })
  accessible!: boolean;

  @ApiProperty({
    description: 'Begruendung bei verweigertem Zugang',
    type: String,
    example: 'Dieser Bereich ist fuer Ihre Rolle nicht freigegeben',
    required: false,
    nullable: true,
  })
  reason?: string | null;
}
