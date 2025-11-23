import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { IsCuid } from '@/common/decorators/is-cuid.decorator';

/**
 * DTO zum Erstellen eines neuen ETB für einen Einsatz.
 */
export class CreateEtbDto {
  @ApiProperty({
    description: 'ID des Einsatzes, für den das ETB erstellt werden soll (CUID)',
    example: 'clw3h8x9y0000qwertyuiopas',
  })
  @IsCuid({ message: 'einsatzId muss eine gültige CUID sein' })
  @IsNotEmpty({ message: 'einsatzId darf nicht leer sein' })
  einsatzId!: string;
}
