import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { ApiWrappedResponse } from '@/modules/common/decorators/api-wrapped-response.decorator';
import { Body, Controller, Logger, Param, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiForbiddenResponse, ApiOperation, ApiProperty, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString } from 'class-validator';
import { GeocodingService } from '../services/geocoding.service';

/**
 * DTO für Geocoding-Request
 */
class GeocodeAddressDto {
  @ApiProperty({
    description: 'Adresse die geocoded werden soll',
    example: 'Hauptstraße 1, 10115 Berlin',
  })
  @IsString()
  address!: string;
}

/**
 * Controller für Geocoding-Funktionalität
 *
 * **Verwendung:**
 * - Frontend kann Adressen geocoden BEVOR POI erstellt wird
 * - Rate-Limited auf 1 Request/Sekunde (Nominatim Policy)
 *
 * **Route Structure:**
 * - Base: `/einsatz/:einsatzId`
 * - Geocoding: `POST /geocode`
 *
 * @security Alle Endpunkte erfordern valides JWT Token
 */
@ApiTags('Geocoding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Nicht authentifiziert - JWT Token fehlt oder ungültig' })
@ApiForbiddenResponse({ description: 'Keine Berechtigung für diese Aktion' })
@Controller({
  path: 'einsatz/:einsatzId',
  version: 'alpha',
})
export class GeocodingController {
  private readonly logger = new Logger(GeocodingController.name);

  constructor(private readonly geocodingService: GeocodingService) {}

  /**
   * Geocode eine Adresse zu Koordinaten
   *
   * **Rate-Limiting (Controller-Level):**
   * - Max. 10 Requests/Minute pro User (verhindert API-Missbrauch)
   * - Bei Überschreitung: 429 Too Many Requests
   * - Zusätzlich: Service-Level Throttling (1 req/s für Nominatim)
   *
   * **Fallback:**
   * - Wenn Geocoding fehlschlägt: Gibt `null` zurück
   * - Frontend muss dann manuelle Koordinaten-Eingabe anbieten
   *
   * @param einsatzId - ID des Einsatzes (für Kontext/Logging)
   * @param dto - GeocodeAddressDto mit Adresse
   * @returns Koordinaten {lat, lon} oder null bei Fehler
   */
  @Post('geocode')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @ApiOperation({
    summary: 'Geocode address to coordinates',
    description: 'Konvertiert eine Adresse in geografische Koordinaten via Nominatim API. Controller-Rate-Limit: 10 req/min. Gibt null zurück bei Fehler.',
  })
  @ApiWrappedResponse(Object, {
    description: 'Geocoding erfolgreich oder null bei Fehler',
  })
  @ApiBadRequestResponse({ description: 'Ungültige Adresse' })
  @ApiTooManyRequestsResponse({ description: 'Rate-Limit überschritten: Max. 10 Requests pro Minute' })
  async geocodeAddress(
    @Param('einsatzId') einsatzId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: GeocodeAddressDto,
  ): Promise<{ lat: number; lon: number } | null> {
    this.logger.log(`Geocoding address for Einsatz ${einsatzId}: "${dto.address}"`);

    const result = await this.geocodingService.geocodeAddress(dto.address);

    if (result) {
      this.logger.log(`Geocoding successful: ${dto.address} → (${result.lat}, ${result.lon})`);
    } else {
      this.logger.warn(`Geocoding failed for address: ${dto.address}`);
    }

    return result;
  }
}
