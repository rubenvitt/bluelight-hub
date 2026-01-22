import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Request DTO zum Erstellen einer neuen Erinnerung (Quick-Create).
 *
 * Validiert die Eingabedaten für die Erinnerung-Erstellung.
 * Die eigentliche Business-Validierung erfolgt im CreateErinnerungCommand.
 *
 * **Story 1.1 AC2:**
 * - Titel eingeben
 * - Zeit-Preset wählen (Frontend berechnet faelligAm)
 * - Speichern mit Enter
 *
 * @example
 * ```json
 * {
 *   "titel": "Lagebesprechung",
 *   "faelligAm": "2026-01-19T15:30:00.000Z",
 *   "beschreibung": "Im ELW 1"
 * }
 * ```
 */
export class CreateErinnerungDto {
  /**
   * Titel der Erinnerung.
   * Erforderlich, maximal 100 Zeichen.
   *
   * @example "Lagebesprechung"
   */
  @ApiProperty({
    description: 'Titel der Erinnerung (erforderlich, max 100 Zeichen)',
    example: 'Lagebesprechung',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Titel ist erforderlich' })
  @IsString({ message: 'Titel muss ein String sein' })
  @MaxLength(100, { message: 'Titel darf maximal 100 Zeichen lang sein' })
  titel!: string;

  /**
   * Fälligkeitszeitpunkt der Erinnerung (ISO-8601 Format).
   * Muss in der Zukunft liegen.
   *
   * **Frontend Berechnung:**
   * ```typescript
   * const faelligAm = addMinutes(new Date(), selectedPreset);
   * // selectedPreset: 5, 10, 15, 30, 60 Minuten
   * ```
   *
   * @example "2026-01-19T15:30:00.000Z"
   */
  @ApiProperty({
    description: 'Fälligkeitszeitpunkt der Erinnerung (ISO-8601). Muss in der Zukunft liegen.',
    example: '2026-01-19T15:30:00.000Z',
  })
  @IsNotEmpty({ message: 'Fälligkeitszeitpunkt ist erforderlich' })
  @IsDateString({}, { message: 'faelligAm muss ein gültiges ISO-8601 Datum sein' })
  faelligAm!: string;

  /**
   * Optionale Beschreibung der Erinnerung.
   * Maximal 500 Zeichen.
   *
   * @example "Im ELW 1 mit Einsatzleitung"
   */
  @ApiProperty({
    description: 'Optionale Beschreibung (max 500 Zeichen)',
    example: 'Im ELW 1 mit Einsatzleitung',
    type: String,
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'Beschreibung muss ein String sein' })
  @MaxLength(500, { message: 'Beschreibung darf maximal 500 Zeichen lang sein' })
  beschreibung?: string;

  /**
   * Story 2.6: Pflicht-Notiz bei Erledigung erforderlich.
   * Wenn true, muss bei Erledigung eine Notiz eingegeben werden.
   *
   * @default false
   * @example false
   */
  @ApiProperty({
    description: 'Pflicht-Notiz bei Erledigung erforderlich (Story 2.6)',
    example: false,
    required: false,
    default: false, // Sync mit Erinnerung.DEFAULT_REQUIRES_NOTE
  })
  @IsOptional()
  @IsBoolean({ message: 'requiresNote muss ein Boolean sein' })
  requiresNote?: boolean;
}
