import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Post, Put, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiConflictResponse, ApiNotFoundResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import type { ValidatedUser } from '@/modules/auth/strategies/jwt.strategy';
import { ApiWrappedCreatedResponse, ApiWrappedResponse } from '@/modules/common/decorators/api-wrapped-response.decorator';
import { CreateErinnerungDto, UpdateErinnerungDto, ErinnerungResponseDto } from '@/application/erinnerung/dto';
import { CreateErinnerungCommand } from '@/application/erinnerung/commands/create-erinnerung/create-erinnerung.command';
import { CreateErinnerungHandler } from '@/application/erinnerung/commands/create-erinnerung/create-erinnerung.handler';
import { UpdateErinnerungCommand } from '@/application/erinnerung/commands/update-erinnerung/update-erinnerung.command';
import { UpdateErinnerungHandler } from '@/application/erinnerung/commands/update-erinnerung/update-erinnerung.handler';
import { GetErinnerungenByEinsatzQuery } from '@/application/erinnerung/queries/get-erinnerungen-by-einsatz/get-erinnerungen-by-einsatz.query';
import { GetErinnerungenByEinsatzHandler } from '@/application/erinnerung/queries/get-erinnerungen-by-einsatz/get-erinnerungen-by-einsatz.handler';
import { ERINNERUNG_ERROR_CODES } from '@/application/erinnerung/errors/erinnerung-error.codes';

/**
 * Controller für Erinnerungen innerhalb eines Einsatzes.
 *
 * Ermöglicht das Erstellen und Abrufen von Erinnerungen.
 * Erinnerungen sind immer an einen Einsatz gebunden.
 *
 * **Story 1.1 Features:**
 * - Quick-Create: Erinnerung mit Titel und Zeitpunkt in unter 10 Sekunden anlegen
 * - Zeit-Presets: 5, 10, 15, 30, 60 Minuten
 * - Status: Wird initial als GEPLANT erstellt
 */
@ApiTags('Erinnerungen')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Nicht authentifiziert - JWT Token fehlt oder ungültig' })
@Controller({
  path: 'einsatz/:einsatzId/erinnerungen',
  version: 'alpha',
})
export class ErinnerungController {
  constructor(
    private readonly createHandler: CreateErinnerungHandler,
    private readonly updateHandler: UpdateErinnerungHandler,
    private readonly getByEinsatzHandler: GetErinnerungenByEinsatzHandler,
  ) {}

  /**
   * Alle Erinnerungen eines Einsatzes abrufen.
   *
   * Gibt die Liste aller Erinnerungen sortiert nach Fälligkeit zurück.
   * Wird für die Erinnerungsliste im Einsatz-Kontext verwendet.
   *
   * **Story 1.1 AC2:** "die Erinnerung erscheint in meiner Liste"
   */
  @Get()
  @ApiOperation({
    summary: 'Alle Erinnerungen eines Einsatzes abrufen',
    description: 'Gibt alle Erinnerungen des Einsatzes sortiert nach Fälligkeit (aufsteigend) zurück.',
  })
  @ApiWrappedResponse(ErinnerungResponseDto, {
    isArray: true,
    description: 'Liste aller Erinnerungen',
  })
  @ApiBadRequestResponse({ description: 'Ungültige EinsatzId' })
  async getByEinsatz(@Param('einsatzId') einsatzId: string): Promise<ErinnerungResponseDto[]> {
    const queryResult = GetErinnerungenByEinsatzQuery.create({ einsatzId });

    if (queryResult.isFailure || !queryResult.value) {
      throw new BadRequestException(queryResult.error);
    }

    const result = await this.getByEinsatzHandler.execute(queryResult.value);

    if (result.isFailure) {
      throw new BadRequestException(result.error);
    }

    return result.value ?? [];
  }

