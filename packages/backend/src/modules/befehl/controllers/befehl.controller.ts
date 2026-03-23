import { AddBefehlKommentarHandler } from '@/application/befehl/commands/add-befehl-kommentar/add-befehl-kommentar.handler';
import { AddBefehlKommentarCommand } from '@/application/befehl/commands/add-befehl-kommentar/add-befehl-kommentar.command';
import { CreateBefehlHandler } from '@/application/befehl/commands/create-befehl/create-befehl.handler';
import { KorrigiereBefehlHandler } from '@/application/befehl/commands/korrigiere-befehl/korrigiere-befehl.handler';
import { QuittierenBefehlHandler } from '@/application/befehl/commands/quittieren-befehl/quittieren-befehl.handler';
import { GetBefehlHistorieQueryHandler } from '@/application/befehl/queries/get-befehl-historie/get-befehl-historie.handler';
import { GetBefehlHistorieQuery } from '@/application/befehl/queries/get-befehl-historie/get-befehl-historie.query';
import { EmpfaengerSucheQueryHandler } from '@/application/befehl/queries/empfaenger-suche/empfaenger-suche.handler';
import { EmpfaengerSucheQuery } from '@/application/befehl/queries/empfaenger-suche/empfaenger-suche.query';
import { EmpfaengerSucheResultDto } from '@/application/befehl/dto/empfaenger-suche-result.dto';
import { BefehlsgeberSucheQueryHandler } from '@/application/befehl/queries/befehlsgeber-suche/befehlsgeber-suche.handler';
import { BefehlsgeberSucheQuery } from '@/application/befehl/queries/befehlsgeber-suche/befehlsgeber-suche.query';
import { BefehlsgeberSucheResultDto } from '@/application/befehl/dto/befehlsgeber-suche-result.dto';
import { ExportBefehleQueryHandler } from '@/application/befehl/queries/export-befehle/export-befehle.handler';
import { ExportBefehleQuery } from '@/application/befehl/queries/export-befehle/export-befehle.query';
import { CreateBefehlCommand } from '@/application/befehl/commands/create-befehl/create-befehl.command';
import { KorrigiereBefehlCommand } from '@/application/befehl/commands/korrigiere-befehl/korrigiere-befehl.command';
import { QuittierenBefehlCommand } from '@/application/befehl/commands/quittieren-befehl/quittieren-befehl.command';
import { AendereEmpfaengerStatusHandler } from '@/application/befehl/commands/aendere-empfaenger-status/aendere-empfaenger-status.handler';
import { AendereEmpfaengerStatusCommand } from '@/application/befehl/commands/aendere-empfaenger-status/aendere-empfaenger-status.command';
import { AendereEmpfaengerStatusDto } from '@/application/befehl/dto/aendere-empfaenger-status.dto';
import { AddBefehlKommentarDto } from '@/application/befehl/dto/add-befehl-kommentar.dto';
import { CreateBefehlDto } from '@/application/befehl/dto/create-befehl.dto';
import { KorrigiereBefehlDto } from '@/application/befehl/dto/korrigiere-befehl.dto';
import { QuittierenBefehlDto } from '@/application/befehl/dto/quittieren-befehl.dto';
import { BefehlDto } from '@/application/befehl/dto/befehl.dto';
import { BefehlEmpfaengerDto } from '@/application/befehl/dto/befehl-empfaenger.dto';
import { BefehlHistorieTimelineDto } from '@/application/befehl/dto/befehl-historie.dto';
import { BefehlKommentarDto } from '@/application/befehl/dto/befehl-kommentar.dto';
import { BEFEHL_ERROR_CODES } from '@/application/befehl/errors/befehl-error.codes';
import { computeBefehlPriority } from '@/application/befehl/utils/befehl-kritikalitaet.util';
import { IBefehlRepository, BefehlFilterParams } from '@domain/repositories/i-befehl.repository';
import { BefehlId } from '@domain/value-objects/befehl-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { BEFEHL_REPOSITORY } from '@infrastructure/di-tokens';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { BefehlRollenGuard } from '@/modules/common/guards/befehl-rollen.guard';
import { RequiresBefehlRolle } from '@/modules/common/decorators/requires-befehl-rolle.decorator';
import { ApiWrappedCreatedResponse, ApiWrappedResponse } from '@/modules/common/decorators/api-wrapped-response.decorator';
import { BadRequestException, Body, Controller, Get, Inject, InternalServerErrorException, NotFoundException, Param, Patch, Post, Query, Req, Res, UseGuards, ValidationPipe } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { Befehl } from '@domain/aggregates/befehl.aggregate';
import type { BefehlEmpfaenger } from '@domain/entities/befehl-empfaenger.entity';
import type { BefehlKommentar } from '@domain/entities/befehl-kommentar.entity';
import type { Result } from '@domain/common/result';

