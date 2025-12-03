import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO fuer das Erstellen eines neuen Einsatzes.
 *
 * Enthaelt die optionalen Felder die beim Erstellen eines Einsatzes
 * angegeben werden koennen. Alle Felder sind optional, da ein Einsatz
 * initial nur minimal angelegt wird (Status: ANGELEGT).
 *
 * **Validierungsregeln:**
 * - alarmstichwort: max. 255 Zeichen, wird getrimmt
 * - einsatzort: max. 500 Zeichen, wird getrimmt
 * - beschreibung: Freitext, wird getrimmt
 * - alarmierungszeit: ISO 8601 DateTime String
 * - einsatzleiter: max. 255 Zeichen, wird getrimmt
 *
 * **Business Rules:**
 * - createdBy wird aus JWT Token extrahiert (nicht im DTO)
 * - Status ist initial ANGELEGT (nicht im DTO)
 * - Einsatznummer wird automatisch generiert (nicht im DTO)
 *
 * @example
 * ```json
 * {
 *   "alarmstichwort": "Wohnungsbrand",
 *   "einsatzort": "Musterstrasse 123, 80331 Muenchen",
 *   "beschreibung": "Rauchentwicklung im 2. OG",
 *   "alarmierungszeit": "2024-01-15T10:30:00.000Z",
 *   "einsatzleiter": "Max Mustermann"
 * }
 * ```
 */
export class CreateEinsatzDto {
  @ApiPropertyOptional({
    description: 'Das Alarmstichwort des Einsatzes',
    example: 'Wohnungsbrand',
    maxLength: 255,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(255)
  alarmstichwort?: string;

  @ApiPropertyOptional({
    description: 'Der initiale Einsatzort',
    example: 'Musterstrasse 123, 80331 Muenchen',
    maxLength: 500,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  einsatzort?: string;

  @ApiPropertyOptional({
    description: 'Beschreibung des Einsatzes',
    example: 'Rauchentwicklung im 2. OG, keine Personen in Gefahr',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  beschreibung?: string;

  @ApiPropertyOptional({
    description: 'Zeitpunkt der Alarmierung',
    example: '2024-01-15T10:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  alarmierungszeit?: string;

  @ApiPropertyOptional({
    description: 'Name des Einsatzleiters',
    example: 'Max Mustermann',
    maxLength: 255,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(255)
  einsatzleiter?: string;
}
