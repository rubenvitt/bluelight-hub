import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ETB_KATEGORIE_VALUES, type EtbKategorieValue } from '@domain/value-objects/etb-kategorie';

/**
 * DTO fuer einen ETB-Textbaustein.
 *
 * Textbausteine sind vordefinierte Text-Templates fuer die schnelle
 * Erstellung von ETB-Eintraegen. Sie reduzieren Tipparbeit und
 * standardisieren haeufige Eintragstypen.
 *
 * **Verwendung:**
 * - Frontend zeigt Textbausteine in einer Auswahlliste
 * - Bei Auswahl wird `volltext` in das Eingabefeld uebernommen
 * - `kurztext` dient als Label in der Auswahlliste
 * - `kategorie` ermoeglicht kategoriebasiertes Filtern
 */
export class TextbausteinDto {
  @ApiProperty({
    description: 'Eindeutige ID des Textbausteins',
    example: 'clw3h8x9y0000qwertyuiopas',
  })
  id!: string;

  @ApiProperty({
    description: 'Kategorie des Textbausteins',
    enum: ETB_KATEGORIE_VALUES,
    example: 'ALARMIERUNG',
  })
  kategorie!: EtbKategorieValue;

  @ApiProperty({
    description: 'Kurzbeschreibung des Textbausteins',
    example: 'Einsatzbereit',
    maxLength: 100,
  })
  kurztext!: string;

  @ApiProperty({
    description: 'Vollstaendiger Text des Bausteins',
    example: 'Alle Einheiten vor Ort einsatzbereit.',
  })
  volltext!: string;

  @ApiProperty({
    description: 'Aktiv-Status des Textbausteins',
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'Sortierreihenfolge',
    example: 1,
  })
  sortOrder!: number;

  @ApiProperty({
    description: 'Anzahl der Verwendungen',
    example: 42,
  })
  verwendungen!: number;

  @ApiPropertyOptional({
    description: 'Datum der letzten Nutzung',
    type: Date,
    example: '2025-01-15T10:30:00.000Z',
    nullable: true,
  })
  letztGenutzt?: Date | null;
}
