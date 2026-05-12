import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Result } from '@domain/common/result';
import type { ILogger } from '@domain/ports/i-logger.port';
import { LOGGER } from '@infrastructure/di-tokens';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { RequiresPermission } from '@/modules/auth/decorators/requires-permission.decorator';
import { EinsatzScopeGuard } from '@/modules/auth/guards/einsatz-scope.guard';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/modules/auth/guards/permissions.guard';
import type { ValidatedUser } from '@/modules/auth/strategies/jwt.strategy';
import { ApiWrappedCreatedResponse, ApiWrappedResponse } from '@/modules/common/decorators/api-wrapped-response.decorator';
import { CreateSicherungspostenCommand } from '@/application/eigenschutz/commands/create-sicherungsposten/create-sicherungsposten.command';
import { UpdateSicherungspostenCommand } from '@/application/eigenschutz/commands/update-sicherungsposten/update-sicherungsposten.command';
import { AufloeseSicherungspostenCommand } from '@/application/eigenschutz/commands/aufloese-sicherungsposten/aufloese-sicherungsposten.command';
import { GetSicherungspostenQuery } from '@/application/eigenschutz/queries/get-sicherungsposten/get-sicherungsposten.query';
import { ListSicherungspostenQuery } from '@/application/eigenschutz/queries/list-sicherungsposten/list-sicherungsposten.query';
import {
  AufloeseSicherungspostenDto,
  CreateSicherungspostenDto,
  CreateSicherungspostenPersonalFreitextDto,
  CreateSicherungspostenPersonalEinsatzPersonDto,
  CreateSicherungspostenStandortAddressDto,
  CreateSicherungspostenStandortCoordinateDto,
  UpdateSicherungspostenDto,
} from '@/application/eigenschutz/dto/create-sicherungsposten.dto';
import { PersonalFreitextEntryDto, PersonalEinsatzPersonEntryDto, SicherungspostenDto, StandortAddressDto, StandortCoordinateDto } from '@/application/eigenschutz/dto/sicherungsposten.dto';
import { toSicherungspostenDto } from '@/application/eigenschutz/dto/sicherungsposten.factory';
import { SICHERUNGSPOSTEN_CONFLICT_DETECTED } from '@domain/eigenschutz/aggregates/sicherungsposten.aggregate';
import type { ISicherungspostenRepository, SicherungspostenReadModel } from '@domain/eigenschutz/repositories';
import { SICHERUNGSPOSTEN_REPOSITORY } from '@infrastructure/di-tokens';
import type { PersonalEntryProps, StandortProps } from '@domain/eigenschutz/value-objects/standort.vo';
import type { SicherungspostenQueryStatus } from '@/application/eigenschutz/queries/list-sicherungsposten/list-sicherungsposten.query';

const SICHERUNGSPOSTEN_STATUS_VALUES: ReadonlyArray<SicherungspostenQueryStatus> = ['AKTIV', 'AUFGELOEST'];

function parseSicherungspostenStatus(raw: string | undefined): SicherungspostenQueryStatus | null {
  if (raw === 'AKTIV' || raw === 'AUFGELOEST') return raw;
  return null;
}

/**
 * Controller für Sicherungsposten-Endpoints (Story 4.1, AC8).
 *
 * Routen unter `/api/einsaetze/:einsatzId/sicherheit/eigenschutz/sicherungsposten`,
 * vier Endpunkte: GET (Liste mit Status-Filter), POST (Create), PATCH (Update),
 * POST :id/aufloesen (UX-DR27 destructive-with-reason).
 */
