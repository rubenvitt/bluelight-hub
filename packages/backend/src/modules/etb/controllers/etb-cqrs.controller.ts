import { AddEintragCommand, DeleteEintragCommand, LockEtbCommand, UpdateEintragCommand } from '@/application/etb/commands';
import { AddEintragHandler } from '@/application/etb/commands/add-eintrag/add-eintrag.handler';
import { DeleteEintragHandler } from '@/application/etb/commands/delete-eintrag/delete-eintrag.handler';
import { LockEtbHandler } from '@/application/etb/commands/lock-etb/lock-etb.handler';
import { UpdateEintragHandler } from '@/application/etb/commands/update-eintrag/update-eintrag.handler';
import { AddEintragDto, EintragDto, EtbDto, EtbSnapshotDto, TextbausteinListResponse, UpdateEintragDto } from '@/application/etb/dto';
import { EtbQueryMapper, type EtbSnapshotDto as EtbSnapshotDtoFromMapper } from '@/application/etb/mappers';
import { GetEtbHistoryQuery, GetEtbHistoryQueryHandler, GetEtbQuery, GetEtbQueryHandler, GetTextbausteineQuery, GetTextbausteineHandler } from '@/application/etb/queries';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import type { ValidatedUser } from '@/modules/auth/strategies/jwt.strategy';
import { SkipTransform } from '@/modules/common/decorators/skip-transform.decorator';
import { IEtbRepository } from '@domain/repositories/i-etb.repository';
import { EtbId } from '@domain/value-objects/etb-id';
import { ETB_REPOSITORY } from '@/infrastructure/di-tokens';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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

/**
 * CQRS Controller für ETB (Einsatztagebuch) Management.
 *
 * Dieser Controller implementiert das CQRS Pattern für ETB-Operationen:
 * - Commands: State Mutation via CommandBus (Add/Update/Delete Eintrag, Lock ETB)
 * - Queries: State Reading via QueryBus (Get ETB, Get History)
 *
 * **Architektur-Entscheidung:**
 * Controller ist ein dünner HTTP-Adapter ohne Business-Logik. Alle Operationen
 * werden an Command/Query Handler delegiert, die in der Application Layer leben.
 * Result Pattern wird für konsistente Fehlerbehandlung verwendet.
 *
 * **Endpunkte:**
 * - GET /etb/einsatz/:einsatzId - ETB für Einsatz abrufen
 * - GET /etb/:etbId/history - ETB Versionshistorie abrufen
 * - POST /etb/:etbId/eintrag - Neuen Eintrag hinzufügen
 * - PUT /etb/:etbId/eintrag/:eintragId - Eintrag aktualisieren
 * - DELETE /etb/:etbId/eintrag/:eintragId - Eintrag soft-löschen
 * - POST /etb/:etbId/lock - ETB sperren (nur ADMIN/SUPER_ADMIN)
 *
 * @security Alle Endpunkte erfordern valides JWT Token (JwtAuthGuard)
 * @see EtbApplicationModule - Registriert alle Handler
 */
@ApiTags('ETB')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Nicht authentifiziert - JWT Token fehlt oder ungültig' })
@ApiForbiddenResponse({ description: 'Keine Berechtigung für diese Aktion' })
@SkipTransform()
@Controller({
  path: 'etb',
  version: 'alpha',
})
export class EtbCqrsController {
  private readonly logger = new Logger(EtbCqrsController.name);

  constructor(
    private readonly addEintragHandler: AddEintragHandler,
    private readonly updateEintragHandler: UpdateEintragHandler,
    private readonly deleteEintragHandler: DeleteEintragHandler,
    private readonly lockEtbHandler: LockEtbHandler,
    private readonly getEtbQueryHandler: GetEtbQueryHandler,
    private readonly getEtbHistoryQueryHandler: GetEtbHistoryQueryHandler,
    private readonly getTextbausteineHandler: GetTextbausteineHandler,
    @Inject(ETB_REPOSITORY)
    private readonly etbRepository: IEtbRepository,
  ) {}

  // ============================================
  // GET ENDPOINTS (Queries)
  // ============================================

