import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Coordinate DTO für POI-Positionsangaben.
 *
 * Kapselt sowohl MGRS- als auch Lat/Lng-Koordinaten für Interoperabilität.
 * MGRS ist primäres Format (DRK-Standard), Lat/Lng dient als Fallback für
 * Web-Map-Integration (z.B. Leaflet, Mapbox).
 */
export class CoordinateDto {
  @ApiProperty({
    description: 'MGRS-Koordinate (Military Grid Reference System) - primäres Format',
    example: '32U MV 12345 67890',
  })
  mgrs!: string;

  @ApiProperty({
    description: 'Geografische Breite (WGS84)',
    example: 52.52,
    minimum: -90,
    maximum: 90,
  })
  lat!: number;

  @ApiProperty({
    description: 'Geografische Länge (WGS84)',
    example: 13.405,
    minimum: -180,
    maximum: 180,
  })
  lng!: number;
}

/**
 * Point of Interest (POI) Response DTO für Lagekarten-Queries.
 *
 * Repräsentiert einen einzelnen POI mit Position und Kategorie für
 * die API-Rückgabe. Enthält sowohl MGRS- als auch Lat/Lng-Koordinaten
 * zur Unterstützung verschiedener Kartenrenderer.
 *
 * **Warum beide Koordinatenformate:**
 * - MGRS: DRK-Standard für Funkdurchsagen (kompakt, metrik)
 * - Lat/Lng: Web-Maps-Kompatibilität (Leaflet, Mapbox, Google Maps)
 * - Vermeidet Client-Side Konvertierung (Performance, Fehlerreduktion)
 *
 * **Unterschied zu Domain Entity:**
 * - Domain speichert NUR MGRS (Single Source of Truth)
 * - DTO projiziert BEIDE Formate für API-Consumer
 * - Mapper konvertiert MGRS → Lat/Lng on-the-fly
 */
export class PoiDto {
  @ApiProperty({
    description: 'Eindeutige POI-ID (CUID)',
    example: 'clw3h8x9y0000qwertyuiopas',
  })
  id!: string;

  @ApiProperty({
    description: 'Name/Label des POI für UI-Darstellung',
    example: 'Brandenburger Tor',
  })
  name!: string;

  @ApiProperty({
    description: 'Position des POI mit MGRS und Lat/Lng',
    type: CoordinateDto,
  })
  coordinate!: CoordinateDto;

  @ApiProperty({
    description: 'Kategorie des POI für Filterung und Farb-Codierung',
    example: 'EINSATZSTELLE',
    enum: ['EINSATZSTELLE', 'BEREITSTELLUNGSRAUM', 'GEFAHRENSTELLE', 'WASSERENTNAHMESTELLE', 'SONSTIGES'],
  })
  category!: string;

  @ApiPropertyOptional({
    description: 'Optionale Beschreibung mit zusätzlichen Informationen',
    example: 'Haupteinsatzort - Rauchentwicklung im 2. OG',
    nullable: true,
  })
  beschreibung?: string;
}
