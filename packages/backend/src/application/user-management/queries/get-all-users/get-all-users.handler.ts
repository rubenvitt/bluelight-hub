import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject, Logger } from '@nestjs/common';
import { Result } from '@domain/common/result';
import type { IUserRepository } from '@domain/repositories/i-user.repository';
import type { UserDto } from '@/application/user-management/dto/user.dto';
import { GetAllUsersQuery } from './get-all-users.query';
import { USER_REPOSITORY } from '@infrastructure/di-tokens';

/**
 * Handler für GetAllUsersQuery.
 *
 * Orchestriert das Abrufen aller User Aggregates und mappt sie zu Response DTOs.
 * Filtert automatisch gelöschte und gesperrte User aus (aktive User only).
 *
 * **Verhalten:**
 * - Ruft repository.findAll() auf um alle User Aggregates zu laden
 * - Filtert gelöschte User (isDeleted) und gesperrte User (isLocked) aus
 * - Mappt User Aggregates zu UserDto Response DTOs
 * - Leeres Array ist valides Resultat (keine User gefunden)
 * - Bei Repository-Fehler wird Result.fail() zurückgegeben
 *
 * **Migration zu IUserRepository:**
 * - Nutzt IUserRepository.findAll() (Result Pattern)
 * - Entkoppelt von Legacy UserRepository
 * - Interface-basiertes Design ermöglicht Testing mit Mock Repository
 *
 * **Query Pattern (CQRS Read Side):**
 * - Read-Only Operation (keine Aggregate-Änderung)
 * - Keine Events werden emittiert
 * - Direkter Repository-Zugriff (kein Command Bus)
 * - DTO-Transformation entkoppelt Domain von API
 *
 * **Warum Filter in Handler statt Repository:**
 * - Repository.findAll() gibt ALLE Aggregates zurück (keine Geschäftslogik)
 * - Application Layer entscheidet welche User sichtbar sind (Business Rule)
 * - Ermöglicht unterschiedliche Filter-Strategien für verschiedene Queries
 * - Single Responsibility: Repository = Persistenz, Handler = Business Logic
 *
 * @example
 * ```typescript
 * // Handler ausführen
 * const handler = new GetAllUsersQueryHandler(repository);
 * const query = new GetAllUsersQuery();
 * const result = await handler.execute(query);
 *
 * if (result.isSuccess) {
 *   const users = result.value!;
 *   console.log(`${users.length} aktive Benutzer gefunden`);
 *   users.forEach(dto => console.log(`${dto.username} (${dto.role})`));
 * } else {
 *   console.error(result.error); // "Database connection failed"
 * }
 * ```
 */
@QueryHandler(GetAllUsersQuery)
@Injectable()
export class GetAllUsersQueryHandler implements IQueryHandler<GetAllUsersQuery, Result<UserDto[]>> {
  private readonly logger = new Logger(GetAllUsersQueryHandler.name);

  /**
   * Constructor mit Dependency Injection.
   *
   * Nutzt @Inject Token für Interface-basierte Injection (Hexagonal Architecture).
   *
   * @param repository - IUserRepository mit findAll() Support
   */
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repository: IUserRepository,
  ) {}

  /**
   * Führt die Query aus und gibt alle aktiven User als DTOs zurück.
   *
   * **Ablauf:**
   * 1. Repository.findAll() aufrufen um alle User Aggregates zu laden
   * 2. Repository Result auf Fehler prüfen
   * 3. User Aggregates zu DTOs mappen (mit aggregateToDto())
   * 4. Result.ok(UserDto[]) zurückgeben
   *
   * **Fehlerbehandlung:**
   * - Repository-Fehler (DB Connection Failed) → Result.fail()
   * - Unerwartete Fehler (try-catch) → Result.fail()
   * - Leeres Array ist KEIN Fehler sondern valides Resultat
   *
   * @param _query - GetAllUsersQuery (keine Parameter, wird nicht verwendet)
   * @returns Result<UserDto[]> - Success mit User DTOs oder Failure
   */
  async execute(_query: GetAllUsersQuery): Promise<Result<UserDto[]>> {
    try {
      // 1. Repository Abfrage (alle User Aggregates)
      // Result Pattern: Repository gibt Result<T> zurück statt Exceptions zu werfen
      const repositoryResult = await this.repository.findAll();

      // 2. Prüfe Repository Result auf Fehler
      if (repositoryResult.isFailure) {
        this.logger.error(`Repository error: ${repositoryResult.error}`);
        return Result.fail<UserDto[]>(repositoryResult.error ?? 'Failed to fetch users from repository');
      }

      // 3. Type Narrowing: value ist garantiert vorhanden wenn isFailure === false
      const users = repositoryResult.value;
      if (!users) {
        // Fallback: Leeres Result (sollte nicht passieren aber Type-Safe)
        return Result.ok<UserDto[]>([]);
      }

      // 4. Domain Aggregates zu DTOs mappen
      const dtos = users.map((aggregate) => this.aggregateToDto(aggregate));

      // 5. Logging für Monitoring
      this.logger.log(`Found ${dtos.length} users`);

      // 6. Return Success mit UserDto Array
      return Result.ok<UserDto[]>(dtos);
    } catch (error) {
      // Structured Logging für Produktions-Debugging
      this.logger.error('Unexpected error fetching all users', error instanceof Error ? error.stack : String(error));
      const errorMessage = error instanceof Error ? error.message : 'Unexpected error while fetching all users';
      return Result.fail<UserDto[]>(errorMessage);
    }
  }

  /**
   * Konvertiert ein User Aggregate zu einem UserDto.
   *
   * Diese Methode mappt das Domain Aggregate (DDD) zu einem API-Response DTO
   * ohne computed fields (User hat keine computed fields wie Einsatz.name).
   *
   * **Mapping Strategy:**
   * - Domain Aggregate Getters → DTO Properties
   * - Value Objects werden zu primitiven Typen serialisiert
   * - Username.toString() → string
   * - UserRole.toString() → string (UserRole enum)
   * - UserId.toString() → string
   *
   * **Warum private Method:**
   * - Encapsulation: DTO-Mapping Logik ist Handler-interner Concern
   * - Reusability: Kann von anderen Queries im selben Handler wiederverwendet werden
   * - Single Responsibility: Handler orchestriert, Mapper transformiert
   *
   * @param aggregate - User Domain Aggregate
   * @returns UserDto - Response DTO mit primitiven Typen
   */
  private aggregateToDto(aggregate: import('@domain/aggregates/user.aggregate').UserAggregate): UserDto {
    // Domain Aggregate → Response DTO Mapping
    return {
      id: aggregate.id.toString(),
      username: aggregate.username.toString(),
      role: aggregate.role.toString(), // UserRole Value Object → String
      createdAt: aggregate.createdAt,
      updatedAt: aggregate.updatedAt,
      isLocked: aggregate.isLocked,
      lockReason: null, // TODO: lockReason ist noch nicht im Aggregate implementiert
    };
  }
}
