import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { Roles } from '@/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import type { ValidatedUser } from '@/auth/strategies/jwt.strategy';
import { ApiWrappedResponse } from '@/common/decorators/api-wrapped-response.decorator';
import { SkipTransform } from '@/common/decorators/skip-transform.decorator';
import type { PaginatedData } from '@/common/interceptors/transform.interceptor';
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
import { CreateEinsatzCommand, UpdateEinsatzCommand, ArchiveEinsatzCommand, CompleteEinsatzCommand } from '@/application/einsatz/commands';
import { GetEinsatzDetailsQuery, GetActiveEinsaetzeWithCountsQuery, GetEinsatzByIdQuery } from '@/application/einsatz/queries';
import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, UseGuards, ValidationPipe, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { EinsatzService } from './einsatz.service';
import { EinsatzDto } from '@/application/einsatz/dto/einsatz.dto';

/**
 * Controller für Einsatzverwaltung (CQRS Pattern)
 *
 * Dieser Controller ist ein "thin adapter" der HTTP-Requests zu Commands/Queries mappt.
 * Business-Logik ist in Command/Query Handlern implementiert.
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
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiUnauthorizedResponse({ description: 'Nicht authentifiziert - JWT Token fehlt oder ungültig' })
@ApiForbiddenResponse({ description: 'Keine Berechtigung für diese Aktion' })
@Controller({
  path: 'einsatz',
  version: 'alpha',
})
export class EinsatzController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    // EinsatzService temporär beibehalten für Endpoints die noch nicht migriert sind
    // TODO Story 4-10: Vollständig zu CQRS migrieren
    private readonly einsatzService: EinsatzService,
  ) {}

  /**
   * Erstellt einen neuen Einsatz via CQRS Command
   */
  @Post()
  @Roles('USER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Neuen Einsatz erstellen', description: 'Erstellt einen neuen Einsatz mit automatisch generiertem Namen.' })
  @ApiCreatedResponse({ type: EinsatzDto, description: 'Einsatz erfolgreich erstellt' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler in den Eingabedaten' })
  async create(@Body(new ValidationPipe({ transform: true, whitelist: true })) dto: CreateEinsatzDto, @CurrentUser() user: ValidatedUser): Promise<EinsatzDto> {
    const commandResult = CreateEinsatzCommand.create(dto.alarmstichwort || 'Unbekannt', user.userId, undefined, dto.beschreibung);
    if (commandResult.isFailure || !commandResult.value) throw new BadRequestException(commandResult.error);

    const result = await this.commandBus.execute(commandResult.value);
    if (result.isFailure) throw new BadRequestException(result.error);

    return this.loadEinsatzById(result.value.value);
  }

  /**
   * Lädt paginierte Einsatz-Liste
   * TODO Story 4-10: Migration zu GetAllEinsaetzeQuery
   */
  @Get()
  @ApiOperation({ summary: 'Alle Einsätze abrufen', description: 'Paginierte Liste aller Einsätze. Archivierte standardmäßig ausgeschlossen.' })
  @ApiWrappedResponse(EinsatzResponseDto, { description: 'Paginierte Liste der Einsätze', isArray: true })
  @ApiBadRequestResponse({ description: 'Ungültige Query-Parameter' })
  async findAll(@Query(new ValidationPipe({ transform: true, whitelist: true })) query: EinsatzQueryDto): Promise<PaginatedData<EinsatzResponseDto>> {
    return this.einsatzService.findAll(query);
  }

  /**
   * Optimierte Liste aktiver Einsätze mit ETB-Einträge und POI-Counts via CQRS Query
   */
  @Get('active-with-counts')
  @SkipTransform()
  @ApiOperation({ summary: 'Aktive Einsätze mit Counts abrufen', description: 'Optimierte Abfrage für Dashboard: Liefert alle nicht-archivierten Einsätze mit ETB-Einträge und POI-Counts.' })
  @ApiOkResponse({ type: [EinsatzListItemDto], description: 'Liste aktiver Einsätze mit Counts' })
  @ApiBadRequestResponse({ description: 'Fehler beim Abrufen der Einsätze' })
  async getActiveEinsaetzeWithCounts(): Promise<EinsatzListItemDto[]> {
    const result = await this.queryBus.execute(new GetActiveEinsaetzeWithCountsQuery());
    if (result.isFailure) throw new BadRequestException(result.error ?? 'Unbekannter Fehler');
    return result.value ?? [];
  }

  /**
   * Status-Statistiken
   * TODO Story 4-10: Migration zu GetStatusCountsQuery
   */
  @Get('stats/status-counts')
  @ApiOperation({ summary: 'Status-Statistiken abrufen', description: 'Anzahl der Einsätze pro Status.' })
  @ApiWrappedResponse(StatusCountsResponseDto, { description: 'Status-Statistiken erfolgreich abgerufen' })
  async getStatusCounts(@Query(new ValidationPipe({ transform: true, whitelist: true })) query: StatusCountsQueryDto): Promise<StatusCountsResponseDto> {
    return this.einsatzService.getStatusCounts(query.includeArchived);
  }

  /**
   * Navigation: Vorheriger Einsatz
   * TODO Story 4-10: Migration zu GetPreviousEinsatzIdQuery
   */
  @Get(':id/navigation/previous')
  @ApiOperation({ summary: 'ID des vorherigen Einsatzes abrufen', description: 'Gibt die ID des vorherigen Einsatzes basierend auf createdAt zurück.' })
  @ApiWrappedResponse(NavigationResponseDto, { description: 'ID des vorherigen Einsatzes oder null' })
  @ApiNotFoundResponse({ description: 'Einsatz nicht gefunden' })
  async getPrevious(@Param('id') id: string): Promise<NavigationResponseDto> {
    return this.einsatzService.getPreviousId(id);
  }

  /**
   * Navigation: Nächster Einsatz
   * TODO Story 4-10: Migration zu GetNextEinsatzIdQuery
   */
  @Get(':id/navigation/next')
  @ApiOperation({ summary: 'ID des nächsten Einsatzes abrufen', description: 'Gibt die ID des nächsten Einsatzes basierend auf createdAt zurück.' })
  @ApiWrappedResponse(NavigationResponseDto, { description: 'ID des nächsten Einsatzes oder null' })
  @ApiNotFoundResponse({ description: 'Einsatz nicht gefunden' })
  async getNext(@Param('id') id: string): Promise<NavigationResponseDto> {
    return this.einsatzService.getNextId(id);
  }

  /**
   * Vollständigkeits-Check
   * TODO Story 4-10: Migration zu GetEinsatzCompletenessQuery
   */
  @Get(':id/completeness')
  @ApiOperation({ summary: 'Vollständigkeits-Check für Einsatz', description: 'Berechnet und gibt die Vollständigkeit eines Einsatzes zurück.' })
  @ApiWrappedResponse(CompletenessResponseDto, { description: 'Vollständigkeits-Information erfolgreich abgerufen' })
  @ApiNotFoundResponse({ description: 'Einsatz nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Ungültige Einsatz-ID oder Query-Parameter' })
  async getCompleteness(@Param('id') id: string, @Query(new ValidationPipe({ transform: true, whitelist: true })) query: CompletenessQueryDto): Promise<CompletenessResponseDto> {
    return this.einsatzService.getCompleteness(id, query.refresh);
  }

  /**
   * Kombinierte Abfrage für Einsatz mit ETB und Lagekarte via CQRS Query
   */
  @Get(':id/details')
  @ApiOperation({ summary: 'Einsatz mit ETB und Lagekarte abrufen (kombiniert)', description: 'Lädt Einsatz mit ETB und Lagekarte in einer Anfrage.' })
  @ApiOkResponse({ type: EinsatzDetailsDto, description: 'Einsatz mit ETB und Lagekarte' })
  @ApiNotFoundResponse({ description: 'Einsatz nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Ungültige Einsatz-ID' })
  async getEinsatzDetails(@Param('id') id: string): Promise<EinsatzDetailsDto> {
    const result = await this.queryBus.execute(new GetEinsatzDetailsQuery(id));
    if (result.isFailure) throw new NotFoundException(result.error);
    if (!result.value) throw new NotFoundException(`Einsatz mit ID ${id} nicht gefunden`);
    return result.value;
  }

  /**
   * Einzelnen Einsatz abrufen via CQRS Query
   */
  @Get(':id')
  @ApiOperation({ summary: 'Einzelnen Einsatz abrufen', description: 'Gibt einen einzelnen Einsatz mit allen Details zurück.' })
  @ApiWrappedResponse(EinsatzResponseDto, { description: 'Einsatz gefunden' })
  @ApiNotFoundResponse({ description: 'Einsatz nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Ungültige Einsatz-ID' })
  async findOne(@Param('id') id: string): Promise<EinsatzResponseDto> {
    // TODO Story 4-10: Migration zu vollständigem GetEinsatzByIdQuery mit allen ResponseDto-Feldern
    return this.einsatzService.findOne(id);
  }

  /**
   * Einsatz aktualisieren via CQRS Command
   */
  @Patch(':id')
  @Roles('USER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Einsatz aktualisieren', description: 'Aktualisiert einen bestehenden Einsatz.' })
  @ApiOkResponse({ type: EinsatzDto, description: 'Einsatz erfolgreich aktualisiert' })
  @ApiNotFoundResponse({ description: 'Einsatz nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler in den Eingabedaten' })
  async update(@Param('id') id: string, @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: UpdateEinsatzDto, @CurrentUser() _user: ValidatedUser): Promise<EinsatzDto> {
    const commandResult = UpdateEinsatzCommand.create(id, dto.alarmstichwort, undefined, dto.beschreibung);
    if (commandResult.isFailure || !commandResult.value) throw new BadRequestException(commandResult.error);

    const result = await this.commandBus.execute(commandResult.value);
    if (result.isFailure) {
      if (result.error?.includes('nicht gefunden') || result.error?.includes('not found')) throw new NotFoundException(result.error);
      throw new BadRequestException(result.error);
    }

    return this.loadEinsatzById(id);
  }

  /**
   * Schließt einen Einsatz ab via CQRS Command
   */
  @Post(':id/complete')
  @Roles('USER', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Einsatz abschließen', description: 'Markiert einen Einsatz als ABGESCHLOSSEN und sperrt das ETB.' })
  @ApiOkResponse({ type: EinsatzDto, description: 'Einsatz erfolgreich abgeschlossen' })
  @ApiNotFoundResponse({ description: 'Einsatz nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Einsatz kann nicht abgeschlossen werden (z.B. bereits abgeschlossen)' })
  async complete(@Param('id') id: string, @CurrentUser() user: ValidatedUser): Promise<EinsatzDto> {
    const commandResult = CompleteEinsatzCommand.create(id, user.userId);
    if (commandResult.isFailure || !commandResult.value) throw new BadRequestException(commandResult.error);

    const result = await this.commandBus.execute(commandResult.value);
    if (result.isFailure) {
      if (result.error?.includes('nicht gefunden') || result.error?.includes('not found')) throw new NotFoundException(result.error);
      throw new BadRequestException(result.error);
    }

    return this.loadEinsatzById(id);
  }

  /**
   * Archiviert einen Einsatz (Soft-Delete gemäß No-Delete Policy) via CQRS Command
   */
  @Post(':id/archive')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Einsatz archivieren (Soft-Delete)', description: 'Markiert einen Einsatz als ARCHIVIERT. Niemals physisch gelöscht.' })
  @ApiOkResponse({ type: EinsatzDto, description: 'Einsatz erfolgreich archiviert' })
  @ApiNotFoundResponse({ description: 'Einsatz nicht gefunden' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler oder Einsatz kann nicht archiviert werden' })
  async archive(@Param('id') id: string, @CurrentUser() user: ValidatedUser): Promise<EinsatzDto> {
    const commandResult = ArchiveEinsatzCommand.create(id, user.userId);
    if (commandResult.isFailure || !commandResult.value) throw new BadRequestException(commandResult.error);

    const result = await this.commandBus.execute(commandResult.value);
    if (result.isFailure) {
      if (result.error?.includes('nicht gefunden') || result.error?.includes('not found')) throw new NotFoundException(result.error);
      throw new BadRequestException(result.error);
    }

    return this.loadEinsatzById(id);
  }

  /**
   * NO-DELETE Policy Enforcement: DELETE-Requests werden explizit abgelehnt
   */
  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Einsatz löschen (NICHT ERLAUBT)',
    description: 'Einsätze dürfen aus Compliance-Gründen NIEMALS gelöscht werden. Nutze stattdessen Archive-Funktion.',
  })
  @ApiBadRequestResponse({ description: 'Einsätze können nicht gelöscht werden (NO-DELETE Policy)' })
  async delete(@Param('id') _id: string): Promise<never> {
    throw new BadRequestException(
      'Einsätze können aus rechtlichen Gründen (Aufbewahrungspflicht) nicht gelöscht werden. ' + 'Nutze stattdessen die Archive-Funktion (POST /api/v-alpha/einsatz/:id/archive).',
    );
  }

  /**
   * Helper: Lädt Einsatz nach Command-Ausführung via QueryBus
   */
  private async loadEinsatzById(id: string): Promise<EinsatzDto> {
    const query = new GetEinsatzByIdQuery(id);
    const result = await this.queryBus.execute(query);
    if (result.isFailure) throw new InternalServerErrorException(result.error);
    if (!result.value) throw new NotFoundException(`Einsatz mit ID ${id} nicht gefunden`);
    return result.value;
  }
}