  /**
   * Alle Textbausteine abrufen.
   *
   * Textbausteine sind vordefinierte Text-Templates fuer die schnelle
   * Erstellung von ETB-Eintraegen. Sie reduzieren Tipparbeit und
   * standardisieren haeufige Eintragstypen.
   *
   * **Route-Position:**
   * MUSS VOR parametrisierten Routen wie :etbId/history kommen,
   * da sonst "textbausteine" als etbId interpretiert wird.
   *
   * @param kategorie - Optional: Filtert nach Kategorie
   * @param onlyActive - Nur aktive Textbausteine (Standard: true)
   * @returns TextbausteinListResponse mit allen Textbausteinen
   */
  @Get('textbausteine')
  @ApiOperation({
    summary: 'Alle Textbausteine abrufen',
    description: 'Gibt alle verfuegbaren Textbausteine zur schnellen ETB-Erstellung zurueck. Optional nach Kategorie filterbar.',
  })
  @ApiOkResponse({ type: TextbausteinListResponse, description: 'Textbausteine erfolgreich abgerufen' })
  @ApiBadRequestResponse({ description: 'Fehler beim Laden der Textbausteine' })
  @ApiQuery({ name: 'kategorie', required: false, description: 'Filter nach Kategorie (z.B. ALARMIERUNG, LAGE)' })
  @ApiQuery({ name: 'onlyActive', required: false, type: Boolean, description: 'Nur aktive Textbausteine (Standard: true)' })
  async getTextbausteine(@Query('kategorie') kategorie?: string, @Query('onlyActive') onlyActive?: string): Promise<TextbausteinListResponse> {
    this.logger.log(`Getting Textbausteine (kategorie: ${kategorie ?? 'all'}, onlyActive: ${onlyActive ?? 'true'})`);

    // Parse onlyActive - Standard ist true
    const onlyActiveBoolean = onlyActive === undefined || onlyActive === 'true';

    // Parse kategorie - undefined wenn nicht angegeben
    const kategorieEnum = kategorie as import('@prisma/client').EtbKategorie | undefined;

    const query = new GetTextbausteineQuery(kategorieEnum, onlyActiveBoolean);
    const result = await this.getTextbausteineHandler.execute(query);

    if (result.isFailure) {
      throw new BadRequestException(result.error);
    }

    return {
      meta: { timestamp: new Date().toISOString() },
      data: result.value ?? [],
    };
  }

