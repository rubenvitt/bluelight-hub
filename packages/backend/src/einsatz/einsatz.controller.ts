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
import { GetEinsatzDetailsQuery, GetEinsatzDetailsQueryHandler, GetActiveEinsaetzeWithCountsQuery, GetActiveEinsaetzeWithCountsQueryHandler } from '@/application/einsatz/queries';
import { Body, Controller, Get, Logger, NotFoundException, Param, Patch, Post, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import * as util from 'node:util';
import { EinsatzService } from './einsatz.service';

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
    private readonly einsatzService: EinsatzService,
    private readonly duplicateDetectionService: CacheDuplicateDetectionService,
    private readonly getEinsatzDetailsHandler: GetEinsatzDetailsQueryHandler,
    private readonly getActiveEinsaetzeWithCountsHandler: GetActiveEinsaetzeWithCountsQueryHandler,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Neuen Einsatz erstellen',
    description: 'Erstellt einen neuen Einsatz mit automatisch generiertem Namen. Alle Felder sind optional.',
  })
  @ApiWrappedResponse(EinsatzResponseDto, { description: 'Einsatz erfolgreich erstellt' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler in den Eingabedaten' })
  async create(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    createEinsatzDto: CreateEinsatzDto,
    @CurrentUser() user: ValidatedUser,
  ): Promise<EinsatzResponseDto> {
    this.logger.log(`Creating new Einsatz for user ${user.userId}`);

    // Generiere Cache-Key basierend auf Eingabedaten und User
    const cacheKey = `einsatz:create:${user.userId}:${JSON.stringify(createEinsatzDto)}`;

    return await this.duplicateDetectionService.executeIdempotent(
      cacheKey,
      () => this.einsatzService.create(createEinsatzDto, user.userId),
      60000, // 1 Minute TTL
    );
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
  async getActiveEinsaetzeWithCounts(): Promise<EinsatzListItemDto[]> {
    this.logger.log('Fetching active Einsätze with counts');

    const query = new GetActiveEinsaetzeWithCountsQuery();
    const result = await this.getActiveEinsaetzeWithCountsHandler.execute(query);

    if (result.isFailure) {
      this.logger.error(`Failed to get active Einsätze with counts: ${result.error}`);
      throw new Error(result.error ?? 'Unbekannter Fehler');
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
    const result = await this.getEinsatzDetailsHandler.execute(query);

    if (result.isFailure) {
      this.logger.error(`Failed to get Einsatz details: ${result.error}`);
      throw new NotFoundException(result.error);
    }

    const einsatzDetails = result.value;
    if (!einsatzDetails) {
      throw new NotFoundException(`Einsatz mit ID ${id} nicht gefunden`);
    }

    return einsatzDetails;
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
  @ApiWrappedResponse(EinsatzResponseDto, { description: 'Einsatz erfolgreich aktualisiert' })
  @ApiNotFoundResponse({
    description: 'Einsatz nicht gefunden',
  })
  @ApiBadRequestResponse({ description: 'Validierungsfehler in den Eingabedaten' })
  async update(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    updateEinsatzDto: UpdateEinsatzDto,
    @CurrentUser() user: ValidatedUser,
  ): Promise<EinsatzResponseDto> {
    this.logger.log(`Updating Einsatz ${id} by user ${user.userId}`);

    // Generiere Cache-Key basierend auf ID, Eingabedaten und User
    const cacheKey = `einsatz:update:${id}:${user.userId}:${JSON.stringify(updateEinsatzDto)}`;

    return await this.duplicateDetectionService.executeIdempotent(
      cacheKey,
      () => this.einsatzService.update(id, updateEinsatzDto, user.userId),
      60000, // 1 Minute TTL
    );
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
  @ApiWrappedResponse(EinsatzResponseDto, { description: 'Einsatz erfolgreich archiviert' })
  @ApiNotFoundResponse({
    description: 'Einsatz nicht gefunden',
  })
  async archive(@Param('id') id: string, @CurrentUser() user: ValidatedUser): Promise<EinsatzResponseDto> {
    this.logger.warn(`Archiving Einsatz ${id} by user ${user.userId} (No-Delete Policy)`);
    return await this.einsatzService.archive(id, user.userId);
  }
}
