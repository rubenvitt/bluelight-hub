import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/**
 * Basis-DTO für Paginierung in API-Anfragen.
 * Stellt standardisierte Paginierungsparameter bereit.
 */
export class FilterPaginationDto {
  /**
   * Seite für Paginierung (1-basiert)
   */
  @ApiPropertyOptional({
    description: 'Seite für Paginierung (1-basiert)',
    default: 1,
    type: Number,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Seite muss eine ganze Zahl sein' })
  @Min(1, { message: 'Seite muss mindestens 1 sein' })
  page?: number = 1;

  /**
   * Anzahl der Einträge pro Seite
   */
  @ApiPropertyOptional({
    description: 'Anzahl der Einträge pro Seite',
    default: 10,
    type: Number,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit muss eine ganze Zahl sein' })
  @Min(1, { message: 'Limit muss mindestens 1 sein' })
  limit?: number = 10;
}
