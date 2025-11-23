import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdatePoiPositionDto {
  @ApiProperty({ description: 'Neue Koordinate (Lat/Lng oder MGRS)', example: { lat: 52.53, lng: 13.41 } })
  @IsObject()
  newCoordinate!: { lat: number; lng: number } | { mgrs: string };
}
