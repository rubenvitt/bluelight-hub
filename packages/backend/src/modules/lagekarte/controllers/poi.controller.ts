import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import type { ValidatedUser } from '@/auth/strategies/jwt.strategy';
import { ApiWrappedResponse } from '@/common/decorators/api-wrapped-response.decorator';
import { Body, Controller, Delete, Get, Logger, Param, Post, Put, UseGuards, ValidationPipe, BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiExtraModels, ApiForbiddenResponse, ApiNotFoundResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CreatePoiDto } from '../dto/create-poi.dto';
import { UpdatePoiDto } from '../dto/update-poi.dto';
import { PoiResponseDto } from '../dto/poi-response.dto';
import { LagekartePoi, Prisma } from '@prisma/client';
import { PoiRepository } from '../repositories/poi.repository';
import { LagekarteRepository } from '../repositories/lagekarte.repository';
import { GeocodingService } from '../services/geocoding.service';
import { MgrsConverterService } from '../services/mgrs-converter.service';

/**
 * Controller für POI-Management (Points of Interest) - DEPRECATED
 *
 * **DEPRECATED (Migration Story 5-1):**
 * - Alle Endpoints sind als DEPRECATED markiert
 * - Verwende stattdessen die CQRS-Endpoints unter `/lagekarte/:id/pois`
 * - Dieser Controller wird in einer zukünftigen Version entfernt
 *
 * **Migration Path:**
 * - GET /einsatz/:einsatzId/lagekarte/pois → GET /lagekarte/:lagekarteId/pois
 * - POST /einsatz/:einsatzId/lagekarte/pois → POST /lagekarte/:lagekarteId/poi
 * - GET /einsatz/:einsatzId/lagekarte/pois/:poiId → GET /lagekarte/:lagekarteId/poi/:poiId (über CQRS Query)
 * - PUT /einsatz/:einsatzId/lagekarte/pois/:poiId → PUT /lagekarte/:lagekarteId/poi/:poiId
 * - DELETE /einsatz/:einsatzId/lagekarte/pois/:poiId → DELETE /lagekarte/:lagekarteId/poi/:poiId
 *
 * **Warum DEPRECATED:**
 * - Alte Repositories (LagekarteRepository, PoiRepository) werden entfernt
 * - CQRS-Endpoints bieten bessere Architektur (CommandBus/QueryBus)
 * - Neue Endpoints nutzen ILagekarteRepository (Hexagonal Architecture)
 *
 * **POI-Typen:**
 * - EINSATZORT, EINSATZABSCHNITT, EINSATZLEITUNG
 * - FAHRZEUG, EINHEIT
 * - GEFAHRENQUELLE, SPERRBEREICH, VERSORGUNGSPUNKT
 * - BEREITSTELLUNGSRAUM, BEHANDLUNGSPLATZ, SAMMELSTELLE
 * - UNTERKUNFT, SONSTIGES
 *
 * **Route Structure:**
 * - Base: `/einsatz/:einsatzId/lagekarte/pois` (DEPRECATED)
 * - Alle Routes sind JWT-geschützt via `JwtAuthGuard`
 *
 * @security Alle Endpunkte erfordern valides JWT Token
 * @deprecated Verwende CQRS-Endpoints unter `/lagekarte/:id/pois`
 */
@ApiTags('POI (DEPRECATED)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Nicht authentifiziert - JWT Token fehlt oder ungültig' })
@ApiForbiddenResponse({ description: 'Keine Berechtigung für diese Aktion' })
@ApiExtraModels(PoiResponseDto)
@Controller({
  path: 'einsatz/:einsatzId/lagekarte/pois',
  version: 'alpha',
})
export class PoiController {
  private readonly logger = new Logger(PoiController.name);

  constructor(
    private readonly poiRepository: PoiRepository,
    private readonly lagekarteRepository: LagekarteRepository,
    private readonly geocodingService: GeocodingService,
    private readonly mgrsConverter: MgrsConverterService,
  ) {}

