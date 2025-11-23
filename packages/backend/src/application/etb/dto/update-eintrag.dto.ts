import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * DTO für UpdateEintrag-Request.
 *
 * Wird vom Controller verwendet um eingehende API-Requests zu validieren.
 * Die ETB-ID, Eintrag-ID und User-ID werden aus Route-Parametern bzw. Auth-Context extrahiert.
 *
 * @example
 * ```json
 * {
 *   "newText": "Fahrzeug W1 um 14:35 Uhr am Einsatzort eingetroffen (korrigiert)"
 * }
 * ```
 */
export class UpdateEintragDto {
  /**
   * Neuer Textinhalt für den Eintrag.
   *
   * Ersetzt den bestehenden Text vollständig. Der alte Text wird
   * automatisch in einem Snapshot gespeichert (DRK-Compliance).
   */
  @ApiProperty({
    description: 'Neuer Textinhalt des Eintrags',
    example: 'Fahrzeug W1 um 14:35 Uhr am Einsatzort eingetroffen (korrigiert)',
    minLength: 1,
    maxLength: 65535,
  })
  @IsString({ message: 'newText muss ein String sein' })
  @IsNotEmpty({ message: 'newText darf nicht leer sein' })
  @MinLength(1, { message: 'newText darf nicht leer sein' })
  @MaxLength(65535, { message: 'newText darf maximal 65535 Zeichen lang sein' })
  newText!: string;
}
