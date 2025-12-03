import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import type { ValidatedUser } from '@/auth/strategies/jwt.strategy';
import { ApiWrappedResponse } from '@/common/decorators/api-wrapped-response.decorator';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { join } from 'node:path';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { SaveLagekarteStateDto } from '../dto/save-lagekarte-state.dto';
import { Lagekarte } from '@prisma/client';
import { CreateLagekarteDto, AddPoiDto, UpdatePoiPositionDto } from '@/application/lagekarte/dto';
import { CreateLagekarteCommand, AddPoiCommand, RemovePoiCommand, UpdatePoiPositionCommand } from '@/application/lagekarte/commands';
import { GetLagekarteQuery, GetPoisQuery } from '@/application/lagekarte/queries';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { LagekarteDto, PoiDto } from '@/application/lagekarte/dtos';
import { PoiMapper } from '@/application/lagekarte/mappers/poi.mapper';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { Inject } from '@nestjs/common';
import { LagekarteRepository } from '../repositories/lagekarte.repository';

/**
 * Controller für Lagekarten-Management (Hybrid: CQRS + Legacy)
 *
 * **Architecture:**
 * - CQRS Endpoints: Verwenden CommandBus/QueryBus (Story 2-6 Scope)
 * - Legacy Endpoints: Verwenden LagekarteService direkt (Screenshot/State Management - Out of Scope)
 *
 * **CQRS Endpoints (Refactored):**
 * - GET /einsatz/:einsatzId/lagekarte → GetLagekarteQuery
 * - POST /lagekarte → CreateLagekarteCommand
 * - POST /lagekarte/:lagekarteId/poi → AddPoiCommand
 * - PUT /lagekarte/:lagekarteId/poi/:poiId → UpdatePoiPositionCommand
 * - DELETE /lagekarte/:lagekarteId/poi/:poiId → RemovePoiCommand
 * - GET /lagekarte/:lagekarteId/pois → GetPoisQuery
 *
 * **Legacy Endpoints (Preserved):**
 * - POST /einsatz/:einsatzId/lagekarte → saveLagekarteState (GeoJSON)
 * - POST /einsatz/:einsatzId/lagekarte/screenshot → uploadScreenshot
 * - DELETE /einsatz/:einsatzId/lagekarte/screenshot/:filename → deleteScreenshot
 * - DELETE /einsatz/:einsatzId/lagekarte → deleteLagekarte
 *
 * **Route Structure:**
 * - Legacy Base: `/einsatz/:einsatzId/lagekarte` (für Screenshot/State)
 * - CQRS Routes: `/lagekarte/*` (neue API-Struktur)
 *
 * @security Alle Endpunkte erfordern valides JWT Token
 */
@ApiTags('Lagekarte')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Nicht authentifiziert - JWT Token fehlt oder ungültig' })
@ApiForbiddenResponse({ description: 'Keine Berechtigung für diese Aktion' })
@Controller({
  path: 'einsatz/:einsatzId/lagekarte',
  version: 'alpha',
})
export class LagekarteController {
  private readonly logger = new Logger(LagekarteController.name);
  private readonly uploadsPath: string;
  private readonly uploadDir: string;