  /**
   * Alle POIs einer Lagekarte abrufen - DEPRECATED
   *
   * @param einsatzId - ID des Einsatzes
   * @returns Array aller POIs der Lagekarte
   * @deprecated Verwende GET /lagekarte/:lagekarteId/pois (CQRS Query)
   */
  @Get()
  @ApiOperation({
    summary: 'POIs abrufen (DEPRECATED)',
    description: 'DEPRECATED: Verwende GET /lagekarte/:lagekarteId/pois. Gibt alle POIs einer Lagekarte zurück.',
    deprecated: true,
  })
  @ApiWrappedResponse(PoiResponseDto, { description: 'POIs erfolgreich abgerufen', isArray: true })
  @ApiNotFoundResponse({ description: 'Einsatz nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Ungültige Einsatz-ID' })
  async getPois(@Param('einsatzId') einsatzId: string): Promise<LagekartePoi[]> {
    this.logger.log(`Getting POIs for Einsatz ${einsatzId}`);

    // Get existing lagekarte (no lazy creation - use CQRS CreateLagekarteCommand for creation)
    const lagekarte = await this.lagekarteRepository.findByEinsatzId(einsatzId);
    if (!lagekarte) {
      this.logger.warn(`No Lagekarte exists for Einsatz ${einsatzId}`);
      throw new NotFoundException(`Lagekarte for Einsatz ${einsatzId} not found. Use POST /lagekarte to create one first.`);
    }

    const pois = await this.poiRepository.findByLagekarteId(lagekarte.id);
    this.logger.log(`Returning ${pois.length} POIs for Einsatz ${einsatzId}`);
    return pois;
  }

  /**
   * POI erstellen - DEPRECATED
   *
   * **Geocoding:**
   * - Wenn `adresse` angegeben: Nominatim API wird aufgerufen
   * - Wenn Geocoding fehlschlägt: Fallback zu manuellen Koordinaten
   *
   * @param dto - CreatePoiDto mit POI-Daten
   * @param user - Authentifizierter User
   * @returns Erstellter POI
   * @deprecated Verwende POST /lagekarte/:lagekarteId/poi (CQRS Command)
   */
  @Post()
  @ApiOperation({
    summary: 'POI erstellen (DEPRECATED)',
    description: 'DEPRECATED: Verwende POST /lagekarte/:lagekarteId/poi. Erstellt einen neuen POI mit automatischem Geocoding.',
    deprecated: true,
  })
  @ApiWrappedResponse(PoiResponseDto, { description: 'POI erfolgreich erstellt' })
  @ApiNotFoundResponse({ description: 'Lagekarte nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler in den Eingabedaten' })
  async createPoi(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreatePoiDto,
    @CurrentUser() user: ValidatedUser,
  ): Promise<LagekartePoi> {
    this.logger.log(`Creating POI (type: ${dto.type}) by user ${user.userId}`);

    // Resolve coordinates (priority: MGRS > Lat/Lng > Address geocoding)
    const { mgrs, latitude, longitude } = await this.resolveCoordinates(dto);

    // Create POI with both MGRS and Lat/Lng coordinates
    const poiData: Prisma.LagekartePoiCreateInput = {
      lagekarte: { connect: { id: dto.lagekarteId } },
      type: dto.type,
      name: dto.name ?? null,
      adresse: dto.adresse ?? null,
      mgrs,
      latitude,
      longitude,
      icon: dto.icon ?? null,
      metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : Prisma.DbNull,
    };

    const poi = await this.poiRepository.create(poiData);
    this.logger.log(`POI ${poi.id} created with MGRS: ${mgrs}, Lat/Lng: (${latitude}, ${longitude})`);
    return poi;
  }

