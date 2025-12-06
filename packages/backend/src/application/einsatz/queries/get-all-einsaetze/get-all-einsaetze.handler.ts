import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject, Logger } from '@nestjs/common';
import { Result } from '@domain/common/result';
import type { PaginatedData } from '@/common/interceptors/transform.interceptor';
import type { EinsatzResponseDto } from '@/application/einsatz/dto/einsatz-response.dto';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import { EinsatzNameGenerator } from '@/einsatz/utils/name-generator.util';
import { EinsatzCompletenessCalculator } from '@/einsatz/utils/completeness.util';
import { GetAllEinsaetzeQuery } from './get-all-einsaetze.query';
// TODO (Epic 6): Migrate utilities to use Domain Aggregate instead of Prisma Entity
// biome-ignore lint/style/noRestrictedImports: Legacy dependency - EinsatzNameGenerator/CompletenessCalculator require Prisma types
import type { Einsatz as PrismaEinsatz } from '@prisma/client';

/**
 * Handler für GetAllEinsaetzeQuery.
 *
 * Orchestriert das Abrufen einer paginierten Einsatz-Liste mit optionalen
 * Filtern, Suche und Sortierung. Mappt Prisma Entities zu Response DTOs
 * mit computed fields (name, nameComponents, optional completeness).
 *
 * **Verhalten:**
 * - Ruft repository.findWithPagination() mit dynamischen WHERE-Conditions auf
 * - Unterstützt Status-Filter, Volltextsuche, Archiv-Filter
 * - Mappt Einsatz Entities zu EinsatzResponseDto
 * - Berechnet optional Vollständigkeits-Score (includeCompleteness=true)
 * - Leeres Array ist valides Resultat (keine Einsätze gefunden)
 * - Bei Repository-Fehler wird Result.fail() zurückgegeben
 *
 * **Filter-Logik:**
 * - includeArchived=false (default): Filtert ARCHIVIERT Status aus
 * - includeArchived=true + kein Status: Zeigt alle Status
 * - status gesetzt: Zeigt nur diesen Status (überschreibt includeArchived)
 * - search: Case-insensitive LIKE auf alarmstichwort und id
 *
 * **Pagination:**
 * - page und limit werden direkt ans Repository durchgereicht
 * - Default: page=1, limit=10 (siehe Query Defaults)
 * - totalPages wird aus total/limit berechnet
 *
 * **Migration zu IEinsatzRepository (Story 5-1):**
 * - Nutzt IEinsatzRepository.findAllPaginated() (Result Pattern)
 * - Entkoppelt von Legacy EinsatzRepository
 * - Interface-basiertes Design ermöglicht Testing mit Mock Repository
 *
 * **Query Pattern (CQRS Read Side):**
 * - Read-Only Operation (keine Aggregate-Änderung)
 * - Keine Events werden emittiert
 * - Direkter Repository-Zugriff (kein Command Bus)
 * - DTO-Transformation entkoppelt Domain von API
 *
 * @example
 * ```typescript
 * // Handler ausführen
 * const handler = new GetAllEinsaetzeQueryHandler(repository);
 * const query = new GetAllEinsaetzeQuery({
 *   status: 'IN_BEARBEITUNG',
 *   page: 1,
 *   limit: 20
 * });
 * const result = await handler.execute(query);
 *
 * if (result.isSuccess) {
 *   const paginatedData = result.value!;
 *   console.log(`${paginatedData.total} Einsätze gefunden`);
 *   console.log(`Seite ${paginatedData.page}/${Math.ceil(paginatedData.total / paginatedData.limit!)}`);
 *   paginatedData.items.forEach(dto => console.log(dto.name));
 * } else {
 *   console.error(result.error); // "Database connection failed"
 * }
 * ```
 */
@QueryHandler(GetAllEinsaetzeQuery)
@Injectable()
export class GetAllEinsaetzeQueryHandler implements IQueryHandler<GetAllEinsaetzeQuery, Result<PaginatedData<EinsatzResponseDto>>> {
  private readonly logger = new Logger(GetAllEinsaetzeQueryHandler.name);

