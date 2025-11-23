import { ApiProperty } from '@nestjs/swagger';

/**
 * ETB Version DTO für Versionsverfolgung.
 *
 * Repräsentiert den Versionierungszustand eines ETB-Aggregates.
 * Ermöglicht Optimistic Locking und Konflikt-Detection bei
 * konkurrierenden Edits.
 *
 * **Warum separates DTO:**
 * - Konsistente Versionierung über alle ETB-Responses
 * - Basis für Client-Side Conflict Detection
 * - Ermöglicht Polling-basierte Synchronisation ohne WebSocket
 *
 * **Verwendung:**
 * - Bei Updates muss Client versionNumber mitschicken
 * - Server prüft Version vor Mutation (Optimistic Locking)
 * - Bei Version-Mismatch → 409 Conflict Response
 */
export class EtbVersionDto {
  @ApiProperty({
    description: 'Versionsnummer (monoton steigend)',
    example: 1,
    minimum: 1,
  })
  versionNumber!: number;

  @ApiProperty({
    description: 'Zeitstempel der letzten Version',
    example: '2024-01-15T12:00:00.000Z',
    type: 'string',
    format: 'date-time',
  })
  timestamp!: Date;
}