  /**
   * Resolves coordinates from DTO using priority: MGRS > Lat/Lng > Address
   */
  private async resolveCoordinates(dto: CreatePoiDto | (UpdatePoiDto & { latitude?: number; longitude?: number })): Promise<{ mgrs: string | null; latitude: number; longitude: number }> {
    // Priority 1: MGRS provided (PRIMARY FORMAT)
    if ('mgrs' in dto && dto.mgrs) {
      this.logger.log(`Using MGRS coordinates (PRIMARY): ${dto.mgrs}`);
      try {
        const coords = this.mgrsConverter.mgrsToLatLng(dto.mgrs);
        return { mgrs: dto.mgrs, latitude: coords.latitude, longitude: coords.longitude };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new BadRequestException(`MGRS Konvertierung fehlgeschlagen: ${errorMessage}`);
      }
    }

    // Priority 2: Lat/Lng provided
    if ('latitude' in dto && dto.latitude !== undefined && 'longitude' in dto && dto.longitude !== undefined) {
      this.logger.log(`Using Lat/Lng coordinates: (${dto.latitude}, ${dto.longitude})`);
      try {
        const mgrs = this.mgrsConverter.latLngToMgrs(dto.latitude, dto.longitude, 5);
        return { mgrs, latitude: dto.latitude, longitude: dto.longitude };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new BadRequestException(`MGRS Konvertierung fehlgeschlagen: ${errorMessage}`);
      }
    }

    // Priority 3: Address geocoding
    if (dto.adresse) {
      this.logger.log(`Geocoding address: ${dto.adresse}`);
      const coords = await this.geocodingService.geocodeAddress(dto.adresse);
      if (!coords) {
        throw new BadRequestException(`Adresse konnte nicht geocoded werden: "${dto.adresse}". Bitte geben Sie MGRS oder Lat/Lng Koordinaten an.`);
      }
      try {
        const mgrs = this.mgrsConverter.latLngToMgrs(coords.lat, coords.lon, 5);
        return { mgrs, latitude: coords.lat, longitude: coords.lon };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new BadRequestException(`MGRS Konvertierung nach Geocoding fehlgeschlagen: ${errorMessage}`);
      }
    }

    throw new BadRequestException('Entweder mgrs, latitude+longitude oder adresse erforderlich');
  }

  /**
   * Einzelnen POI abrufen - DEPRECATED
   *
   * @param poiId - ID des POI
   * @returns POI-Daten
   * @deprecated Verwende GET /lagekarte/:lagekarteId/pois mit Filter (CQRS Query)
   */
  @Get(':poiId')
  @ApiOperation({
    summary: 'POI abrufen (DEPRECATED)',
    description: 'DEPRECATED: Verwende GET /lagekarte/:lagekarteId/pois mit Filter. Gibt einen einzelnen POI zurück.',
    deprecated: true,
  })
  @ApiWrappedResponse(PoiResponseDto, { description: 'POI gefunden' })
  @ApiNotFoundResponse({ description: 'POI nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Ungültige POI-ID' })
  async getPoi(@Param('poiId') poiId: string): Promise<LagekartePoi> {
    this.logger.log(`Getting POI ${poiId}`);
    const poi = await this.poiRepository.findById(poiId);
    if (!poi) {
      throw new NotFoundException(`POI with ID ${poiId} not found`);
    }
    this.logger.log(`POI ${poiId} found (type: ${poi.type})`);
    return poi;
  }

