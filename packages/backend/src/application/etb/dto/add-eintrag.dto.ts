import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EtbKategorie } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

  /**
   * Kategorie des ETB-Eintrags.
   *
   * Optional mit Default LAGE. Ermöglicht Kategorisierung von Einträgen
   * für bessere Filterung und Übersichtlichkeit im Einsatztagebuch.
   */
  @ApiPropertyOptional({
    description: 'Kategorie des ETB-Eintrags',
    enum: EtbKategorie,
    default: EtbKategorie.LAGE,
    example: EtbKategorie.LAGE,
  })
  @IsOptional()
  @IsEnum(EtbKategorie, { message: 'kategorie muss ein gültiger EtbKategorie-Wert sein' })
  kategorie?: EtbKategorie;

  /**
   * Einsatz-ID fuer automatische ETB-Erstellung, falls noch kein ETB existiert.
   * Optional, weil bestehende ETBs weiterhin nur die etbId benötigen.
   */
  @ApiPropertyOptional({
    description: 'Aktive Einsatz-ID (wird genutzt um bei Bedarf ein ETB zu erstellen)',
    example: 'clx1234567890abcdefghijk',
  })
  @IsOptional()
  @IsString({ message: 'einsatzId muss ein String sein' })
  einsatzId?: string;
}
