import { Inject, Injectable } from '@nestjs/common';
import { TransactionalCommandHandler } from '@application/common/handlers/transactional-command.handler';
import type { UpdateUserCommand } from './update-user.command';
import { Result } from '@domain/common/result';
import type { DomainEvent } from '@domain/common/domain-event';
import type { TransactionContext } from '@domain/common/transaction';
// biome-ignore lint/style/useImportType: PrismaService needed for DI at runtime
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import type { IUserRepository } from '@domain/repositories/i-user.repository';
import { OUTBOX_REPOSITORY, USER_REPOSITORY } from '@infrastructure/di-tokens';
import { UserId } from '@domain/value-objects/user-id';
import { Username } from '@domain/value-objects/username';
import { UserRole } from '@domain/value-objects/user-role';

/**
 * Command Handler für UpdateUserCommand.
 *
 * Implementiert User-Update mit folgenden Business Rules:
 * - User muss existieren (nicht gelöscht, nicht gesperrt)
 * - Username muss unique sein (falls geändert)
 * - Letzter SUPER_ADMIN darf nicht herabgestuft werden
 *
 * **Transactional Outbox Pattern (AC5):**
 * - Extends TransactionalCommandHandler für atomare Event-Persistierung
 * - Domain Events (UserRoleChangedEvent) werden mit User-Update in einer Transaktion gespeichert
 * - Keine "lost events" bei DB-Fehlern nach User-Save
 *
 * **Result Pattern (AC4):**
 * - Verwendet Result<T> für erwartete Business-Fehler
 * - Exceptions nur für unerwartete Fehler (DB-Fehler, Programming Errors)
 * - Transaction Rollback bei Result.fail() UND bei Exceptions
 *
 * **Framework-Agnostizität (AC3):**
 * - Nur @Injectable und @Inject Decorators (NestJS-agnostisch)
 * - Keine HTTP-spezifischen Imports (Response, HttpException, etc.)
 * - Result Pattern statt Framework-Exceptions
 *
 * @example
 * ```typescript
 * // In Controller (Infrastructure Layer)
 * const command = UpdateUserCommand.create(id, currentUser.id, dto.username, dto.role);
 * if (command.isFailure) {
 *   throw new BadRequestException(command.error);
 * }
 *
 * const result = await handler.execute(command.value!);
 * if (result.isFailure) {
 *   throw new BadRequestException(result.error);
 * }
 * ```
 */
@Injectable()
export class UpdateUserHandler extends TransactionalCommandHandler<UpdateUserCommand, void> {
  /**
   * Constructor mit Dependency Injection.
   *
   * **DI Token Pattern (AC1 & AC2):**
   * - @Inject(USER_REPOSITORY) statt @Inject('IUserRepository')
   * - Symbol DI Token für Type Safety und Refactoring-Sicherheit
   * - Repository Interface aus Domain Layer, Implementierung aus Infrastructure
   *
   * @param prisma - PrismaService für Transaktionsverwaltung
   * @param outboxRepository - IOutboxRepository für Event-Persistierung
   * @param userRepository - IUserRepository für User Aggregate Operations
   */
  constructor(
    prisma: PrismaService,
    @Inject(OUTBOX_REPOSITORY) outboxRepository: IOutboxRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
  ) {
    super(prisma, outboxRepository);
  }