  /**
   * POI aktualisieren - DEPRECATED
   *
   * **Geocoding Update:**
   * - Wenn neue `adresse` angegeben: Re-Geocoding wird durchgeführt
   * - Wenn Geocoding fehlschlägt: Alte Koordinaten bleiben erhalten
   *
   * @param poiId - ID des POI
   * @param dto - UpdatePoiDto mit zu ändernden Feldern
   * @param user - Authentifizierter User
   * @returns Aktualisierter POI
   * @deprecated Verwende PUT /lagekarte/:lagekarteId/poi/:poiId (CQRS Command)
   */
  @Put(':poiId')
  @ApiOperation({
    summary: 'POI aktualisieren (DEPRECATED)',
    description: 'DEPRECATED: Verwende PUT /lagekarte/:lagekarteId/poi/:poiId. Aktualisiert einen bestehenden POI mit automatischem Re-Geocoding.',
    deprecated: true,
  })
  @ApiWrappedResponse(PoiResponseDto, { description: 'POI erfolgreich aktualisiert' })
  @ApiNotFoundResponse({ description: 'POI nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler in den Eingabedaten' })
  async updatePoi(
    @Param('poiId') poiId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: UpdatePoiDto,
    @CurrentUser() user: ValidatedUser,
  ): Promise<LagekartePoi> {
    this.logger.log(`Updating POI ${poiId} by user ${user.userId}`);

    // Check if POI exists
    const existingPoi = await this.poiRepository.findById(poiId);
    if (!existingPoi) {
      throw new NotFoundException(`POI with ID ${poiId} not found`);
    }

    const updateData: Prisma.LagekartePoiUpdateInput = {
      type: dto.type,
      name: dto.name,
      adresse: dto.adresse,
      icon: dto.icon,
      metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : undefined,
    };

    // Coordinate Update Logic (Priority-based)
    let coordinatesUpdated = false;

    // Priority 1: MGRS provided (PRIMARY FORMAT)
    if (dto.mgrs !== undefined) {
      this.logger.log(`Updating MGRS coordinates (PRIMARY): ${dto.mgrs}`);
      try {
        const coords = this.mgrsConverter.mgrsToLatLng(dto.mgrs);
        updateData.mgrs = dto.mgrs;
        updateData.latitude = coords.latitude;
        updateData.longitude = coords.longitude;
        coordinatesUpdated = true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new BadRequestException(`MGRS Konvertierung fehlgeschlagen: ${errorMessage}`);
      }
    }
    // Priority 2: Lat/Lng provided
    else if (dto.latitude !== undefined || dto.longitude !== undefined) {
      const newLat = dto.latitude ?? existingPoi.latitude;
      const newLng = dto.longitude ?? existingPoi.longitude;

      this.logger.log(`Updating Lat/Lng coordinates: (${newLat}, ${newLng})`);
      try {
        const mgrsString = this.mgrsConverter.latLngToMgrs(newLat, newLng, 5);
        updateData.mgrs = mgrsString;
        updateData.latitude = newLat;
        updateData.longitude = newLng;
        coordinatesUpdated = true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new BadRequestException(`MGRS Konvertierung fehlgeschlagen: ${errorMessage}`);
      }
    }
    // Priority 3: Address geocoding (only if address changed)
    else if (dto.adresse) {
      this.logger.log(`Re-geocoding address: ${dto.adresse}`);
      const coords = await this.geocodingService.geocodeAddress(dto.adresse);
      if (coords) {
        try {
          const mgrsString = this.mgrsConverter.latLngToMgrs(coords.lat, coords.lon, 5);
          updateData.mgrs = mgrsString;
          updateData.latitude = coords.lat;
          updateData.longitude = coords.lon;
          coordinatesUpdated = true;
        } catch {
          this.logger.warn(`MGRS Konvertierung nach Geocoding fehlgeschlagen, behalte bestehende Koordinaten`);
        }
      } else {
        this.logger.warn(`Geocoding failed for address "${dto.adresse}", keeping existing coordinates`);
      }
    }

    const updatedPoi = await this.poiRepository.update(poiId, updateData);

    if (coordinatesUpdated) {
      this.logger.log(`POI ${poiId} updated with MGRS: ${updatedPoi.mgrs}, Lat/Lng: (${updatedPoi.latitude}, ${updatedPoi.longitude})`);
    } else {
      this.logger.log(`POI ${poiId} updated (coordinates unchanged)`);
    }

    return updatedPoi;
  }

  /**
   * POI löschen - DEPRECATED
   *
   * @param poiId - ID des POI
   * @param user - Authentifizierter User
   * @deprecated Verwende DELETE /lagekarte/:lagekarteId/poi/:poiId (CQRS Command)
   */
  @Delete(':poiId')
  @ApiOperation({
    summary: 'POI löschen (DEPRECATED)',
    description: 'DEPRECATED: Verwende DELETE /lagekarte/:lagekarteId/poi/:poiId. Löscht einen POI permanent.',
    deprecated: true,
  })
  @ApiWrappedResponse(PoiResponseDto, { description: 'POI erfolgreich gelöscht' })
  @ApiNotFoundResponse({ description: 'POI nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Ungültige POI-ID' })
  async deletePoi(@Param('poiId') poiId: string, @CurrentUser() user: ValidatedUser): Promise<void> {
    this.logger.warn(`Deleting POI ${poiId} by user ${user.userId}`);

    // Check if POI exists
    const existingPoi = await this.poiRepository.findById(poiId);
    if (!existingPoi) {
      throw new NotFoundException(`POI with ID ${poiId} not found`);
    }

    await this.poiRepository.delete(poiId);
    this.logger.warn(`POI ${poiId} deleted`);
  }
}
