import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Response DTO fuer Einsatz-Navigation.
 *
 * Enthaelt die ID des vorherigen oder naechsten Einsatzes fuer
 * Navigation zwischen Einsaetzen in chronologischer Reihenfolge.
 *
 * **Verwendung:**
 * - GET /api/einsatz/:id/navigation/previous
 * - GET /api/einsatz/:id/navigation/next
 *
 * **Business Rules:**
 * - Chronologische Sortierung nach createdAt
 * - null wenn kein vorheriger/naechster Einsatz existiert
 * - Archivierte Einsaetze werden uebersprungen
 *
 * @example
 * ```json
 * // Vorheriger Einsatz gefunden
 * { "id": "clw3h8x9y0000qwertyuiopas" }
 *
 * // Kein vorheriger Einsatz (erster Einsatz)
 * { "id": null }
 * ```
 */
export class NavigationResponseDto {
  @ApiProperty({
    description: 'ID des vorherigen/naechsten Einsatzes',
    nullable: true,
    example: 'clw3h8x9y0000qwertyuiopas',
  })
  @IsOptional()
  @IsString()
  id?: string | null;
}
