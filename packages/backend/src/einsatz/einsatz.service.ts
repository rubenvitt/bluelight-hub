import type { PaginatedData } from '@/common/interceptors/transform.interceptor';
import { CreateEinsatzDto, EinsatzCompleteness, EinsatzQueryDto, EinsatzResponseDto, NavigationResponseDto, StatusCountsResponseDto, UpdateEinsatzDto } from '@/einsatz/dto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Einsatz, EinsatzStatus, Prisma } from '@prisma/client';
import { milliseconds } from 'date-fns';
import { EinsatzRepository } from './einsatz.repository';
import { EinsatzNotFoundException } from './exceptions/einsatz-not-found.exception';
import { EinsatzCompletenessCalculator } from './utils/completeness.util';
import { EinsatzNameGenerator } from './utils/name-generator.util';
import { EinsatzStatusTransitions } from './utils/status-transitions.util';

@Injectable()
export class EinsatzService {
  private readonly logger = new Logger(EinsatzService.name);
  private readonly completenessCache = new Map<string, { data: EinsatzCompleteness; expires: number }>();
  private readonly CACHE_TTL = milliseconds({ minutes: 1 });
  private lastCleanup = Date.now();
  private readonly CLEANUP_INTERVAL = milliseconds({ minutes: 5 }); // 5 Minuten

  constructor(private readonly repository: EinsatzRepository) {}

  /**
   * Erstellt einen neuen Einsatz mit automatisch generiertem Namen.
   *
   * HINWEIS (Story 0-1): Domain Events werden NICHT mehr hier emittiert.
   * Stattdessen erfolgt Event-Publishing via Transactional Outbox Pattern
   * in den CQRS Command Handlers (CreateEinsatzHandler).
   *
   * @deprecated Nutze CreateEinsatzHandler für neue Implementierungen
   */
  async create(dto: CreateEinsatzDto, userId: string): Promise<EinsatzResponseDto> {
    const einsatzData = {
      alarmstichwort: dto.alarmstichwort || null,
      alarmierungszeit: dto.alarmierungszeit ? new Date(dto.alarmierungszeit) : null,
      einsatzort: dto.einsatzort || null,
      beschreibung: dto.beschreibung || null,
      einsatzleiter: dto.einsatzleiter || null,
      creator: {
        connect: {
          id: userId,
        },
      },
    };

    const einsatz = await this.repository.create(einsatzData);
    this.logger.log(`🚨 Einsatz ${einsatz.id} erstellt von User ${userId}`);

    return this.toResponseDto(einsatz);
  }

