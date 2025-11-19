import { ApiProperty } from '@nestjs/swagger';
import { PoiDto } from './poi.dto';

/**
 * Lagekarte Response DTO für Query Operations.
 *
 * Repräsentiert eine vollständige Lagekarte mit allen POIs für die
 * API-Rückgabe. Entkoppelt die Domain-Aggregate-Struktur von der
 * API-Response und ermöglicht flexible Projektionen.
 *
 * **Warum separates DTO statt direkt Aggregate:**
 * - Versionierung: API-Struktur kann unabhängig von Domain evolvieren
 * - Projektion: Nur API-relevante Felder (z.B. keine Domain Events)
 * - Performance: Optimierte Serialisierung ohne Domain-Overhead
 * - Security: Verhindert Leakage von internen Domain-Details
 *
 * **Unterschied zu Domain Aggregate:**
 * - Domain: LagekarteAggregate mit Poi[] als Child Entities
 * - DTO: Flache Struktur mit PoiDto[] für JSON-Response
 * - Domain: Enthält Business Logic (addPoi, removePoi, etc.)
 * - DTO: Pure Data (keine Logik, nur Struktur)
 *
 * **Use Cases:**
 * - GET /api/lagekarte/:einsatzId → Returns LagekarteDto
 * - WebSocket Updates → Sends LagekarteDto on POI changes
 * - Report Generation → Export LagekarteDto to PDF/Excel
 */
export class LagekarteDto {
  @ApiProperty({
    description: 'Eindeutige Lagekarten-ID (CUID)',
    example: 'clw3h8x9y0000qwertyuiopas',
  })
  id!: string;

  @ApiProperty({
    description: 'Referenz zum übergeordneten Einsatz',
    example: 'clw3h8x9y0000qwertyuiopas',
  })
  einsatzId!: string;

  @ApiProperty({
    description: 'Liste aller POIs auf der Lagekarte',
    type: [PoiDto],
    isArray: true,
  })
  pois!: PoiDto[];

  @ApiProperty({
    description: 'Erstellungszeitpunkt der Lagekarte',
    example: '2024-01-15T12:00:00.000Z',
    type: 'string',
    format: 'date-time',
  })
  createdAt!: Date;
}
