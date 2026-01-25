import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Request DTO zum Aktualisieren einer bestehenden Erinnerung.
 *
 * Alle Felder sind optional - mindestens eines muss aber in der Anfrage
 * vorhanden sein (wird im Command validiert).
 *
 * **Story 1.3 AC1, AC2:**
 * - Titel bearbeiten
 * - Fälligkeit ändern (Timer wird neu berechnet)
 * - Beschreibung aktualisieren
 *
 * **AC4 - Validierung:**
 * - Titel: Falls gesetzt, nicht leer und max 100 Zeichen
 * - FaelligAm: Falls gesetzt, muss gültiges ISO-8601 Datum sein
 * - Beschreibung: Falls gesetzt, max 500 Zeichen
 *
 * @example
 * ```json
 * {
 *   "titel": "Aktualisierte Lagebesprechung",
 *   "faelligAm": "2026-01-19T16:00:00.000Z"
 * }
 * ```
 */
export class UpdateErinnerungDto {
  /**
   * Neuer Titel der Erinnerung.
   * Optional - wird nur aktualisiert wenn vorhanden.
   * Darf nicht leer sein, maximal 100 Zeichen.
   *
   * @example "Aktualisierte Lagebesprechung"
   */
  @ApiProperty({
    description: 'Neuer Titel der Erinnerung (optional, wenn gesetzt: nicht leer, max 100 Zeichen)',
    example: 'Aktualisierte Lagebesprechung',
    required: false,
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'Titel muss ein String sein' })
  @MinLength(1, { message: 'Titel darf nicht leer sein' })
  @MaxLength(100, { message: 'Titel darf maximal 100 Zeichen lang sein' })
  titel?: string;

  /**
   * Neuer Fälligkeitszeitpunkt der Erinnerung (ISO-8601 Format).
   * Optional - wird nur aktualisiert wenn vorhanden.
   * Muss in der Zukunft liegen (wird im Command validiert).
   *
   * **Timer-Neuberechnung:**
   * Bei Änderung wird der Countdown automatisch neu berechnet.
   *
   * @example "2026-01-19T16:00:00.000Z"
   */
  @ApiProperty({
    description: 'Neuer Fälligkeitszeitpunkt (ISO-8601). Muss in der Zukunft liegen.',
    example: '2026-01-19T16:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'faelligAm muss ein gültiges ISO-8601 Datum sein' })
  faelligAm?: string;

  /**
   * Neue Beschreibung der Erinnerung.
   * Optional - wird nur aktualisiert wenn vorhanden.
   * Kann auf null gesetzt werden um die Beschreibung zu entfernen.
   * Maximal 500 Zeichen.
   *
   * @example "Im ELW 2 mit Einsatzleitung und Abschnittsleiter"
   */
  @ApiProperty({
    description: 'Neue Beschreibung (optional, max 500 Zeichen). null um zu löschen.',
    example: 'Im ELW 2 mit Einsatzleitung und Abschnittsleiter',
    type: String,
    required: false,
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: 'Beschreibung muss ein String sein' })
  @MaxLength(500, { message: 'Beschreibung darf maximal 500 Zeichen lang sein' })
  beschreibung?: string | null;

  /**
   * Neue Eskalationsperson.
   * Optional - wird nur aktualisiert wenn vorhanden.
   * Kann auf null gesetzt werden um die Eskalationsperson zu entfernen.
   *
   * @example "clw3h8x9y0005znopqrstuvw"
   */
  @ApiProperty({
    description: 'Neue Eskalationsperson (Story 4.1). null um zu löschen.',
    example: 'clw3h8x9y0005znopqrstuvw',
    type: String,
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: 'eskalationsPersonId muss ein String sein' })
  eskalationsPersonId?: string | null;
}
