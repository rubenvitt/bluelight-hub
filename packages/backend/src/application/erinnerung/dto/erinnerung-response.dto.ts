import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO für Erinnerung API Responses.
 *
 * Wird verwendet für:
 * - POST /erinnerung (Create Response)
 * - GET /erinnerung/:id (Single Resource)
 * - GET /erinnerung (List Item)
 *
 * **Status Enum:**
 * - GEPLANT: Initial, wartet auf Fälligkeit
 * - AUSGELOEST: Alarm wurde ausgelöst
 * - ACKNOWLEDGED: User hat bestätigt
 * - SNOOZED: Temporär verschoben
 * - ESKALIERT: Zur Eskalation weitergeleitet
 * - ERLEDIGT: Abgeschlossen
 *
 * @example
 * ```json
 * {
 *   "id": "clw3h8x9y0000qwertyuiopas",
 *   "einsatzId": "clw3h8x9y0001abcdefghijkl",
 *   "titel": "Lagebesprechung",
 *   "beschreibung": "Im ELW 1",
 *   "faelligAm": "2026-01-19T15:30:00.000Z",
 *   "status": "GEPLANT",
 *   "erstelltVon": "clw3h8x9y0002mnopqrstuvwx",
 *   "createdAt": "2026-01-19T15:00:00.000Z",
 *   "updatedAt": "2026-01-19T15:00:00.000Z"
 * }
 * ```
 */
export class ErinnerungResponseDto {
  @ApiProperty({
    description: 'Eindeutige ID der Erinnerung (CUID2)',
    example: 'clw3h8x9y0000qwertyuiopas',
  })
  id!: string;

  @ApiProperty({
    description: 'ID des zugehörigen Einsatzes',
    example: 'clw3h8x9y0001abcdefghijkl',
  })
  einsatzId!: string;

  @ApiProperty({
    description: 'Titel der Erinnerung',
    example: 'Lagebesprechung',
  })
  titel!: string;

  @ApiProperty({
    description: 'Optionale Beschreibung',
    example: 'Im ELW 1 mit Einsatzleitung',
    nullable: true,
  })
  beschreibung!: string | null;

  @ApiProperty({
    description: 'Fälligkeitszeitpunkt (ISO-8601)',
    example: '2026-01-19T15:30:00.000Z',
  })
  faelligAm!: string;

  @ApiProperty({
    description: 'Aktueller Status der Erinnerung',
    example: 'GEPLANT',
    enum: ['GEPLANT', 'AUSGELOEST', 'ACKNOWLEDGED', 'SNOOZED', 'ESKALIERT', 'ERLEDIGT'],
  })
  status!: string;

  @ApiProperty({
    description: 'User-ID des Erstellers',
    example: 'clw3h8x9y0002mnopqrstuvwx',
  })
  erstelltVon!: string;

  @ApiProperty({
    description: 'Erstellungszeitpunkt (ISO-8601)',
    example: '2026-01-19T15:00:00.000Z',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Letztes Update (ISO-8601)',
    example: '2026-01-19T15:00:00.000Z',
  })
  updatedAt!: string;

  @ApiProperty({
    description: 'Anzahl der bisherigen Snooze-Vorgaenge (Story 2.2 AC2)',
    example: 0,
    minimum: 0,
  })
  snoozeCount!: number;

  @ApiProperty({
    description: 'Zeitpunkt der Erledigung (ISO-8601) (Story 2.5)',
    example: '2026-01-19T16:00:00.000Z',
    nullable: true,
    required: false,
  })
  erledigtAm?: string | null;

  @ApiProperty({
    description: 'User-ID der Person die erledigt hat (Story 2.5)',
    example: 'clw3h8x9y0003yzabcdefghij',
    nullable: true,
    required: false,
  })
  erledigtBy?: string | null;

  @ApiProperty({
    description: 'Optionale Notiz zur Erledigung (max 500 Zeichen) (Story 2.5)',
    example: 'Aufgabe erfolgreich abgeschlossen',
    nullable: true,
    required: false,
    maxLength: 500,
  })
  erledigungsNotiz?: string | null;

  @ApiProperty({
    description: 'Pflicht-Notiz bei Erledigung erforderlich (Story 2.6)',
    example: false,
  })
  requiresNote!: boolean;
}
