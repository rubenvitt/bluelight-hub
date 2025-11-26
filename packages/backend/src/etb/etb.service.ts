import { ValidatedUser } from '@/auth/strategies/jwt.strategy';
import { FilterPaginationDto } from '@/common/dto/pagination.dto';
import type { PaginatedData } from '@/common/interceptors/transform.interceptor';
import { EinsatzErstelltEvent } from '@/einsatz/events/einsatz-erstellt.event';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Einsatz, Einsatztagebuch, EtbEintrag, EtbEintragHistorie, EtbStatus, EtbTextbaustein, User } from '@prisma/client';
import { CreateEtbEintragDto } from './dto/create-etb-eintrag.dto';
import { CreateEtbDto } from './dto/create-etb.dto';
import { EtbPaginationDto } from './dto/etb-pagination.dto';
import {
  CreateEtbEintragResponse,
  CreateEtbResponse,
  EtbDto,
  EtbEintragDto,
  EtbHistoryEntryDto,
  GetEtbResponse,
  TextbausteinDto,
  TextbausteinListResponse,
  UpdateEtbEintragResponse,
} from './dto/etb-response.dto';
import { UpdateEtbEintragDto } from './dto/update-etb-eintrag.dto';
import { EtbRepository } from './etb.repository';

@Injectable()
export class EtbService {
  private readonly logger = new Logger(EtbService.name);

  constructor(private readonly etbRepository: EtbRepository) {}

