import { Injectable, Inject } from '@nestjs/common';
import type { IEtbRepository } from '@domain/repositories/i-etb.repository';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { Result } from '@domain/common/result';
import type { EtbDto } from '@application/etb/dto';
import { EtbQueryMapper } from '@application/etb/mappers';
import type { GetEtbQuery } from './get-etb.query';

/**
 * Handler fuer GetEtbQuery.
 *
 * Orchestriert das Laden eines ETB ueber das Repository und
 * konvertiert das Domain-Aggregate zu einem DTO fuer die API-Response.
 *
 * **CQRS Query-Side Pattern:**
 * - Read-Only: Aendert niemals Domain State
 * - Result<T>: Kein Exception-Throwing fuer vorhersagbare Fehler
 * - Null ist valide: ETB existiert moeglicherweise nicht
 * - Mapper: Domain -> DTO Transformation
 *
 * **Unterschied zu Command Handlers:**
 * - Commands: Validierung + Business Logic + State Mutation
 * - Queries: Nur Orchestration + Mapping (NO Business Logic)
 *
 * **Fehlerbehandlung:**
 * - null = ETB nicht gefunden (NICHT Error, valide Response!)
 * - Repository Error -> Result.fail('Fehler beim Laden des ETB')
 * - Invalid EinsatzId -> Result.fail('Ungueltige Einsatz-ID')
 *
 * @example
 * ```typescript
 * const query = new GetEtbQuery('clw3h8x9y0000qwertyuiopas');
 * const result = await handler.execute(query);
 *
 * if (result.isSuccess && result.value) {
 *   console.log('ETB:', result.value);
 * } else if (result.isSuccess && result.value === null) {
 *   console.log('ETB not found (404)');
 * } else {
 *   console.error('Error:', result.error);
 * }
 *
 * // Mit soft-deleted Eintraegen
 * const queryWithDeleted = new GetEtbQuery('clw3h8x9y0000qwertyuiopas', true);
 * ```
 */
@Injectable()
export class GetEtbQueryHandler {
  constructor(
    @Inject('IEtbRepository')
    private readonly etbRepository: IEtbRepository,
  ) {}

  /**
   * Fuehrt die Query aus und laedt das ETB fuer einen Einsatz.
   *
   * Diese Methode gibt `null` zurueck, wenn kein ETB existiert,
   * anstatt einen Fehler zu werfen. Das ermoeglicht dem Controller,
   * zwischen "Resource not found" (404) und "Request failed" (500) zu
   * unterscheiden.
   *
   * **Orchestration Flow:**
   * 1. Validiere EinsatzId via Value Object
   * 2. Lade Aggregate via Repository
   * 3. Wenn null -> return Result.ok(null) (NICHT Fehler!)
   * 4. Wenn Aggregate -> Map zu DTO (mit includeDeleted Filter) -> return Result.ok(dto)
   * 5. Bei Repository-Error -> return Result.fail()
   *
   * **Null Handling:**
   * `null` ist eine valide Response, wenn das ETB noch nicht
   * erstellt wurde. Der Controller kann dann 404 NOT FOUND zurueckgeben.
   *
   * **DTO Mapping:**
   * EtbQueryMapper.toEtbDto() filtert soft-deleted Eintraege
   * basierend auf dem `includeDeleted` Parameter.
   *
   * @param query - Die Query mit der EinsatzId und includeDeleted Flag
   * @returns EtbDto oder null (wenn nicht gefunden), oder Fehler
   */
  async execute(query: GetEtbQuery): Promise<Result<EtbDto | null>> {
    try {
      // Step 1: Validate EinsatzId via Value Object
      const einsatzIdResult = EinsatzId.create(query.einsatzId);
      if (einsatzIdResult.isFailure) {
        return Result.fail(einsatzIdResult.error ?? 'Ungueltige Einsatz-ID');
      }

      const einsatzId = einsatzIdResult.value;
      if (!einsatzId) {
        return Result.fail('Ungueltige Einsatz-ID Ergebnis');
      }

      // Step 2: Load Aggregate from Repository
      const aggregate = await this.etbRepository.findByEinsatzId(einsatzId);

      // Step 3: Handle null case (ETB not found - NOT an error!)
      if (!aggregate) {
        return Result.ok(null);
      }

      // Step 4: Map Aggregate to DTO (with includeDeleted filtering)
      const dto = EtbQueryMapper.toEtbDto(aggregate, query.includeDeleted);

      return Result.ok(dto);
    } catch (_error) {
      // Step 5: Catch unexpected errors (e.g., database connection failure)
      return Result.fail('Fehler beim Laden des ETB');
    }
  }
}
