import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressDto } from './address.dto';

/**
 * Erlaubte Einsatz-Status Werte fuer API-Responses.
 *
 * Entspricht den Status-Werten im EinsatzStatus Value Object,
 * aber als String-Union fuer TypeScript Type Safety in DTOs.
 */
export type EinsatzStatusType = 'ANGELEGT' | 'IN_BEARBEITUNG' | 'ABGESCHLOSSEN' | 'ARCHIVIERT';

/**
 * DTO fuer Einsatz-Daten in API-Responses.
 *
 * Trennt Domain-Schicht (EinsatzAggregate) von API-Schicht.
 * Enthaelt nur die fuer API-Consumers relevanten Felder.
 *
 * **Warum separate DTO-Klasse:**
 * - Swagger Decorators sind API-Concern
 * - Ermoeglicht API-Versionierung ohne Domain-Aenderungen
 * - Value Objects werden auf primitive Typen gemappt
 * - Security: Interne Domain-Details (Events) bleiben verborgen
 *
 * @example
 * ```typescript
 * // API Response:
 * {
 *   "id": "clw3h8x9y0000qwertyuiopas",
 *   "nummer": "E2024-abc123xy",
 *   "alarmstichwort": "Wohnungsbrand",
 *   "status": "IN_BEARBEITUNG",
 *   "createdBy": "clw3h8x9y0001qwertyuiopas",
 *   "createdAt": "2024-01-15T10:30:00.000Z"
 * }
 * ```
 */
export class EinsatzDto {
  @ApiProperty({
    description: 'Eindeutige Einsatz-ID (CUID2 Format)',
    example: 'clw3h8x9y0000qwertyuiopas',
  })
  id!: string;

  @ApiProperty({
    description: 'Auto-generierte Einsatznummer (Format: E{YEAR}-{CUID-8})',
    example: 'E2024-abc123xy',
  })
  nummer!: string;

  @ApiProperty({
    description: 'Alarmstichwort (z.B. Wohnungsbrand, Verkehrsunfall)',
    example: 'Wohnungsbrand',
  })
  alarmstichwort!: string;

  @ApiProperty({
    description: 'Einsatz-Status',
    enum: ['ANGELEGT', 'IN_BEARBEITUNG', 'ABGESCHLOSSEN', 'ARCHIVIERT'],
    example: 'IN_BEARBEITUNG',
  })
  status!: EinsatzStatusType;

  @ApiPropertyOptional({
    description: 'Einsatzort (optional)',
    type: AddressDto,
  })
  einsatzort?: AddressDto;

  @ApiPropertyOptional({
    description: 'Freitext-Bemerkung (optional)',
    example: 'Dachstuhl brennt, Personen evakuiert',
  })
  bemerkung?: string;

  @ApiProperty({
    description: 'User-ID des Erstellers (CUID2 Format)',
    example: 'clw3h8x9y0001qwertyuiopas',
  })
  createdBy!: string;

  @ApiProperty({
    description: 'Erstellungszeitpunkt',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt!: Date;

  @ApiPropertyOptional({
    description: 'Abschlusszeitpunkt (nur wenn Status = ABGESCHLOSSEN oder ARCHIVIERT)',
    example: '2024-01-15T14:45:00.000Z',
  })
  abgeschlossenAt?: Date;

  @ApiPropertyOptional({
    description: 'Archivierungszeitpunkt (nur wenn Status = ARCHIVIERT)',
    example: '2034-01-15T10:00:00.000Z',
  })
  archivedAt?: Date;
}
