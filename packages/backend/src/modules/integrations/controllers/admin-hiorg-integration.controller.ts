/**
 * AdminHiOrgIntegrationController - Admin-Endpoints für HiOrg-Server Integration.
 *
 * Alle Endpoints sind mit JwtAuthGuard + RolesGuard geschützt.
 * Nur ADMIN und SUPER_ADMIN können HiOrg-Server Credentials verwalten.
 * Verwendet ausschließlich OAuth2 für die Authentifizierung.
 *
 * **Endpoints:**
 * - GET  /admin/integrations/hiorg/credentials - Credentials-Status abfragen
 * - POST /admin/integrations/hiorg/oauth/initiate - OAuth2 Flow starten
 * - POST /admin/integrations/hiorg/test        - Verbindung testen
 * - GET  /admin/integrations/hiorg/persons     - Personen-Vorschau laden
 *
 * @module modules/integrations/controllers
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
// biome-ignore lint/style/useImportType: ConfigService needed for DI at runtime
import { ConfigService } from '@nestjs/config';
import type { ILogger } from '@domain/ports/i-logger.port';
import { LOGGER } from '@/infrastructure/di-tokens';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiServiceUnavailableResponse,
  ApiTooManyRequestsResponse,
  ApiInternalServerErrorResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { ApiWrappedResponse } from '@/modules/common/decorators/api-wrapped-response.decorator';
import type { ValidatedUser } from '@/modules/auth/strategies/jwt.strategy';
import { ADMIN_RATE_LIMIT, ADMIN_MUTATION_RATE_LIMIT } from '@/infrastructure/http/constants/rate-limit.constants';

// Handlers
import { TestHiOrgConnectionHandler } from '@application/integrations/commands/test-hiorg-connection/test-hiorg-connection.handler';
import { InitiateOAuthFlowHandler } from '@application/integrations/commands/initiate-oauth-flow/initiate-oauth-flow.handler';
import { GetHiOrgCredentialsHandler } from '@application/integrations/queries/get-hiorg-credentials/get-hiorg-credentials.handler';
import { PreviewHiOrgPersonsHandler } from '@application/integrations/queries/preview-hiorg-persons/preview-hiorg-persons.handler';
import { GetQualifikationMappingsHandler } from '@application/integrations/queries/get-qualifikation-mappings/get-qualifikation-mappings.handler';
import { SaveQualifikationMappingHandler } from '@application/integrations/commands/save-qualifikation-mapping/save-qualifikation-mapping.handler';
import { AutoMatchQualifikationenHandler } from '@application/integrations/commands/auto-match-qualifikationen/auto-match-qualifikationen.handler';

// Commands & Queries
import { TestHiOrgConnectionCommand } from '@application/integrations/commands/test-hiorg-connection/test-hiorg-connection.command';
import { InitiateOAuthFlowCommand } from '@application/integrations/commands/initiate-oauth-flow/initiate-oauth-flow.command';
import { GetHiOrgCredentialsQuery } from '@application/integrations/queries/get-hiorg-credentials/get-hiorg-credentials.query';
import { PreviewHiOrgPersonsQuery } from '@application/integrations/queries/preview-hiorg-persons/preview-hiorg-persons.query';
import { GetQualifikationMappingsQuery } from '@application/integrations/queries/get-qualifikation-mappings/get-qualifikation-mappings.query';
import { SaveQualifikationMappingCommand } from '@application/integrations/commands/save-qualifikation-mapping/save-qualifikation-mapping.command';
import { AutoMatchQualifikationenCommand } from '@application/integrations/commands/auto-match-qualifikationen/auto-match-qualifikationen.command';
import { INTEGRATION_TYPES } from '@domain/integrations';

// DTOs
import {
  HiOrgCredentialsResponseDto,
  HiOrgConnectionInfoDto,
  HiOrgPersonsPreviewResponseDto,
  InitiateOAuthResponseDto,
  QualifikationMappingsResponseDto,
  SaveQualifikationMappingRequestDto,
  AutoMatchResultResponseDto,
  AutoMatchRequestDto,
} from '../dto';

// Error Codes
import { INTEGRATION_ERROR_CODES, IntegrationError } from '@domain/integrations';

/**
 * Admin Controller für HiOrg-Server Integration.
 *
 * **Sicherheitskonzept:**
 * - Nur ADMIN/SUPER_ADMIN haben Zugriff (JwtAuthGuard + RolesGuard)
 * - API Token wird verschlüsselt gespeichert (AES-256-GCM)
 * - Token wird NIEMALS in Responses zurückgegeben
 * - Alle Mutationen werden geloggt (Audit Trail)
 *
 * **Rate Limiting:**
 * - GET-Endpoints: 30 Anfragen pro Minute
 * - Mutationen (POST): 10 Anfragen pro Minute
 */
