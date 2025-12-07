import type { IUserRepository } from '@domain/repositories/i-user.repository';
import { UserId } from '@domain/value-objects/user-id';
import { Username } from '@domain/value-objects/username';
import { UserRole } from '@domain/value-objects/user-role';
import { UserAggregate } from '@domain/aggregates/user.aggregate';
import { CommandHandler } from '@nestjs/cqrs';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CreateUserCommand } from './create-user.command';
import { TransactionalCommandHandler } from '@application/common/handlers/transactional-command.handler';
// biome-ignore lint/style/useImportType: PrismaService needed for DI at runtime
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import type { DomainEvent } from '@domain/common/domain-event';
import type { TransactionContext } from '@domain/common';
import { Result } from '@domain/common/result';
import { USER_REPOSITORY, OUTBOX_REPOSITORY } from '@infrastructure/di-tokens';

/**
 * Handler für CreateUserCommand mit Transactional Outbox Pattern.
 *
 * Erweitert TransactionalCommandHandler für atomare Persistierung von
 * Aggregate und Domain Events in einer Datenbank-Transaktion.
 *
 * **Transactional Flow:**
 * 1. Validiert Username Format (3-50 Zeichen)
 * 2. Prüft ob aktiver User mit gleichem Username existiert
 * 3. Erstellt neuen User Aggregate
 * 4. Prüft ob erster User im System → SUPER_ADMIN
 * 5. Speichert Aggregate in Transaction
 * 6. Extrahiert Domain Events vom Aggregate
 * 7. Base Handler speichert Events in Outbox (atomar in gleicher TX)
 *
 * **Business Rules:**
 * - Username muss unique sein (DB Constraint)
 * - Erster User im System wird SUPER_ADMIN (Security Bootstrap)
 * - Bei Conflict mit gelöschtem User: DB wirft Constraint Violation
 *
 * **Event Flow:**
 * - UserCreatedEvent wird in Outbox persistiert (PENDING status)
 * - OutboxEventPublisher pollt und publiziert zu Event Bus
 * - Event Handler können reagieren (z.B. Welcome Email, Audit Log)
 *
 * **TODO: User-Reaktivierung (Story 4.7):**
 * Die Reaktivierung gelöschter User erfordert eine Erweiterung des IUserRepository:
 * - findDeletedByUsername(username: Username, tx?: TransactionContext): Promise<Result<UserAggregate | null>>
 * - reactivate(user: UserAggregate, tx?: TransactionContext): Promise<Result<void>>
 * Aktuell wird ein Constraint Violation geworfen wenn ein gelöschter User mit gleichem Username existiert.
 */
@CommandHandler(CreateUserCommand)
@Injectable()
export class CreateUserHandler extends TransactionalCommandHandler<CreateUserCommand, string> {
  private readonly logger = new Logger(CreateUserHandler.name);

