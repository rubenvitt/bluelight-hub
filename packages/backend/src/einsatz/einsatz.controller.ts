import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import type { ValidatedUser } from '@/auth/strategies/jwt.strategy';
import { ApiWrappedResponse } from '@/common/decorators/api-wrapped-response.decorator';
import type { PaginatedData } from '@/common/interceptors/transform.interceptor';
import { CacheDuplicateDetectionService } from '@/common/services/cache-duplicate-detection.service';
import {
  CompletenessQueryDto,
  CompletenessResponseDto,
  CreateEinsatzDto,
  EinsatzQueryDto,
  EinsatzResponseDto,
  NavigationResponseDto,
  StatusCountsQueryDto,
  StatusCountsResponseDto,
  UpdateEinsatzDto,
} from '@/einsatz/dto';
import { EinsatzDetailsDto, EinsatzListItemDto } from '@/application/einsatz/dto';
import { CreateEinsatzCommand, UpdateEinsatzCommand, ArchiveEinsatzCommand } from '@/application/einsatz/commands';
import { GetEinsatzDetailsQuery, GetActiveEinsaetzeWithCountsQuery, GetEinsatzByIdQuery } from '@/application/einsatz/queries';
import { Body, Controller, Get, Logger, NotFoundException, Param, Patch, Post, Query, UseGuards, ValidationPipe, BadRequestException } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import * as util from 'node:util';
import { EinsatzService } from './einsatz.service';
import { EinsatzDto } from '@/application/einsatz/dto/einsatz.dto';

/**
 * Controller für Einsatzverwaltung
 *
 * SICHERHEITSKRITISCH: No-Delete Policy
 * =====================================
 * Einsätze dürfen aus rechtlichen und Compliance-Gründen NIEMALS physisch gelöscht werden!
 *
 * Gründe:
 * - Gesetzliche Aufbewahrungspflichten (mind. 10 Jahre)
 * - Audit-Trail und Nachvollziehbarkeit
 * - Beweissicherung für rechtliche Verfahren
 * - Compliance-Anforderungen für Rettungsorganisationen
 *
 * Archivierung statt Löschung:
 * - Verwende Status 'ARCHIVIERT' für "gelöschte" Einsätze
 * - Soft-Delete Pattern mit Filterung in Abfragen
 * - Keine DELETE-Endpoints implementieren
 *
 * @security Diese Policy ist in arc42 Kapitel 08-concepts dokumentiert
 * @see docs/architecture/08-concepts.adoc#no-delete-policy-für-einsätze
 */
