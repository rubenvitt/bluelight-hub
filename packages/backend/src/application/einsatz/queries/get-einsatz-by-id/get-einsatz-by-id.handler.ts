import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import type { EinsatzDto } from '@application/einsatz/dto/einsatz.dto';
import { EinsatzQueryMapper } from '@application/einsatz/mappers/einsatz-query.mapper';
import { Result } from '@domain/common/result';
import type { IEinsatzRepository } from '@domain/repositories';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { GetEinsatzByIdQuery } from './get-einsatz-by-id.query';
import { EINSATZ_REPOSITORY } from '@infrastructure/di-tokens';

/**
 * Query Handler fuer GetEinsatzByIdQuery.
 *
 * Laedt einen einzelnen Einsatz aus dem Repository und mappt
 * ihn zu einem DTO fuer API-Responses.
 *
 * **Business Rules:**
 * - Validiert einsatzId via EinsatzId.create() Value Object
 * - Return Result.ok(null) wenn Einsatz nicht gefunden (kein Error!)
 * - Mappt Aggregate zu DTO wenn gefunden
 * - Behandelt Repository Errors via Result.fail()
 *
 * **Warum null statt Error bei "not found":**
 * - "Not found" ist kein technischer Fehler, sondern valides Business-Resultat
 * - Controller kann explizit pruefen: if (result.value === null) → return 404
 * - Echte Errors (z.B. DB Connection Failed) werden via Result.fail() zurueckgegeben
 *
 * **CQRS Read Side:**
 * - Query Handler aendert KEINEN State (Read-Only)
 * - Keine Events werden publiziert
 * - Reine Projektion: Domain Aggregate → DTO
 *
 * @example
 * ```typescript
 * // Usage in Controller
 * const query = new GetEinsatzByIdQuery(id);
 * const result = await handler.execute(query);
 *
 * if (result.isFailure) {
 *   throw new InternalServerErrorException(result.error);
 * }
 *
 * if (result.value === null) {
 *   throw new NotFoundException('Einsatz not found');
 * }
 *
 * return result.value; // EinsatzDto
 * ```
 */
@QueryHandler(GetEinsatzByIdQuery)
export class GetEinsatzByIdQueryHandler implements IQueryHandler<GetEinsatzByIdQuery, Result<EinsatzDto | null>> {
  private readonly logger = new Logger(GetEinsatzByIdQueryHandler.name);

  constructor(
    @Inject(EINSATZ_REPOSITORY)
    private readonly repository: IEinsatzRepository,
  ) {}

  /**
   * Fuehrt die Query aus und gibt DTO oder null zurueck.
   *
   * **Flow:**
   * 1. Validiere einsatzId via EinsatzId.create() Value Object
   * 2. Rufe repository.findById(einsatzId) auf
   * 3. Return Result.ok(null) wenn nicht gefunden
   * 4. Mappe Aggregate zu DTO wenn gefunden
   * 5. Behandle unerwartete Fehler via try-catch → Result.fail()
   *
   * @param query - GetEinsatzByIdQuery mit validierter einsatzId
   * @returns Result<EinsatzDto | null> - Success mit DTO oder null, Failure bei technischem Fehler
   */
  async execute(query: GetEinsatzByIdQuery): Promise<Result<EinsatzDto | null>> {
    try {
      // Validiere einsatzId via Value Object
      const einsatzIdResult = EinsatzId.create(query.einsatzId);
      if (einsatzIdResult.isFailure) {
        return Result.fail(einsatzIdResult.error ?? 'Ungueltige einsatzId');
      }
      // Type Narrowing: value ist garantiert vorhanden nach isFailure Check
      const einsatzId = einsatzIdResult.value;
      if (!einsatzId) {
        return Result.fail('Ungueltige einsatzId');
      }

      // Repository Call
      const repoResult = await this.repository.findById(einsatzId);
      if (repoResult.isFailure) {
        return Result.fail(repoResult.error ?? 'Repository-Fehler');
      }

      // Not found → Return null (kein Error!)
      if (repoResult.value === null || repoResult.value === undefined) {
        return Result.ok<EinsatzDto | null>(null);
      }

      // Map Aggregate to DTO
      const aggregate = repoResult.value;
      const dto = EinsatzQueryMapper.toEinsatzDto(aggregate);

      return Result.ok<EinsatzDto | null>(dto);
    } catch (error) {
      // Structured Logging fuer Produktions-Debugging
      this.logger.error(`Unexpected error loading einsatz ${query.einsatzId}`, error instanceof Error ? error.stack : String(error));
      return Result.fail(`Unerwarteter Fehler beim Laden des Einsatzes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
