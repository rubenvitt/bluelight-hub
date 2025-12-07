import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ETB_KATEGORIE_VALUES, type EtbKategorieValue } from '@domain/value-objects/etb-kategorie';

/**
 * Eintrag Response DTO für ETB-Queries.
 *
 * Repräsentiert einen einzelnen Eintrag im Einsatztagebuch für die
 * API-Rückgabe. Enthält alle relevanten Metadaten für Chronologie
 * und Nachvollziehbarkeit.
 *
 * **Warum sequenceNumber:**
 * - Garantiert deterministische Reihenfolge unabhängig von Timestamps
 * - Ermöglicht Concurrent Edits ohne Reorder-Konflikte
 * - Basis für Diff/Merge bei ETB-Versioning
 *
 * **Unterschied zu Domain Entity:**
 * - Domain: Enthält Validierungslogik (Min-Länge, Berechtigungen)
 * - DTO: Pure Data für API-Response
 * - Domain: Kann Events emittieren (EintragCreated, EintragUpdated)
 * - DTO: Stateless Snapshot des Entity-Zustands
 */
export class EintragDto {
  @ApiProperty({
    description: 'Eindeutige Eintrags-ID (CUID)',
    example: 'clw3h8x9y0000qwertyuiopas',
  })
  id!: string;

  @ApiProperty({
    description: 'Sequenznummer für deterministische Reihenfolge',
    example: 1,
    minimum: 1,
  })
  sequenceNumber!: number;

  @ApiProperty({
    description: 'Kategorie des Eintrags',
    enum: ETB_KATEGORIE_VALUES,
    example: 'LAGE',
  })
  kategorie!: EtbKategorieValue;

  @ApiProperty({
    description: 'Eintragungstext (Freitext)',
    example: 'Einsatzkräfte vor Ort eingetroffen',
  })
  text!: string;

  @ApiProperty({
    description: 'Fachlicher Zeitstempel des Eintrags (wann ist das Ereignis eingetreten)',
    example: '2024-01-15T12:00:00.000Z',
    type: 'string',
    format: 'date-time',
  })
  timestamp!: Date;

  @ApiPropertyOptional({
    description: 'Optionaler Funkrufname der Einheit',
    example: 'W1',
    maxLength: 100,
    nullable: true,
    type: 'string',
  })
  funkrufname?: string | null;

  @ApiPropertyOptional({
    description: 'Optionaler Standort der Einheit',
    example: 'Hauptstraße 123',
    maxLength: 255,
    nullable: true,
    type: 'string',
  })
  standort?: string | null;

  @ApiProperty({
    description: 'Versionsnummer des Eintrags für Änderungshistorie',
    example: 1,
    minimum: 1,
  })
  version!: number;

  @ApiProperty({
    description: 'Flag für automatisch generierte Einträge (z.B. durch System-Events)',
    example: false,
  })
  isAutomatic!: boolean;

  @ApiProperty({
    description: 'User-ID des Erstellers (Referenz)',
    example: 'clw3h8x9y0000qwertyuiopas',
  })
  createdBy!: string;

  @ApiProperty({
    description: 'Erstellungszeitpunkt des Eintrags (technischer Timestamp)',
    example: '2024-01-15T12:00:00.000Z',
    type: 'string',
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiPropertyOptional({
    description: 'Letzter Aktualisierungszeitpunkt (nur bei Editierung)',
    example: '2024-01-15T12:30:00.000Z',
    type: 'string',
    format: 'date-time',
    nullable: true,
  })
  updatedAt?: Date;

  @ApiPropertyOptional({
    description: 'User-ID des letzten Editors (Referenz)',
    example: 'clw3h8x9y0000qwertyuiopas',
    nullable: true,
    type: 'string',
  })
  updatedBy?: string | null;

  @ApiProperty({
    description: 'Soft-Delete-Flag (Einträge werden nie physisch gelöscht)',
    example: false,
  })
  isDeleted!: boolean;

  @ApiPropertyOptional({
    description: 'Soft-Delete-Zeitpunkt (wann wurde der Eintrag gelöscht)',
    example: '2024-01-15T13:00:00.000Z',
    type: 'string',
    format: 'date-time',
    nullable: true,
  })
  deletedAt?: Date | null;

  @ApiPropertyOptional({
    description: 'User-ID des Löschenden (Referenz)',
    example: 'clw3h8x9y0000qwertyuiopas',
    nullable: true,
    type: 'string',
  })
  deletedBy?: string | null;

  @ApiPropertyOptional({
    description: 'Username des Löschenden (aus User-Join)',
    example: 'max.mustermann',
    nullable: true,
    type: 'string',
  })
  deleterUsername?: string | null;

  @ApiPropertyOptional({
    description: 'Optionale Metadaten (z.B. Screenshots, Anhänge)',
    example: {
      screenshot: {
        url: '/uploads/lagekarte/einsatz_123.png',
        width: 1024,
        height: 768,
      },
    },
    nullable: true,
  })
  metadata?: Record<string, unknown>;
}
