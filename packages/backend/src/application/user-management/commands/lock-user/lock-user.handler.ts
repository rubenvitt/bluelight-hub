import { CommandHandler } from '@nestjs/cqrs';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { TransactionalCommandHandler } from '@application/common/handlers/transactional-command.handler';
// biome-ignore lint/style/useImportType: PrismaService needed for DI at runtime
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import type { IUserRepository } from '@domain/repositories/i-user.repository';
import type { DomainEvent } from '@domain/common/domain-event';
import type { TransactionContext } from '@domain/common';
import { Result } from '@domain/common/result';
import { OUTBOX_REPOSITORY, USER_REPOSITORY } from '@infrastructure/di-tokens';
import { UserId } from '@domain/value-objects/user-id';
import { LockUserCommand } from './lock-user.command';

/**
 * Handler für LockUserCommand mit Transactional Outbox Pattern.
 *
 * Erweitert TransactionalCommandHandler für atomare Persistierung von
 * User Aggregate und Domain Events in einer Datenbank-Transaktion.
 *
 * **Transactional Flow:**
 * 1. Validiert User-ID und LockedBy-ID Format
 * 2. Lädt User Aggregate via Repository
 * 3. Prüft Min-1-SUPER_ADMIN Constraint (via Aggregate.lock())
 * 4. Speichert User Aggregate in Transaction
 * 5. Extrahiert UserLockedEvent vom Aggregate
 * 6. Base Handler speichert Event in Outbox (atomar in gleicher TX)
 * 7. Transaction Commit → User + Event persistent
 * 8. OutboxEventPublisher pollt und publiziert Event asynchron
 *
 * **Business Rules (vom Aggregate enforced):**
 * - Letzter SUPER_ADMIN kann nicht gesperrt werden (Min-1-SUPER_ADMIN Constraint)
 * - User muss existieren und nicht gelöscht sein
 * - User muss noch nicht gesperrt sein (Idempotenz über Aggregate)
 *
 * **Event Flow:**
 * - UserLockedEvent wird in Outbox persistiert (PENDING status)
 * - OutboxEventPublisher pollt und publiziert zu Event Bus (max 7s Latenz)
 * - Event Handler können Session Termination, Audit Log, Notifications triggern
 *
 * **Warum Transactional Outbox Pattern:**
 * - Garantiert atomare Persistierung: User + Event committed oder beide rollback
 * - Keine "lost events" bei DB-Fehlern nach User-Save
 * - Event Publishing via Outbox statt direkter Event-Emission
 * - Retry-Safe: Events in Outbox können bei Fehler erneut publiziert werden
 */
@CommandHandler(LockUserCommand)
@Injectable()
export class LockUserHandler extends TransactionalCommandHandler<LockUserCommand, void> {
  private readonly logger = new Logger(LockUserHandler.name);

  constructor(
    prisma: PrismaService,
    @Inject(OUTBOX_REPOSITORY) outboxRepository: IOutboxRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {
    super(prisma, outboxRepository);
  }

  /**
   * Führt die User-Sperrung innerhalb einer Datenbank-Transaktion aus.
   *
   * Diese Methode implementiert die Business Logic für LockUserCommand:
   * 1. Validiert User-ID und LockedBy-ID Format
   * 2. Lädt User Aggregate via Repository
   * 3. Ruft Aggregate.lock() auf (enforced Min-1-SUPER_ADMIN Constraint)
   * 4. Speichert User Aggregate in Transaction
   * 5. Extrahiert UserLockedEvent für Outbox
   *
   * WICHTIG: Nutzt `tx` Parameter für alle DB-Operationen (NICHT this.prisma).
   * Base Handler koordiniert Transaction Commit und Outbox-Persistierung.
   *
   * **Result Pattern (AC4):**
   * - Gibt Result<T> zurück für erwartete Fehler (User not found, Last SUPER_ADMIN, etc.)
   * - Exceptions nur für unerwartete Fehler (DB-Fehler, Programming Errors)
   * - Bei Result.fail(): Transaction wird automatisch zurückgerollt
   *
   * @param command - Validierter LockUserCommand
   * @param tx - Transaction Context (framework-agnostisch, Infrastructure castet zu Prisma)
   * @returns Result<{ result: void; events: DomainEvent[] }> - Success oder Failure
   */
  protected async executeInTransaction(command: LockUserCommand, tx: TransactionContext): Promise<Result<{ result: undefined; events: DomainEvent[] }>> {
    // Step 1: Validate User ID format
    const userIdResult = UserId.create(command.id);
    if (userIdResult.isFailure) {
      const error = userIdResult.error ?? 'Invalid User ID';
      this.logger.warn('User ID validation failed', {
        error,
        userId: command.id,
        operation: 'lockUser',
        phase: 'validation',
      });
      return Result.fail(error);
    }
    const userId = userIdResult.value;

    if (!userId) {
      this.logger.error('Unexpected null UserId after successful validation', {
        operation: 'lockUser',
        phase: 'validation',
      });
      return Result.fail('Invalid User ID');
    }

    // Step 2: Validate LockedBy ID format
    const lockedByResult = UserId.create(command.lockedBy);
    if (lockedByResult.isFailure) {
      const error = lockedByResult.error ?? 'Invalid LockedBy ID';
      this.logger.warn('LockedBy ID validation failed', {
        error,
        lockedBy: command.lockedBy,
        operation: 'lockUser',
        phase: 'validation',
      });
      return Result.fail(error);
    }
    const lockedBy = lockedByResult.value;

    if (!lockedBy) {
      this.logger.error('Unexpected null LockedBy after successful validation', {
        operation: 'lockUser',
        phase: 'validation',
      });
      return Result.fail('Invalid LockedBy ID');
    }

    // Step 3: Load User Aggregate
    const userResult = await this.userRepository.findById(userId, tx);
    if (userResult.isFailure) {
      const error = userResult.error ?? 'Failed to load user';
      this.logger.error('Failed to load user', {
        error,
        userId: userId.value,
        operation: 'lockUser',
        phase: 'repository',
      });
      return Result.fail(error);
    }

    const user = userResult.value;
    if (!user) {
      this.logger.warn('User not found', {
        userId: userId.value,
        operation: 'lockUser',
        phase: 'validation',
      });
      return Result.fail('User not found');
    }

    // Step 4: Lock User (Aggregate enforces Min-1-SUPER_ADMIN Constraint)
    // WICHTIG: Nutze tx für countSuperAdmins() in Aggregate.lock()
    const lockResult = await user.lock(this.userRepository, lockedBy, command.reason);
    if (lockResult.isFailure) {
      const error = lockResult.error ?? 'Failed to lock user';
      this.logger.warn('User lock failed', {
        error,
        userId: userId.value,
        lockedBy: lockedBy.value,
        reason: command.reason,
        operation: 'lockUser',
        phase: 'domain',
      });
      return Result.fail(error);
    }

    // Step 5: Save User Aggregate in Transaction
    const saveResult = await this.userRepository.save(user, tx);
    if (saveResult.isFailure) {
      const error = saveResult.error ?? 'Failed to save user';
      this.logger.error('Failed to save locked user', {
        error,
        userId: userId.value,
        operation: 'lockUser',
        phase: 'persistence',
      });
      return Result.fail(error);
    }

    // Step 6: Extract Domain Events for Outbox
    const events = user.getDomainEvents();

    this.logger.log('User locked successfully', {
      userId: userId.value,
      lockedBy: lockedBy.value,
      reason: command.reason,
      eventCount: events.length,
    });

    // Step 7: Return result + events für Base Handler
    return Result.ok({
      result: undefined,
      events,
    });
  }
}