  constructor(
    prisma: PrismaService,
    @Inject(OUTBOX_REPOSITORY) outboxRepository: IOutboxRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {
    super(prisma, outboxRepository);
  }

  /**
   * Führt die User-Erstellung innerhalb einer Datenbank-Transaktion aus.
   *
   * Diese Methode implementiert die Business Logic für CreateUserCommand:
   * 1. Validiert Username Format (3-50 Zeichen)
   * 2. Validiert createdBy UserId Format
   * 3. Prüft ob aktiver User mit gleichem Username existiert
   * 4. Erstellt neuen User Aggregate via Factory Method
   * 5. Prüft ob erster User im System (SUPER_ADMIN Bootstrap)
   * 6. Speichert Aggregate in Transaction
   * 7. Extrahiert Domain Events für Outbox
   *
   * WICHTIG: Nutzt `tx` Parameter für alle DB-Operationen (NICHT this.prisma).
   * Base Handler koordiniert Transaction Commit und Outbox-Persistierung.
   *
   * **Result Pattern (AC4):**
   * - Gibt Result<T> zurück für erwartete Fehler (Validierung, Business Rules)
   * - Exceptions nur für unerwartete Fehler (DB-Fehler, Programming Errors)
   * - Bei Result.fail(): Transaction wird automatisch zurückgerollt
   *
   * @param command - Validierter CreateUserCommand
   * @param tx - Transaction Context (framework-agnostisch, Infrastructure castet zu Prisma)
   * @returns Result<{ result: string; events: DomainEvent[] }> - Success oder Failure
   */
  protected async executeInTransaction(command: CreateUserCommand, tx: TransactionContext): Promise<Result<{ result: string; events: DomainEvent[] }>> {
    // Step 1: Validate Username format
    const usernameResult = Username.create(command.username);
    if (usernameResult.isFailure) {
      const error = usernameResult.error ?? 'Ungültiger Username';
      this.logger.warn('Username validation failed', {
        error,
        username: command.username,
        operation: 'createUser',
        phase: 'validation',
      });
      return Result.fail(error); // ✅ Result Pattern statt Exception
    }
    const username = usernameResult.value;

    // Defensive Programming: TypeScript kann Result<T>.value nicht automatisch als non-null
    // narrowen nach isSuccess-Prüfung, da das Type-System diese Garantie nicht ausdrücken kann.
    if (!username) {
      this.logger.error('Unexpected null Username after successful validation', {
        operation: 'createUser',
        phase: 'validation',
      });
      return Result.fail('Ungültiger Username'); // ✅ Result Pattern statt Exception
    }

    // Step 2: Validate createdBy UserId format
    const createdByIdResult = UserId.create(command.createdBy);
    if (createdByIdResult.isFailure) {
      const error = createdByIdResult.error ?? 'Ungültige createdBy User-ID';
      this.logger.warn('CreatedBy UserId validation failed', {
        error,
        createdBy: command.createdBy,
        operation: 'createUser',
        phase: 'validation',
      });
      return Result.fail(error); // ✅ Result Pattern statt Exception
    }
    const createdById = createdByIdResult.value;

    if (!createdById) {
      this.logger.error('Unexpected null CreatedBy UserId after successful validation', {
        operation: 'createUser',
        phase: 'validation',
      });
      return Result.fail('Ungültige createdBy User-ID'); // ✅ Result Pattern statt Exception
    }

    // Step 3: Check if user with same username exists
    // WICHTIG: findByUsername() gibt nur NICHT-GELÖSCHTE User zurück
    // Für Reaktivierung gelöschter User wird separate Logik benötigt
    const existingUserResult = await this.userRepository.findByUsername(username, tx);
    if (existingUserResult.isFailure) {
      const error = existingUserResult.error ?? 'Fehler beim Prüfen auf existierenden User';
      this.logger.error('Failed to check existing user', {
        error,
        username: username.value,
        operation: 'createUser',
        phase: 'validation',
      });
      return Result.fail(error); // ✅ Result Pattern statt Exception
    }

    // Wenn User mit gleichem Username existiert (nicht gelöscht), Fehler
    if (existingUserResult.value) {
      const error = 'Benutzername bereits vergeben';
      this.logger.warn('Username already exists', {
        username: username.value,
        operation: 'createUser',
        phase: 'validation',
      });
      return Result.fail(error); // ✅ Result Pattern statt Exception
    }

    // Step 4: Determine role (default USER, or first user → SUPER_ADMIN)
    let userRole = command.role || UserRole.USER();

    // Business Rule: Erster User wird SUPER_ADMIN (Security Bootstrap)
    // Prüfung: Zähle alle User (inkl. gelöschte)
    const allUsersResult = await this.userRepository.findAll(tx);
    if (allUsersResult.isFailure) {
      const error = allUsersResult.error ?? 'Fehler beim Prüfen auf erste User-Erstellung';
      this.logger.error('Failed to count all users', {
        error,
        operation: 'createUser',
        phase: 'validation',
      });
      return Result.fail(error); // ✅ Result Pattern statt Exception
    }

    const allUsers = allUsersResult.value;
    if (!allUsers) {
      this.logger.error('Unexpected null users list after successful query', {
        operation: 'createUser',
        phase: 'validation',
      });
      return Result.fail('Fehler beim Prüfen auf erste User-Erstellung'); // ✅ Result Pattern statt Exception
    }

    // Wenn keine User existieren, ist dies der erste User → SUPER_ADMIN
    if (allUsers.length === 0) {
      userRole = UserRole.SUPER_ADMIN();
      this.logger.log('First user detected, assigning SUPER_ADMIN role', {
        username: username.value,
        operation: 'createUser',
        phase: 'validation',
      });
    }

    // Step 5: Create new User Aggregate
    // Business Rules werden vom Aggregate enforced
    const aggregateResult = UserAggregate.create(username, userRole);

    if (aggregateResult.isFailure) {
      const error = aggregateResult.error ?? 'User konnte nicht erstellt werden';
      this.logger.warn('User creation failed', {
        error,
        username: username.value,
        operation: 'createUser',
        phase: 'validation',
      });
      return Result.fail(error); // ✅ Result Pattern statt Exception
    }

    const userAggregate = aggregateResult.value;
    if (!userAggregate) {
      this.logger.error('Unexpected null User after successful creation', {
        operation: 'createUser',
        phase: 'validation',
      });
      return Result.fail('User konnte nicht erstellt werden'); // ✅ Result Pattern statt Exception
    }

    // Step 6: Save Aggregate in Transaction (WICHTIG: Nutze tx, nicht this.prisma)
    const saveResult = await this.userRepository.save(userAggregate, tx);
    if (saveResult.isFailure) {
      const error = saveResult.error ?? 'User konnte nicht gespeichert werden';
      this.logger.error('Failed to save User', {
        error,
        userId: userAggregate.id.value,
        username: username.value,
        operation: 'createUser',
        phase: 'persistence',
      });
      return Result.fail(error); // ✅ Result Pattern statt Exception
    }

    // Step 7: Extract Domain Events for Outbox
    // Base Handler wird Events in Outbox persistieren (atomar in gleicher TX)
    const events = userAggregate.getDomainEvents();

    this.logger.log('User created successfully', {
      userId: userAggregate.id.value,
      username: username.value,
      role: userRole.value,
      eventCount: events.length,
    });

    // Step 8: Return result + events für Base Handler
    // Base Handler committed Transaction wenn alles erfolgreich
    return Result.ok({
      result: userAggregate.id.value,
      events,
    });
  }
}
