import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Result } from '@domain/common/result';
import type { IUserRepository } from '@domain/repositories/i-user.repository';
import { UserId } from '@domain/value-objects/user-id';
import { USER_REPOSITORY } from '@infrastructure/di-tokens';
import type { UserDto } from '@application/user-management/dto/user.dto';
import { UserQueryMapper } from '@application/user-management/mappers/user-query.mapper';
import { GetUserByIdQuery } from './get-user-by-id.query';

/**
 * Query Handler fuer GetUserByIdQuery.
 *
 * Laedt einen einzelnen User aus dem Repository und mappt
 * ihn zu einem DTO fuer API-Responses.
 *
 * **Business Rules:**
 * - Validiert userId via UserId.create() Value Object
 * - Return Result.ok(null) wenn User nicht gefunden (kein Error!)
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
 * const query = new GetUserByIdQuery(id);
 * const result = await handler.execute(query);
 *
 * if (result.isFailure) {
 *   throw new InternalServerErrorException(result.error);
 * }
 *
 * if (result.value === null) {
 *   throw new NotFoundException('User not found');
 * }
 *
 * return result.value; // UserDto
 * ```
 */
@QueryHandler(GetUserByIdQuery)
export class GetUserByIdQueryHandler implements IQueryHandler<GetUserByIdQuery, Result<UserDto | null>> {
  private readonly logger = new Logger(GetUserByIdQueryHandler.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repository: IUserRepository,
  ) {}

  /**
   * Fuehrt die Query aus und gibt DTO oder null zurueck.
   *
   * **Flow:**
   * 1. Validiere userId via UserId.create() Value Object
   * 2. Rufe repository.findById(userId) auf
   * 3. Return Result.ok(null) wenn nicht gefunden
   * 4. Mappe Aggregate zu DTO wenn gefunden
   * 5. Behandle unerwartete Fehler via try-catch → Result.fail()
   *
   * @param query - GetUserByIdQuery mit validierter userId
   * @returns Result<UserDto | null> - Success mit DTO oder null, Failure bei technischem Fehler
   */
  async execute(query: GetUserByIdQuery): Promise<Result<UserDto | null>> {
    try {
      // Validiere userId via Value Object
      const userIdResult = UserId.create(query.userId);
      if (userIdResult.isFailure) {
        return Result.fail(userIdResult.error ?? 'Ungueltige userId');
      }
      // Type Narrowing: value ist garantiert vorhanden nach isFailure Check
      const userId = userIdResult.value;
      if (!userId) {
        return Result.fail('Ungueltige userId');
      }

      // Repository Call
      const repoResult = await this.repository.findById(userId);
      if (repoResult.isFailure) {
        return Result.fail(repoResult.error ?? 'Repository-Fehler');
      }

      // Not found → Return null (kein Error!)
      if (repoResult.value === null || repoResult.value === undefined) {
        return Result.ok<UserDto | null>(null);
      }

      // Map Aggregate to DTO
      const aggregate = repoResult.value;
      const dto = UserQueryMapper.toUserDto(aggregate);

      return Result.ok<UserDto | null>(dto);
    } catch (error) {
      // Structured Logging fuer Produktions-Debugging
      this.logger.error(`Unexpected error loading user ${query.userId}`, error instanceof Error ? error.stack : String(error));
      return Result.fail(`Unerwarteter Fehler beim Laden des Users: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
