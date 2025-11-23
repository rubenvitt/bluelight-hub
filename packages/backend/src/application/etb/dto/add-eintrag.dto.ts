import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * DTO für AddEintrag-Request.
 *
 * Wird vom Controller verwendet um eingehende API-Requests zu validieren.
 * Die ETB-ID und User-ID werden aus Route-Parametern bzw. Auth-Context extrahiert.
 *
 * @example
 * ```json
 * {
 *   "text": "Fahrzeug W1 am Einsatzort eingetroffen"
 * }
 * ```
 */
export class AddEintragDto {
  /**
   * Textinhalt des neuen Eintrags.
   *
   * Darf nicht leer sein. Beschreibt eine Aktion, ein Ereignis oder
   * eine Beobachtung im Einsatzverlauf.
   */
  @ApiProperty({
    description: 'Textinhalt des Eintrags',
    example: 'Fahrzeug W1 am Einsatzort eingetroffen',
    minLength: 1,
    maxLength: 65535,
  })
  @IsString({ message: 'text muss ein String sein' })
  @MinLength(1, { message: 'text darf nicht leer sein' })
  @MaxLength(65535, { message: 'Text darf maximal 65535 Zeichen lang sein' })
  text!: string;
}
