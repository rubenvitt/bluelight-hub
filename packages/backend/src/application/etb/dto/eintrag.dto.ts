import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EtbKategorie } from '@prisma/client';

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
    enum: EtbKategorie,
    example: 'LAGE',
  })
  kategorie!: EtbKategorie;

  @ApiProperty({
    description: 'Eintragungstext (Freitext)',
    example: 'Einsatzkräfte vor Ort eingetroffen',
  })
  text!: string;

  @ApiProperty({
    description: 'User-ID des Erstellers (Referenz)',
    example: 'clw3h8x9y0000qwertyuiopas',
  })
  createdBy!: string;

  @ApiProperty({
    description: 'Erstellungszeitpunkt des Eintrags',
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

  @ApiProperty({
    description: 'Soft-Delete-Flag (Einträge werden nie physisch gelöscht)',
    example: false,
  })
  isDeleted!: boolean;

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
