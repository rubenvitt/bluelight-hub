import { ApiPropertyOptional } from '@nestjs/swagger';
import { EinsatzStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO fuer das Aktualisieren eines bestehenden Einsatzes.
 *
 * Enthaelt alle Felder die bei einem Update geaendert werden koennen.
 * Alle Felder sind optional - nur angegebene Felder werden aktualisiert
 * (Partial Update).
 *
 * **Validierungsregeln:**
 * - alarmstichwort: max. 255 Zeichen, wird getrimmt
 * - einsatzort: max. 500 Zeichen, wird getrimmt
 * - beschreibung: Freitext, wird getrimmt
 * - alarmierungszeit: ISO 8601 DateTime String
 * - einsatzleiter: max. 255 Zeichen, wird getrimmt
 * - status: Muss valider EinsatzStatus Enum-Wert sein
 * - metadata: JSON-Objekt mit beliebigem Schema
 *
 * **Business Rules:**
 * - updatedBy wird aus JWT Token extrahiert (nicht im DTO)
 * - updatedAt wird automatisch gesetzt (nicht im DTO)
 * - Status-Uebergaenge werden im Domain Layer validiert
 * - Archivierte Einsaetze koennen nicht aktualisiert werden
 *
 * **Status-Uebergaenge (valide):**
 * - ANGELEGT → IN_BEARBEITUNG
 * - IN_BEARBEITUNG → ABGESCHLOSSEN
 * - ABGESCHLOSSEN → ARCHIVIERT
 * - Ungueltige Uebergaenge werden vom Domain Layer abgelehnt
 *
 * @example
 * ```json
 * {
 *   "alarmstichwort": "Wohnungsbrand - aktualisiert",
 *   "status": "IN_BEARBEITUNG",
 *   "einsatzleiter": "Max Mustermann",
 *   "metadata": {
 *     "notizen": "Wichtiger Hinweis",
 *     "prioritaet": "hoch"
 *   }
 * }
 * ```
 */
export class UpdateEinsatzDto {
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
    description: 'Der Einsatzort',
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

  @ApiPropertyOptional({
    description: 'Status des Einsatzes',
    enum: EinsatzStatus,
    example: EinsatzStatus.IN_BEARBEITUNG,
  })
  @IsOptional()
  @IsEnum(EinsatzStatus)
  status?: EinsatzStatus;

  @ApiPropertyOptional({
    description: 'Zusaetzliche Metadaten als JSON',
    example: { notizen: 'Wichtiger Hinweis', prioritaet: 'hoch' },
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
