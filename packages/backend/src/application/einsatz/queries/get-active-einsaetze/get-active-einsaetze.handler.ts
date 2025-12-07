import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import type { IEinsatzRepository } from '@domain/repositories';
import { Result } from '@domain/common/result';
import type { EinsatzDto } from '@application/einsatz/dto/einsatz.dto';
import { EinsatzQueryMapper } from '@application/einsatz/mappers/einsatz-query.mapper';
import { GetActiveEinsaetzeQuery } from './get-active-einsaetze.query';
import { EINSATZ_REPOSITORY } from '@infrastructure/di-tokens';

/**
 * Handler fuer GetActiveEinsaetzeQuery.
 *
 * Orchestriert das Abrufen aller aktiven Einsaetze aus dem Repository
 * und mappt die Aggregates zu DTOs fuer die API-Response.
 *
 * **Verhalten:**
 * - Ruft repository.findActive() auf (filtert ARCHIVIERT Status)
 * - Sortiert Einsaetze nach createdAt DESC (newest first)
 * - Mappt Aggregates zu EinsatzDto via EinsatzQueryMapper
 * - Leeres Array ist valides Resultat (keine aktiven Einsaetze)
 * - Bei Repository-Fehler wird Result.fail() zurueckgegeben
 *
 * **Warum createdAt DESC Sortierung:**
 * - UI zeigt neueste Einsaetze zuerst (aktuellste Info)
 * - UX: User interessiert sich fuer juengste Ereignisse
 * - Performance: Frontend kann direkt rendern ohne Re-Sort
 *
 * **Query Pattern (CQRS Read Side):**
 * - Read-Only Operation (keine Aggregate-Aenderung)
 * - Keine Events werden emittiert
 * - Direkter Repository-Zugriff (kein Command Bus)
 * - DTO-Transformation entkoppelt Domain von API
 *
 * @example
 * ```typescript
 * // Handler ausfuehren
 * const handler = new GetActiveEinsaetzeQueryHandler(repository);
 * const query = new GetActiveEinsaetzeQuery();
 * const result = await handler.execute(query);
 *
 * if (result.isSuccess) {
 *   const dtos = result.value!;
 *   dtos.forEach(dto => console.log(dto.nummer, dto.alarmstichwort));
 * } else {
 *   console.error(result.error); // "Database connection failed"
 * }
 * ```
 */
@QueryHandler(GetActiveEinsaetzeQuery)
export class GetActiveEinsaetzeQueryHandler implements IQueryHandler<GetActiveEinsaetzeQuery, Result<EinsatzDto[]>> {
  private readonly logger = new Logger(GetActiveEinsaetzeQueryHandler.name);

  constructor(
    @Inject(EINSATZ_REPOSITORY)
    private readonly repository: IEinsatzRepository,
  ) {}

  /**
   * Fuehrt die Query aus und gibt alle aktiven Einsaetze als DTOs zurueck.
   *
   * **Ablauf:**
   * 1. Repository.findActive() aufrufen (filtert ARCHIVIERT)
   * 2. Result pruefen (bei Fehler sofort Result.fail() returnen)
   * 3. Aggregates nach createdAt DESC sortieren
   * 4. Jedes Aggregate zu DTO mappen via EinsatzQueryMapper
   * 5. Result.ok(dtos) zurueckgeben
   *
   * **Fehlerbehandlung:**
   * - Repository-Fehler (DB Connection Failed) → Result.fail()
   * - Unerwartete Fehler (try-catch) → Result.fail()
   * - Leeres Array ist KEIN Fehler sondern valides Resultat
   *
   * @param _query - GetActiveEinsaetzeQuery (parameterlos, Underscore weil unused)
   * @returns Result<EinsatzDto[]> - Success mit DTOs oder Failure mit Error Message
   */
  async execute(_query: GetActiveEinsaetzeQuery): Promise<Result<EinsatzDto[]>> {
    try {
      // 1. Hole alle aktiven Einsaetze vom Repository
      const aggregatesResult = await this.repository.findActive();

      // 2. Pruefe Repository Result
      if (aggregatesResult.isFailure) {
        return Result.fail<EinsatzDto[]>(aggregatesResult.error ?? 'Failed to fetch active einsaetze from repository');
      }

      // Type Narrowing: value ist garantiert vorhanden wenn isFailure === false
      const aggregates = aggregatesResult.value;
      if (!aggregates) {
        return Result.ok<EinsatzDto[]>([]);
      }

      // 3. Sortiere nach createdAt DESC (newest first)
      // WICHTIG: sort() mutiert Array, daher spreaden wir fuer Immutability
      const sortedAggregates = [...aggregates].sort((a, b) => {
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      // 4. Mappe Aggregates zu DTOs
      const dtos = sortedAggregates.map((aggregate) => EinsatzQueryMapper.toEinsatzDto(aggregate));

      // 5. Return Success mit DTOs (leeres Array ist valide)
      return Result.ok<EinsatzDto[]>(dtos);
    } catch (error) {
      // Structured Logging fuer Produktions-Debugging
      this.logger.error('Unexpected error fetching active einsaetze', error instanceof Error ? error.stack : String(error));
      const errorMessage = error instanceof Error ? error.message : 'Unexpected error while fetching active einsaetze';
      return Result.fail<EinsatzDto[]>(errorMessage);
    }
  }
}
