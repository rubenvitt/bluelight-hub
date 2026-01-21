import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

/**
 * Request DTO zum Snoozen einer ausgelösten Erinnerung.
 *
 * Validiert die Eingabedaten für die Snooze-Operation.
 * Die eigentliche Business-Validierung (Status = AUSGELOEST) erfolgt im Handler.
 *
 * **Story 2.1 AC1:**
 * - Preset-Zeiten: 1 Min, 5 Min, 10 Min
 * - Escape-Taste aktiviert Standard-Snooze (5 Min) - Frontend-Logik
 *
 * @example
 * ```json
 * {
 *   "snoozeMinutes": 5
 * }
 * ```
 */
export class SnoozeErinnerungDto {
  /**
   * Snooze-Dauer in Minuten.
   * Muss einer der Preset-Werte sein: 1, 5, oder 10.
   *
   * @example 5
   */
  @ApiProperty({
    description: 'Snooze-Dauer in Minuten (Preset-Werte: 1, 5, 10)',
    example: 5,
    enum: [1, 5, 10],
  })
  @IsInt({ message: 'snoozeMinutes muss eine Ganzzahl sein' })
  @IsIn([1, 5, 10], { message: 'snoozeMinutes muss 1, 5 oder 10 sein' })
  snoozeMinutes!: 1 | 5 | 10;
}