  /**
   * Neue Erinnerung erstellen (Quick-Create).
   *
   * Erstellt eine Erinnerung mit dem angegebenen Titel und Zeitpunkt.
   * Der Status wird automatisch auf GEPLANT gesetzt.
   *
   * **Story 1.1 AC2:**
   * - Erinnerung wird mit Status GEPLANT erstellt
   * - Visuelles Feedback bestätigt Erstellung
   */
  @Post()
  @ApiOperation({
    summary: 'Neue Erinnerung erstellen',
    description: 'Erstellt eine neue Erinnerung mit Titel und Fälligkeitszeitpunkt. Status wird auf GEPLANT gesetzt.',
  })
  @ApiWrappedCreatedResponse(ErinnerungResponseDto, {
    description: 'Erinnerung erfolgreich erstellt',
  })
  @ApiBadRequestResponse({ description: 'Validierungsfehler in den Eingabedaten' })
  async create(
    @Param('einsatzId') einsatzId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreateErinnerungDto,
    @CurrentUser() user: ValidatedUser,
  ): Promise<ErinnerungResponseDto> {
    const commandResult = CreateErinnerungCommand.create({
      einsatzId,
      titel: dto.titel,
      beschreibung: dto.beschreibung,
      faelligAm: new Date(dto.faelligAm),
      erstelltVon: user.userId,
    });

    if (commandResult.isFailure || !commandResult.value) {
      throw new BadRequestException(commandResult.error);
    }

    const result = await this.createHandler.execute(commandResult.value);

    if (result.isFailure) {
      throw new BadRequestException(result.error);
    }

    if (!result.value) {
      throw new BadRequestException('Erinnerung konnte nicht erstellt werden');
    }

    return result.value;
  }

  /**
   * Aktualisiert eine bestehende Erinnerung.
   *
   * Nur Erinnerungen im Status GEPLANT können bearbeitet werden, da
   * bereits ausgelöste oder abgeschlossene Erinnerungen historische
   * Fakten darstellen und nicht nachträglich verändert werden dürfen.
   *
   * **Story 1.3 AC2:**
   * - Änderungen werden gespeichert
   * - Bei Zeit-Änderung: Timer wird neu berechnet
   * - WebSocket-Event `erinnerung.updated` wird gesendet
   *
   * **Story 1.3 AC3:**
   * - Nur Erinnerungen im Status GEPLANT können bearbeitet werden
   * - Andere Status: 409 Conflict
   */
  @Put(':id')
  @ApiOperation({
    summary: 'Erinnerung aktualisieren',
    description: 'Aktualisiert eine bestehende Erinnerung. Nur Erinnerungen im Status GEPLANT können bearbeitet werden.',
  })
  @ApiWrappedResponse(ErinnerungResponseDto, {
    description: 'Erinnerung erfolgreich aktualisiert',
  })
  @ApiBadRequestResponse({ description: 'Validierungsfehler in den Eingabedaten oder keine Änderungen angegeben' })
  @ApiNotFoundResponse({ description: 'Erinnerung nicht gefunden' })
  @ApiConflictResponse({ description: 'Erinnerung kann nicht bearbeitet werden (Status ist nicht GEPLANT)' })
  async update(
    @Param('einsatzId') _einsatzId: string, // Für URL-Struktur, nicht für Validierung genutzt
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: UpdateErinnerungDto,
    @CurrentUser() user: ValidatedUser,
  ): Promise<ErinnerungResponseDto> {
    const commandResult = UpdateErinnerungCommand.create({
      erinnerungId: id,
      aktualisierVon: user.userId,
      titel: dto.titel,
      beschreibung: dto.beschreibung,
      faelligAm: dto.faelligAm ? new Date(dto.faelligAm) : undefined,
    });

    if (commandResult.isFailure || !commandResult.value) {
      throw new BadRequestException(commandResult.error);
    }

    const result = await this.updateHandler.execute(commandResult.value);

    if (result.isFailure) {
      // Error Mapping: NOT_FOUND → 404, NOT_EDITABLE → 409, sonst 400
      if (result.error === ERINNERUNG_ERROR_CODES.NOT_FOUND) {
        throw new NotFoundException('Erinnerung nicht gefunden');
      }
      if (result.error === ERINNERUNG_ERROR_CODES.NOT_EDITABLE) {
        throw new ConflictException('Nur geplante Erinnerungen können bearbeitet werden');
      }
      throw new BadRequestException(result.error);
    }

    if (!result.value) {
      throw new BadRequestException('Erinnerung konnte nicht aktualisiert werden');
    }

    return result.value;
  }
}
