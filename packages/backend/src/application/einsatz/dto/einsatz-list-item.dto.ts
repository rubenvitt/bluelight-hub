import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { EinsatzStatusType } from './einsatz.dto';

/**
 * Kompaktes DTO für Einsatz-Listen mit Counts.
 * Optimiert für Dashboard-Ansichten mit ETB-Einträge und POI-Zählern.
 *
 * **Warum separates List-DTO statt vollständiges EinsatzDto:**
 * - Performance: Reduziert Payload-Größe (keine nested DTOs)
 * - Query-Optimierung: Ermöglicht COUNT-Queries ohne JOINs
 * - UI-Focus: Nur Felder die in Listen-Ansichten benötigt werden
 * - Scalability: 100 Einsätze mit Full-Details = 5MB+, mit List-DTO < 50KB
 *
 * **Unterschied zu EinsatzDto:**
 * - EinsatzDto: Vollständige Daten (inkl. bemerkung, createdBy, etc.)
 * - EinsatzListItemDto: Kompakt (nur name, status, counts)
 * - EinsatzDto: Für Detail-Views
 * - EinsatzListItemDto: Für Tabellen/Dashboard-Kacheln
 *
 * **Use Cases:**
 * - GET /api/einsatz → Returns EinsatzListItemDto[]
 * - Dashboard: Zeigt alle aktiven Einsätze mit Counts
 * - Archiv-Liste: Zeigt historische Einsätze mit Stats
 *
 * @example
 * ```typescript
 * // API Response:
 * {
 *   "id": "clw3h8x9y0000qwertyuiopas",
 *   "nummer": "E2024-abc123xy",
 *   "alarmstichwort": "Wohnungsbrand",
 *   "status": "IN_BEARBEITUNG",
 *   "einsatzort": { "ort": "Musterstadt" },
 *   "createdAt": "2024-01-15T10:30:00.000Z",
 *   "etbEintraegeCount": 15,
 *   "poisCount": 8
 * }
 * ```
 */
export class EinsatzListItemDto {
  @ApiProperty({
    description: 'Eindeutige Einsatz-ID (CUID2)',
    example: 'clw3h8x9y0000qwertyuiopas',
  })
  id!: string;

  @ApiProperty({
    description: 'Einsatznummer (Format: E{YEAR}-{ID})',
    example: 'E2024-abc123xy',
  })
  nummer!: string;

  @ApiProperty({
    description: 'Alarmstichwort / Einsatzart',
    example: 'Wohnungsbrand',
  })
  alarmstichwort!: string;

  @ApiProperty({
    description: 'Aktueller Einsatz-Status',
    enum: ['ANGELEGT', 'IN_BEARBEITUNG', 'ABGESCHLOSSEN', 'ARCHIVIERT'],
    example: 'IN_BEARBEITUNG',
  })
  status!: EinsatzStatusType;

  @ApiPropertyOptional({
    description: 'Einsatzort (nur Ort-Feld für kompakte Anzeige)',
    type: 'object',
    properties: {
      ort: { type: 'string' },
    },
    example: { ort: 'Musterstadt' },
    nullable: true,
  })
  einsatzort?: { ort: string };

  @ApiProperty({
    description: 'Erstellungszeitpunkt',
    example: '2024-01-15T10:30:00.000Z',
    type: 'string',
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Anzahl ETB-Einträge (nicht gelöschte)',
    example: 15,
    minimum: 0,
  })
  etbEintraegeCount!: number;

  @ApiProperty({
    description: 'Anzahl POIs auf der Lagekarte',
    example: 8,
    minimum: 0,
  })
  poisCount!: number;
}
