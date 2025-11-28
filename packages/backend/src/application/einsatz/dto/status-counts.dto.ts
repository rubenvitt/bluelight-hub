import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO fuer die Anzahl der Einsaetze pro Status.
 *
 * Repraesentiert die Verteilung der Einsaetze auf die verschiedenen Status-Werte.
 * Wird verwendet fuer Dashboard-Statistiken und Auslastungsanzeigen.
 */
export class StatusCountsDto {
  @ApiProperty({
    description: 'Anzahl der Einsaetze mit Status ANGELEGT',
    example: 10,
  })
  angelegt!: number;

  @ApiProperty({
    description: 'Anzahl der Einsaetze mit Status IN_BEARBEITUNG',
    example: 5,
  })
  inBearbeitung!: number;

  @ApiProperty({
    description: 'Anzahl der Einsaetze mit Status ABGESCHLOSSEN',
    example: 8,
  })
  abgeschlossen!: number;

  @ApiProperty({
    description: 'Anzahl der Einsaetze mit Status ARCHIVIERT',
    example: 12,
  })
  archiviert!: number;
}

/**
 * Response DTO fuer Einsatz-Status-Statistiken.
 *
 * Enthaelt die Gesamtanzahl aller Einsaetze und die Verteilung auf die einzelnen Status.
 *
 * **Verwendung:**
 * - Dashboard: Anzeige der Einsatzverteilung
 * - Statistiken: Auslastungsmetriken
 * - Monitoring: Systemauslastung tracking
 *
 * @example
 * ```json
 * {
 *   "total": 35,
 *   "counts": {
 *     "angelegt": 10,
 *     "inBearbeitung": 5,
 *     "abgeschlossen": 8,
 *     "archiviert": 12
 *   }
 * }
 * ```
 */
export class StatusCountsResponseDto {
  @ApiProperty({
    description: 'Gesamtanzahl aller Einsaetze',
    example: 35,
  })
  total!: number;

  @ApiProperty({
    description: 'Anzahl der Einsaetze pro Status',
    type: StatusCountsDto,
  })
  counts!: StatusCountsDto;
}