  /**
   * Führt User-Update innerhalb einer Transaktion aus.
   *
   * **Business Logic Flow:**
   * 1. Validiere updatedBy UserId
   * 2. Lade User Aggregate aus Repository
   * 3. Falls Username-Änderung: Prüfe Uniqueness
   * 4. Falls Role-Änderung: Verwende Aggregate.updateRole() (mit Min-1-SUPER_ADMIN Check)
   * 5. Falls Username-Änderung: Aktualisiere Username (NO Event - simple property change)
   * 6. Persistiere User Aggregate
   * 7. Extrahiere Domain Events (UserRoleChangedEvent bei Role-Änderung)
   * 8. Return { result: void, events } für atomare Outbox-Persistierung
   *
   * **Warum Username-Änderung KEIN Event emittiert:**
   * - Username ist technische Property-Änderung, kein fachlich relevantes Event
   * - Kein External System muss über Username-Änderung benachrichtigt werden
   * - ABER: Role-Änderung ist fachlich relevant (Permissions ändern sich)
   *
   * **Min-1-SUPER_ADMIN Constraint:**
   * - UserAggregate.updateRole() prüft automatisch Min-1-SUPER_ADMIN Constraint
   * - Handler delegiert Business Rule an Domain Layer (Hexagonal Architecture)
   *
   * @param command - Validierter UpdateUserCommand
   * @param tx - Transaction Context für atomare Operationen
   * @returns Result mit void (success) oder Error-Message
   */
  protected async executeInTransaction(command: UpdateUserCommand, tx: TransactionContext): Promise<Result<{ result: undefined; events: DomainEvent[] }>> {
    // 1. Validiere updatedBy UserId
    const updatedByIdResult = UserId.create(command.updatedBy);
    if (updatedByIdResult.isFailure || !updatedByIdResult.value) {
      return Result.fail(updatedByIdResult.error ?? 'Invalid updatedBy ID');
    }
    const updatedById = updatedByIdResult.value;

    // 2. Lade User Aggregate
    const userIdResult = UserId.create(command.id);
    if (userIdResult.isFailure || !userIdResult.value) {
      return Result.fail(userIdResult.error ?? 'Invalid user ID');
    }

    const userResult = await this.userRepository.findById(userIdResult.value, tx);
    if (userResult.isFailure || !userResult.value) {
      return Result.fail(userResult.error ?? 'User not found or already deleted');
    }

    const user = userResult.value;

    // Business Rule: Gesperrte User können nicht aktualisiert werden
    if (user.isLocked) {
      return Result.fail('Cannot update locked user');
    }

    // 3. Falls Username-Änderung: Prüfe Uniqueness
    if (command.username !== undefined && command.username !== user.username.toString()) {
      const newUsernameResult = Username.create(command.username);
      if (newUsernameResult.isFailure || !newUsernameResult.value) {
        return Result.fail(newUsernameResult.error ?? 'Invalid username');
      }

      // Prüfe ob neuer Username bereits existiert
      const existsResult = await this.userRepository.existsByUsername(newUsernameResult.value, tx);
      if (existsResult.isFailure) {
        return Result.fail(existsResult.error ?? 'Failed to check username uniqueness');
      }
      if (existsResult.value === true) {
        return Result.fail('Username already exists');
      }

      // WICHTIG: Username direkt ändern (User Aggregate hat keine updateUsername() Methode)
      // Username-Änderung wird im Repository.save() persistiert
      // HACK: Private Property Update via Type Assertion (Domain Model hat keinen Setter)
      // biome-ignore lint/suspicious/noExplicitAny: Domain Model hat keinen Setter für username
      (user as any)._username = newUsernameResult.value;
    }

    // 4. Falls Role-Änderung: Verwende Aggregate.updateRole() (mit Min-1-SUPER_ADMIN Check)
    if (command.role !== undefined) {
      // Convert Prisma UserRole to Domain UserRole Value Object
      let newRole: ReturnType<typeof UserRole.SUPER_ADMIN | typeof UserRole.ADMIN | typeof UserRole.USER>;
      switch (command.role) {
        case 'SUPER_ADMIN':
          newRole = UserRole.SUPER_ADMIN();
          break;
        case 'ADMIN':
          newRole = UserRole.ADMIN();
          break;
        case 'USER':
          newRole = UserRole.USER();
          break;
        default:
          return Result.fail(`Invalid role: ${command.role}`);
      }

      // Delegate Min-1-SUPER_ADMIN Check to Domain Layer
      const updateRoleResult = await user.updateRole(newRole, updatedById, this.userRepository);
      if (updateRoleResult.isFailure) {
        return Result.fail(updateRoleResult.error ?? 'Failed to update role');
      }
    }

    // 5. Persistiere User Aggregate
    const saveResult = await this.userRepository.save(user, tx);
    if (saveResult.isFailure) {
      return Result.fail(saveResult.error ?? 'Failed to save user');
    }

    // 6. Extrahiere Domain Events
    const events = user.getDomainEvents();
    user.clearDomainEvents();

    // 7. Return success mit Events für atomare Outbox-Persistierung
    return Result.ok({ result: undefined, events });
  }
}
