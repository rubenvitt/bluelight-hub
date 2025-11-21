import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, ValidateNested, MinLength, MaxLength, IsEnum, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

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
  @ApiProperty({ description: 'Einsatz-ID', example: 'e-123' })
  @IsString()
  @IsNotEmpty()
  einsatzId!: string;

  @ApiPropertyOptional({ description: 'Initialer POI (optional)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => InitialPoiDto)
  initialPoi?: InitialPoiDto;
}
