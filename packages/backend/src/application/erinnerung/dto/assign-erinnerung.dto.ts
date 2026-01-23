import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Request DTO zum Zuweisen einer bestehenden Erinnerung an einen anderen Benutzer.
 *
 * **Story 3.4 AC1:**
 * - Bestehende Erinnerung nachträglich zuweisen
 * - Teilnehmer aus aktiven Einsatz-Teilnehmern auswählen
 *
 * @example
 * ```json
 * {
 *   "assignedToId": "clw3h8x9y0003user2xxxxxx"
 * }
 * ```
 */
export class AssignErinnerungDto {
  /**
   * ID des Benutzers, dem die Erinnerung zugewiesen werden soll.
   * Muss ein aktiver Einsatz-Teilnehmer sein.
   *
   * @example "clw3h8x9y0003user2xxxxxx"
   */
  @ApiProperty({
    description: 'ID des Benutzers, dem die Erinnerung zugewiesen wird. Muss aktiver Einsatz-Teilnehmer sein.',
    example: 'clw3h8x9y0003user2xxxxxx',
  })
  @IsNotEmpty({ message: 'assignedToId ist erforderlich' })
  @IsString({ message: 'assignedToId muss ein String sein' })
  assignedToId!: string;
}
