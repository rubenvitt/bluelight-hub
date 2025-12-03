import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * DTO fuer Query-Parameter beim Abrufen der Einsatz-Vollstaendigkeit.
 *
 * Enthaelt optionale Parameter fuer die Vollstaendigkeits-Abfrage.
 *
 * **Query-Parameter:**
 * - refresh: Cache-Invalidierung fuer Vollstaendigkeits-Berechnung (default: false)
 *
 * **Verwendung:**
 * - GET /api/einsatz/:id/completeness
 * - GET /api/einsatz/:id/completeness?refresh=true
 *
 * **Hinweis zu refresh:**
 * - MVP Implementation ignoriert refresh Parameter (kein Caching)
 * - Kann in spaeteren Iterationen fuer Cache-Invalidierung genutzt werden
 *
 * @example
 * ```
 * GET /api/einsatz/cm4xyz/completeness?refresh=true
 * ```
 */
export class CompletenessQueryDto {
  @ApiPropertyOptional({
    description: 'Cache-Invalidierung fuer Vollstaendigkeits-Berechnung (MVP: ignoriert)',
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
  refresh?: boolean = false;
}