@ApiTags('eigenschutz')
@ApiBearerAuth()
@ApiExtraModels(
  StandortCoordinateDto,
  StandortAddressDto,
  PersonalEinsatzPersonEntryDto,
  PersonalFreitextEntryDto,
  CreateSicherungspostenStandortCoordinateDto,
  CreateSicherungspostenStandortAddressDto,
  CreateSicherungspostenPersonalEinsatzPersonDto,
  CreateSicherungspostenPersonalFreitextDto,
)
@ApiUnauthorizedResponse({ description: 'Nicht authentifiziert — JWT fehlt oder ungültig' })
@ApiForbiddenResponse({ description: 'Keine ausreichende Permission für die Aktion' })
@Controller({ path: 'einsaetze/:einsatzId/sicherheit/eigenschutz/sicherungsposten', version: 'alpha' })
@UseGuards(JwtAuthGuard, EinsatzScopeGuard, PermissionsGuard)
export class SicherungspostenController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    @Inject(SICHERUNGSPOSTEN_REPOSITORY)
    private readonly postenRepo: ISicherungspostenRepository,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {}

  @Get()
  @RequiresPermission('eigenschutz:sicherungsposten:read')
  @ApiOperation({ summary: 'Sicherungsposten eines Einsatzes auflisten (Status-Filter AKTIV/AUFGELOEST)' })
  @ApiParam({ name: 'einsatzId', type: String, description: 'CUID des Einsatzes' })
  @ApiQuery({ name: 'status', required: true, enum: ['AKTIV', 'AUFGELOEST'] })
  @ApiWrappedResponse(SicherungspostenDto, {
    description: 'Liste der Sicherungsposten, sortiert nach aktualisiertAm DESC bzw. aufgeloestAm DESC.',
    isArray: true,
  })
  async listSicherungsposten(@Param('einsatzId') einsatzId: string, @Query('status') statusRaw: string): Promise<SicherungspostenDto[]> {
    const status = parseSicherungspostenStatus(statusRaw);
    if (!status) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: `status muss eines von ${SICHERUNGSPOSTEN_STATUS_VALUES.join(', ')} sein`,
        context: { rule: 'InvalidStatus' },
      });
    }
    const result = (await this.queryBus.execute(new ListSicherungspostenQuery(einsatzId, status))) as Result<SicherungspostenReadModel[]>;
    if (result.isFailure || !result.value) {
      throw new InternalServerErrorException(result.error ?? 'Sicherungsposten konnten nicht geladen werden');
    }
    return result.value.map((readModel) =>
      toSicherungspostenDto({
        aggregate: readModel.aggregate,
        erstelltAm: readModel.erstelltAm,
        aktualisiertAm: readModel.aktualisiertAm,
        aktualisiertVonUserId: readModel.aktualisiertVonUserId,
      }),
    );
  }

  @Get(':postenId')
  @RequiresPermission('eigenschutz:sicherungsposten:read')
  @ApiOperation({
    summary: 'Sicherungsposten per ID laden (Detail-Ansicht)',
    description:
      'Lädt einen Sicherungsposten samt Persistenz-Metadaten für die Detail-Ansicht (Story 4.4 — bidirektionale Navigation Karte ↔ Detail). ' +
      'Cross-Einsatz-Zugriff liefert 404 (kein 403), damit die Existenz fremder Posten nicht leakt.',
  })
  @ApiParam({ name: 'einsatzId', type: String, description: 'CUID des Einsatzes' })
  @ApiParam({ name: 'postenId', type: String, description: 'CUID des Sicherungspostens' })
  @ApiWrappedResponse(SicherungspostenDto, { description: 'Sicherungsposten geladen.' })
  @ApiNotFoundResponse({ description: 'Sicherungsposten existiert nicht oder gehört zu einem anderen Einsatz' })
  async getSicherungsposten(@Param('einsatzId') einsatzId: string, @Param('postenId') postenId: string): Promise<SicherungspostenDto> {
    const result = (await this.queryBus.execute(new GetSicherungspostenQuery(einsatzId, postenId))) as Result<SicherungspostenReadModel>;
    if (result.isFailure || !result.value) {
      const error = result.error ?? 'NotFound:Sicherungsposten';
      if (error.startsWith('NotFound:')) {
        throw new NotFoundException({
          statusCode: 404,
          error: 'Not Found',
          message: 'Sicherungsposten existiert nicht oder gehört zu einem anderen Einsatz.',
          context: { resource: 'sicherungsposten' },
        });
      }
      throw new InternalServerErrorException({ statusCode: 500, error: 'Internal Server Error', message: error, context: { rule: 'Unexpected' } });
    }
    return toSicherungspostenDto({
      aggregate: result.value.aggregate,
      erstelltAm: result.value.erstelltAm,
      aktualisiertAm: result.value.aktualisiertAm,
      aktualisiertVonUserId: result.value.aktualisiertVonUserId,
    });
  }

  @Post()
  @RequiresPermission('eigenschutz:sicherungsposten:write')
  @ApiOperation({ summary: 'Neuen Sicherungsposten anlegen' })
  @ApiParam({ name: 'einsatzId', type: String, description: 'CUID des Einsatzes' })
  @ApiBody({ type: CreateSicherungspostenDto })
  @ApiWrappedCreatedResponse(SicherungspostenDto, { description: 'Der neu angelegte Sicherungsposten.' })
  @ApiBadRequestResponse({ description: 'DTO-Validation' })
  @ApiUnprocessableEntityResponse({ description: 'Aggregate-Invariante verletzt (z. B. ungültiger Standort)' })
  async createSicherungsposten(@Param('einsatzId') einsatzId: string, @Body() body: CreateSicherungspostenDto, @CurrentUser() user: ValidatedUser): Promise<SicherungspostenDto> {
    const result = (await this.commandBus.execute(
      new CreateSicherungspostenCommand(
        einsatzId,
        user.userId,
        body.bezeichnung,
        body.standort as StandortProps,
        body.personal as PersonalEntryProps[],
        body.einheitId,
        body.zustaendigkeitsbereich,
        body.abloesezeiten,
      ),
    )) as Result<string>;
    if (result.isFailure || !result.value) {
      throw this.mapCommandError(result.error ?? 'Sicherungsposten konnte nicht angelegt werden', undefined);
    }
    return this.loadDto(einsatzId, result.value);
  }

  @Patch(':postenId')
  @HttpCode(HttpStatus.OK)
  @RequiresPermission('eigenschutz:sicherungsposten:write')
  @ApiOperation({ summary: 'Sicherungsposten aktualisieren (Optimistic-Concurrency)' })
  @ApiParam({ name: 'einsatzId', type: String, description: 'CUID des Einsatzes' })
  @ApiParam({ name: 'postenId', type: String, description: 'CUID des Sicherungspostens' })
  @ApiBody({ type: UpdateSicherungspostenDto })
  @ApiWrappedResponse(SicherungspostenDto, { description: 'Aktualisierter Sicherungsposten mit inkrementierter Version.' })
  @ApiNotFoundResponse({ description: 'Sicherungsposten existiert nicht oder gehört zu einem anderen Einsatz' })
  @ApiConflictResponse({ description: 'Optimistic-Concurrency-Mismatch — `context.currentVersion` + `context.attemptedVersion`' })
  @ApiUnprocessableEntityResponse({ description: 'Validation oder BusinessRule (z. B. BereitsAufgeloest)' })
  async updateSicherungsposten(
    @Param('einsatzId') einsatzId: string,
    @Param('postenId') postenId: string,
    @Body() body: UpdateSicherungspostenDto,
    @CurrentUser() user: ValidatedUser,
  ): Promise<SicherungspostenDto> {
    const command = new UpdateSicherungspostenCommand(einsatzId, postenId, user.userId, body.expectedVersion, {
      ...(body.bezeichnung !== undefined ? { bezeichnung: body.bezeichnung } : {}),
      ...(body.standort !== undefined ? { standort: body.standort as StandortProps } : {}),
      ...(body.personal !== undefined ? { personal: body.personal as PersonalEntryProps[] } : {}),
      ...(body.einheitId !== undefined ? { einheitId: body.einheitId } : {}),
      ...(body.zustaendigkeitsbereich !== undefined ? { zustaendigkeitsbereich: body.zustaendigkeitsbereich } : {}),
      ...(body.abloesezeiten !== undefined ? { abloesezeiten: body.abloesezeiten } : {}),
    });
    const result = (await this.commandBus.execute(command)) as Result<string>;
    if (result.isFailure || !result.value) {
      throw this.mapCommandError(result.error ?? 'Update fehlgeschlagen', body.expectedVersion);
    }
    return this.loadDto(einsatzId, result.value);
  }

  @Post(':postenId/aufloesen')
  @HttpCode(HttpStatus.OK)
  @RequiresPermission('eigenschutz:sicherungsposten:write')
  @ApiOperation({ summary: 'Sicherungsposten auflösen (Pflicht-Begründung — UX-DR27)' })
  @ApiParam({ name: 'einsatzId', type: String, description: 'CUID des Einsatzes' })
  @ApiParam({ name: 'postenId', type: String, description: 'CUID des Sicherungspostens' })
  @ApiBody({ type: AufloeseSicherungspostenDto })
  @ApiWrappedResponse(SicherungspostenDto, { description: 'Aufgelöster Sicherungsposten.' })
  @ApiNotFoundResponse({ description: 'Sicherungsposten existiert nicht oder gehört zu einem anderen Einsatz' })
  @ApiConflictResponse({ description: 'Optimistic-Concurrency-Mismatch' })
  @ApiUnprocessableEntityResponse({ description: 'Bereits aufgelöst oder Begründung ungültig' })
  async aufloeseSicherungsposten(
    @Param('einsatzId') einsatzId: string,
    @Param('postenId') postenId: string,
    @Body() body: AufloeseSicherungspostenDto,
    @CurrentUser() user: ValidatedUser,
  ): Promise<SicherungspostenDto> {
    const result = (await this.commandBus.execute(new AufloeseSicherungspostenCommand(einsatzId, postenId, user.userId, body.expectedVersion, body.begruendung))) as Result<string>;
    if (result.isFailure || !result.value) {
      throw this.mapCommandError(result.error ?? 'Sicherungsposten konnte nicht aufgelöst werden', body.expectedVersion);
    }
    return this.loadDto(einsatzId, result.value);
  }

  private async loadDto(einsatzId: string, postenId: string): Promise<SicherungspostenDto> {
    const result = await this.postenRepo.findReadModelById(postenId);
    if (result.isFailure || !result.value || result.value.aggregate.einsatzId !== einsatzId) {
      throw new NotFoundException({ statusCode: 404, error: 'Not Found', message: 'NotFound:Sicherungsposten', context: { resource: 'sicherungsposten' } });
    }
    return toSicherungspostenDto({
      aggregate: result.value.aggregate,
      erstelltAm: result.value.erstelltAm,
      aktualisiertAm: result.value.aktualisiertAm,
      aktualisiertVonUserId: result.value.aktualisiertVonUserId,
    });
  }

  private mapCommandError(error: string, attemptedVersion: number | undefined): NotFoundException | ConflictException | UnprocessableEntityException | InternalServerErrorException {
    if (error.startsWith(SICHERUNGSPOSTEN_CONFLICT_DETECTED)) {
      const match = error.match(/:current=(\d+)$/);
      const currentVersion = match?.[1] !== undefined ? Number.parseInt(match[1], 10) : undefined;
      return new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: SICHERUNGSPOSTEN_CONFLICT_DETECTED,
        context: { currentVersion, attemptedVersion },
      });
    }
    if (error.startsWith('NotFound:')) {
      const resource = error.slice('NotFound:'.length).toLowerCase();
      return new NotFoundException({ statusCode: 404, error: 'Not Found', message: error, context: { resource } });
    }
    if (error.startsWith('BusinessRule:')) {
      const rule = error.slice('BusinessRule:'.length);
      return new UnprocessableEntityException({ statusCode: 422, error: 'Unprocessable Entity', message: error, context: { rule } });
    }
    if (error.startsWith('ValidationFailed:')) {
      return new UnprocessableEntityException({ statusCode: 422, error: 'Unprocessable Entity', message: error, context: { rule: 'ItemValidation' } });
    }
    if (error.startsWith('InfrastructureError:') || error.startsWith('Invariant:')) {
      return new InternalServerErrorException({ statusCode: 500, error: 'Internal Server Error', message: error, context: { layer: error.startsWith('Invariant:') ? 'domain' : 'infrastructure' } });
    }
    const errorCategory = error.split(':')[0] ?? 'unknown';
    this.logger.error('Unexpected Sicherungsposten command error', { errorCategory });
    return new InternalServerErrorException({ statusCode: 500, error: 'Internal Server Error', message: error, context: { rule: 'Unexpected' } });
  }
}