/**
 * Controller fuer Befehlsverwaltung.
 *
 * Thin HTTP Adapter: Mappt HTTP-Requests zu Commands und Domain-Ergebnisse
 * zurueck auf HTTP-Responses. Business-Logik liegt im CreateBefehlHandler.
 *
 * **Endpoints:**
 * - POST /api/v-alpha/befehle — Neuen Kurzbefehl erfassen
 * - POST /api/v-alpha/befehle/:id/quittieren — Befehl quittieren (Story 2.1)
 * - GET /api/v-alpha/befehle?einsatzId={id} — Befehle eines Einsatzes abrufen
 */
@ApiTags('Befehle')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BefehlRollenGuard)
@ApiUnauthorizedResponse({ description: 'Nicht authentifiziert - JWT Token fehlt oder ungültig' })
@ApiForbiddenResponse({ description: 'Keine Berechtigung – Einsatz-Rolle nicht ausreichend' })
@Controller({
  path: 'befehle',
  version: ['alpha', '1'],
})
export class BefehlController {
  constructor(
    private readonly addBefehlKommentarHandler: AddBefehlKommentarHandler,
    private readonly createBefehlHandler: CreateBefehlHandler,
    private readonly korrigiereBefehlHandler: KorrigiereBefehlHandler,
    private readonly quittierenBefehlHandler: QuittierenBefehlHandler,
    private readonly aendereEmpfaengerStatusHandler: AendereEmpfaengerStatusHandler,
    private readonly getBefehlHistorieQueryHandler: GetBefehlHistorieQueryHandler,
    private readonly exportBefehleQueryHandler: ExportBefehleQueryHandler,
    private readonly empfaengerSucheQueryHandler: EmpfaengerSucheQueryHandler,
    private readonly befehlsgeberSucheQueryHandler: BefehlsgeberSucheQueryHandler,
    @Inject(BEFEHL_REPOSITORY) private readonly befehlRepository: IBefehlRepository,
  ) {}

