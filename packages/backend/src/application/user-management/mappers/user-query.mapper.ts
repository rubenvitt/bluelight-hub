import type { UserAggregate } from '@domain/aggregates/user.aggregate';
import type { UserDto } from '../dto/user.dto';

/**
 * Query Mapper für User Domain → DTO Transformation.
 *
 * Trennt Domain-Schicht (UserAggregate mit Business Logic)
 * von der API-Schicht (DTOs als reine Daten-Objekte).
 *
 * **Warum separater Mapper:**
 * - Versionierung: API-Struktur kann unabhaengig von Domain evolvieren
 * - Projektion: Nur API-relevante Felder werden exportiert (keine Domain Events)
 * - Security: Interne Domain-Details bleiben verborgen
 * - Testbarkeit: Mapper koennen isoliert ohne Domain-Logik getestet werden
 *
 * **Pattern:**
 * - Pure Functions: Kein State, keine Side Effects, keine Dependencies
 * - Immutable Input: Aggregates werden nicht modifiziert
 * - Static Methods: Keine Instanziierung notwendig
 */
export class UserQueryMapper {
  /**
   * Konvertiert ein UserAggregate zu einem UserDto.
   *
   * Diese Transformation trennt die Domain-Schicht von der API-Schicht,
   * damit interne Aenderungen am Aggregate die API-Struktur nicht brechen.
   *
   * **Mapping-Details:**
   * - Value Objects (id, username, role) werden auf .value/.toString() gemappt
   * - isLocked wird direkt uebernommen
   * - lockReason ist immer null (UserAggregate speichert lockReason nicht)
   * - createdAt und updatedAt werden von AggregateRoot uebernommen
   *
   * @param aggregate - Das zu konvertierende UserAggregate
   * @returns UserDto fuer API-Response
   */
  static toUserDto(aggregate: UserAggregate): UserDto {
    return {
      id: aggregate.id.toString(),
      username: aggregate.username.toString(),
      role: aggregate.role.value,
      createdAt: aggregate.createdAt,
      updatedAt: aggregate.updatedAt,
      isLocked: aggregate.isLocked,
      lockReason: null, // UserAggregate speichert lockReason nicht
    };
  }

  /**
   * Konvertiert ein Array von UserAggregates zu UserDtos.
   *
   * @param aggregates - Array von UserAggregates
   * @returns Array von UserDtos
   */
  static toUserDtos(aggregates: UserAggregate[]): UserDto[] {
    return aggregates.map((aggregate) => UserQueryMapper.toUserDto(aggregate));
  }
}
