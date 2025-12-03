import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * DTO fuer Query-Parameter beim Abrufen von Status-Statistiken.
 *
 * Enthaelt optionale Parameter fuer die Statistik-Abfrage.
 *
 * **Query-Parameter:**
 * - includeArchived: Archivierte Einsaetze in Statistik einschliessen (default: false)
 *
 * **Verwendung:**
 * - GET /api/einsatz/stats/status-counts
 * - GET /api/einsatz/stats/status-counts?includeArchived=true
 *
 * @example
 * ```
 * GET /api/einsatz/stats/status-counts?includeArchived=false
 * ```
 */
export class StatusCountsQueryDto {
  @ApiPropertyOptional({
    description: 'Archivierte Einsaetze in Statistik einschliessen (Standard: false)',
    example: false,
    type: Boolean,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === '1' || value === 1) return true;
    if (value === 'false' || value === false || value === '0' || value === 0) return false;
    return false;
  })
  @IsBoolean()
  includeArchived?: boolean = false;
}
