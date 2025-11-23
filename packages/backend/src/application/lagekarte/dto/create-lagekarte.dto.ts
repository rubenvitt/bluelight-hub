import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, ValidateNested, MinLength, MaxLength, IsEnum, IsObject, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { IsCuid } from '@/common/decorators/is-cuid.decorator';

export class InitialPoiDto {
  @ApiProperty({ description: 'POI-Name', example: 'Einsatzstelle' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Koordinate als Lat/Lng oder MGRS', example: { lat: 52.52, lng: 13.4 } })
  @IsObject()
  coordinate!: { lat: number; lng: number } | { mgrs: string };

  @ApiProperty({
    description: 'POI-Kategorie (DRK-Standard)',
    enum: ['EINSATZSTELLE', 'BEREITSTELLUNGSRAUM', 'GEFAHRENSTELLE', 'WASSERENTNAHMESTELLE', 'SONSTIGES'],
  })
  @IsEnum(['EINSATZSTELLE', 'BEREITSTELLUNGSRAUM', 'GEFAHRENSTELLE', 'WASSERENTNAHMESTELLE', 'SONSTIGES'])
  category!: string;
}

export class CreateLagekarteDto {
  @ApiProperty({ description: 'Einsatz-ID (CUID)', example: 'clw3h8x9y0000qwertyuiopas' })
  @IsCuid()
  @IsNotEmpty()
  einsatzId!: string;

  @ApiPropertyOptional({ description: 'Initialer POI (optional)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => InitialPoiDto)
  initialPoi?: InitialPoiDto;
}
