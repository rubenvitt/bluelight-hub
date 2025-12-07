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
import { UnlockUserCommand } from './unlock-user.command';

/**
 * Handler für UnlockUserCommand mit Transactional Outbox Pattern.
 *
 * Erweitert TransactionalCommandHandler für atomare Persistierung von
 * User Aggregate und Domain Events in einer Datenbank-Transaktion.
 *
 * **Transactional Flow:**
 * 1. Validiert User-ID und UnlockedBy-ID Format
 * 2. Lädt User Aggregate via Repository
 * 3. Prüft ob User gesperrt ist (via Aggregate.unlock())
 * 4. Speichert User Aggregate in Transaction
 * 5. Extrahiert UserUnlockedEvent vom Aggregate (nur wenn tatsächlich entsperrt)
 * 6. Base Handler speichert Event in Outbox (atomar in gleicher TX)
 * 7. Transaction Commit → User + Event persistent
 * 8. OutboxEventPublisher pollt und publiziert Event asynchron
 *
 * **Business Rules (vom Aggregate enforced):**
 * - User muss existieren und nicht gelöscht sein
 * - User muss gesperrt sein (No-Op wenn bereits entsperrt)
 * - Entsperrung ist idempotent (kein Fehler bei mehrfachem Aufruf)
 *
 * **Event Flow:**
 * - UserUnlockedEvent wird in Outbox persistiert (PENDING status)
 * - OutboxEventPublisher pollt und publiziert zu Event Bus (max 7s Latenz)
 * - Event Handler können Audit Log, Notifications, Failed Login Reset triggern
 *
 * **Warum Transactional Outbox Pattern:**
 * - Garantiert atomare Persistierung: User + Event committed oder beide rollback
 * - Keine "lost events" bei DB-Fehlern nach User-Save
 * - Event Publishing via Outbox statt direkter Event-Emission
 * - Retry-Safe: Events in Outbox können bei Fehler erneut publiziert werden
 */
@CommandHandler(UnlockUserCommand)
@Injectable()
export class UnlockUserHandler extends TransactionalCommandHandler<UnlockUserCommand, void> {
  private readonly logger = new Logger(UnlockUserHandler.name);

  constructor(
    prisma: PrismaService,
    @Inject(OUTBOX_REPOSITORY) outboxRepository: IOutboxRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {
    super(prisma, outboxRepository);
  }

  /**
   * Führt die User-Entsperrung innerhalb einer Datenbank-Transaktion aus.
   *
   * Diese Methode implementiert die Business Logic für UnlockUserCommand:
   * 1. Validiert User-ID und UnlockedBy-ID Format
   * 2. Lädt User Aggregate via Repository
   * 3. Ruft Aggregate.unlock() auf (idempotent, emittiert Event nur bei tatsächlicher Änderung)
   * 4. Speichert User Aggregate in Transaction
   * 5. Extrahiert UserUnlockedEvent für Outbox (leer wenn No-Op)
   *
   * WICHTIG: Nutzt `tx` Parameter für alle DB-Operationen (NICHT this.prisma).
   * Base Handler koordiniert Transaction Commit und Outbox-Persistierung.
   *
   * **Result Pattern (AC4):**
   * - Gibt Result<T> zurück für erwartete Fehler (User not found, etc.)
   * - Exceptions nur für unerwartete Fehler (DB-Fehler, Programming Errors)
   * - Bei Result.fail(): Transaction wird automatisch zurückgerollt
   *
   * @param command - Validierter UnlockUserCommand
   * @param tx - Transaction Context (framework-agnostisch, Infrastructure castet zu Prisma)
   * @returns Result<{ result: void; events: DomainEvent[] }> - Success oder Failure
   */
  protected async executeInTransaction(command: UnlockUserCommand, tx: TransactionContext): Promise<Result<{ result: undefined; events: DomainEvent[] }>> {
    // Step 1: Validate User ID format
    const userIdResult = UserId.create(command.id);
    if (userIdResult.isFailure) {
      const error = userIdResult.error ?? 'Invalid User ID';
      this.logger.warn('User ID validation failed', {
        error,
        userId: command.id,
        operation: 'unlockUser',
        phase: 'validation',
      });
      return Result.fail(error);
    }
    const userId = userIdResult.value;

    if (!userId) {
      this.logger.error('Unexpected null UserId after successful validation', {
        operation: 'unlockUser',
        phase: 'validation',
      });
      return Result.fail('Invalid User ID');
    }

    // Step 2: Validate UnlockedBy ID format
    const unlockedByResult = UserId.create(command.unlockedBy);
    if (unlockedByResult.isFailure) {
      const error = unlockedByResult.error ?? 'Invalid UnlockedBy ID';
      this.logger.warn('UnlockedBy ID validation failed', {
        error,
        unlockedBy: command.unlockedBy,
        operation: 'unlockUser',
        phase: 'validation',
      });
      return Result.fail(error);
    }
    const unlockedBy = unlockedByResult.value;

    if (!unlockedBy) {
      this.logger.error('Unexpected null UnlockedBy after successful validation', {
        operation: 'unlockUser',
        phase: 'validation',
      });
      return Result.fail('Invalid UnlockedBy ID');
    }

    // Step 3: Load User Aggregate
    const userResult = await this.userRepository.findById(userId, tx);
    if (userResult.isFailure) {
      const error = userResult.error ?? 'Failed to load user';
      this.logger.error('Failed to load user', {
        error,
        userId: userId.value,
        operation: 'unlockUser',
        phase: 'repository',
      });
      return Result.fail(error);
    }

    const user = userResult.value;
    if (!user) {
      this.logger.warn('User not found', {
        userId: userId.value,
        operation: 'unlockUser',
        phase: 'validation',
      });
      return Result.fail('User not found');
    }

    // Step 4: Unlock User (Aggregate enforces Idempotency)
    // Emittiert Event nur wenn User tatsächlich gesperrt war
    const unlockResult = user.unlock(unlockedBy);
    if (unlockResult.isFailure) {
      const error = unlockResult.error ?? 'Failed to unlock user';
      this.logger.warn('User unlock failed', {
        error,
        userId: userId.value,
        unlockedBy: unlockedBy.value,
        operation: 'unlockUser',
        phase: 'domain',
      });
      return Result.fail(error);
    }

    // Step 5: Save User Aggregate in Transaction
    const saveResult = await this.userRepository.save(user, tx);
    if (saveResult.isFailure) {
      const error = saveResult.error ?? 'Failed to save user';
      this.logger.error('Failed to save unlocked user', {
        error,
        userId: userId.value,
        operation: 'unlockUser',
        phase: 'persistence',
      });
      return Result.fail(error);
    }

    // Step 6: Extract Domain Events for Outbox
    // Kann leer sein wenn User bereits entsperrt war (No-Op)
    const events = user.getDomainEvents();

    this.logger.log('User unlocked successfully', {
      userId: userId.value,
      unlockedBy: unlockedBy.value,
      eventCount: events.length,
      wasLocked: events.length > 0, // Event nur bei tatsächlicher Änderung
    });

    // Step 7: Return result + events für Base Handler
    return Result.ok({
      result: undefined,
      events,
    });
  }
}