  /**
   * Exportiert alle Befehle eines Einsatzes als CSV oder JSON.
   *
   * WICHTIG: Dieser Endpoint MUSS VOR den :id Routen stehen,
   * da Express sonst 'export' als :id Parameter matched.
   *
   * Flow: Query-Params → Query → Handler → File-Download Response
   */
  @Get('export')
  @RequiresBefehlRolle('BEFEHLSGEBER', 'ERSTELLER')
  @ApiOperation({
    summary: 'Befehle exportieren',
    description: 'Exportiert alle Befehle eines Einsatzes als CSV- oder JSON-Datei fuer die Nachbereitung.',
  })
  @ApiQuery({ name: 'format', description: 'Export-Format', enum: ['csv', 'json'], required: true })
  @ApiQuery({ name: 'einsatzId', description: 'ID des Einsatzes', type: String, required: true })
  @ApiProduces('text/csv', 'application/json')
  // HINWEIS: @ApiOkResponse statt @ApiWrappedResponse, da File-Download keinen JSON-Envelope nutzt.
  // CLAUDE.md AC7 Exception: File-Downloads verwenden Stream-Response, kein Standard-Wrapper.
  @ApiOkResponse({ description: 'Exportierte Befehlsdaten als CSV- oder JSON-Datei' })
  @ApiBadRequestResponse({ description: 'einsatzId fehlt oder format ungueltig' })
  async exportBefehle(@Query('einsatzId') einsatzIdParam: string | string[], @Query('format') formatParam: string | string[], @Res() res: Response): Promise<void> {
    if (Array.isArray(einsatzIdParam)) {
      throw new BadRequestException('einsatzId darf nicht mehrfach angegeben werden');
    }

    if (Array.isArray(formatParam)) {
      throw new BadRequestException('format darf nicht mehrfach angegeben werden');
    }

    const einsatzId = einsatzIdParam;
    const format = formatParam;

    if (!einsatzId) {
      throw new BadRequestException('einsatzId ist erforderlich');
    }

    if (format !== 'csv' && format !== 'json') {
      throw new BadRequestException("format muss 'csv' oder 'json' sein");
    }

    const query = new ExportBefehleQuery(einsatzId, format as 'csv' | 'json');
    const result = await this.exportBefehleQueryHandler.execute(query);

    if (result.isFailure) {
      throw new BadRequestException(result.error);
    }

    if (!result.value) {
      throw new InternalServerErrorException('Export konnte nicht erstellt werden');
    }

    const { content, filename, contentType } = result.value;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  /**
   * Sucht Empfaenger fuer die Befehlsadressierung in EinsatzPersonen und StammPersonen.
   *
   * WICHTIG: Dieser Endpoint MUSS VOR den :id Routen stehen,
   * da Express sonst 'empfaenger-suche' als :id Parameter matched.
   *
   * Flow: Query-Params → Query → Handler (Prisma Direct) → DTO[] Response
   */
  @Get('empfaenger-suche')
  @RequiresBefehlRolle('ERSTELLER', 'BEFEHLSGEBER')
  @ApiOperation({
    summary: 'Empfaenger fuer Befehlsadressierung suchen',
    description: 'Durchsucht EinsatzPersonen und StammPersonen fuer die Empfaenger-Auswahl bei Befehlserstellung.',
  })
  @ApiQuery({ name: 'q', description: 'Suchbegriff (min. 2 Zeichen)', type: String, required: true })
  @ApiQuery({ name: 'einsatzId', description: 'Einsatz-ID', type: String, required: true })
  @ApiWrappedResponse(EmpfaengerSucheResultDto, { isArray: true, description: 'Suchergebnisse' })
  @ApiBadRequestResponse({ description: 'Suchbegriff zu kurz oder einsatzId fehlt' })
  async empfaengerSuche(@Query('q') q: string, @Query('einsatzId') einsatzId: string): Promise<EmpfaengerSucheResultDto[]> {
    const trimmedQ = q?.trim();
    if (!trimmedQ || trimmedQ.length < 2) {
      throw new BadRequestException('Suchbegriff muss mindestens 2 Zeichen lang sein');
    }
    if (trimmedQ.length > 100) {
      throw new BadRequestException('Suchbegriff darf maximal 100 Zeichen lang sein');
    }
    if (!einsatzId) {
      throw new BadRequestException('einsatzId ist erforderlich');
    }

    const einsatzIdResult = EinsatzId.create(einsatzId);
    if (einsatzIdResult.isFailure) {
      throw new BadRequestException(einsatzIdResult.error);
    }

    const query = new EmpfaengerSucheQuery(trimmedQ, einsatzId);
    const result = await this.empfaengerSucheQueryHandler.execute(query);

    if (result.isFailure) {
      throw new InternalServerErrorException(result.error);
    }

    return result.value ?? [];
  }

  /**
   * Befehlsgeber-Suche: Kombiniert Vorschlaege und EinsatzPersonen.
   *
   * WICHTIG: Dieser Endpoint MUSS VOR den :id Routen stehen,
   * da Express sonst 'befehlsgeber-suche' als :id Parameter matched.
   *
   * Flow: Query-Params → Query → Handler (Prisma Direct) → DTO[] Response
   */
  @Get('befehlsgeber-suche')
  @RequiresBefehlRolle('ERSTELLER', 'BEFEHLSGEBER')
  @ApiOperation({
    summary: 'Befehlsgeber-Vorschlaege und Kraefte suchen',
    description: 'Durchsucht konfigurierte Befehlsgeber-Vorschlaege und EinsatzPersonen fuer das Befehlsgeber-Feld.',
  })
  @ApiQuery({ name: 'einsatzId', description: 'Einsatz-ID', type: String, required: true })
  @ApiQuery({ name: 'q', description: 'Optionaler Suchbegriff', type: String, required: false })
  @ApiWrappedResponse(BefehlsgeberSucheResultDto, { isArray: true, description: 'Befehlsgeber-Suchergebnisse' })
  @ApiBadRequestResponse({ description: 'einsatzId fehlt' })
  async befehlsgeberSuche(@Query('einsatzId') einsatzId: string, @Query('q') q?: string): Promise<BefehlsgeberSucheResultDto[]> {
    if (!einsatzId) {
      throw new BadRequestException('einsatzId ist erforderlich');
    }

    const einsatzIdResult = EinsatzId.create(einsatzId);
    if (einsatzIdResult.isFailure) {
      throw new BadRequestException(einsatzIdResult.error);
    }

    const query = new BefehlsgeberSucheQuery(einsatzId, q);
    const result = await this.befehlsgeberSucheQueryHandler.execute(query);

    if (result.isFailure) {
      throw new InternalServerErrorException(result.error);
    }

    return result.value ?? [];
  }

  /**
   * Erstellt einen neuen Befehl via TransactionalCommandHandler.
   *
   * Flow: DTO → Command → Handler (Transaction + Outbox) → Load from DB → DTO Response
   */
  @Post()
  @ApiOperation({
    summary: 'Neuen Befehl erstellen',
    description: 'Erstellt einen neuen Kurzbefehl mit Empfängern, Befehlsgeber und Auftrag.',
  })
  @RequiresBefehlRolle('ERSTELLER', 'BEFEHLSGEBER')
  @ApiWrappedCreatedResponse(BefehlDto, { description: 'Befehl erfolgreich erstellt' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler in den Eingabedaten' })
  async create(@Body(new ValidationPipe({ transform: true, whitelist: true })) dto: CreateBefehlDto): Promise<BefehlDto> {
    const command = new CreateBefehlCommand(
      dto.einsatzId,
      dto.empfaenger,
      dto.befehlsgeber,
      dto.erstellerId,
      dto.auftrag,
      dto.zeitvorgabe,
      dto.ereignis,
      dto.mittel,
      dto.ziel,
      dto.weg,
      dto.befehlsgeberId,
    );

    const result = await this.createBefehlHandler.execute(command);

    if (!result) {
      throw new InternalServerErrorException('Befehl-Erstellung lieferte kein Ergebnis');
    }

    if (result.isFailure) {
      throw new BadRequestException(result.error);
    }

    if (!result.value) {
      throw new InternalServerErrorException('Befehl wurde erstellt, aber keine ID zurückgegeben');
    }

    return this.loadBefehlById(result.value);
  }

  /**
   * Quittiert einen Befehl durch einen Empfaenger.
   *
   * Flow: DTO → Command → Handler (Transaction + Outbox) → Load from DB → DTO Response
   */
  @Post(':id/quittieren')
  @ApiOperation({
    summary: 'Befehl quittieren',
    description: 'Empfaenger quittiert einen Befehl mit Quittierungsart (VERSTANDEN, RUECKFRAGE, NICHT_VERSTANDEN).',
  })
  @ApiParam({ name: 'id', description: 'Befehl-ID', type: String })
  @RequiresBefehlRolle('BEFEHLSGEBER', 'EMPFAENGER')
  @ApiWrappedResponse(BefehlDto, { description: 'Befehl erfolgreich quittiert' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler oder Domain-Fehler (nicht zugestellt, bereits quittiert, korrigiert)' })
  @ApiNotFoundResponse({ description: 'Befehl nicht gefunden' })
  async quittieren(@Param('id') id: string, @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: QuittierenBefehlDto): Promise<BefehlDto> {
    const command = new QuittierenBefehlCommand(id, dto.empfaengerId, dto.quittierungArt, dto.kommentar);

    const result = await this.quittierenBefehlHandler.execute(command);

    if (!result) {
      throw new InternalServerErrorException('Befehl-Quittierung lieferte kein Ergebnis');
    }

    if (result.isFailure) {
      if (result.error === BEFEHL_ERROR_CODES.NOT_FOUND) {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error);
    }

    if (!result.value) {
      throw new InternalServerErrorException('Befehl wurde quittiert, aber keine ID zurückgegeben');
    }

    return this.loadBefehlById(result.value);
  }

  /**
   * Ändert den Status eines einzelnen Empfängers.
   * Unterstützt: Zustellen, stellvertretend Quittieren, Zurücksetzen.
   *
   * Flow: DTO → Command → Handler (Transaction + Outbox) → Load from DB → DTO Response
   */
  @Patch(':id/empfaenger/:empfaengerEntityId/status')
  @ApiOperation({
    summary: 'Empfänger-Status ändern',
    description: 'Ändert den Status eines Empfängers: Zustellen, stellvertretend Quittieren oder Zurücksetzen.',
  })
  @ApiParam({ name: 'id', description: 'Befehl-ID', type: String })
  @ApiParam({ name: 'empfaengerEntityId', description: 'Empfänger-Entity-ID', type: String })
  @RequiresBefehlRolle('ERSTELLER', 'BEFEHLSGEBER')
  @ApiWrappedResponse(BefehlDto, { description: 'Befehl mit aktualisiertem Empfänger-Status' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler oder Domain-Fehler' })
  @ApiNotFoundResponse({ description: 'Befehl nicht gefunden' })
  async aendereEmpfaengerStatus(
    @Param('id') id: string,
    @Param('empfaengerEntityId') empfaengerEntityId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: AendereEmpfaengerStatusDto,
    @Req() req: { user: { userId: string } },
  ): Promise<BefehlDto> {
    const command = new AendereEmpfaengerStatusCommand(id, empfaengerEntityId, dto.aktion, req.user.userId, dto.quittierungArt, dto.kommentar, dto.zielStatus);

    const result = await this.aendereEmpfaengerStatusHandler.execute(command);

    if (!result) {
      throw new InternalServerErrorException('Empfänger-Status-Änderung lieferte kein Ergebnis');
    }

    if (result.isFailure) {
      if (result.error === BEFEHL_ERROR_CODES.NOT_FOUND) {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error);
    }

    if (!result.value) {
      throw new InternalServerErrorException('Empfänger-Status wurde geändert, aber keine ID zurückgegeben');
    }

    return this.loadBefehlById(result.value);
  }

  /**
   * Erstellt einen Korrekturbefehl und markiert den Original-Befehl als KORRIGIERT.
   *
   * Flow: DTO → Command → Handler (Transaction + Outbox) → Load from DB → DTO Response
   */
  @Post(':id/korrigieren')
  @ApiOperation({
    summary: 'Korrekturbefehl erstellen',
    description: 'Erstellt einen Korrekturbefehl und markiert den Original-Befehl als KORRIGIERT. EinsatzId wird vom Original uebernommen.',
  })
  @ApiParam({ name: 'id', description: 'Original-Befehl-ID', type: String })
  @RequiresBefehlRolle('BEFEHLSGEBER')
  @ApiWrappedCreatedResponse(BefehlDto, { description: 'Korrekturbefehl erstellt' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler oder Domain-Fehler (ungültige Status-Transition)' })
  @ApiNotFoundResponse({ description: 'Original-Befehl nicht gefunden' })
  async korrigieren(@Param('id') id: string, @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: KorrigiereBefehlDto): Promise<BefehlDto> {
    const command = new KorrigiereBefehlCommand(id, dto.empfaenger, dto.befehlsgeber, dto.erstellerId, dto.auftrag, dto.zeitvorgabe, dto.ereignis, dto.mittel, dto.ziel, dto.weg, dto.befehlsgeberId);

    const result = await this.korrigiereBefehlHandler.execute(command);

    if (!result) {
      throw new InternalServerErrorException('Korrekturbefehl-Erstellung lieferte kein Ergebnis');
    }

    if (result.isFailure) {
      if (result.error === BEFEHL_ERROR_CODES.NOT_FOUND) {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error);
    }

    if (!result.value) {
      throw new InternalServerErrorException('Korrekturbefehl wurde erstellt, aber keine ID zurückgegeben');
    }

    return this.loadBefehlById(result.value);
  }

  /**
   * Fügt einen Kommentar zu einem Befehl hinzu.
   *
   * Flow: DTO → Command → Handler (Transaction + Outbox) → Load from DB → DTO Response
   */
  @Post(':id/kommentare')
  @RequiresBefehlRolle('ERSTELLER', 'BEFEHLSGEBER', 'EMPFAENGER')
  @ApiOperation({
    summary: 'Kommentar zu Befehl hinzufuegen',
    description: 'Fuegt einen Kommentar oder eine Rueckfrage zu einem Befehl hinzu. Unterstuetzt Thread-Antworten via parentId.',
  })
  @ApiParam({ name: 'id', description: 'Befehl-ID', type: String })
  @ApiWrappedCreatedResponse(BefehlDto, { description: 'Kommentar wurde hinzugefuegt' })
  @ApiBadRequestResponse({ description: 'Validierungsfehler oder Domain-Fehler' })
  @ApiNotFoundResponse({ description: 'Befehl nicht gefunden' })
  async addKommentar(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: AddBefehlKommentarDto,
    @Req() req: { user: { userId: string } },
  ): Promise<BefehlDto> {
    const authorId = req.user.userId;
    const command = new AddBefehlKommentarCommand(id, authorId, dto.text, dto.isRueckfrage, dto.parentId);

    const result = await this.addBefehlKommentarHandler.execute(command);

    if (result.isFailure) {
      if (result.error === BEFEHL_ERROR_CODES.NOT_FOUND) {
        throw new NotFoundException(result.error);
      }
      throw new BadRequestException(result.error);
    }

    if (!result.value) {
      throw new InternalServerErrorException('Kommentar wurde hinzugefügt, aber keine ID zurückgegeben');
    }

    return this.loadBefehlById(result.value);
  }

  /**
   * Gibt die vollstaendige Historie eines Befehls als Timeline zurueck.
   *
   * Flow: Query → Handler (Prisma Direct) → Timeline-DTO Response
   */
  @Get(':id/historie')
  @RequiresBefehlRolle('BEFEHLSGEBER', 'ERSTELLER', 'EMPFAENGER', 'BEOBACHTER')
  @ApiOperation({
    summary: 'Befehlshistorie-Timeline abrufen',
    description: 'Gibt die vollstaendige Befehlshistorie als chronologische Timeline im Paket-Tracking-Style zurueck.',
  })
  @ApiParam({ name: 'id', description: 'Befehl-ID', type: String })
  @ApiWrappedResponse(BefehlHistorieTimelineDto, { description: 'Vollständige Befehlshistorie-Timeline' })
  @ApiNotFoundResponse({ description: 'Befehl nicht gefunden' })
  async getHistorie(@Param('id') id: string): Promise<BefehlHistorieTimelineDto> {
    const query = new GetBefehlHistorieQuery(id);
    const result = await this.getBefehlHistorieQueryHandler.execute(query);

    if (result.isFailure) {
      if (result.error === BEFEHL_ERROR_CODES.NOT_FOUND) {
        throw new NotFoundException(result.error);
      }
      throw new InternalServerErrorException(result.error);
    }

    if (!result.value) {
      throw new InternalServerErrorException('Befehlshistorie konnte nicht geladen werden');
    }

    return result.value;
  }

  /**
   * Gibt alle Befehle eines Einsatzes zurück, sortiert nach erteiltAm DESC.
   */
  @Get()
  @ApiOperation({
    summary: 'Befehle eines Einsatzes abrufen',
    description:
      'Gibt alle Befehle für den angegebenen Einsatz zurück, sortiert nach Erstellungszeitpunkt (neueste zuerst). Unterstützt erweiterte Filter: Status, Empfänger-Name, Befehlsgeber-Name, Freitextsuche (q) und Zeitraum (von/bis). hasOpenRueckfragen hat Vorrang vor empfaengerId. Erweiterte Filter haben Vorrang vor empfaengerId/hasOpenRueckfragen.',
  })
  @ApiQuery({ name: 'einsatzId', description: 'ID des Einsatzes', type: String, required: true })
  @ApiQuery({ name: 'empfaengerId', description: 'Optional: Filtert Befehle nach Empfänger-ID', type: String, required: false })
  @ApiQuery({ name: 'hasOpenRueckfragen', description: 'Filtert auf Befehle mit offenen Rückfragen', type: Boolean, required: false })
  @ApiQuery({ name: 'status', description: 'Komma-separierte Status-Filter (ERTEILT,ZUGESTELLT,QUITTIERT,KORRIGIERT)', type: String, required: false })
  @ApiQuery({ name: 'empfaengerName', description: 'Freitext-Filter auf Empfänger-Name (case-insensitive)', type: String, required: false })
  @ApiQuery({ name: 'befehlsgeberName', description: 'Freitext-Filter auf Befehlsgeber-Name (case-insensitive)', type: String, required: false })
  @ApiQuery({ name: 'q', description: 'Volltextsuche über Auftrag (case-insensitive)', type: String, required: false })
  @ApiQuery({ name: 'von', description: 'Zeitfilter: Befehle ab Datum (ISO 8601)', type: String, required: false })
  @ApiQuery({ name: 'bis', description: 'Zeitfilter: Befehle bis Datum (ISO 8601)', type: String, required: false })
  @RequiresBefehlRolle('BEFEHLSGEBER', 'ERSTELLER', 'EMPFAENGER', 'BEOBACHTER')
  @ApiWrappedResponse(BefehlDto, { isArray: true, description: 'Liste aller Befehle eines Einsatzes' })
  @ApiBadRequestResponse({ description: 'einsatzId fehlt oder ist ungültig' })
  async findByEinsatz(
    @Query('einsatzId') einsatzId: string,
    @Query('empfaengerId') empfaengerId?: string,
    @Query('hasOpenRueckfragen') hasOpenRueckfragen?: string,
    @Query('status') status?: string,
    @Query('empfaengerName') empfaengerName?: string,
    @Query('befehlsgeberName') befehlsgeberName?: string,
    @Query('q') q?: string,
    @Query('von') von?: string,
    @Query('bis') bis?: string,
    @Req() req?: { einsatzRolle?: string; user?: { userId: string } },
  ): Promise<BefehlDto[]> {
    if (!einsatzId) {
      throw new BadRequestException('einsatzId ist erforderlich');
    }

    const einsatzIdResult = EinsatzId.create(einsatzId);
    if (einsatzIdResult.isFailure) {
      throw new BadRequestException(einsatzIdResult.error);
    }

    const einsatzIdVo = einsatzIdResult.value as EinsatzId;
    const einsatzRolle = req?.einsatzRolle;
    const isEmpfaenger = einsatzRolle === 'EMPFAENGER' && req?.user?.userId;

    // Erweiterte Filter prüfen
    const hasExtendedFilters = status || empfaengerName || befehlsgeberName || q || von || bis;

    let result: Result<Befehl[]>;
    if (hasExtendedFilters) {
      const filters = this.parseFilterParams(status, empfaengerName, befehlsgeberName, q, von, bis);
      if (isEmpfaenger) {
        filters.empfaengerUserId = req.user.userId;
      }
      result = await this.befehlRepository.findFiltered(einsatzIdVo, filters);
    } else {
      const hasOpenRueckfragenBool = hasOpenRueckfragen?.toLowerCase() === 'true';
      const trimmedEmpfaengerId = empfaengerId?.trim() || undefined;

      if (hasOpenRueckfragenBool) {
        result = await this.befehlRepository.findWithOpenRueckfragen(einsatzIdVo);
      } else if (trimmedEmpfaengerId) {
        result = await this.befehlRepository.findByEmpfaengerId(einsatzIdVo, trimmedEmpfaengerId);
      } else if (isEmpfaenger) {
        result = await this.befehlRepository.findByEmpfaengerId(einsatzIdVo, req.user.userId);
      } else {
        result = await this.befehlRepository.findByEinsatzId(einsatzIdVo);
      }
    }

    if (result.isFailure) {
      throw new InternalServerErrorException('Fehler beim Laden der Befehle');
    }

    const befehle = result.value ?? [];

    const dtos = befehle.map((b) => this.mapToDto(b));

    // BEOBACHTER: alle Befehle sehen, aber Kommentare ausblenden
    if (einsatzRolle === 'BEOBACHTER') {
      for (const dto of dtos) {
        dto.kommentare = [];
      }
    }

    return dtos;
  }

  /**
   * Parst und validiert die erweiterten Filter-Parameter.
   */
  private parseFilterParams(status?: string, empfaengerName?: string, befehlsgeberName?: string, q?: string, von?: string, bis?: string): BefehlFilterParams {
    const validStatusValues = ['ERTEILT', 'ZUGESTELLT', 'QUITTIERT', 'KORRIGIERT'];
    const filters: BefehlFilterParams = {};

    if (status) {
      const statusValues = status.split(',').map((s) => s.trim().toUpperCase());
      const invalidValues = statusValues.filter((s) => !validStatusValues.includes(s));
      if (invalidValues.length > 0) {
        throw new BadRequestException(`Ungültige Status-Werte: ${invalidValues.join(', ')}. Erlaubt: ${validStatusValues.join(', ')}`);
      }
      filters.status = statusValues;
    }

    if (empfaengerName?.trim()) {
      filters.empfaengerName = empfaengerName.trim();
    }

    if (befehlsgeberName?.trim()) {
      filters.befehlsgeberName = befehlsgeberName.trim();
    }

    if (q?.trim()) {
      filters.q = q.trim();
    }

    if (von) {
      const vonDate = new Date(von);
      if (Number.isNaN(vonDate.getTime())) {
        throw new BadRequestException(`Ungültiges Datum für 'von': ${von}. Erwartetes Format: ISO 8601`);
      }
      filters.von = vonDate;
    }

    if (bis) {
      const bisDate = new Date(bis);
      if (Number.isNaN(bisDate.getTime())) {
        throw new BadRequestException(`Ungültiges Datum für 'bis': ${bis}. Erwartetes Format: ISO 8601`);
      }
      filters.bis = bisDate;
    }

    if (filters.von && filters.bis && filters.bis < filters.von) {
      throw new BadRequestException("'bis' muss nach 'von' liegen");
    }

    return filters;
  }

  /**
   * Laedt einen Befehl aus der DB und mappt ihn auf BefehlDto.
   */
  private async loadBefehlById(id: string): Promise<BefehlDto> {
    const befehlIdResult = BefehlId.create(id);
    if (befehlIdResult.isFailure) {
      throw new InternalServerErrorException(befehlIdResult.error);
    }

    const befehlId = befehlIdResult.value as BefehlId;
    const findResult = await this.befehlRepository.findById(befehlId);

    if (findResult.isFailure) {
      throw new InternalServerErrorException(findResult.error);
    }

    if (!findResult.value) {
      throw new InternalServerErrorException(`Befehl mit ID ${id} nicht gefunden nach Erstellung`);
    }

    return this.mapToDto(findResult.value);
  }

  /**
   * Mappt ein Befehl Aggregate auf BefehlDto fuer die API-Response.
   * Berechnet Priority-Felder via computeBefehlPriority() Utility.
   */
  private mapToDto(befehl: Befehl): BefehlDto {
    const dto = new BefehlDto();
    dto.id = befehl.id.value;
    dto.nummer = befehl.nummer;
    dto.einsatzId = befehl.einsatzId.value;
    dto.auftrag = befehl.auftrag;
    dto.befehlsgeberName = befehl.befehlsgeberName;
    dto.befehlsgeberId = befehl.befehlsgeberId?.value;
    dto.erstellerId = befehl.erstellerId?.value;
    dto.status = befehl.status.value as BefehlDto['status'];
    dto.befehlstyp = befehl.befehlstyp;
    dto.zeitvorgabe = befehl.zeitvorgabe;
    dto.ereignis = befehl.ereignis;
    dto.mittel = befehl.mittel;
    dto.ziel = befehl.ziel;
    dto.weg = befehl.weg;
    dto.originalBefehlId = befehl.originalBefehlId?.value;
    dto.erteiltAm = befehl.erteiltAm;
    dto.empfaenger = befehl.empfaenger.map((e) => this.mapEmpfaengerToDto(e));
    dto.kommentare = befehl.kommentare.map((k) => this.mapKommentarToDto(k));

    // Computed Priority-Felder via Utility
    const priority = computeBefehlPriority(befehl.status.value, befehl.zeitvorgabe, befehl.erteiltAm, befehl.empfaenger, befehl.kommentare);
    dto.isUeberfaellig = priority.isUeberfaellig;
    dto.hatNichtVerstanden = priority.hatNichtVerstanden;
    dto.hatOffeneRueckfrage = priority.hatOffeneRueckfrage;
    dto.kritikalitaet = priority.kritikalitaet;

    dto.createdAt = befehl.createdAt;
    dto.updatedAt = befehl.updatedAt;
    return dto;
  }

  private mapEmpfaengerToDto(empfaenger: BefehlEmpfaenger): BefehlEmpfaengerDto {
    const dto = new BefehlEmpfaengerDto();
    dto.id = empfaenger.id;
    dto.name = empfaenger.name;
    dto.empfaengerId = empfaenger.empfaengerId?.value;
    dto.zugestelltAm = empfaenger.zugestelltAm;
    dto.quittiertAm = empfaenger.quittiertAm;
    dto.quittierungArt = empfaenger.quittierungArt;
    dto.quittierungKommentar = empfaenger.quittierungKommentar;
    dto.istQuittierbar = empfaenger.istQuittierbar;
    return dto;
  }

  private mapKommentarToDto(kommentar: BefehlKommentar): BefehlKommentarDto {
    const dto = new BefehlKommentarDto();
    dto.id = kommentar.id;
    dto.authorId = kommentar.authorId?.value;
    dto.text = kommentar.text;
    dto.isRueckfrage = kommentar.isRueckfrage;
    dto.parentId = kommentar.parentId;
    dto.createdAt = kommentar.createdAt;
    return dto;
  }
}