@ApiTags('Einsatz')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Nicht authentifiziert - JWT Token fehlt oder ungültig' })
@ApiForbiddenResponse({ description: 'Keine Berechtigung für diese Aktion' })
@Controller({
  path: 'einsatz',
  version: 'alpha',
})
export class EinsatzController {
  private readonly logger = new Logger(EinsatzController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly einsatzService: EinsatzService,
    private readonly duplicateDetectionService: CacheDuplicateDetectionService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Neuen Einsatz erstellen',
    description: 'Erstellt einen neuen Einsatz mit automatisch generiertem Namen. Alle Felder sind optional.',
  })
  @ApiCreatedResponse({ type: EinsatzDto, description: 'Einsatz erfolgreich erstellt' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler in den Eingabedaten' })
  async create(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    createEinsatzDto: CreateEinsatzDto,
    @CurrentUser() user: ValidatedUser,
  ): Promise<EinsatzDto> {
    this.logger.log(`Creating new Einsatz for user ${user.userId}`);

    // Command erstellen und validieren
    const commandResult = CreateEinsatzCommand.create(
      createEinsatzDto.alarmstichwort || 'Unbekannt',
      user.userId,
      undefined, // einsatzort TODO: von DTO mappen
      createEinsatzDto.beschreibung,
    );
    if (commandResult.isFailure || !commandResult.value) {
      throw new BadRequestException(commandResult.error);
    }

    // Command ausfuehren
    const result = await this.commandBus.execute(commandResult.value);
    if (result.isFailure) throw new BadRequestException(result.error);
    if (!result.value) throw new BadRequestException('Einsatz-ID wurde nicht zurückgegeben');

    // Einsatz laden via Query
    const query = new GetEinsatzByIdQuery(result.value.value);
    const einsatzResult = await this.queryBus.execute(query);
    if (einsatzResult.isFailure) throw new BadRequestException(einsatzResult.error);
    if (!einsatzResult.value) throw new NotFoundException('Einsatz wurde erstellt, konnte aber nicht geladen werden');

    return einsatzResult.value;
  }

  @Get()
  @ApiOperation({
    summary: 'Alle Einsätze abrufen',
    description:
      'Gibt eine paginierte Liste aller Einsätze zurück. WICHTIG: Archivierte Einsätze werden gemäß No-Delete Policy standardmäßig ausgeschlossen. Verwende includeArchived=true um archivierte Einsätze einzuschließen.',
  })
  @ApiWrappedResponse(EinsatzResponseDto, { description: 'Paginierte Liste der Einsätze (ohne archivierte, außer explizit angefordert)', isArray: true })
  @ApiBadRequestResponse({ description: 'Ungültige Query-Parameter' })
  async findAll(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: EinsatzQueryDto,
  ): Promise<PaginatedData<EinsatzResponseDto>> {
    const sanitizedQuery = {
      status: query.status,
      page: query.page,
      limit: query.limit,
      includeArchived: query.includeArchived,
      sortBy: query.orderBy,
      sortOrder: query.orderDirection,
    };
    this.logger.log(`Fetching Einsätze with filters: ${util.inspect(sanitizedQuery)}`);
    return await this.einsatzService.findAll(query);
  }

  /**
   * Optimierte Liste aktiver Einsätze mit ETB-Einträge und POI-Counts.
   * Ersetzt mehrere einzelne API-Calls für Dashboard-Ansichten.
   *
   * @returns Aktive Einsätze (nicht ARCHIVIERT) mit Counts
   */
  @Get('active-with-counts')
  @ApiOperation({
    summary: 'Aktive Einsätze mit Counts abrufen',
    description: 'Optimierte Abfrage für Dashboard: Liefert alle nicht-archivierten Einsätze mit ETB-Einträge und POI-Counts. ' + 'Sortiert nach Erstellungsdatum (neueste zuerst).',
  })
  @ApiOkResponse({ type: [EinsatzListItemDto], description: 'Liste aktiver Einsätze mit Counts' })
  @ApiBadRequestResponse({ description: 'Fehler beim Abrufen der Einsätze' })
  async getActiveEinsaetzeWithCounts(): Promise<EinsatzListItemDto[]> {
    this.logger.log('Fetching active Einsätze with counts');

    const query = new GetActiveEinsaetzeWithCountsQuery();
    const result = await this.queryBus.execute(query);

    if (result.isFailure) {
      this.logger.error(`Failed to get active Einsätze with counts: ${result.error}`);
      throw new BadRequestException(result.error ?? 'Unbekannter Fehler');
    }

    return result.value ?? [];
  }

  @Get('stats/status-counts')
  @ApiOperation({
    summary: 'Status-Statistiken abrufen',
    description: 'Gibt die Anzahl der Einsätze pro Status zurück.',
  })
  @ApiWrappedResponse(StatusCountsResponseDto, { description: 'Status-Statistiken erfolgreich abgerufen' })
  async getStatusCounts(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: StatusCountsQueryDto,
  ): Promise<StatusCountsResponseDto> {
    this.logger.log(`Getting status counts (includeArchived: ${query.includeArchived})`);
    return await this.einsatzService.getStatusCounts(query.includeArchived);
  }

  @Get(':id/navigation/previous')
  @ApiOperation({
    summary: 'ID des vorherigen Einsatzes abrufen',
    description: 'Gibt nur die ID des vorherigen Einsatzes basierend auf createdAt zurück. Effizient für Navigation.',
  })
  @ApiWrappedResponse(NavigationResponseDto, { description: 'ID des vorherigen Einsatzes oder null' })
  @ApiNotFoundResponse({
    description: 'Einsatz mit der angegebenen ID nicht gefunden',
  })
  async getPrevious(@Param('id') id: string): Promise<NavigationResponseDto> {
    this.logger.log(`Getting previous Einsatz ID for ${id}`);
    return await this.einsatzService.getPreviousId(id);
  }

  @Get(':id/navigation/next')
  @ApiOperation({
    summary: 'ID des nächsten Einsatzes abrufen',
    description: 'Gibt nur die ID des nächsten Einsatzes basierend auf createdAt zurück. Effizient für Navigation.',
  })
  @ApiWrappedResponse(NavigationResponseDto, { description: 'ID des nächsten Einsatzes oder null' })
  @ApiNotFoundResponse({
    description: 'Einsatz mit der angegebenen ID nicht gefunden',
  })
  async getNext(@Param('id') id: string): Promise<NavigationResponseDto> {
    this.logger.log(`Getting next Einsatz ID for ${id}`);
    return await this.einsatzService.getNextId(id);
  }

  @Get(':id/completeness')
  @ApiOperation({
    summary: 'Vollständigkeits-Check für Einsatz',
    description: 'Berechnet und gibt die Vollständigkeit eines Einsatzes zurück.',
  })
  @ApiWrappedResponse(CompletenessResponseDto, { description: 'Vollständigkeits-Information erfolgreich abgerufen' })
  @ApiNotFoundResponse({
    description: 'Einsatz nicht gefunden',
  })
  @ApiBadRequestResponse({ description: 'Ungültige Einsatz-ID oder Query-Parameter' })
  async getCompleteness(
    @Param('id') id: string,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: CompletenessQueryDto,
  ): Promise<CompletenessResponseDto> {
    this.logger.log(`Getting completeness for Einsatz ${id} (refresh: ${query.refresh})`);

    try {
      const result = await this.einsatzService.getCompleteness(id, query.refresh);
      this.logger.log(`Completeness for Einsatz ${id}: ${result.score}% complete`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to get completeness for Einsatz ${id}: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Kombinierte Abfrage für Einsatz mit ETB und Lagekarte.
   * Reduziert Frontend API-Calls von 3 auf 1 für bessere Performance.
   *
   * @param id Einsatz-ID (CUID2 Format)
   * @returns Einsatz mit zugehörigem ETB und Lagekarte (beide können null sein)
   */
  @Get(':id/details')
  @ApiOperation({
    summary: 'Einsatz mit ETB und Lagekarte abrufen (kombiniert)',
    description: 'Lädt einen Einsatz zusammen mit seinem Einsatztagebuch und Lagekarte in einer einzigen Anfrage. ' + 'ETB und Lagekarte können null sein, wenn sie noch nicht erstellt wurden.',
  })
  @ApiOkResponse({ type: EinsatzDetailsDto, description: 'Einsatz mit ETB und Lagekarte' })
  @ApiNotFoundResponse({ description: 'Einsatz nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Ungültige Einsatz-ID' })
  async getEinsatzDetails(@Param('id') id: string): Promise<EinsatzDetailsDto> {
    this.logger.log(`Fetching Einsatz details (combined) for ${id}`);

    const query = new GetEinsatzDetailsQuery(id);
    const result = await this.queryBus.execute(query);

    if (result.isFailure) {
      this.logger.error(`Failed to get Einsatz details: ${result.error}`);
      throw new NotFoundException(result.error);
    }

    if (!result.value) {
      throw new NotFoundException(`Einsatz mit ID ${id} nicht gefunden`);
    }

    return result.value;
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Einzelnen Einsatz abrufen',
    description: 'Gibt einen einzelnen Einsatz mit allen Details zurück.',
  })
  @ApiWrappedResponse(EinsatzResponseDto, { description: 'Einsatz gefunden' })
  @ApiNotFoundResponse({
    description: 'Einsatz nicht gefunden',
  })
  @ApiBadRequestResponse({ description: 'Ungültige Einsatz-ID' })
  async findOne(@Param('id') id: string): Promise<EinsatzResponseDto> {
    this.logger.log(`Fetching Einsatz ${id}`);
    return await this.einsatzService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Einsatz aktualisieren',
    description: 'Aktualisiert einen bestehenden Einsatz. Der Name wird automatisch neu generiert.',
  })
  @ApiOkResponse({ type: EinsatzDto, description: 'Einsatz erfolgreich aktualisiert' })
  @ApiNotFoundResponse({ description: 'Einsatz nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler in den Eingabedaten' })
  async update(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    updateEinsatzDto: UpdateEinsatzDto,
    @CurrentUser() user: ValidatedUser,
  ): Promise<EinsatzDto> {
    this.logger.log(`Updating Einsatz ${id} by user ${user.userId}`);

    // Command erstellen und validieren
    const commandResult = UpdateEinsatzCommand.create(
      id,
      updateEinsatzDto.alarmstichwort,
      undefined, // einsatzort TODO: von DTO mappen
      updateEinsatzDto.beschreibung,
    );
    if (commandResult.isFailure || !commandResult.value) {
      throw new BadRequestException(commandResult.error);
    }

    // Command ausfuehren
    const result = await this.commandBus.execute(commandResult.value);
    if (result.isFailure) {
      if (result.error?.includes('nicht gefunden') || result.error?.includes('not found')) {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error);
    }

    // Einsatz laden via Query
    const query = new GetEinsatzByIdQuery(id);
    const einsatzResult = await this.queryBus.execute(query);
    if (einsatzResult.isFailure) throw new BadRequestException(einsatzResult.error);
    if (!einsatzResult.value) throw new NotFoundException('Einsatz wurde aktualisiert, konnte aber nicht geladen werden');

    return einsatzResult.value;
  }

  /**
   * Archiviert einen Einsatz (Soft-Delete gemäß No-Delete Policy)
   *
   * @security Verwende diesen Endpoint statt DELETE!
   * Einsätze werden nicht gelöscht, sondern als ARCHIVIERT markiert.
   */
  @Patch(':id/archive')
  @ApiOperation({
    summary: 'Einsatz archivieren (Soft-Delete)',
    description: 'Markiert einen Einsatz als ARCHIVIERT. Einsätze werden gemäß No-Delete Policy niemals physisch gelöscht.',
  })
  @ApiOkResponse({ type: EinsatzDto, description: 'Einsatz erfolgreich archiviert' })
  @ApiNotFoundResponse({ description: 'Einsatz nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler oder Einsatz kann nicht archiviert werden' })
  async archive(@Param('id') id: string, @CurrentUser() user: ValidatedUser): Promise<EinsatzDto> {
    this.logger.warn(`Archiving Einsatz ${id} by user ${user.userId} (No-Delete Policy)`);

    // Command erstellen und validieren
    const commandResult = ArchiveEinsatzCommand.create(id, user.userId);
    if (commandResult.isFailure || !commandResult.value) {
      throw new BadRequestException(commandResult.error);
    }

    // Command ausfuehren
    const result = await this.commandBus.execute(commandResult.value);
    if (result.isFailure) {
      if (result.error?.includes('nicht gefunden') || result.error?.includes('not found')) {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error);
    }

    // Einsatz laden via Query
    const query = new GetEinsatzByIdQuery(id);
    const einsatzResult = await this.queryBus.execute(query);
    if (einsatzResult.isFailure) throw new BadRequestException(einsatzResult.error);
    if (!einsatzResult.value) throw new NotFoundException('Einsatz wurde archiviert, konnte aber nicht geladen werden');

    return einsatzResult.value;
  }
}