  /**
   * @deprecated DEAKTIVIERT - Ersetzt durch EtbAutoCreationHandler (CQRS/DDD)
   *
   * Event-Listener: Reagiert auf Einsatz-Erstellung und legt automatisch ETB an
   *
   * Dieser Listener wurde durch den EtbAutoCreationHandler im Application Layer ersetzt,
   * der den CQRS-Ansatz mit Domain Events verwendet.
   *
   * @see packages/backend/src/application/etb/event-handlers/etb-auto-creation.handler.ts
   */
  // @OnEvent('einsatz.erstellt') - DEAKTIVIERT: Nutze EtbAutoCreationHandler stattdessen
  async handleEinsatzErstellt_DISABLED(event: EinsatzErstelltEvent): Promise<void> {
    try {
      await this.createEtbForEinsatz(event.einsatzId, event.userId);
      this.logger.log(`📖 ETB für Einsatz ${event.einsatzId} automatisch erstellt (DRAFT) - Event-basiert`);
    } catch (error) {
      this.logger.error(`⚠️ ETB-Erstellung fehlgeschlagen für Einsatz ${event.einsatzId}`, {
        einsatzId: event.einsatzId,
        userId: event.userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Optional: Sentry/Monitoring Integration
      // await this.monitoringService?.captureException(error, {
      //   tags: { einsatzId: event.einsatzId, eventType: 'einsatz.erstellt' }
      // });

      // Optional: Dead Letter Queue für manuelle Nachbearbeitung
      // await this.dlqService?.push('etb.creation.failed', event);

      // Nicht kritisch - ETB kann später noch angelegt werden
    }
  }

  async createEtb(createEtbDto: CreateEtbDto, user: ValidatedUser): Promise<CreateEtbResponse> {
    // Check if ETB already exists for this Einsatz
    const existingEtb = await this.etbRepository.findByEinsatzId(createEtbDto.einsatzId);
    if (existingEtb) {
      throw new ConflictException('ETB already exists for this Einsatz');
    }

    const etb = await this.etbRepository.create({
      einsatzId: createEtbDto.einsatzId,
      status: EtbStatus.DRAFT,
      createdBy: user.userId,
    });

    return {
      data: this.toEtbDto(etb),
      meta: {
        timestamp: new Date().toISOString(),
      },
      message: 'ETB erfolgreich erstellt',
    };
  }

  /**
   * Creates ETB for a new Einsatz (called internally during Einsatz creation)
   * ETB is initially DRAFT and ready for entries
   *
   * Implements idempotent find-or-create pattern to prevent race conditions
   * when multiple event handlers process the same Einsatz creation event.
   */
  async createEtbForEinsatz(einsatzId: string, userId: string): Promise<EtbDto> {
    // Try to find existing ETB first (find-or-create pattern)
    const existingEtb = await this.etbRepository.findByEinsatzId(einsatzId);
    if (existingEtb) {
      this.logger.debug(`ETB für Einsatz ${einsatzId} existiert bereits - skip creation`);
      return this.toEtbDto(existingEtb);
    }

    try {
      const etb = await this.etbRepository.create({
        einsatzId,
        status: EtbStatus.DRAFT,
        createdBy: userId,
      });

      return this.toEtbDto(etb);
    } catch (error: unknown) {
      // Handle P2002: Unique constraint violation (race condition)
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        this.logger.warn(`Race condition detected: ETB für Einsatz ${einsatzId} wurde parallel erstellt`);
        // Fetch the ETB that was created by the concurrent request
        const etb = await this.etbRepository.findByEinsatzId(einsatzId);
        if (!etb) {
          // This should never happen, but handle it gracefully
          throw new ConflictException('ETB creation race condition - unable to retrieve existing ETB');
        }
        return this.toEtbDto(etb);
      }
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Ruft ein ETB anhand der Einsatz-ID mit paginierten Einträgen ab
   *
   * @param einsatzId - Die ID des Einsatzes
   * @param paginationDto - DTO mit Paginierungs- und Sortieroptionen
   * @returns Das ETB mit paginierten Einträgen
   */
  async getEtbByEinsatzId(einsatzId: string, paginationDto: EtbPaginationDto): Promise<GetEtbResponse> {
    const { limit = 10, page = 1, sortBy = 'timestamp', sortOrder = 'desc', includeDeleted = false } = paginationDto;

    const offset = (page - 1) * limit;
    const etb = await this.etbRepository.findByEinsatzIdWithEntries(einsatzId, limit, offset, sortBy, sortOrder, includeDeleted);
    if (!etb) {
      throw new NotFoundException('ETB not found for this Einsatz');
    }

    // Get total count for pagination
    const total = await this.etbRepository.countEintraege(etb.id, includeDeleted);
    const totalPages = Math.ceil(total / limit);

    return {
      data: this.toEtbDto(etb),
      meta: {
        timestamp: new Date().toISOString(),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async createEintrag(etbId: string, createEintragDto: CreateEtbEintragDto, user: ValidatedUser): Promise<CreateEtbEintragResponse> {
    // Verify ETB exists and is not locked
    const etb = await this.etbRepository.findById(etbId);
    if (!etb) {
      throw new NotFoundException('ETB not found');
    }
    if (etb.status === EtbStatus.LOCKED) {
      throw new BadRequestException('Cannot add entries to locked ETB');
    }

    // Use atomic method to prevent race conditions
    const eintrag = await this.etbRepository.createEintragAtomic({
      etbId,
      timestamp: createEintragDto.timestamp || new Date(),
      kategorie: createEintragDto.kategorie,
      text: createEintragDto.text,
      metadata: createEintragDto.metadata,
      createdBy: user.userId,
      version: 1,
    });

    return {
      data: this.toEtbEintragDto(eintrag),
      meta: {
        timestamp: new Date().toISOString(),
      },
      message: 'ETB-Eintrag erfolgreich erstellt',
    };
  }

  async updateEintrag(eintragId: string, updateEintragDto: UpdateEtbEintragDto, user: ValidatedUser): Promise<UpdateEtbEintragResponse> {
    // Verify entry exists
    const eintrag = await this.etbRepository.findEintragById(eintragId);
    if (!eintrag) {
      throw new NotFoundException('ETB entry not found');
    }

    // Verify ETB is not locked
    const etb = await this.etbRepository.findById(eintrag.etbId);
    if (!etb) {
      throw new NotFoundException('ETB not found');
    }
    if (etb.status === EtbStatus.LOCKED) {
      throw new BadRequestException('Cannot update entries in locked ETB');
    }

    // Create history entry before update
    await this.etbRepository.createEintragHistory({
      eintragId,
      version: eintrag.version,
      timestamp: eintrag.timestamp,
      sequenceNumber: eintrag.sequenceNumber,
      kategorie: eintrag.kategorie,
      text: eintrag.text,
      metadata: eintrag.metadata as Record<string, unknown> | undefined,
      changeReason: updateEintragDto.changeReason || 'Update',
      changedBy: user.userId,
    });

    // Update the entry with incremented version
    const updatedEintrag = await this.etbRepository.updateEintrag(eintragId, {
      ...updateEintragDto,
      version: eintrag.version + 1,
      updatedBy: user.userId,
    });

    return {
      data: this.toEtbEintragDto(updatedEintrag),
      meta: {
        timestamp: new Date().toISOString(),
      },
      message: 'ETB-Eintrag erfolgreich aktualisiert',
    };
  }

  async deleteEintrag(eintragId: string, user: ValidatedUser): Promise<void> {
    // Verify entry exists
    const eintrag = await this.etbRepository.findEintragById(eintragId);
    if (!eintrag) {
      throw new NotFoundException('ETB entry not found');
    }

    // Verify ETB is not locked
    const etb = await this.etbRepository.findById(eintrag.etbId);
    if (!etb) {
      throw new NotFoundException('ETB not found');
    }
    if (etb.status === EtbStatus.LOCKED) {
      throw new BadRequestException('Cannot delete entries from locked ETB');
    }

    // Soft delete
    await this.etbRepository.softDeleteEintrag(eintragId, user.userId);
  }

  async getTextbausteine(): Promise<TextbausteinListResponse> {
    const textbausteine = await this.etbRepository.findAllTextbausteine();

    return {
      data: textbausteine.map((baustein) => this.toTextbausteinDto(baustein)),
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Ruft die Versionshistorie eines ETB-Eintrags ab
   *
   * @param eintragId - ID des ETB-Eintrags
   * @param paginationDto - DTO mit Paginierungsoptionen
   * @returns Versionshistorie mit Paginierung
   */
  async getEintragHistory(eintragId: string, paginationDto: FilterPaginationDto): Promise<PaginatedData<EtbHistoryEntryDto>> {
    const { limit = 10, page = 1 } = paginationDto;

    // Verify entry exists
    const eintrag = await this.etbRepository.findEintragById(eintragId);
    if (!eintrag) {
      throw new NotFoundException('ETB entry not found');
    }

    const offset = (page - 1) * limit;
    const history = await this.etbRepository.findEintragHistoryById(eintragId, limit, offset);
    const total = await this.etbRepository.countEintragHistory(eintragId);

    return {
      items: history.map((entry) => this.toHistoryEntryDto(entry)),
      total,
      page,
      limit,
    };
  }

  /**
   * Maps a Prisma EtbEintrag to EtbEintragDto
   */
  private toEtbEintragDto(
    eintrag: EtbEintrag & {
      creator?: Partial<User> | null;
      updater?: Partial<User> | null;
      deleter?: Partial<User> | null;
      historie?: Array<{ id: string; version: number; changedAt: Date }> | null;
    },
  ): EtbEintragDto {
    return {
      id: eintrag.id,
      etbId: eintrag.etbId,
      timestamp: eintrag.timestamp,
      sequenceNumber: eintrag.sequenceNumber,
      kategorie: eintrag.kategorie,
      text: eintrag.text,
      version: eintrag.version,
      funkrufname: eintrag.funkrufname ?? undefined,
      standort: eintrag.standort ?? undefined,
      isAutomatic: eintrag.isAutomatic ?? false,
      metadata: eintrag.metadata ? (eintrag.metadata as Record<string, unknown>) : undefined,
      createdBy: eintrag.createdBy,
      createdAt: eintrag.createdAt,
      updatedBy: eintrag.updatedBy ?? undefined,
      updatedAt: eintrag.updatedAt,
      deletedAt: eintrag.deletedAt ?? undefined,
      deletedBy: eintrag.deletedBy ?? undefined,
      deleterUsername: eintrag.deleter?.username,
    };
  }

  /**
   * Maps a Prisma Einsatztagebuch to EtbDto
   */
  private toEtbDto(
    etb: Einsatztagebuch & {
      einsatz?: Partial<Einsatz> | null;
      creator?: Partial<User> | null;
      updater?: Partial<User> | null;
      locker?: Partial<User> | null;
      eintraege?: Array<
        EtbEintrag & {
          creator?: Partial<User> | null;
          updater?: Partial<User> | null;
          deleter?: Partial<User> | null;
          historie?: Array<{ id: string; version: number; changedAt: Date }> | null;
        }
      > | null;
    },
  ): EtbDto {
    const dto: EtbDto = {
      id: etb.id,
      einsatzId: etb.einsatzId,
      status: etb.status,
      createdBy: etb.createdBy,
      createdAt: etb.createdAt,
      updatedAt: etb.updatedAt,
    };

    // Only include eintraege if they are loaded
    if (etb.eintraege) {
      dto.eintraege = etb.eintraege.map((e) => this.toEtbEintragDto(e));
    }

    return dto;
  }

  /**
   * Maps a Prisma EtbTextbaustein to TextbausteinDto
   */
  private toTextbausteinDto(
    baustein: EtbTextbaustein & {
      creator?: Partial<User> | null;
      updater?: Partial<User> | null;
    },
  ): TextbausteinDto {
    return {
      id: baustein.id,
      kategorie: baustein.kategorie,
      kurztext: baustein.kurztext,
      volltext: baustein.volltext,
      isActive: baustein.isActive ?? true,
      sortOrder: baustein.sortOrder ?? 0,
      verwendungen: baustein.verwendungen ?? 0,
      letztGenutzt: baustein.letztGenutzt ?? undefined,
    };
  }

  /**
   * Maps a Prisma EtbEintragHistorie to EtbHistoryEntryDto
   */
  private toHistoryEntryDto(
    historyEntry: EtbEintragHistorie & {
      modifier?: Partial<User> | null;
    },
  ): EtbHistoryEntryDto {
    return {
      id: historyEntry.id,
      eintragId: historyEntry.eintragId,
      version: historyEntry.version,
      timestamp: historyEntry.timestamp,
      sequenceNumber: historyEntry.sequenceNumber,
      kategorie: historyEntry.kategorie,
      text: historyEntry.text,
      funkrufname: historyEntry.funkrufname ?? undefined,
      standort: historyEntry.standort ?? undefined,
      metadata: historyEntry.metadata ? (historyEntry.metadata as Record<string, unknown>) : undefined,
      changeReason: historyEntry.changeReason ?? undefined,
      changedAt: historyEntry.changedAt,
      changedBy: historyEntry.changedBy,
      changedByUsername: historyEntry.modifier?.username,
    };
  }
}
