import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { Injectable, Logger } from '@nestjs/common';
import { Result } from '@domain/common/result';
import type { PaginatedData } from '@/common/interceptors/transform.interceptor';
import type { EinsatzResponseDto } from '@/einsatz/dto/einsatz-response.dto';
// biome-ignore lint/correctness/noUnusedImports: Required for NestJS DI - must be value import, not type import
import type { EinsatzRepository } from '@/einsatz/einsatz.repository';
import { EinsatzNameGenerator } from '@/einsatz/utils/name-generator.util';
import { EinsatzCompletenessCalculator } from '@/einsatz/utils/completeness.util';
import { GetAllEinsaetzeQuery } from './get-all-einsaetze.query';
import type { Einsatz } from '@prisma/client';
import { EinsatzStatus, type Prisma } from '@prisma/client';

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
 * **Warum EinsatzRepository statt IEinsatzRepository:**
 * - IEinsatzRepository hat KEINE paginierte Methode (nur findActive())
 * - Pragmatischer Ansatz: Nutze bestehende findWithPagination() aus EinsatzRepository
 * - TODO Epic 4: IEinsatzRepository um findAllPaginated() erweitern und migrieren
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
   * HINWEIS: Nutzt EinsatzRepository (nicht IEinsatzRepository Interface)
   * weil das Domain Interface keine paginierte Methode hat.
   *
   * @param repository - EinsatzRepository mit findWithPagination() Support
   */
  constructor(private readonly repository: EinsatzRepository) {}

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

      // 2. Prisma WHERE-Clause dynamisch bauen
      const where: Prisma.EinsatzWhereInput = {};

      // No-Delete Policy: Filter archivierte Einsätze standardmäßig aus
      if (!includeArchived && !status) {
        // Wenn kein spezifischer Status angefragt wurde UND archivierte nicht eingeschlossen werden sollen
        where.status = { not: EinsatzStatus.ARCHIVIERT };
      } else if (status) {
        // Wenn spezifischer Status gesetzt: Überschreibt includeArchived
        where.status = status;
      }
      // Wenn includeArchived=true und kein spezifischer Status: Zeige alle (kein Filter)

      // Volltextsuche: alarmstichwort, id (case-insensitive)
      if (search) {
        const searchTerm = search.trim();
        if (searchTerm) {
          where.OR = [{ alarmstichwort: { contains: searchTerm, mode: 'insensitive' } }, { id: { contains: searchTerm, mode: 'insensitive' } }];
        }
      }

      // 3. Prisma OrderBy-Clause
      const orderByClause: Prisma.EinsatzOrderByWithRelationInput = {
        [orderBy]: orderDirection,
      };

      // 4. Repository Abfrage (paginiert)
      const result = await this.repository.findWithPagination(page, limit, where, orderByClause);

      // 5. Entities zu DTOs mappen
      const dtos = await Promise.all(result.items.map((einsatz: Einsatz) => this.toResponseDto(einsatz, includeCompleteness)));

      // 6. Logging für Monitoring
      this.logger.log(`Found ${result.total} Einsätze (showing ${dtos.length}) - Filters: status=${status}, search='${search}', includeArchived=${includeArchived}, page=${page}, limit=${limit}`);

      // 7. Return Success mit PaginatedData
      return Result.ok<PaginatedData<EinsatzResponseDto>>({
        items: dtos,
        total: result.total,
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
   * Konvertiert ein Einsatz-Entity zu einem ResponseDTO mit computed fields.
   *
   * Diese Methode mappt die persistierte Entity (Prisma Model) zu einem
   * API-Response DTO und fügt computed fields hinzu die nicht in der DB
   * gespeichert sind (name, nameComponents, optional completeness).
   *
   * **Computed Fields:**
   * - name: Auto-generierter Einsatz-Name (z.B. "Brand 3 - 27.01.2025 14:30")
   * - nameComponents: Komponenten des Namens (alarmstichwort, datum, zeit)
   * - completeness: Optional - Vollständigkeits-Score und Missing Fields
   *
   * **Warum private Method:**
   * - Encapsulation: DTO-Mapping Logik ist Handler-interner Concern
   * - Reusability: Kann von anderen Queries im selben Handler wiederverwendet werden
   * - Single Responsibility: Handler orchestriert, Mapper transformiert
   *
   * @param einsatz - Prisma Einsatz Entity
   * @param includeCompleteness - Ob Vollständigkeits-Info berechnet werden soll
   * @returns Promise<EinsatzResponseDto> - Response DTO mit computed fields
   */
  private async toResponseDto(einsatz: Einsatz, includeCompleteness = false): Promise<EinsatzResponseDto> {
    // Computed Field: Generierter Name
    const name = EinsatzNameGenerator.generate(einsatz);
    const nameComponents = EinsatzNameGenerator.getNameComponents(einsatz);

    // Basis DTO mit Entity Fields + Computed Name
    const response: EinsatzResponseDto = {
      ...einsatz,
      name,
      nameComponents,
    };

    // Optional: Vollständigkeits-Berechnung (rechenintensiv)
    if (includeCompleteness) {
      response.completeness = EinsatzCompletenessCalculator.calculate(einsatz);
    }

    return response;
  }
}