  /**
   * Constructor mit Dependency Injection.
   *
   * MIGRATION (Story 5-1): Migriert von EinsatzRepository zu IEinsatzRepository Interface.
   * Nutzt @Inject Token für Interface-basierte Injection (Hexagonal Architecture).
   *
   * @param repository - IEinsatzRepository mit findAllPaginated() Support
   */
  constructor(
    @Inject('IEinsatzRepository')
    private readonly repository: IEinsatzRepository,
  ) {}

  /**
   * Führt die Query aus und gibt paginierte Einsätze als DTOs zurück.
   *
   * **Ablauf:**
   * 1. Query-Parameter extrahieren und Defaults setzen
   * 2. Prisma WHERE-Clause dynamisch bauen (Status, Search, Archive-Filter)
   * 3. Prisma OrderBy-Clause bauen
   * 4. Repository.findWithPagination() aufrufen
   * 5. Entities zu DTOs mappen (mit computed fields)
   * 6. Optional Completeness berechnen (wenn includeCompleteness=true)
   * 7. Result.ok(PaginatedData) zurückgeben
   *
   * **Fehlerbehandlung:**
   * - Repository-Fehler (DB Connection Failed) → Result.fail()
   * - Unerwartete Fehler (try-catch) → Result.fail()
   * - Leeres Array ist KEIN Fehler sondern valides Resultat
   *
   * @param query - GetAllEinsaetzeQuery mit optionalen Parametern
   * @returns Result<PaginatedData<EinsatzResponseDto>> - Success mit paginierten DTOs oder Failure
   */
  async execute(query: GetAllEinsaetzeQuery): Promise<Result<PaginatedData<EinsatzResponseDto>>> {
    try {
      // 1. Parameter extrahieren mit Defaults
      const { status, search, includeArchived = false, includeCompleteness = false, page = 1, limit = 10, orderBy = 'createdAt', orderDirection = 'desc' } = query.params;

      // 2. Repository Abfrage (paginiert) mit IEinsatzRepository.findAllPaginated()
      // Result Pattern: Repository gibt Result<T> zurück statt Exceptions zu werfen
      const repositoryResult = await this.repository.findAllPaginated(
        {
          status,
          includeArchived,
          searchTerm: search,
        },
        {
          page,
          limit,
        },
        {
          orderBy,
          orderDirection,
        },
      );

      // 3. Prüfe Repository Result auf Fehler
      if (repositoryResult.isFailure) {
        this.logger.error(`Repository error: ${repositoryResult.error}`);
        return Result.fail<PaginatedData<EinsatzResponseDto>>(repositoryResult.error ?? 'Failed to fetch einsaetze from repository');
      }

      // 4. Type Narrowing: value ist garantiert vorhanden wenn isFailure === false
      const paginatedData = repositoryResult.value;
      if (!paginatedData) {
        // Fallback: Leeres Result (sollte nicht passieren aber Type-Safe)
        return Result.ok<PaginatedData<EinsatzResponseDto>>({
          items: [],
          total: 0,
          page,
          limit,
        });
      }

      // 5. Domain Aggregates zu DTOs mappen (mit computed fields)
      // HINWEIS: toResponseDto() erwartet Prisma Entity, aber wir haben jetzt Domain Aggregate
      // Wir müssen eine Adapter-Funktion erstellen die Domain → DTO mappt
      const dtos = await Promise.all(paginatedData.items.map((aggregate) => this.aggregateToResponseDto(aggregate, includeCompleteness)));

      // 6. Logging für Monitoring
      this.logger.log(
        `Found ${paginatedData.total} Einsätze (showing ${dtos.length}) - Filters: status=${status}, search='${search}', includeArchived=${includeArchived}, page=${page}, limit=${limit}`,
      );

      // 7. Return Success mit PaginatedData
      return Result.ok<PaginatedData<EinsatzResponseDto>>({
        items: dtos,
        total: paginatedData.total,
        page,
        limit,
      });
    } catch (error) {
      // Structured Logging für Produktions-Debugging
      this.logger.error('Unexpected error fetching all einsaetze', error instanceof Error ? error.stack : String(error));
      const errorMessage = error instanceof Error ? error.message : 'Unexpected error while fetching all einsaetze';
      return Result.fail<PaginatedData<EinsatzResponseDto>>(errorMessage);
    }
  }