  constructor(
    private readonly queryBus: QueryBus,
    private readonly configService: ConfigService,
    private readonly lagekarteRepository: LagekarteRepository, // Direct repository access for legacy endpoints
  ) {
    // Get uploads path from ENV or use default (relative to project root)
    const uploadsBase = this.configService.get<string>('UPLOADS_PATH') || 'uploads';
    this.uploadsPath = join(process.cwd(), uploadsBase);
    this.uploadDir = join(this.uploadsPath, 'lagekarte');

    // Ensure uploads directory exists
    try {
      mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Uploads directory ready: ${this.uploadDir}`);
    } catch (error) {
      this.logger.error(`Failed to create uploads directory: ${this.uploadDir}`, error);
    }
  }

  // ============================================
  // CQRS ENDPOINTS (Story 2-6 Scope)
  // ============================================

  /**
   * Lagekarte für Einsatz abrufen (REFACTORED - uses QueryBus)
   *
   * Nutzt GetLagekarteQuery via QueryBus für CQRS-Pattern.
   * Ersetzt vorheriges Service-basiertes getOrCreateLagekarte().
   *
   * @param einsatzId - ID des Einsatzes
   * @returns Lagekarte mit allen POIs oder null wenn nicht gefunden
   */
  @Get()
  @ApiOperation({
    summary: 'Lagekarte abrufen',
    description: 'Gibt die Lagekarte für einen Einsatz zurück. Nutzt CQRS QueryBus für Read-Operations.',
  })
  @ApiOkResponse({ type: LagekarteDto, description: 'Lagekarte erfolgreich abgerufen' })
  @ApiNotFoundResponse({ description: 'Lagekarte nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Ungültige Einsatz-ID' })
  async getLagekarte(@Param('einsatzId') einsatzId: string): Promise<LagekarteDto | null> {
    this.logger.log(`Getting Lagekarte for Einsatz ${einsatzId} (via QueryBus)`);

    const query = new GetLagekarteQuery(einsatzId);
    const result = await this.queryBus.execute(query);

    if (result.isFailure) {
      this.logger.error(`Failed to get Lagekarte for Einsatz ${einsatzId}: ${result.error}`);
      throw new NotFoundException(result.error);
    }

    this.logger.log(`Lagekarte ${result.value?.id ?? 'null'} returned for Einsatz ${einsatzId}`);
    return result.value ?? null;
  }

  /**
   * Lagekarte-State speichern (GeoJSON Zeichnungen) - LEGACY ENDPOINT
   *
   * **OUT OF SCOPE:** Diese Methode bleibt unverändert und nutzt weiterhin LagekarteService.
   * GeoJSON State Management ist nicht Teil der CQRS-Refactoring Story 2-6.
   *
   * @param einsatzId - ID des Einsatzes
   * @param dto - SaveLagekarteStateDto mit state (GeoJSON FeatureCollection)
   * @param user - Authentifizierter User
   * @returns Aktualisierte Lagekarte
   */
  @Post()
  @ApiOperation({
    summary: 'Lagekarte-State speichern (Legacy)',
    description: 'Speichert den GeoJSON State (Zeichnungen) einer Lagekarte. Der State enthält Polygone, Linien und Marker im GeoJSON FeatureCollection Format.',
  })
  @ApiWrappedResponse(Object, { description: 'Lagekarte-State erfolgreich gespeichert' })
  @ApiNotFoundResponse({ description: 'Lagekarte nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler in den Eingabedaten' })
  async saveLagekarteState(
    @Param('einsatzId') einsatzId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: SaveLagekarteStateDto,
    @CurrentUser() user: ValidatedUser,
  ): Promise<Lagekarte> {
    this.logger.log(`Saving Lagekarte state for Einsatz ${einsatzId} by user ${user.userId}`);

    // Get existing Lagekarte using repository directly
    const lagekarte = await this.lagekarteRepository.findByEinsatzId(einsatzId);
    if (!lagekarte) {
      this.logger.error(`Lagekarte not found for Einsatz ${einsatzId}`);
      throw new NotFoundException(`Lagekarte for Einsatz ${einsatzId} not found`);
    }

    // Update state using repository directly
    const updated = await this.lagekarteRepository.update(lagekarte.id, dto.state);
    this.logger.log(`Lagekarte ${lagekarte.id} state updated for Einsatz ${einsatzId}`);
    return updated;
  }

  /**
   * Screenshot der Lagekarte hochladen (für ETB-Integration) - LEGACY ENDPOINT
   *
   * **OUT OF SCOPE:** Diese Methode bleibt unverändert.
   * File Upload Management ist nicht Teil der CQRS-Refactoring Story 2-6.
   *
   * **Security:**
   * - PNG und JPEG-Files erlaubt (MIME-Type Validierung)
   * - Filename Sanitization (verhindert Path Traversal)
   * - Max. File-Size: 10MB
   *
   * **Storage:**
   * - Ziel: `/uploads/lagekarte/{einsatzId}_{timestamp}.{png|jpg}`
   * - Persistierung via Docker Volume
   *
   * @param einsatzId - ID des Einsatzes
   * @param file - Hochgeladenes Screenshot-File (PNG oder JPEG)
   * @param user - Authentifizierter User
   * @returns File URL für ETB-Integration
   */
  @Post('screenshot')
  @ApiOperation({
    summary: 'Screenshot der Lagekarte hochladen (Legacy)',
    description: 'Upload eines Screenshots der Lagekarte für ETB-Integration. PNG- und JPEG-Files bis 10MB. Rückgabe: File-URL für Verwendung in ETB-Einträgen.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Screenshot-Datei (PNG oder JPEG, max 10MB)',
        },
      },
    },
  })
  @ApiWrappedResponse(Object, { description: 'Screenshot erfolgreich hochgeladen' })
  @ApiBadRequestResponse({ description: 'Ungültiges File-Format oder zu groß' })
  @ApiNotFoundResponse({ description: 'Einsatz nicht gefunden' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          // Use project root for uploads (consistent with ServeStaticModule)
          const uploadsBase = process.env.UPLOADS_PATH || 'uploads';
          const uploadsPath = join(process.cwd(), uploadsBase);
          const uploadDir = join(uploadsPath, 'lagekarte');

          // Ensure directory exists
          try {
            mkdirSync(uploadDir, { recursive: true });
          } catch {
            // Ignore errors - directory likely exists
          }

          cb(null, uploadDir);
        },
        filename: (req, uploadedFile, cb) => {
          const reqEinsatzId = req.params.einsatzId || 'unknown';
          const timestamp = Date.now();
          // Sanitize: Prevent path traversal
          const sanitizedEinsatzId = reqEinsatzId.replace(/[^a-zA-Z0-9_-]/g, '');
          // Use correct extension based on MIME type
          const extension = uploadedFile.mimetype === 'image/jpeg' ? 'jpg' : 'png';
          cb(null, `${sanitizedEinsatzId}_${timestamp}.${extension}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max (Lagekarten-Screenshots mit scale:2 können groß sein)
      },
      fileFilter: (_req, uploadedFile, cb) => {
        // Validate MIME type: Accept PNG and JPEG
        const allowedMimeTypes = ['image/png', 'image/jpeg'];
        if (!allowedMimeTypes.includes(uploadedFile.mimetype)) {
          return cb(new BadRequestException('Only PNG and JPEG files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadScreenshot(@Param('einsatzId') einsatzId: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: ValidatedUser): Promise<{ url: string }> {
    this.logger.log(`Uploading screenshot for Einsatz ${einsatzId} by user ${user.userId}`);

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const fileUrl = `/uploads/lagekarte/${file.filename}`;
    this.logger.log(`Screenshot uploaded: ${fileUrl}`);

    return { url: fileUrl };
  }

  /**
   * Screenshot löschen (für ETB-Fehler-Cleanup) - LEGACY ENDPOINT
   *
   * **OUT OF SCOPE:** Diese Methode bleibt unverändert.
   * File Upload Management ist nicht Teil der CQRS-Refactoring Story 2-6.
   *
   * **Security:**
   * - Filename Validierung (verhindert Path Traversal)
   * - Nur Screenshots des angegebenen Einsatzes können gelöscht werden
   * - File-Existence-Check vor Löschung
   *
   * **Use Case:**
   * - Cleanup wenn ETB-Eintrag-Erstellung fehlschlägt (AC7)
   *
   * @param einsatzId - ID des Einsatzes
   * @param filename - Dateiname des Screenshots (z.B. "einsatzId_timestamp.png" oder "einsatzId_timestamp.jpg")
   * @param user - Authentifizierter User
   */
  @Delete('screenshot/:filename')
  @ApiOperation({
    summary: 'Screenshot löschen (Legacy)',
    description: 'Löscht einen Screenshot der Lagekarte (PNG oder JPEG). Verwendet für Cleanup wenn ETB-Eintrag-Erstellung fehlschlägt (AC7). Filename-Validierung verhindert Path Traversal.',
  })
  @ApiWrappedResponse(Object, { description: 'Screenshot erfolgreich gelöscht' })
  @ApiBadRequestResponse({ description: 'Ungültiger Filename oder Path Traversal-Versuch' })
  @ApiNotFoundResponse({ description: 'Screenshot nicht gefunden' })
  @ApiForbiddenResponse({ description: 'Keine Berechtigung - Screenshot gehört zu anderem Einsatz' })
  async deleteScreenshot(@Param('einsatzId') einsatzId: string, @Param('filename') filename: string, @CurrentUser() user: ValidatedUser): Promise<{ message: string }> {
    this.logger.log(`Deleting screenshot ${filename} for Einsatz ${einsatzId} by user ${user.userId}`);

    // Validate filename (prevent path traversal)
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      this.logger.error(`Invalid filename: ${filename}`);
      throw new BadRequestException('Invalid filename - Path traversal not allowed');
    }

    // Validate filename format: Must be "einsatzId_timestamp.png" or "einsatzId_timestamp.jpg"
    const filenamePattern = /^[a-zA-Z0-9_-]+_\d+\.(png|jpg)$/;
    if (!filenamePattern.test(filename)) {
      this.logger.error(`Invalid filename format: ${filename}`);
      throw new BadRequestException('Invalid filename format - Expected: einsatzId_timestamp.png or einsatzId_timestamp.jpg');
    }

    // Verify filename starts with einsatzId (authorization check)
    const sanitizedEinsatzId = einsatzId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!filename.startsWith(`${sanitizedEinsatzId}_`)) {
      this.logger.error(`Authorization failed: Screenshot ${filename} does not belong to Einsatz ${einsatzId}`);
      throw new ForbiddenException('Screenshot does not belong to this Einsatz');
    }

    // Build full file path
    const filePath = join(this.uploadDir, filename);

    // Check file existence
    if (!existsSync(filePath)) {
      this.logger.error(`Screenshot not found: ${filePath}`);
      throw new NotFoundException(`Screenshot ${filename} not found`);
    }

    // Delete file
    try {
      unlinkSync(filePath);
      this.logger.log(`Screenshot deleted: ${filePath}`);
      return { message: 'Screenshot deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete screenshot: ${filePath}`, error);
      throw new BadRequestException('Failed to delete screenshot');
    }
  }

  /**
   * Lagekarte löschen (CASCADE: POIs werden automatisch mitgelöscht) - LEGACY ENDPOINT
   *
   * **OUT OF SCOPE:** Diese Methode bleibt unverändert und nutzt weiterhin LagekarteService.
   * Delete-Operations sind nicht Teil der CQRS-Refactoring Story 2-6.
   *
   * @param einsatzId - ID des Einsatzes
   * @param user - Authentifizierter User
   */
  @Delete()
  @ApiOperation({
    summary: 'Lagekarte löschen (Legacy)',
    description: 'Löscht die Lagekarte eines Einsatzes. CASCADE: Alle zugehörigen POIs werden automatisch mitgelöscht.',
  })
  @ApiWrappedResponse(Object, { description: 'Lagekarte erfolgreich gelöscht' })
  @ApiNotFoundResponse({ description: 'Lagekarte nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Ungültige Einsatz-ID' })
  async deleteLagekarte(@Param('einsatzId') einsatzId: string, @CurrentUser() user: ValidatedUser): Promise<void> {
    this.logger.warn(`Deleting Lagekarte for Einsatz ${einsatzId} by user ${user.userId}`);

    // Get existing Lagekarte using repository directly
    const lagekarte = await this.lagekarteRepository.findByEinsatzId(einsatzId);
    if (!lagekarte) {
      this.logger.error(`Lagekarte not found for Einsatz ${einsatzId}`);
      throw new NotFoundException(`Lagekarte for Einsatz ${einsatzId} not found`);
    }

    // Delete using repository directly (cascade to POIs)
    await this.lagekarteRepository.delete(lagekarte.id);
    this.logger.warn(`Lagekarte ${lagekarte.id} deleted for Einsatz ${einsatzId} (CASCADE to POIs)`);
  }
}

// ============================================
// CQRS ENDPOINTS - SEPARATE CONTROLLER
// ============================================

/**
 * Controller für neue CQRS-basierte Lagekarte API
 *
 * Dieser Controller implementiert die neuen CQRS-Endpunkte aus Story 2-6.
 * Separater Controller ermöglicht saubere Trennung zwischen Legacy- und CQRS-Routes.
 *
 * **Route Structure:**
 * - Base: `/lagekarte` (ohne einsatzId im Path)
 * - Alle Routes nutzen CommandBus/QueryBus (kein LagekarteService)
 *
 * **Endpoints:**
 * - POST /lagekarte → CreateLagekarteCommand
 * - POST /lagekarte/:lagekarteId/poi → AddPoiCommand
 * - PUT /lagekarte/:lagekarteId/poi/:poiId → UpdatePoiPositionCommand
 * - DELETE /lagekarte/:lagekarteId/poi/:poiId → RemovePoiCommand
 * - GET /lagekarte/einsatz/:einsatzId → GetLagekarteQuery
 * - GET /lagekarte/:lagekarteId/pois → GetPoisQuery
 */
@ApiTags('Lagekarte (CQRS)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Nicht authentifiziert - JWT Token fehlt oder ungültig' })
@ApiForbiddenResponse({ description: 'Keine Berechtigung für diese Aktion' })
@Controller({
  path: 'lagekarte',
  version: 'alpha',
})
export class LagekarteCqrsController {
  private readonly logger = new Logger(LagekarteCqrsController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    @Inject('ILagekarteRepository')
    private readonly lagekarteRepository: ILagekarteRepository,
  ) {}

  /**
   * Helper: Load Lagekarte aggregate and map a specific POI to DTO.
   *
   * @param lagekarteId - ID der Lagekarte
   * @param poiId - ID des POI
   * @returns PoiDto
   * @throws NotFoundException wenn Lagekarte oder POI nicht gefunden
   */
  private async loadAndMapPoi(lagekarteId: string, poiId: string): Promise<PoiDto> {
    const idResult = LagekarteId.create(lagekarteId);
    if (idResult.isFailure || !idResult.value) {
      throw new BadRequestException('Invalid Lagekarte ID');
    }

    const aggregate = await this.lagekarteRepository.findById(idResult.value);
    if (!aggregate) {
      throw new NotFoundException(`Lagekarte ${lagekarteId} nicht gefunden`);
    }

    const poi = aggregate.pois.find((p) => p.id.value === poiId);
    if (!poi) {
      throw new NotFoundException(`POI ${poiId} nicht gefunden`);
    }

    return PoiMapper.toDto(poi);
  }

  /**
   * Lagekarte erstellen (AC 1)
   *
   * Erstellt eine neue Lagekarte für einen Einsatz via CommandBus.
   * Optional kann ein initialer POI (z.B. Einsatzort) mitgegeben werden.
   *
   * @param dto - CreateLagekarteDto mit einsatzId und optionalem initialPoi
   * @returns Erstellte Lagekarte
   */
  @Post()
  @ApiOperation({
    summary: 'Lagekarte erstellen',
    description: 'Erstellt eine neue Lagekarte für einen Einsatz. Optional kann ein initialer POI (z.B. Einsatzort) mitgegeben werden.',
  })
  @ApiCreatedResponse({ type: LagekarteDto, description: 'Lagekarte erfolgreich erstellt' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler in den Eingabedaten' })
  async createLagekarte(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreateLagekarteDto,
  ): Promise<LagekarteDto> {
    this.logger.log(`Creating Lagekarte for Einsatz ${dto.einsatzId} (via CommandBus)`);

    const commandResult = CreateLagekarteCommand.create(dto.einsatzId, dto.initialPoi);
    if (commandResult.isFailure || !commandResult.value) {
      this.logger.error(`Invalid command for Einsatz ${dto.einsatzId}: ${commandResult.error}`);
      throw new BadRequestException(commandResult.error);
    }

    const result = await this.commandBus.execute(commandResult.value);

    if (result.isFailure) {
      this.logger.error(`Failed to create Lagekarte for Einsatz ${dto.einsatzId}: ${result.error}`);
      throw new BadRequestException(result.error);
    }

    // Retrieve the created Lagekarte to return DTO
    const queryResult = await this.queryBus.execute(new GetLagekarteQuery(dto.einsatzId));
    if (queryResult.isFailure || !queryResult.value) {
      this.logger.error(`Failed to retrieve created Lagekarte for Einsatz ${dto.einsatzId}`);
      throw new BadRequestException('Failed to retrieve created Lagekarte');
    }

    this.logger.log(`Lagekarte ${result.value?.value ?? 'unknown'} created for Einsatz ${dto.einsatzId}`);
    return queryResult.value;
  }

  /**
   * POI hinzufügen (AC 2)
   *
   * Fügt einen neuen POI zur Lagekarte hinzu via CommandBus.
   *
   * @param lagekarteId - ID der Lagekarte
   * @param dto - AddPoiDto mit POI-Details (name, coordinate, category, beschreibung)
   * @returns Neu erstellter POI
   */
  @Post(':lagekarteId/poi')
  @ApiOperation({
    summary: 'POI hinzufügen',
    description: 'Fügt einen neuen POI zur Lagekarte hinzu. Koordinaten können als Lat/Lng oder MGRS angegeben werden.',
  })
  @ApiCreatedResponse({ type: PoiDto, description: 'POI erfolgreich hinzugefügt' })
  @ApiNotFoundResponse({ description: 'Lagekarte nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler in den Eingabedaten' })
  async addPoi(
    @Param('lagekarteId') lagekarteId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: AddPoiDto,
  ): Promise<PoiDto> {
    this.logger.log(`Adding POI to Lagekarte ${lagekarteId} (via CommandBus)`);

    const commandResult = AddPoiCommand.create(lagekarteId, dto.name, dto.coordinate, dto.category, dto.beschreibung);
    if (commandResult.isFailure || !commandResult.value) {
      this.logger.error(`Invalid command for Lagekarte ${lagekarteId}: ${commandResult.error}`);
      throw new BadRequestException(commandResult.error);
    }

    const result = await this.commandBus.execute(commandResult.value);

    if (result.isFailure) {
      this.logger.error(`Failed to add POI to Lagekarte ${lagekarteId}: ${result.error}`);

      if (result.error?.includes('nicht gefunden')) {
        throw new NotFoundException(result.error);
      }

      throw new BadRequestException(result.error);
    }

    // Handler returns Result<PoiId>, extract POI ID
    const poiId = result.value;
    if (!poiId) {
      throw new BadRequestException('Failed to add POI: No POI ID returned');
    }

    // Load the newly created POI and return DTO
    const poiDto = await this.loadAndMapPoi(lagekarteId, poiId.value);
    this.logger.log(`POI ${poiId.value} added to Lagekarte ${lagekarteId}`);
    return poiDto;
  }

  /**
   * POI-Position aktualisieren (AC 4)
   *
   * Aktualisiert die Position eines POIs via CommandBus.
   *
   * @param lagekarteId - ID der Lagekarte
   * @param poiId - ID des POIs
   * @param dto - UpdatePoiPositionDto mit neuer Koordinate
   * @returns Aktualisierter POI
   */
  @Put(':lagekarteId/poi/:poiId')
  @ApiOperation({
    summary: 'POI-Position aktualisieren',
    description: 'Aktualisiert die Position eines POIs. Koordinaten können als Lat/Lng oder MGRS angegeben werden.',
  })
  @ApiOkResponse({ type: PoiDto, description: 'POI-Position erfolgreich aktualisiert' })
  @ApiNotFoundResponse({ description: 'Lagekarte oder POI nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler in den Eingabedaten' })
  async updatePoiPosition(
    @Param('lagekarteId') lagekarteId: string,
    @Param('poiId') poiId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: UpdatePoiPositionDto,
  ): Promise<PoiDto> {
    this.logger.log(`Updating position of POI ${poiId} in Lagekarte ${lagekarteId} (via CommandBus)`);

    const commandResult = UpdatePoiPositionCommand.create(lagekarteId, poiId, dto.newCoordinate);
    if (commandResult.isFailure || !commandResult.value) {
      this.logger.error(`Invalid command for POI ${poiId}: ${commandResult.error}`);
      throw new BadRequestException(commandResult.error);
    }

    const result = await this.commandBus.execute(commandResult.value);

    if (result.isFailure) {
      this.logger.error(`Failed to update POI ${poiId} position in Lagekarte ${lagekarteId}: ${result.error}`);

      if (result.error?.includes('nicht gefunden')) {
        throw new NotFoundException(result.error);
      }

      throw new BadRequestException(result.error);
    }

    // Handler returns Result<void>, load the updated POI and return DTO
    const poiDto = await this.loadAndMapPoi(lagekarteId, poiId);
    this.logger.log(`POI ${poiId} position updated in Lagekarte ${lagekarteId}`);
    return poiDto;
  }

  /**
   * POI entfernen (AC 3)
   *
   * Entfernt einen POI von der Lagekarte via CommandBus.
   *
   * @param lagekarteId - ID der Lagekarte
   * @param poiId - ID des POIs
   * @returns Void (HTTP 204 No Content)
   */
  @Delete(':lagekarteId/poi/:poiId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'POI entfernen',
    description: 'Entfernt einen POI von der Lagekarte.',
  })
  @ApiResponse({ status: 204, description: 'POI erfolgreich entfernt' })
  @ApiNotFoundResponse({ description: 'Lagekarte oder POI nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler' })
  async removePoi(@Param('lagekarteId') lagekarteId: string, @Param('poiId') poiId: string): Promise<void> {
    this.logger.log(`Removing POI ${poiId} from Lagekarte ${lagekarteId} (via CommandBus)`);

    const commandResult = RemovePoiCommand.create(lagekarteId, poiId);
    if (commandResult.isFailure || !commandResult.value) {
      this.logger.error(`Invalid command for POI ${poiId}: ${commandResult.error}`);
      throw new BadRequestException(commandResult.error);
    }

    const result = await this.commandBus.execute(commandResult.value);

    if (result.isFailure) {
      this.logger.error(`Failed to remove POI ${poiId} from Lagekarte ${lagekarteId}: ${result.error}`);

      if (result.error?.includes('nicht gefunden')) {
        throw new NotFoundException(result.error);
      }

      throw new BadRequestException(result.error);
    }

    // Handler returns Result<void>, operation successful
    this.logger.log(`POI ${poiId} removed from Lagekarte ${lagekarteId}`);
    // No return statement (void) - HTTP 204 No Content
  }

  /**
   * Lagekarte für Einsatz abrufen (AC 5)
   *
   * Nutzt GetLagekarteQuery via QueryBus.
   * Alternative Route zu GET /einsatz/:einsatzId/lagekarte (Legacy).
   *
   * @param einsatzId - ID des Einsatzes
   * @returns Lagekarte mit allen POIs oder null wenn nicht gefunden
   */
  @Get('einsatz/:einsatzId')
  @ApiOperation({
    summary: 'Lagekarte für Einsatz abrufen',
    description: 'Gibt die Lagekarte für einen Einsatz zurück. Nutzt CQRS QueryBus für Read-Operations.',
  })
  @ApiOkResponse({ type: LagekarteDto, description: 'Lagekarte erfolgreich abgerufen' })
  @ApiNotFoundResponse({ description: 'Lagekarte nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Ungültige Einsatz-ID' })
  async getLagekarteByEinsatzId(@Param('einsatzId') einsatzId: string): Promise<LagekarteDto | null> {
    this.logger.log(`Getting Lagekarte for Einsatz ${einsatzId} (via QueryBus)`);

    const query = new GetLagekarteQuery(einsatzId);
    const result = await this.queryBus.execute(query);

    if (result.isFailure) {
      this.logger.error(`Failed to get Lagekarte for Einsatz ${einsatzId}: ${result.error}`);
      throw new NotFoundException(result.error);
    }

    this.logger.log(`Lagekarte ${result.value?.id ?? 'null'} returned for Einsatz ${einsatzId}`);
    return result.value ?? null;
  }

  /**
   * POIs einer Lagekarte abrufen (AC3)
   *
   * Nutzt GetPoisQuery via QueryBus mit optionaler Kategorie-Filterung.
   *
   * @param lagekarteId - ID der Lagekarte
   * @param category - Optionale Kategorie-Filterung (z.B. "EINSATZSTELLE")
   * @returns Liste aller POIs (gefiltert falls category angegeben)
   */
  @Get(':lagekarteId/pois')
  @ApiOperation({
    summary: 'POIs einer Lagekarte abrufen',
    description: 'Gibt alle POIs einer Lagekarte zurück. Optionale Filterung nach Kategorie. Nutzt CQRS QueryBus für Read-Operations.',
  })
  @ApiOkResponse({ type: [PoiDto], description: 'POIs erfolgreich abgerufen' })
  @ApiNotFoundResponse({ description: 'Lagekarte nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Ungültige Lagekarte-ID oder Kategorie' })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Optionale Kategorie-Filterung',
    enum: ['EINSATZSTELLE', 'BEREITSTELLUNGSRAUM', 'GEFAHRENSTELLE', 'WASSERENTNAHMESTELLE', 'SONSTIGES'],
  })
  async getPois(@Param('lagekarteId') lagekarteId: string, @Query('category') category?: string): Promise<PoiDto[]> {
    this.logger.log(`Getting POIs for Lagekarte ${lagekarteId}${category ? ` (category: ${category})` : ''} (via QueryBus)`);

    const query = new GetPoisQuery(lagekarteId, category);
    const result = await this.queryBus.execute(query);

    if (result.isFailure || !result.value) {
      this.logger.error(`Failed to get POIs for Lagekarte ${lagekarteId}: ${result.error}`);
      throw new NotFoundException(result.error ?? 'POIs not found');
    }

    this.logger.log(`${result.value.length} POIs returned for Lagekarte ${lagekarteId}`);
    return result.value;
  }
}
