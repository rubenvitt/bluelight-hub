import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsObject, IsEnum, IsOptional } from 'class-validator';

export class AddPoiDto {
  @ApiProperty({ description: 'POI-Name', example: 'Wasserentnahme Teich' })
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

  @ApiPropertyOptional({ description: 'Zusätzliche Beschreibung (optional)', example: 'Zugang über Feldweg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  beschreibung?: string;
}
