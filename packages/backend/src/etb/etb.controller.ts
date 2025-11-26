import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { ValidatedUser } from '@/auth/strategies/jwt.strategy';
import { FilterPaginationDto } from '@/common/dto/pagination.dto';
import type { PaginatedData } from '@/common/interceptors/transform.interceptor';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { milliseconds } from 'date-fns';
import { CreateEtbEintragDto } from './dto/create-etb-eintrag.dto';
import { CreateEtbDto } from './dto/create-etb.dto';
import { EtbPaginationDto } from './dto/etb-pagination.dto';
import { CreateEtbEintragResponse, CreateEtbResponse, EtbHistoryEntryDto, EtbHistoryListResponse, GetEtbResponse, TextbausteinListResponse, UpdateEtbEintragResponse } from './dto/etb-response.dto';
import { UpdateEtbEintragDto } from './dto/update-etb-eintrag.dto';
import { EtbService } from './etb.service';

/**
 * Controller für die Verwaltung von Einsatztagebüchern (ETB)
 *
 * Dieser Controller stellt Endpunkte zur Verfügung für:
 * - Erstellung und Verwaltung von ETBs
 * - Verwaltung von ETB-Einträgen
 * - Abruf von Textbausteinen
 *
 * Rate Limiting:
 * - Standard: 100 Requests pro Minute
 * - Write-Operationen (create/update/delete): 20 Requests pro Minute
 */
@ApiTags('ETB')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@Throttle({ default: { limit: 100, ttl: milliseconds({ minutes: 1 }) } })
@Controller('etb')
export class EtbController {
  constructor(private readonly etbService: EtbService) {}

  /**
   * Erstellt ein neues ETB für einen Einsatz
   *
   * @param createEtbDto - DTO mit den Daten für das neue ETB
   * @param user - Der authentifizierte Benutzer
   * @returns Das erstellte ETB
   */
  @Post()
  @ApiOperation({ summary: 'Neues ETB für einen Einsatz erstellen' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'ETB erfolgreich erstellt',
    type: CreateEtbResponse,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Ungültige Eingaben' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Für diesen Einsatz existiert bereits ein ETB' })
  async createEtb(@Body() createEtbDto: CreateEtbDto, @CurrentUser() user: ValidatedUser): Promise<CreateEtbResponse> {
    return this.etbService.createEtb(createEtbDto, user);
  }

  /**
   * Ruft alle verfügbaren Textbausteine ab
   *
   * @returns Liste aller aktiven Textbausteine
   */
  @Get('textbausteine')
  @ApiOperation({ summary: 'Alle Textbausteine abrufen' })
  @ApiOkResponse({
    description: 'Textbausteine abgerufen',
    type: TextbausteinListResponse,
  })
  async getTextbausteine(): Promise<TextbausteinListResponse> {
    return this.etbService.getTextbausteine();
  }

  /**
   * Ruft ein ETB anhand der Einsatz-ID ab
   *
   * @param einsatzId - Die ID des Einsatzes
   * @param paginationQuery - Query-Parameter für Paginierung und Sortierung
   * @returns Das ETB mit paginierten Einträgen
   */
  @Get(':einsatzId')
  @ApiOperation({ summary: 'ETB anhand der Einsatz-ID abrufen' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'ETB gefunden',
    type: GetEtbResponse,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'ETB nicht gefunden' })
  async getEtbByEinsatzId(@Param('einsatzId') einsatzId: string, @Query() paginationQuery: EtbPaginationDto): Promise<GetEtbResponse> {
    return this.etbService.getEtbByEinsatzId(einsatzId, paginationQuery);
  }

  /**
   * Erstellt einen neuen Eintrag in einem ETB
   *
   * @param etbId - Die ID des ETB
   * @param createEintragDto - DTO mit den Daten für den neuen Eintrag
   * @param user - Der authentifizierte Benutzer
   * @returns Der erstellte ETB-Eintrag
   */
  @Post(':id/eintraege')
  @Throttle({ default: { limit: 20, ttl: milliseconds({ minutes: 1 }) } })
  @ApiOperation({ summary: 'Neuen ETB-Eintrag erstellen' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Eintrag erfolgreich erstellt',
    type: CreateEtbEintragResponse,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Ungültige Eingaben' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'ETB nicht gefunden' })
  async createEintrag(@Param('id') etbId: string, @Body() createEintragDto: CreateEtbEintragDto, @CurrentUser() user: ValidatedUser): Promise<CreateEtbEintragResponse> {
    return this.etbService.createEintrag(etbId, createEintragDto, user);
  }

  /**
   * Aktualisiert einen bestehenden ETB-Eintrag
   *
   * @param eintragId - Die ID des zu aktualisierenden Eintrags
   * @param updateEintragDto - DTO mit den aktualisierten Daten
   * @param user - Der authentifizierte Benutzer
   * @returns Der aktualisierte ETB-Eintrag
   */
  @Put('eintraege/:id')
  @Throttle({ default: { limit: 20, ttl: milliseconds({ minutes: 1 }) } })
  @ApiOperation({ summary: 'ETB-Eintrag aktualisieren' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Eintrag erfolgreich aktualisiert',
    type: UpdateEtbEintragResponse,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Ungültige Eingaben' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Eintrag nicht gefunden' })
  async updateEintrag(@Param('id') eintragId: string, @Body() updateEintragDto: UpdateEtbEintragDto, @CurrentUser() user: ValidatedUser): Promise<UpdateEtbEintragResponse> {
    return this.etbService.updateEintrag(eintragId, updateEintragDto, user);
  }

  /**
   * Ruft die Versionshistorie eines ETB-Eintrags ab
   *
   * @param eintragId - Die ID des ETB-Eintrags
   * @param paginationQuery - Query-Parameter für Paginierung
   * @returns Versionshistorie des Eintrags
   */
  @Get('eintraege/:id/history')
  @ApiOperation({ summary: 'Versionshistorie eines ETB-Eintrags abrufen' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Historie erfolgreich abgerufen',
    type: EtbHistoryListResponse,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Eintrag nicht gefunden' })
  async getEintragHistory(@Param('id') eintragId: string, @Query() paginationQuery: FilterPaginationDto): Promise<PaginatedData<EtbHistoryEntryDto>> {
    return this.etbService.getEintragHistory(eintragId, paginationQuery);
  }

  /**
   * Soft-löscht einen ETB-Eintrag
   *
   * @param eintragId - Die ID des zu löschenden Eintrags
   * @param user - Der authentifizierte Benutzer
   */
  @Delete('eintraege/:id')
  @Throttle({ default: { limit: 20, ttl: milliseconds({ minutes: 1 }) } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'ETB-Eintrag soft löschen' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Eintrag erfolgreich gelöscht' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Eintrag nicht gefunden' })
  async deleteEintrag(@Param('id') eintragId: string, @CurrentUser() user: ValidatedUser): Promise<void> {
    await this.etbService.deleteEintrag(eintragId, user);
  }
}