@ApiTags('admin-integrations-hiorg')
@ApiBearerAuth('admin-jwt')
@ApiUnauthorizedResponse({ description: 'Keine gültige Admin-Authentifizierung' })
@ApiTooManyRequestsResponse({ description: 'Rate limit überschritten' })
@ApiInternalServerErrorResponse({ description: 'Unerwarteter Serverfehler' })
@ApiForbiddenResponse({ description: 'Keine Berechtigung für diese Operation' })
@Controller({ path: 'admin/integrations/hiorg', version: 'alpha' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Throttle({ default: ADMIN_RATE_LIMIT })
export class AdminHiOrgIntegrationController {
  constructor(
    @Inject(LOGGER)
    private readonly logger: ILogger,
    private readonly configService: ConfigService,
    private readonly testConnectionHandler: TestHiOrgConnectionHandler,
    private readonly initiateOAuthHandler: InitiateOAuthFlowHandler,
    private readonly getCredentialsHandler: GetHiOrgCredentialsHandler,
    private readonly previewPersonsHandler: PreviewHiOrgPersonsHandler,
    // Story 7.2: Qualifikation-Mapping Handlers
    private readonly getMappingsHandler: GetQualifikationMappingsHandler,
    private readonly saveMappingHandler: SaveQualifikationMappingHandler,
    private readonly autoMatchHandler: AutoMatchQualifikationenHandler,
  ) {}

  /**
   * Prüft ob OAuth2 serverseitig konfiguriert ist.
   */
  private isOAuthConfigured(): boolean {
    const clientId = this.configService.get<string>('HIORG_OAUTH_CLIENT_ID');
    return !!clientId && clientId.length > 0;
  }

  /**
   * HiOrg-Server Credentials abfragen.
   *
   * SICHERHEIT: Das API Token wird NIEMALS zurückgegeben!
   * Nur hasToken=true/false signalisiert, ob ein Token konfiguriert ist.
   *
   * @returns Credentials ohne Token oder undefined wenn nicht konfiguriert
   */
  @Get('credentials')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'HiOrg-Server Credentials abfragen (ohne Token!)' })
  @ApiWrappedResponse(HiOrgCredentialsResponseDto, { description: 'Credentials gefunden' })
  @ApiNotFoundResponse({ description: 'Keine Credentials konfiguriert' })
  async getCredentials(): Promise<HiOrgCredentialsResponseDto> {
    const query = GetHiOrgCredentialsQuery.create();
    const result = await this.getCredentialsHandler.execute(query);

    if (result.isFailure) {
      this.logger.error(`Fehler beim Abrufen der Credentials: ${result.error}`);
      throw new InternalServerErrorException('Fehler beim Abrufen der Credentials');
    }

    // Auch ohne Credentials returnen wir isOAuthConfigured
    // So kann das Frontend den Button korrekt anzeigen
    if (!result.value) {
      return {
        hasOAuthTokens: false,
        isActive: false,
        lastTestedAt: null,
        lastSyncAt: null,
        isOAuthConfigured: this.isOAuthConfigured(),
      };
    }

    return {
      hasOAuthTokens: result.value.hasOAuthTokens,
      isActive: result.value.isActive,
      lastTestedAt: result.value.lastTestedAt ?? null,
      lastSyncAt: result.value.lastSyncAt ?? null,
      isOAuthConfigured: this.isOAuthConfigured(),
    };
  }

  /**
   * HiOrg-Server Verbindung testen.
   *
   * Verwendet die gespeicherten Credentials, um die Verbindung zum
   * HiOrg-Server zu testen. Bei Erfolg wird lastTestedAt aktualisiert.
   *
   * @returns Verbindungsinformationen
   */
  @Post('test')
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'HiOrg-Server Verbindung testen' })
  @ApiWrappedResponse(HiOrgConnectionInfoDto, { description: 'Verbindung erfolgreich' })
  @ApiNotFoundResponse({ description: 'Keine Credentials konfiguriert' })
  @ApiServiceUnavailableResponse({ description: 'HiOrg-Server nicht erreichbar' })
  async testConnection(@CurrentUser() user: ValidatedUser): Promise<HiOrgConnectionInfoDto> {
    const commandResult = TestHiOrgConnectionCommand.create({ userId: user.userId });
    if (commandResult.isFailure) {
      throw new BadRequestException(commandResult.error);
    }

    const result = await this.testConnectionHandler.execute(commandResult.value!);

    if (result.isFailure) {
      const error = result.error!;

      // Check error codes
      if (IntegrationError.hasCode(error, INTEGRATION_ERROR_CODES.CREDENTIALS_NOT_FOUND)) {
        throw new NotFoundException(IntegrationError.extractMessage(error));
      }
      if (IntegrationError.hasCode(error, INTEGRATION_ERROR_CODES.DECRYPTION_FAILED)) {
        this.logger.error(`Decryption failed: ${error}`);
        throw new InternalServerErrorException('Token-Entschlüsselung fehlgeschlagen');
      }
      if (IntegrationError.hasCode(error, INTEGRATION_ERROR_CODES.CONNECTION_FAILED)) {
        throw new ServiceUnavailableException(IntegrationError.extractMessage(error));
      }
      if (IntegrationError.hasCode(error, INTEGRATION_ERROR_CODES.INVALID_TOKEN)) {
        throw new ForbiddenException(IntegrationError.extractMessage(error));
      }
      if (IntegrationError.hasCode(error, INTEGRATION_ERROR_CODES.FEATURE_LOCKED)) {
        throw new ForbiddenException(IntegrationError.extractMessage(error));
      }
      if (IntegrationError.hasCode(error, INTEGRATION_ERROR_CODES.RATE_LIMITED)) {
        throw new HttpException(IntegrationError.extractMessage(error), HttpStatus.TOO_MANY_REQUESTS);
      }

      throw new ServiceUnavailableException('Verbindungstest fehlgeschlagen');
    }

    // Nach isFailure-Check ist value garantiert vorhanden
    const connectionInfo = result.value!;
    this.logger.log(`HiOrg-Verbindungstest erfolgreich für ${connectionInfo.organisationName}`);

    return {
      organisationName: connectionInfo.organisationName,
      connected: true,
      testedAt: connectionInfo.testedAt,
    };
  }

  /**
   * OAuth2 Flow initiieren.
   *
   * Generiert Authorization URL und gibt diese zurueck.
   * Der Admin muss dann zu dieser URL navigieren, um HiOrg-Server
   * Zugriff zu gewaehren.
   *
   * @param user - Aktueller Admin-Benutzer (aus JWT Token)
   * @returns Authorization URL fuer OAuth2 Flow
   */
  @Post('oauth/initiate')
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'OAuth2 Flow fuer HiOrg starten' })
  @ApiWrappedResponse(InitiateOAuthResponseDto, { description: 'Authorization URL' })
  @ApiBadRequestResponse({ description: 'OAuth nicht konfiguriert (HIORG_OAUTH_CLIENT_ID fehlt)' })
  async initiateOAuthFlow(@CurrentUser() user: ValidatedUser): Promise<InitiateOAuthResponseDto> {
    const commandResult = InitiateOAuthFlowCommand.create({
      integrationType: INTEGRATION_TYPES.HIORG_SERVER,
      userId: user.userId,
    });

    if (commandResult.isFailure) {
      throw new BadRequestException(commandResult.error);
    }

    const result = await this.initiateOAuthHandler.execute(commandResult.value!);

    if (result.isFailure) {
      const error = result.error!;
      // OAuth nicht konfiguriert ist ein Client-Fehler (Konfiguration fehlt)
      // BadRequest zeigt dem User die Nachricht an (4xx werden nicht maskiert)
      if (IntegrationError.hasCode(error, INTEGRATION_ERROR_CODES.OAUTH_NOT_CONFIGURED)) {
        throw new BadRequestException(
          'OAuth ist noch nicht konfiguriert. Die HIORG_OAUTH_CLIENT_ID Umgebungsvariable fehlt. Bitte wende dich an den HiOrg-Server Support um OAuth Zugangsdaten zu erhalten.',
        );
      }
      throw new BadRequestException(IntegrationError.extractMessage(error));
    }

    // Nach isFailure-Check ist value garantiert vorhanden
    const flowResult = result.value!;
    this.logger.log(`OAuth flow initiated for HiOrg by admin ${user.userId}`);
    return { authorizationUrl: flowResult.authorizationUrl };
  }

  /**
   * Personen-Vorschau aus HiOrg-Server laden.
   *
   * Lädt eine Vorschau aller Personen aus dem HiOrg-Server.
   * Kann optional nur aktive Personen zurückgeben.
   *
   * @param activeOnly - Nur aktive Personen? (default: true)
   * @returns Personen-Vorschau mit Anzahl und Liste
   */
  @Get('persons')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Personen-Vorschau aus HiOrg-Server laden' })
  @ApiWrappedResponse(HiOrgPersonsPreviewResponseDto, { description: 'Personen-Vorschau' })
  @ApiNotFoundResponse({ description: 'Keine Credentials konfiguriert' })
  @ApiServiceUnavailableResponse({ description: 'HiOrg-Server nicht erreichbar' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean, description: 'Nur aktive Personen (default: true)' })
  async previewPersons(@Query('activeOnly') activeOnly?: string): Promise<HiOrgPersonsPreviewResponseDto> {
    // Parse boolean manually
    let parsedActiveOnly: boolean | undefined;
    if (activeOnly !== undefined) {
      if (activeOnly === 'true') {
        parsedActiveOnly = true;
      } else if (activeOnly === 'false') {
        parsedActiveOnly = false;
      } else {
        throw new BadRequestException("Ungültiger Wert für 'activeOnly'. Erlaubte Werte: 'true', 'false'");
      }
    }

    const queryResult = PreviewHiOrgPersonsQuery.create({ activeOnly: parsedActiveOnly });
    if (queryResult.isFailure) {
      throw new BadRequestException(queryResult.error);
    }

    const result = await this.previewPersonsHandler.execute(queryResult.value!);

    if (result.isFailure) {
      const error = result.error!;

      // Check error codes
      if (IntegrationError.hasCode(error, INTEGRATION_ERROR_CODES.CREDENTIALS_NOT_FOUND)) {
        throw new NotFoundException(IntegrationError.extractMessage(error));
      }
      if (IntegrationError.hasCode(error, INTEGRATION_ERROR_CODES.DECRYPTION_FAILED)) {
        this.logger.error(`Decryption failed: ${error}`);
        throw new InternalServerErrorException('Token-Entschlüsselung fehlgeschlagen');
      }
      if (IntegrationError.hasCode(error, INTEGRATION_ERROR_CODES.CONNECTION_FAILED)) {
        throw new ServiceUnavailableException(IntegrationError.extractMessage(error));
      }
      if (IntegrationError.hasCode(error, INTEGRATION_ERROR_CODES.INVALID_TOKEN)) {
        throw new ForbiddenException(IntegrationError.extractMessage(error));
      }

      throw new ServiceUnavailableException('Personen-Abfrage fehlgeschlagen');
    }

    // Nach isFailure-Check ist value garantiert vorhanden
    const preview = result.value!;
    return {
      totalCount: preview.totalCount,
      persons: preview.persons.map((p) => ({
        username: p.username,
        mitgliednr: p.mitgliednr,
        vorname: p.vorname,
        nachname: p.nachname,
        qualifikationenCount: p.qualifikationenCount,
        ausbildungenCount: p.ausbildungenCount,
      })),
    };
  }

  // ============ Story 7.2: Qualifikation-Mapping Endpoints ============

  /**
   * Qualifikation-Mappings abrufen.
   *
   * Gibt alle Mappings für HiOrg-Server zurück mit den zugehörigen
   * internen Qualifikation-Namen (falls gemappt).
   *
   * @returns Liste aller Mappings mit Statistiken
   */
  @Get('qualifikation-mappings')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Qualifikation-Mappings abrufen' })
  @ApiWrappedResponse(QualifikationMappingsResponseDto, { description: 'Mappings gefunden' })
  async getQualifikationMappings(): Promise<QualifikationMappingsResponseDto> {
    const queryResult = GetQualifikationMappingsQuery.create({
      source: INTEGRATION_TYPES.HIORG_SERVER,
    });

    if (queryResult.isFailure) {
      throw new BadRequestException(queryResult.error);
    }

    const result = await this.getMappingsHandler.execute(queryResult.value!);

    if (result.isFailure) {
      const error = result.error!;
      if (IntegrationError.hasCode(error, INTEGRATION_ERROR_CODES.MAPPING_NOT_FOUND)) {
        // Keine Mappings = leere Liste zurückgeben
        return {
          mappings: [],
          total: 0,
          mapped: 0,
          unmapped: 0,
        };
      }
      throw new InternalServerErrorException('Fehler beim Laden der Mappings');
    }

    const data = result.value!;
    return {
      mappings: data.mappings.map((m) => ({
        id: m.id,
        externalName: m.externalName,
        externalSource: m.externalSource,
        qualifikationId: m.qualifikationId,
        qualifikationName: m.qualifikationName,
        isAutoMatched: m.isAutoMatched,
        confidence: m.confidence,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
      total: data.total,
      mapped: data.mapped,
      unmapped: data.unmapped,
    };
  }

  /**
   * Qualifikation-Mapping speichern.
   *
   * Aktualisiert die Zuordnung eines externen Qualifikations-Namens
   * zu einer internen Qualifikation. Null entfernt die Zuordnung.
   *
   * @param dto - Mapping-Daten
   * @param user - Aktueller Admin-Benutzer
   * @returns Erfolgsbestätigung
   */
  @Post('qualifikation-mappings')
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Qualifikation-Mapping speichern' })
  @ApiWrappedResponse(QualifikationMappingsResponseDto, { description: 'Mapping gespeichert' })
  @ApiBadRequestResponse({ description: 'Ungültige Mapping-Daten' })
  async saveQualifikationMapping(@Body() dto: SaveQualifikationMappingRequestDto, @CurrentUser() user: ValidatedUser): Promise<QualifikationMappingsResponseDto> {
    const commandResult = SaveQualifikationMappingCommand.create({
      mappingId: dto.id,
      qualifikationId: dto.qualifikationId ?? null,
      updatedBy: user.userId,
    });

    if (commandResult.isFailure) {
      throw new BadRequestException(commandResult.error);
    }

    const result = await this.saveMappingHandler.execute(commandResult.value!);

    if (result.isFailure) {
      const error = result.error!;
      if (IntegrationError.hasCode(error, INTEGRATION_ERROR_CODES.MAPPING_NOT_FOUND)) {
        throw new NotFoundException('Mapping nicht gefunden');
      }
      throw new InternalServerErrorException('Fehler beim Speichern des Mappings');
    }

    this.logger.log(`Qualifikation-Mapping ${dto.id} aktualisiert von ${user.userId}`);

    // Nach dem Speichern alle Mappings zurückgeben
    return this.getQualifikationMappings();
  }

  /**
   * Auto-Match für Qualifikationen ausführen.
   *
   * Verwendet Levenshtein-Distanz und exaktes Matching um externe
   * Qualifikationen automatisch auf interne abzubilden.
   *
   * @param dto - Auto-Match Optionen
   * @param user - Aktueller Admin-Benutzer
   * @returns Match-Ergebnisse mit Statistiken
   */
  @Post('qualifikation-mappings/auto-match')
  @Throttle({ default: ADMIN_MUTATION_RATE_LIMIT })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Auto-Match für Qualifikationen ausführen' })
  @ApiWrappedResponse(AutoMatchResultResponseDto, { description: 'Auto-Match Ergebnisse' })
  async autoMatchQualifikationen(@Body() dto: AutoMatchRequestDto, @CurrentUser() user: ValidatedUser): Promise<AutoMatchResultResponseDto> {
    const commandResult = AutoMatchQualifikationenCommand.create({
      source: INTEGRATION_TYPES.HIORG_SERVER,
      onlyUnmapped: dto.onlyUnmapped ?? true,
      initiatedBy: user.userId,
    });

    if (commandResult.isFailure) {
      throw new BadRequestException(commandResult.error);
    }

    const result = await this.autoMatchHandler.execute(commandResult.value!);

    if (result.isFailure) {
      throw new InternalServerErrorException('Fehler beim Auto-Matching');
    }

    const data = result.value!;
    this.logger.log(`Auto-Match abgeschlossen: ${data.totalMatched}/${data.totalMatched + data.totalUnmatched} gematcht (${data.averageConfidence}% avg)`);

    return {
      matches: data.matches.map((m) => ({
        externalName: m.externalName,
        matchedQualifikationId: m.matchedQualifikationId,
        matchedQualifikationName: m.matchedQualifikationName,
        confidence: m.confidence,
        matchType: m.matchType,
      })),
      totalMatched: data.totalMatched,
      totalUnmatched: data.totalUnmatched,
      averageConfidence: data.averageConfidence,
    };
  }
}
