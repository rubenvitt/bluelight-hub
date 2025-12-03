import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EinsatzStatus, type Prisma } from '@prisma/client';
import { IsEnum } from 'class-validator';

/**
 * Interface fuer Einsatz-Vollstaendigkeitsinformationen.
 *
 * Repraesentiert die Vollstaendigkeit eines Einsatzes inkl. Score
 * und Liste fehlender Felder.
 */
export interface EinsatzCompleteness {
  score: number;
  isComplete: boolean;
  missingFields: MissingField[];
}

/**
 * Interface fuer fehlende Felder in der Vollstaendigkeits-Berechnung.
 */
export interface MissingField {
  field: string;
  fieldPath: string;
  priority: 'critical' | 'important' | 'optional';
  message: string;
  suggestedAction?: string;
}

/**
 * Interface fuer die Komponenten des generierten Einsatz-Namens.
 */
export interface NameComponents {
  alarmstichwort?: string;
  zeit?: string;
  datum: string;
}

/**
 * Interface fuer HATEOAS-Links in der API-Response.
 */
export interface EinsatzLinks {
  self: string;
  update: string;
  completeness: string;
}

/**
 * Response-DTO fuer einen Einsatz.
 *
 * Entkoppelt die persistente Entitaet (Prisma) von der API-Antwort
 * und erlaubt ergaenzende/berechnete Felder ohne DB-spezifische Logik.
 * Dieses DTO beschreibt ausschliesslich die nach aussen exponierten Felder
 * und enthaelt keine Geschaefts- oder Persistenzlogik.
 *
 * **Computed Fields:**
 * - name: Automatisch generierter Einsatz-Name
 * - nameComponents: Komponenten des Namens (alarmstichwort, datum, zeit)
 * - completeness: Optional - Vollstaendigkeits-Info (nur wenn angefordert)
 *
 * **Verwendung:**
 * - GET /api/einsatz (paginierte Liste)
 * - GET /api/einsatz/:id (einzelner Einsatz)
 * - POST /api/einsatz (nach Erstellung)
 * - PATCH /api/einsatz/:id (nach Update)
 *
 * @example
 * ```json
 * {
 *   "id": "cm4xyzabc123456789",
 *   "alarmstichwort": "Wohnungsbrand",
 *   "einsatzort": "Musterstrasse 123, 80331 Muenchen",
 *   "beschreibung": "Rauchentwicklung im 2. OG",
 *   "alarmierungszeit": "2024-01-15T10:30:00.000Z",
 *   "einsatzleiter": "Max Mustermann",
 *   "status": "IN_BEARBEITUNG",
 *   "metadata": null,
 *   "createdAt": "2024-01-15T10:30:00.000Z",
 *   "updatedAt": "2024-01-15T10:30:00.000Z",
 *   "createdBy": "user123",
 *   "updatedBy": null,
 *   "archivedAt": null,
 *   "archivedBy": null,
 *   "name": "Wohnungsbrand - 15.01.2024 10:30",
 *   "nameComponents": {
 *     "alarmstichwort": "Wohnungsbrand",
 *     "datum": "15.01.2024",
 *     "zeit": "10:30"
 *   },
 *   "completeness": {
 *     "score": 75,
 *     "isComplete": false,
 *     "missingFields": [...]
 *   }
 * }
 * ```
 */
export class EinsatzResponseDto {
  @ApiProperty({
    description: 'Eindeutige ID des Einsatzes',
    example: 'cm4xyzabc123456789',
  })
  id!: string;

  @ApiPropertyOptional({
    description: 'Das Alarmstichwort des Einsatzes',
    example: 'Wohnungsbrand',
  })
  alarmstichwort!: string | null;

  @ApiPropertyOptional({
    description: 'Der Einsatzort',
    example: 'Musterstrasse 123, 80331 Muenchen',
  })
  einsatzort!: string | null;

  @ApiPropertyOptional({
    description: 'Beschreibung des Einsatzes',
    example: 'Rauchentwicklung im 2. OG, keine Personen in Gefahr',
  })
  beschreibung!: string | null;

  @ApiPropertyOptional({
    description: 'Zeitpunkt der Alarmierung',
    example: '2024-01-15T10:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  alarmierungszeit!: Date | null;

  @ApiPropertyOptional({
    description: 'Name des Einsatzleiters',
    example: 'Max Mustermann',
  })
  einsatzleiter!: string | null;

  @ApiProperty({
    description: 'Status des Einsatzes',
    enum: EinsatzStatus,
    example: EinsatzStatus.ANGELEGT,
  })
  @IsEnum(EinsatzStatus)
  status!: EinsatzStatus;

  @ApiPropertyOptional({
    description: 'Zusaetzliche Metadaten als JSON',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  metadata!: Prisma.JsonValue | null;

  @ApiProperty({
    description: 'Erstellungszeitpunkt',
    example: '2024-01-15T10:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Zeitpunkt der letzten Aktualisierung',
    example: '2024-01-15T10:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  updatedAt!: Date;

  @ApiProperty({
    description: 'User ID des Erstellers',
    example: 'user123',
  })
  createdBy!: string;

  @ApiPropertyOptional({
    description: 'User ID des letzten Bearbeiters',
    example: 'user456',
  })
  updatedBy!: string | null;

  @ApiPropertyOptional({
    description: 'Zeitpunkt der Archivierung (No-Delete Policy)',
    example: '2024-01-15T16:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  archivedAt!: Date | null;

  @ApiPropertyOptional({
    description: 'User ID des Archivierers (No-Delete Policy)',
    example: 'user789',
  })
  archivedBy!: string | null;

  @ApiProperty({
    description: 'Automatisch generierter Name des Einsatzes',
    example: 'Wohnungsbrand - 15.01.2024 10:30',
  })
  name!: string;

  @ApiPropertyOptional({
    description: 'Vollstaendigkeits-Information',
    type: 'object',
    additionalProperties: true,
  })
  completeness?: EinsatzCompleteness;

  @ApiPropertyOptional({
    description: 'Komponenten des generierten Namens',
    type: 'object',
    additionalProperties: true,
  })
  nameComponents?: NameComponents;
}
