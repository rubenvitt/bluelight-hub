import type { IQueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import { Result } from '@domain/common/result';
import type { EinsatzDto } from '@application/einsatz/dto/einsatz.dto';
import { EinsatzQueryMapper } from '@application/einsatz/mappers/einsatz-query.mapper';
import type { GetEinsatzByNummerQuery } from './get-einsatz-by-nummer.query';

/**
 * Handler für GetEinsatzByNummerQuery.
 *
 * Orchestriert das Laden eines Einsatzes by Einsatznummer über das Repository
 * und konvertiert das Domain-Aggregate zu einem DTO für die API-Response.
 *
 * **CQRS Query-Side Pattern:**
 * - Read-Only: Ändert niemals Domain State
 * - Result<T>: Kein Exception-Throwing für vorhersagbare Fehler
 * - Null ist valide: Einsatz existiert möglicherweise nicht
 * - Mapper: Domain → DTO Transformation
 *
 * **Unterschied zu Command Handlers:**
 * - Commands: Validierung + Business Logic + State Mutation
 * - Queries: Nur Orchestration + Mapping (NO Business Logic)
 *
 * **Fehlerbehandlung:**
 * - null = Einsatz nicht gefunden (NICHT Error, valide Response!)
 * - Repository Error → Result.fail('Failed to load Einsatz by nummer')
 *
 * @example
 * ```typescript
 * const query = new GetEinsatzByNummerQuery('E2024-abc123xy');
 * const result = await handler.execute(query);
 *
 * if (result.isSuccess && result.value) {
 *   console.log('Einsatz:', result.value);
 * } else if (result.isSuccess && result.value === null) {
 *   console.log('Einsatz not found (404)');
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
@Injectable()
export class GetEinsatzByNummerQueryHandler implements IQueryHandler<GetEinsatzByNummerQuery, Result<EinsatzDto | null>> {
  constructor(
    @Inject('IEinsatzRepository')
    private readonly einsatzRepository: IEinsatzRepository,
  ) {}

  /**
   * Führt die Query aus und lädt einen Einsatz by Einsatznummer.
   *
   * Diese Methode gibt `null` zurück, wenn kein Einsatz mit der gegebenen
   * Nummer existiert, anstatt einen Fehler zu werfen. Das ermöglicht dem
   * Controller, zwischen "Resource not found" (404) und "Request failed" (500)
   * zu unterscheiden.
   *
   * **Orchestration Flow:**
   * 1. Lade Aggregate via Repository (findByNummer)
   * 2. Wenn Result.fail → return Result.fail() (Repository Error)
   * 3. Wenn null → return Result.ok(null) (NICHT Fehler!)
   * 4. Wenn Aggregate → Map zu DTO → return Result.ok(dto)
   *
   * **Null Handling:**
   * `null` ist eine valide Response, wenn kein Einsatz mit der Nummer existiert.
   * Das Controller kann dann 404 NOT FOUND zurückgeben.
   *
   * **DTO Mapping:**
   * EinsatzQueryMapper.toEinsatzDto() konvertiert Value Objects (id, status, createdBy)
   * auf primitive Typen für API-Response.
   *
   * @param query - Die Query mit der Einsatznummer
   * @returns EinsatzDto oder null (wenn nicht gefunden), oder Fehler
   */
  async execute(query: GetEinsatzByNummerQuery): Promise<Result<EinsatzDto | null>> {
    try {
      // Step 1: Load Aggregate from Repository
      const aggregateResult = await this.einsatzRepository.findByNummer(query.nummer);

      // Step 2: Handle Repository Error
      if (aggregateResult.isFailure) {
        const errorMessage = aggregateResult.error && aggregateResult.error.trim() ? aggregateResult.error : 'Failed to load Einsatz by nummer';
        return Result.fail(errorMessage);
      }

      const aggregate = aggregateResult.value;

      // Step 3: Handle null case (Einsatz not found - NOT an error!)
      if (!aggregate) {
        return Result.ok(null);
      }

      // Step 4: Map Aggregate to DTO
      const dto = EinsatzQueryMapper.toEinsatzDto(aggregate);

      return Result.ok(dto);
    } catch (_error) {
      // Step 5: Catch unexpected errors (e.g., database connection failure)
      return Result.fail('Failed to load Einsatz by nummer');
    }
  }
}
