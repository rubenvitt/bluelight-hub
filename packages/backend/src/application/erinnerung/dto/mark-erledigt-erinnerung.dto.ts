import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO für den Request Body beim Erledigen einer Erinnerung.
 *
 * **Story 2.5:** Erinnerung als erledigt markieren
 * - Optionale Notiz zur Dokumentation der Erledigung
 * - Maximal 500 Zeichen
 *
 * @example
 * ```json
 * {
 *   "erledigungsNotiz": "Aufgabe erfolgreich abgeschlossen"
 * }
 * ```
 */
export class MarkErledigtErinnerungDto {
  @ApiProperty({
    description: 'Optionale Notiz zur Erledigung (max 500 Zeichen)',
    example: 'Aufgabe erfolgreich abgeschlossen',
    required: false,
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Erledigungs-Notiz darf maximal 500 Zeichen haben' })
  erledigungsNotiz?: string;
}