  /**
   * Gibt alle Einsätze zurück mit optionalem Status-Filter, Suchbegriff und Pagination
   *
   * WICHTIG: Archivierte Einsätze werden standardmäßig ausgeschlossen (No-Delete Policy)
   * Verwende includeArchived=true um auch archivierte Einsätze anzuzeigen
   */
  async findAll(params?: EinsatzQueryDto): Promise<PaginatedData<EinsatzResponseDto>> {
    const { status, search, includeCompleteness = false, includeArchived = false, page = 1, limit = 10, orderBy = 'createdAt', orderDirection = 'desc' } = params || {};

    // Build where conditions
    const where: Prisma.EinsatzWhereInput = {};

    // No-Delete Policy: Filter archivierte Einsätze standardmäßig aus
    if (!includeArchived && !status) {
      // Wenn kein spezifischer Status angefragt wurde UND archivierte nicht eingeschlossen werden sollen
      where.status = { not: EinsatzStatus.ARCHIVIERT };
    } else if (status) {
      where.status = status;
    }
    // Wenn includeArchived=true und kein spezifischer Status, zeige alle (kein Filter)

    if (search) {
      const searchTerm = search.trim();
      if (searchTerm) {
        // Note: Since 'name' is generated, we search in the fields that compose it
        where.OR = [
          { alarmstichwort: { contains: searchTerm, mode: 'insensitive' } },
          {
            id: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        ];
      }
    }

    const result = await this.repository.findWithPagination(page, limit, where, {
      [orderBy]: orderDirection,
    });
    const items = await Promise.all(result.items.map((e: Einsatz) => this.toResponseDto(e, includeCompleteness)));

    this.logger.log(`Found ${result.total} Einsätze (showing ${items.length}) with filters: status=${status}, search='${search}', includeArchived=${includeArchived}`);

    return {
      items,
      total: result.total,
      page,
      limit,
    };
  }

  /**
   * Gibt einen einzelnen Einsatz zurück
   */
  async findOne(id: string, includeCompleteness = true): Promise<EinsatzResponseDto> {
    const einsatz = await this.repository.findOne(id);

    if (!einsatz) {
      throw new EinsatzNotFoundException(id);
    }

    return this.toResponseDto(einsatz, includeCompleteness);
  }

  /**
   * Aktualisiert einen Einsatz und generiert den Namen neu
   */
  async update(id: string, dto: UpdateEinsatzDto, userId: string): Promise<EinsatzResponseDto> {
    const existing = await this.repository.findOne(id);

    if (!existing) {
      throw new EinsatzNotFoundException(id);
    }

    // Schutz vor Bearbeitung archivierter Einsätze
    if (!EinsatzStatusTransitions.canEdit(existing.status)) {
      throw new BadRequestException(`Einsatz ${id} ist archiviert und kann nicht mehr bearbeitet werden. Nur Lesezugriff ist erlaubt.`);
    }

    // Status-Übergang validieren wenn Status geändert wird
    if (dto.status && dto.status !== existing.status) {
      EinsatzStatusTransitions.validateTransition(existing.status, dto.status);
      this.logger.log(`Status-Übergang für Einsatz ${id}: ${existing.status} → ${dto.status}`);
    }

    const updateData: Prisma.EinsatzUpdateInput = {
      alarmstichwort: dto.alarmstichwort,
      status: dto.status,
      beschreibung: dto.beschreibung,
      metadata: dto.metadata as Prisma.InputJsonValue,
      updater: {
        connect: {
          id: userId,
        },
      },
    };

    if (dto.alarmierungszeit) {
      updateData.alarmierungszeit = new Date(dto.alarmierungszeit);
    }

    const updated = await this.repository.update(id, updateData);
    this.logger.log(`Einsatz ${id} aktualisiert von User ${userId}`);

    // Cache invalidieren
    this.completenessCache.delete(id);

    return this.toResponseDto(updated);
  }

  /**
   * Archiviert einen Einsatz (Soft-Delete)
   *
   * WICHTIG: Einsätze werden niemals physisch gelöscht!
   * Diese Methode setzt den Status auf ARCHIVIERT und dokumentiert
   * wann und von wem die Archivierung durchgeführt wurde.
   *
   * @security No-Delete Policy - siehe arc42 Dokumentation
   */
  async archive(id: string, userId: string): Promise<EinsatzResponseDto> {
    const existing = await this.repository.findOne(id);

    if (!existing) {
      throw new EinsatzNotFoundException(id);
    }

    // Verhindere mehrfache Archivierung
    if (existing.status === 'ARCHIVIERT') {
      this.logger.warn(`Einsatz ${id} ist bereits archiviert`);
      return this.toResponseDto(existing);
    }

    // Business-Rule: Nur ABGESCHLOSSEN kann archiviert werden
    if (!EinsatzStatusTransitions.canArchive(existing.status)) {
      throw new BadRequestException(`Einsatz ${id} kann nicht archiviert werden. Nur Einsätze mit Status ABGESCHLOSSEN können archiviert werden. Aktueller Status: ${existing.status}`);
    }

    const updateData: Prisma.EinsatzUpdateInput = {
      status: EinsatzStatus.ARCHIVIERT,
      archivedAt: new Date(),
      archiver: {
        connect: {
          id: userId,
        },
      },
      updater: {
        connect: {
          id: userId,
        },
      },
    };

    const archived = await this.repository.update(id, updateData);
    this.logger.warn(`⚠️ Einsatz ${id} wurde ARCHIVIERT von User ${userId} am ${new Date().toISOString()} (No-Delete Policy)`);

    // Cache invalidieren
    this.completenessCache.delete(id);

    return this.toResponseDto(archived);
  }

  /**
   * Berechnet die Vollständigkeit eines Einsatzes
   */
  async getCompleteness(id: string, refresh = false) {
    if (!refresh) {
      const cached = this.completenessCache.get(id);
      if (cached && cached.expires > Date.now()) {
        // Ensure cached data also has suggestedAction
        return {
          ...cached.data,
          missingFields: cached.data.missingFields.map((field) => ({
            ...field,
            suggestedAction: field.suggestedAction || field.message,
          })),
        };
      }
    }

    const einsatz = await this.repository.findOne(id);
    if (!einsatz) {
      throw new EinsatzNotFoundException(id);
    }

    const completeness = EinsatzCompletenessCalculator.calculate(einsatz);

    // Ensure all fields have suggestedAction (required by CompletenessResponseDto)
    const responseData = {
      ...completeness,
      missingFields: completeness.missingFields.map((field) => ({
        ...field,
        suggestedAction: field.suggestedAction || field.message,
      })),
    };

    // Cache speichern
    this.completenessCache.set(id, {
      data: responseData,
      expires: Date.now() + this.CACHE_TTL,
    });

    // Cleanup mit kombinierter Strategie: Zeit- und größenbasiert
    const now = Date.now();
    if (now - this.lastCleanup > this.CLEANUP_INTERVAL || this.completenessCache.size > 100) {
      this.cleanupExpiredCacheEntries();
      this.lastCleanup = now;
    }

    return responseData;
  }

  /**
   * Gibt die Anzahl der Einsätze pro Status zurück
   */
  async getStatusCounts(includeArchived = false): Promise<StatusCountsResponseDto> {
    const counts = await this.repository.countByStatus(includeArchived);

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

    return {
      total,
      counts,
    };
  }

  /**
   * Gibt die ID des vorherigen Einsatzes basierend auf createdAt zurück
   */
  async getPreviousId(id: string): Promise<NavigationResponseDto> {
    const currentEinsatz = await this.repository.findOne(id);
    if (!currentEinsatz) {
      throw new EinsatzNotFoundException(id);
    }

    const previousId = await this.repository.findPreviousId(currentEinsatz.createdAt);
    return { id: previousId };
  }

  /**
   * Gibt die ID des nächsten Einsatzes basierend auf createdAt zurück
   */
  async getNextId(id: string): Promise<NavigationResponseDto> {
    const currentEinsatz = await this.repository.findOne(id);
    if (!currentEinsatz) {
      throw new EinsatzNotFoundException(id);
    }

    const nextId = await this.repository.findNextId(currentEinsatz.createdAt);
    return { id: nextId };
  }

  /**
   * Konvertiert ein Einsatz-Entity zu einem ResponseDTO mit computed fields
   */
  private async toResponseDto(einsatz: Einsatz, includeCompleteness = false): Promise<EinsatzResponseDto> {
    const name = EinsatzNameGenerator.generate(einsatz);
    const nameComponents = EinsatzNameGenerator.getNameComponents(einsatz);

    const response: EinsatzResponseDto = {
      ...einsatz,
      name,
      nameComponents,
    };

    if (includeCompleteness) {
      response.completeness = await this.getCompleteness(einsatz.id);
    }

    return response;
  }

  /**
   * Bereinigt abgelaufene Cache-Einträge
   */
  private cleanupExpiredCacheEntries(): void {
    const now = Date.now();
    for (const [key, value] of this.completenessCache.entries()) {
      if (value.expires < now) {
        this.completenessCache.delete(key);
      }
    }
  }
}
