import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { IsCuid } from '@/common/decorators/is-cuid.decorator';

/**
 * DTO für CreateEtb-Request.
 *
 * Wird vom Controller verwendet um eingehende API-Requests zu validieren.
 * Verwendet Prisma-CUID-Format (25 Zeichen, beginnt mit 'c') da EinsatzIds
 * von Prisma generiert werden.
 *
 * @example
 * ```json
 * {
 *   "einsatzId": "clw3h8x9y0000qwertyuiopas"
 * }
 * ```
 */
export class CreateEtbDto {
  /**
   * ID des Einsatzes, für den das ETB erstellt werden soll.
   *
   * Muss eine gültige Prisma-CUID sein (25 Zeichen, beginnt mit 'c').
   * Das ETB wird mit dem Einsatz verknüpft (1:1 Beziehung).
   */
  @ApiProperty({
    description: 'ID des Einsatzes (Prisma-CUID, 25 Zeichen)',
    example: 'clw3h8x9y0000qwertyuiopas',
    minLength: 25,
    maxLength: 25,
  })
  @IsNotEmpty({ message: 'einsatzId ist erforderlich' })
  @IsCuid({ message: 'einsatzId muss eine gültige CUID sein' })
  einsatzId!: string;
}