  /**
   * ETB für Einsatz abrufen (AC4)
   *
   * Lädt das ETB für einen Einsatz via GetEtbQuery. Unterstützt optionales
   * Einblenden von soft-gelöschten Einträgen via includeDeleted Parameter.
   *
   * @param einsatzId - ID des Einsatzes (CUID2 Format)
   * @param includeDeleted - Optional: Gelöschte Einträge anzeigen (default: false)
   * @returns EtbDto mit allen Einträgen oder null wenn nicht gefunden
   * @throws NotFoundException wenn ETB nicht existiert
   * @throws BadRequestException bei ungültiger einsatzId
   */
  @Get('einsatz/:einsatzId')
  @ApiOperation({
    summary: 'ETB für Einsatz abrufen',
    description: 'Gibt das Einsatztagebuch für einen Einsatz zurück. Optional können soft-gelöschte Einträge mit includeDeleted=true angezeigt werden.',
  })
  @ApiOkResponse({ type: EtbDto, description: 'ETB erfolgreich abgerufen' })
  @ApiNotFoundResponse({ description: 'ETB für diesen Einsatz nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Ungültige Einsatz-ID' })
  @ApiQuery({
    name: 'includeDeleted',
    required: false,
    type: Boolean,
    description: 'Soft-gelöschte Einträge anzeigen (default: false)',
  })
  async getEtbByEinsatzId(@Param('einsatzId') einsatzId: string, @Query('includeDeleted') includeDeleted?: string): Promise<EtbDto> {
    const includeDeletedBool = includeDeleted === 'true';
    this.logger.log(`Getting ETB for Einsatz ${einsatzId} (includeDeleted: ${includeDeletedBool})`);

    try {
      const query = new GetEtbQuery(einsatzId, includeDeletedBool);
      const result = await this.getEtbQueryHandler.execute(query);

      if (result.isFailure) {
        this.logger.error(`Failed to get ETB for Einsatz ${einsatzId}: ${result.error}`);
        if (result.error?.includes('nicht gefunden') || result.error?.includes('not found')) {
          throw new NotFoundException(result.error);
        }
        throw new BadRequestException(result.error);
      }

      if (!result.value) {
        this.logger.warn(`ETB for Einsatz ${einsatzId} not found`);
        throw new NotFoundException(`ETB für Einsatz ${einsatzId} nicht gefunden`);
      }

      this.logger.log(`ETB ${result.value.id} returned for Einsatz ${einsatzId}`, result.value);
      return result.value;
    } catch (error) {
      // Query constructor throws Error on validation failure
      if (error instanceof Error && !(error instanceof NotFoundException) && !(error instanceof BadRequestException)) {
        this.logger.error(`Invalid query parameters: ${error.message}`);
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * ETB Versionshistorie abrufen (AC4)
   *
   * Lädt alle Snapshots eines ETB für die Versionshistorie.
   * Snapshots werden VOR jeder mutierenden Operation erstellt (DRK-Compliance).
   *
   * @param etbId - ID des ETB (CUID2 Format)
   * @returns Array von EtbSnapshotDto, sortiert nach Version absteigend (neueste zuerst)
   * @throws NotFoundException wenn ETB nicht existiert
   * @throws BadRequestException bei ungültiger etbId
   */
  @Get(':etbId/history')
  @ApiOperation({
    summary: 'ETB Versionshistorie abrufen',
    description: 'Gibt alle Versionen/Snapshots eines ETB zurück. Sortiert nach Version absteigend (neueste zuerst).',
  })
  @ApiOkResponse({ type: [EtbSnapshotDto], description: 'Versionshistorie erfolgreich abgerufen' })
  @ApiNotFoundResponse({ description: 'ETB nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Ungültige ETB-ID' })
  async getEtbHistory(@Param('etbId') etbId: string): Promise<EtbSnapshotDtoFromMapper[]> {
    this.logger.log(`Getting history for ETB ${etbId}`);

    try {
      const query = new GetEtbHistoryQuery(etbId);
      const result = await this.getEtbHistoryQueryHandler.execute(query);

      if (result.isFailure) {
        this.logger.error(`Failed to get history for ETB ${etbId}: ${result.error}`);
        if (result.error?.includes('nicht gefunden') || result.error?.includes('not found')) {
          throw new NotFoundException(result.error);
        }
        throw new BadRequestException(result.error);
      }

      this.logger.log(`${result.value?.length ?? 0} snapshots returned for ETB ${etbId}`);
      return result.value ?? [];
    } catch (error) {
      if (error instanceof Error && !(error instanceof NotFoundException) && !(error instanceof BadRequestException)) {
        this.logger.error(`Invalid query parameters: ${error.message}`);
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  // ============================================
  // POST/PUT/DELETE ENDPOINTS (Commands)
  // ============================================

  /**
   * Neuen Eintrag zum ETB hinzufügen (AC2)
   *
   * Erstellt einen neuen Eintrag im ETB via AddEintragCommand.
   * Ein Snapshot wird VOR der Mutation erstellt (DRK-Compliance).
   * Die sequenceNumber wird automatisch inkrementiert.
   *
   * @param etbId - ID des ETB (CUID2 Format)
   * @param dto - AddEintragDto mit text
   * @param user - Authentifizierter User (aus JWT)
   * @returns Neu erstellter EintragDto
   * @throws NotFoundException wenn ETB nicht gefunden
   * @throws BadRequestException bei Validierungsfehlern oder gesperrtem ETB
   */
  @Post(':etbId/eintrag')
  @ApiOperation({
    summary: 'Eintrag zum ETB hinzufügen',
    description: 'Erstellt einen neuen Eintrag im Einsatztagebuch. Ein Snapshot wird vor der Änderung erstellt.',
  })
  @ApiCreatedResponse({ type: EintragDto, description: 'Eintrag erfolgreich erstellt' })
  @ApiNotFoundResponse({ description: 'ETB nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler oder ETB ist gesperrt' })
  async addEintrag(
    @Param('etbId') etbId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: AddEintragDto,
    @CurrentUser() user: ValidatedUser,
  ): Promise<EintragDto> {
    this.logger.log(`Adding Eintrag to ETB ${etbId} by user ${user.userId}`);

    const commandResult = AddEintragCommand.create(etbId, dto.text, user.userId, dto.kategorie, dto.einsatzId, dto.metadata);
    if (commandResult.isFailure || !commandResult.value) {
      this.logger.error(`Invalid AddEintragCommand: ${commandResult.error}`);
      throw new BadRequestException(commandResult.error);
    }

    const result = await this.addEintragHandler.execute(commandResult.value);

    if (result.isFailure) {
      this.logger.error(`Failed to add Eintrag to ETB ${etbId}: ${result.error}`);
      if (result.error?.includes('nicht gefunden') || result.error?.includes('not found')) {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error);
    }

    // Handler returns Result<EtbEintrag>, map to DTO
    const eintrag = result.value;
    if (!eintrag) {
      throw new BadRequestException('Eintrag wurde erstellt, aber kein Ergebnis zurückgegeben');
    }

    const eintragDto = EtbQueryMapper.toEintragDto(eintrag);
    this.logger.log(`Eintrag ${eintragDto.id} added to ETB ${etbId}`);
    return eintragDto;
  }

  /**
   * Eintrag aktualisieren (AC2)
   *
   * Aktualisiert den Text eines Eintrags via UpdateEintragCommand.
   * Ein Snapshot wird VOR der Mutation erstellt (DRK-Compliance).
   * Der alte Text wird für die Historie gespeichert.
   *
   * @param etbId - ID des ETB (CUID2 Format)
   * @param eintragId - ID des Eintrags (CUID2 Format)
   * @param dto - UpdateEintragDto mit newText
   * @param user - Authentifizierter User (aus JWT)
   * @returns Aktualisierter EintragDto
   * @throws NotFoundException wenn ETB oder Eintrag nicht gefunden
   * @throws BadRequestException bei Validierungsfehlern oder gesperrtem ETB
   */
  @Put(':etbId/eintrag/:eintragId')
  @ApiOperation({
    summary: 'ETB-Eintrag aktualisieren',
    description: 'Aktualisiert den Text eines Eintrags. Ein Snapshot wird vor der Änderung erstellt.',
  })
  @ApiOkResponse({ type: EintragDto, description: 'Eintrag erfolgreich aktualisiert' })
  @ApiNotFoundResponse({ description: 'ETB oder Eintrag nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler oder ETB ist gesperrt' })
  async updateEintrag(
    @Param('etbId') etbId: string,
    @Param('eintragId') eintragId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: UpdateEintragDto,
    @CurrentUser() user: ValidatedUser,
  ): Promise<EintragDto> {
    this.logger.log(`Updating Eintrag ${eintragId} in ETB ${etbId} by user ${user.userId}`);

    const commandResult = UpdateEintragCommand.create(etbId, eintragId, dto.newText, user.userId);
    if (commandResult.isFailure || !commandResult.value) {
      this.logger.error(`Invalid UpdateEintragCommand: ${commandResult.error}`);
      throw new BadRequestException(commandResult.error);
    }

    const result = await this.updateEintragHandler.execute(commandResult.value);

    if (result.isFailure) {
      this.logger.error(`Failed to update Eintrag ${eintragId}: ${result.error}`);
      if (result.error?.includes('nicht gefunden') || result.error?.includes('not found')) {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error);
    }

    // Handler returns Result<void>, need to load updated Eintrag via Repository
    // Use findById with EtbId (not einsatzId like GetEtbQuery expects)
    const etbIdResult = EtbId.create(etbId);
    if (etbIdResult.isFailure || !etbIdResult.value) {
      throw new BadRequestException('Ungültige ETB ID');
    }

    const aggregate = await this.etbRepository.findById(etbIdResult.value);
    if (!aggregate) {
      throw new NotFoundException('ETB nicht gefunden nach Update');
    }

    // Map aggregate to DTO and find the updated Eintrag
    const etbDto = EtbQueryMapper.toEtbDto(aggregate, false);
    const updatedEintrag = etbDto.eintraege.find((e: EintragDto) => e.id === eintragId);
    if (!updatedEintrag) {
      throw new NotFoundException(`Eintrag ${eintragId} nicht gefunden nach Update`);
    }

    this.logger.log(`Eintrag ${eintragId} updated in ETB ${etbId}`);
    return updatedEintrag;
  }

  /**
   * Eintrag soft-löschen (AC2)
   *
   * Markiert einen Eintrag als gelöscht via DeleteEintragCommand.
   * Ein Snapshot wird VOR der Mutation erstellt (DRK-Compliance).
   * Der Eintrag wird NICHT physisch gelöscht (Soft-Delete).
   *
   * @param etbId - ID des ETB (CUID2 Format)
   * @param eintragId - ID des Eintrags (CUID2 Format)
   * @param user - Authentifizierter User (aus JWT)
   * @throws NotFoundException wenn ETB oder Eintrag nicht gefunden
   * @throws BadRequestException bei Validierungsfehlern oder gesperrtem ETB
   */
  @Delete(':etbId/eintrag/:eintragId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'ETB-Eintrag soft-löschen',
    description: 'Markiert einen Eintrag als gelöscht (Soft-Delete). Ein Snapshot wird vor der Änderung erstellt.',
  })
  @ApiResponse({ status: 204, description: 'Eintrag erfolgreich gelöscht' })
  @ApiNotFoundResponse({ description: 'ETB oder Eintrag nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler oder ETB ist gesperrt' })
  async deleteEintrag(@Param('etbId') etbId: string, @Param('eintragId') eintragId: string, @CurrentUser() user: ValidatedUser): Promise<void> {
    this.logger.log(`Deleting Eintrag ${eintragId} from ETB ${etbId} by user ${user.userId}`);

    const commandResult = DeleteEintragCommand.create(etbId, eintragId, user.userId);
    if (commandResult.isFailure || !commandResult.value) {
      this.logger.error(`Invalid DeleteEintragCommand: ${commandResult.error}`);
      throw new BadRequestException(commandResult.error);
    }

    const result = await this.deleteEintragHandler.execute(commandResult.value);

    if (result.isFailure) {
      this.logger.error(`Failed to delete Eintrag ${eintragId}: ${result.error}`);
      if (result.error?.includes('nicht gefunden') || result.error?.includes('not found')) {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error);
    }

    this.logger.log(`Eintrag ${eintragId} deleted from ETB ${etbId}`);
    // No return - HTTP 204 No Content
  }

  // ============================================
  // LOCK ENDPOINT (Admin Only)
  // ============================================

  /**
   * ETB sperren (AC3)
   *
   * Sperrt ein ETB irreversibel via LockEtbCommand.
   * Nur ADMIN oder SUPER_ADMIN dürfen diese Operation ausführen.
   * Nach der Sperrung können keine Einträge mehr hinzugefügt/geändert/gelöscht werden.
   *
   * @param etbId - ID des ETB (CUID2 Format)
   * @param user - Authentifizierter User (aus JWT) mit ADMIN/SUPER_ADMIN Rolle
   * @throws NotFoundException wenn ETB nicht gefunden
   * @throws BadRequestException bei Validierungsfehlern oder bereits gesperrtem ETB
   * @throws ForbiddenException wenn User keine ADMIN/SUPER_ADMIN Rolle hat
   */
  @Post(':etbId/lock')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(204)
  @ApiOperation({
    summary: 'ETB sperren (nur Admin)',
    description: 'Sperrt das ETB irreversibel. Nur ADMIN oder SUPER_ADMIN können diese Aktion ausführen.',
  })
  @ApiResponse({ status: 204, description: 'ETB erfolgreich gesperrt' })
  @ApiNotFoundResponse({ description: 'ETB nicht gefunden' })
  @ApiBadRequestResponse({ description: 'ETB ist bereits gesperrt oder Validierungsfehler' })
  @ApiForbiddenResponse({ description: 'Nur ADMIN oder SUPER_ADMIN berechtigt' })
  async lockEtb(@Param('etbId') etbId: string, @CurrentUser() user: ValidatedUser): Promise<void> {
    this.logger.log(`Locking ETB ${etbId} by user ${user.userId} (role: ${user.role})`);

    const userRole = user.role ?? 'USER';
    const commandResult = LockEtbCommand.create(etbId, user.userId, userRole);
    if (commandResult.isFailure || !commandResult.value) {
      this.logger.error(`Invalid LockEtbCommand: ${commandResult.error}`);
      throw new BadRequestException(commandResult.error);
    }

    const result = await this.lockEtbHandler.execute(commandResult.value);

    if (result.isFailure) {
      this.logger.error(`Failed to lock ETB ${etbId}: ${result.error}`);
      if (result.error?.includes('nicht gefunden') || result.error?.includes('not found')) {
        throw new NotFoundException(result.error);
      }
      if (result.error?.includes('Administratoren')) {
        throw new ForbiddenException(result.error);
      }
      throw new BadRequestException(result.error);
    }

    this.logger.log(`ETB ${etbId} locked by user ${user.userId}`);
    // No return - HTTP 204 No Content
  }
}