  /**
   * Konvertiert ein Domain Aggregate zu einem ResponseDTO mit computed fields.
   *
   * Diese Methode mappt das Domain Aggregate (DDD) zu einem API-Response DTO
   * und fügt computed fields hinzu die nicht im Aggregate gespeichert sind
   * (name, nameComponents, optional completeness).
   *
   * **MIGRATION (Story 5-1):**
   * - Alte Methode toResponseDto() arbeitete mit Prisma Entity
   * - Neue Methode aggregateToResponseDto() arbeitet mit Domain Aggregate
   * - Domain → DTO Mapping entkoppelt Infrastructure von Application Layer
   *
   * **Computed Fields:**
   * - name: Auto-generierter Einsatz-Name (z.B. "Brand 3 - 27.01.2025 14:30")
   * - nameComponents: Komponenten des Namens (alarmstichwort, datum, zeit)
   * - completeness: Optional - Vollständigkeits-Score und Missing Fields
   *
   * **Mapping Strategy:**
   * - Domain Aggregate Getters → DTO Properties
   * - Value Objects werden zu primitiven Typen serialisiert
   * - Computed Fields via EinsatzNameGenerator und EinsatzCompletenessCalculator
   *
   * **Warum private Method:**
   * - Encapsulation: DTO-Mapping Logik ist Handler-interner Concern
   * - Reusability: Kann von anderen Queries im selben Handler wiederverwendet werden
   * - Single Responsibility: Handler orchestriert, Mapper transformiert
   *
   * @param aggregate - Einsatz Domain Aggregate
   * @param includeCompleteness - Ob Vollständigkeits-Info berechnet werden soll
   * @returns Promise<EinsatzResponseDto> - Response DTO mit computed fields
   */
  private async aggregateToResponseDto(aggregate: import('@domain/aggregates/einsatz.aggregate').Einsatz, includeCompleteness = false): Promise<EinsatzResponseDto> {
    // Domain Aggregate → Prisma-kompatibles Objekt für Name Generator
    // HINWEIS: EinsatzNameGenerator erwartet Prisma Entity, aber wir haben Domain Aggregate
    // Wir erstellen ein kompatibles Objekt mit den benötigten Feldern
    const prismaCompatible = {
      id: aggregate.id.value,
      alarmstichwort: aggregate.alarmstichwort,
      createdAt: aggregate.createdAt,
      // Weitere Felder die der Generator benötigt können hier hinzugefügt werden
    };

    // Computed Field: Generierter Name
    const name = EinsatzNameGenerator.generate(prismaCompatible as PrismaEinsatz);
    const nameComponents = EinsatzNameGenerator.getNameComponents(prismaCompatible as PrismaEinsatz);

    // Domain Aggregate → Response DTO Mapping
    const response: EinsatzResponseDto = {
      id: aggregate.id.value,
      alarmstichwort: aggregate.alarmstichwort,
      einsatzort: aggregate.einsatzort?.toString() ?? null, // Address Value Object → String
      beschreibung: aggregate.bemerkung ?? null,
      alarmierungszeit: null, // TODO: Aggregate hat noch kein alarmierungszeit Feld
      einsatzleiter: null, // TODO: Aggregate hat noch kein einsatzleiter Feld
      status: aggregate.status.value as import('@prisma/client').EinsatzStatus, // EinsatzStatus Value Object → Enum
      metadata: null, // TODO: Aggregate hat noch kein metadata Feld
      createdAt: aggregate.createdAt,
      updatedAt: aggregate.updatedAt,
      createdBy: aggregate.createdBy.value,
      updatedBy: null, // TODO: Aggregate hat noch kein updatedBy Feld
      archivedAt: aggregate.archivedAt ?? null,
      archivedBy: null, // TODO: Aggregate hat noch kein archivedBy Feld
      name,
      nameComponents,
    };

    // Optional: Vollständigkeits-Berechnung (rechenintensiv)
    // HINWEIS: EinsatzCompletenessCalculator erwartet Prisma Entity
    // Wir müssen ein kompatibles Objekt erstellen
    if (includeCompleteness) {
      response.completeness = EinsatzCompletenessCalculator.calculate(prismaCompatible as PrismaEinsatz);
    }

    return response;
  }
}
