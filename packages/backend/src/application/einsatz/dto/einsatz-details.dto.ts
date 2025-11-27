import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EinsatzDto } from './einsatz.dto';
import { EtbDto } from '../../etb/dto/etb.dto';
import { LagekarteDto } from '../../lagekarte/dtos/lagekarte.dto';

/**
 * Kombiniertes DTO für Einsatz mit zugehörigem ETB und Lagekarte.
 * Ermöglicht Frontend, alle Daten in einer Anfrage zu laden.
 *
 * **Warum kombiniertes DTO:**
 * - Performance: Reduziert HTTP-Requests (3 → 1)
 * - Consistency: Garantiert konsistente Daten zum selben Zeitpunkt
 * - UX: Schnellere Initial-Load-Time für Einsatz-Detailseiten
 * - Backend-Optimierung: Ermöglicht JOIN-Queries statt N+1 Problem
 *
 * **Use Cases:**
 * - GET /api/einsatz/:id/details → Returns EinsatzDetailsDto
 * - Dashboard: Vollständige Einsatz-Übersicht in einem Request
 * - Report Generation: Export aller Einsatz-Daten (PDF/Excel)
 *
 * @example
 * ```typescript
 * // API Response:
 * {
 *   "einsatz": {
 *     "id": "clw3h8x9y0000qwertyuiopas",
 *     "nummer": "E2024-abc123xy",
 *     "status": "IN_BEARBEITUNG"
 *   },
 *   "etb": {
 *     "id": "clw3h8x9y0001qwertyuiopas",
 *     "eintraege": [...]
 *   },
 *   "lagekarte": {
 *     "id": "clw3h8x9y0002qwertyuiopas",
 *     "pois": [...]
 *   }
 * }
 * ```
 */
export class EinsatzDetailsDto {
  @ApiProperty({
    description: 'Der Einsatz selbst mit allen Basis-Informationen',
    type: () => EinsatzDto,
  })
  einsatz!: EinsatzDto;

  @ApiPropertyOptional({
    description: 'Das Einsatztagebuch (null wenn noch nicht erstellt)',
    type: () => EtbDto,
    nullable: true,
  })
  etb!: EtbDto | null;

  @ApiPropertyOptional({
    description: 'Die Lagekarte (null wenn noch nicht erstellt)',
    type: () => LagekarteDto,
    nullable: true,
  })
  lagekarte!: LagekarteDto | null;
}
