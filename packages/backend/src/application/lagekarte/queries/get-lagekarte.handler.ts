import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { Result } from '@domain/common/result';
import type { LagekarteDto } from '@application/lagekarte/dtos/lagekarte.dto';
import { LagekarteMapper } from '@application/lagekarte/mappers/lagekarte.mapper';
import { GetLagekarteQuery } from './get-lagekarte.query';

/**
 * Handler für GetLagekarteQuery.
 *
 * Orchestriert das Laden einer Lagekarte über das Repository und
 * konvertiert das Domain-Aggregate zu einem DTO für die API-Response.
 *
 * **CQRS Query-Side Pattern:**
 * - Read-Only: Ändert niemals Domain State
 * - Result<T>: Kein Exception-Throwing für vorhersagbare Fehler
 * - Null ist valide: Lagekarte existiert möglicherweise nicht
 * - Mapper: Domain → DTO Transformation
 *
 * **Unterschied zu Command Handlers:**
 * - Commands: Validierung + Business Logic + State Mutation
 * - Queries: Nur Orchestration + Mapping (NO Business Logic)
 *
 * **Fehlerbehandlung:**
 * - null = Lagekarte nicht gefunden (NICHT Error, valide Response!)
 * - Repository Error → Result.fail('Failed to load Lagekarte')
 * - Invalid EinsatzId → Result.fail('Invalid Einsatz ID')
 *
 * @example
 * ```typescript
 * const query = new GetLagekarteQuery('einsatz-123');
 * const result = await handler.execute(query);
 *
 * if (result.isSuccess && result.value) {
 *   console.log('Lagekarte:', result.value);
 * } else if (result.isSuccess && result.value === null) {
 *   console.log('Lagekarte not found (404)');
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
@Injectable()
@QueryHandler(GetLagekarteQuery)
export class GetLagekarteQueryHandler implements IQueryHandler<GetLagekarteQuery, Result<LagekarteDto | null>> {
  constructor(
    @Inject('ILagekarteRepository')
    private readonly lagekarteRepository: ILagekarteRepository,
  ) {}

  /**
   * Führt die Query aus und lädt die Lagekarte für einen Einsatz.
   *
   * Diese Methode gibt `null` zurück, wenn keine Lagekarte existiert,
   * anstatt einen Fehler zu werfen. Das ermöglicht dem Controller,
   * zwischen "Resource not found" (404) und "Request failed" (500) zu
   * unterscheiden.
   *
   * **Orchestration Flow:**
   * 1. Validiere EinsatzId via Value Object
   * 2. Lade Aggregate via Repository
   * 3. Wenn null → return Result.ok(null) (NICHT Fehler!)
   * 4. Wenn Aggregate → Map zu DTO → return Result.ok(dto)
   * 5. Bei Repository-Error → return Result.fail()
   *
   * **Null Handling:**
   * `null` ist eine valide Response, wenn die Lagekarte noch nicht
   * erstellt wurde. Das Controller kann dann 404 NOT FOUND zurückgeben.
   *
   * **DTO Mapping:**
   * LagekarteMapper.toDto() konvertiert MGRS-Koordinaten zusätzlich
   * zu Lat/Lng, damit das Frontend beide Formate nutzen kann.
   *
   * @param query - Die Query mit der EinsatzId
   * @returns LagekarteDto oder null (wenn nicht gefunden), oder Fehler
   */
  async execute(query: GetLagekarteQuery): Promise<Result<LagekarteDto | null>> {
    try {
      // Step 1: Validate EinsatzId via Value Object
      const einsatzIdResult = EinsatzId.create(query.einsatzId);
      if (einsatzIdResult.isFailure) {
        return Result.fail(einsatzIdResult.error ?? 'Invalid Einsatz ID');
      }

      const einsatzId = einsatzIdResult.value;
      if (!einsatzId) {
        return Result.fail('Invalid Einsatz ID result');
      }

      // Step 2: Load Aggregate from Repository
      const aggregate = await this.lagekarteRepository.findByEinsatzId(einsatzId);

      // Step 3: Handle null case (Lagekarte not found - NOT an error!)
      if (!aggregate) {
        return Result.ok(null);
      }

      // Step 4: Map Aggregate to DTO
      const dto = LagekarteMapper.toDto(aggregate);

      return Result.ok(dto);
    } catch (_error) {
      // Step 5: Catch unexpected errors (e.g., database connection failure)
      return Result.fail('Failed to load Lagekarte');
    }
  }
}
