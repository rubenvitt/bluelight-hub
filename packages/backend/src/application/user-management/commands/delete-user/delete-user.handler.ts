import type { IUserRepository } from '@domain/repositories/i-user.repository';
import { UserId } from '@domain/value-objects/user-id';
import { UserRole } from '@domain/value-objects/user-role';
import { CommandHandler } from '@nestjs/cqrs';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DeleteUserCommand } from './delete-user.command';
import { Result } from '@domain/common/result';
import { USER_REPOSITORY, OUTBOX_REPOSITORY } from '@infrastructure/di-tokens';
import type { TransactionContext } from '@domain/common';
import { TransactionalCommandHandler } from '@application/common/handlers/transactional-command.handler';
import type { DomainEvent } from '@domain/common/domain-event';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
// biome-ignore lint/style/useImportType: PrismaService needed for DI at runtime
import { PrismaService } from '@infrastructure/database/prisma.service';

/**
 * Handler für DeleteUserCommand.
 *
 * Implementiert Soft Delete Pattern mit optionalem Admin-Downgrade.
 * Verwendet TransactionalCommandHandler für atomare Persistierung von
 * User-Änderungen und Domain Events im Transactional Outbox Pattern.
 *
 * **Business Rules:**
 * - Soft Delete: User wird auf isDeleted=true gesetzt (kein physisches DELETE)
 * - SUPER_ADMIN Schutz: Letzter SUPER_ADMIN kann weder gelöscht noch herabgestuft werden
 * - Admin Downgrade Option: Admin kann zu USER herabgestuft werden statt gelöscht
 * - Audit Trail: deletedBy wird immer gesetzt für Compliance
 *
 * **Soft Delete Felder:**
 * - isDeleted: true
 * - deletedAt: Current timestamp
 * - deletedBy: UserId des Admin der die Löschung durchführt
 * - isActive: false (User kann sich nicht mehr einloggen)
 * - Lock-Felder werden zurückgesetzt (gelöschte User sind irrelevant)
 * - Bei Admin: Role → USER, passwordHash → null
 *
 * **Admin Downgrade vs. Delete:**
 * - downgradeAdmin=false: Admin wird soft-deleted (isDeleted=true)
 * - downgradeAdmin=true: Admin wird zu USER herabgestuft (bleibt aktiv, isDeleted=false)
 * - Use Case: Admin verlässt Organisation, soll aber als USER bleiben
 *
 * **Domain Events:**
 * - UserDeletedEvent: Bei Soft Delete (isDeleted=true)
 * - UserRoleChangedEvent: Bei Admin Downgrade (Role ADMIN/SUPER_ADMIN → USER)
 *
 * **Result Pattern (AC4):**
 * - Verwendet Result<void> für erwartete Fehler (User nicht gefunden, letzter SUPER_ADMIN, etc.)
 * - Exceptions nur für unerwartete Fehler (DB-Fehler, Programming Errors)
 * - TransactionalCommandHandler handled Transaction Rollback bei Result.fail()
 *
 * @example
 * ```typescript
 * // Standard Delete (Soft Delete)
 * const deleteCmd = DeleteUserCommand.create({
 *   id: 'user-id-123',
 *   deletedBy: 'admin-id-456',
 * });
 * const result = await handler.execute(deleteCmd.value);
 * if (result.isSuccess) {
 *   // User ist soft-deleted (isDeleted=true)
 *   // UserDeletedEvent wurde emittiert
 * }
 *
 * // Admin Downgrade
 * const downgradeCmd = DeleteUserCommand.create({
 *   id: 'admin-id-789',
 *   downgradeAdmin: true,
 *   deletedBy: 'super-admin-id-001',
 * });
 * const result2 = await handler.execute(downgradeCmd.value);
 * if (result2.isSuccess) {
 *   // Admin ist jetzt USER Role, bleibt aktiv (isDeleted=false)
 *   // UserRoleChangedEvent wurde emittiert
 * }
 * ```
 */
@CommandHandler(DeleteUserCommand)
@Injectable()
export class DeleteUserHandler extends TransactionalCommandHandler<DeleteUserCommand, void> {
  private readonly logger = new Logger(DeleteUserHandler.name);

  constructor(
    prisma: PrismaService,
    @Inject(OUTBOX_REPOSITORY) outboxRepository: IOutboxRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {
    super(prisma, outboxRepository);
  }

  /**
   * Führt User-Löschung (Soft Delete) oder Admin-Downgrade in Transaction aus.
   *
   * **Result Pattern (AC4):**
   * - Gibt Result<{ result: void; events: DomainEvent[] }> zurück
   * - Bei Validierungsfehlern: Result.fail()
   * - Bei Business Rule Violations: Result.fail()
   * - Base Class handled Transaction Rollback bei Result.fail()
   *
   * **Transaction Flow:**
   * 1. Validate UserId Format
   * 2. Load User Aggregate
   * 3. Check if User exists
   * 4. Check SUPER_ADMIN Protection Rule
   * 5. Determine Action: Delete vs. Downgrade
   * 6. Perform Action + Generate Events
   * 7. Save User Aggregate (in Transaction)
   * 8. Return Events (Base Class speichert in Outbox)
   *
   * @param command - Validierter DeleteUserCommand
   * @param tx - Transaction Context (framework-agnostisch)
   * @returns Result<{ result: void; events: DomainEvent[] }> - Success oder Failure
   */
  protected async executeInTransaction(command: DeleteUserCommand, tx: TransactionContext): Promise<Result<{ result: undefined; events: DomainEvent[] }>> {
    // Step 1: Validate UserId format
    const userIdResult = UserId.create(command.id);
    if (userIdResult.isFailure) {
      return Result.fail(userIdResult.error ?? 'Ungültige User-ID');
    }
    const userId = userIdResult.value;
    if (!userId) {
      this.logger.error('Unexpected null UserId after successful validation');
      return Result.fail('Ungültige User-ID');
    }

    // Step 2: Validate deletedBy UserId format
    const deletedByResult = UserId.create(command.deletedBy);
    if (deletedByResult.isFailure) {
      return Result.fail(deletedByResult.error ?? 'Ungültige deletedBy User-ID');
    }
    const deletedBy = deletedByResult.value;
    if (!deletedBy) {
      this.logger.error('Unexpected null deletedBy UserId after successful validation');
      return Result.fail('Ungültige deletedBy User-ID');
    }

    // Step 3: Load User Aggregate (in Transaction für Konsistenz)
    const findResult = await this.userRepository.findById(userId, tx);
    if (findResult.isFailure) {
      this.logger.error('Failed to load User for deletion', {
        operation: 'deleteUser',
        phase: 'load',
        error: findResult.error,
        userId: command.id,
      });
      return Result.fail(findResult.error ?? 'Benutzer konnte nicht geladen werden');
    }

    const user = findResult.value;
    if (!user) {
      this.logger.warn('User not found for deletion', {
        operation: 'deleteUser',
        phase: 'load',
        userId: command.id,
      });
      return Result.fail('Benutzer nicht gefunden');
    }

    // Step 4: Determine Action - Delete vs. Downgrade
    const isAdmin = user.role.value === 'ADMIN' || user.role.value === 'SUPER_ADMIN';
    const shouldDowngrade = command.downgradeAdmin && isAdmin;

    if (shouldDowngrade) {
      // Admin Downgrade: Role → USER (bleibt aktiv)
      this.logger.log('Downgrading Admin to USER', {
        operation: 'deleteUser',
        phase: 'downgrade',
        userId: command.id,
        oldRole: user.role.value,
      });

      const newRole = UserRole.USER();

      // Step 5: Use Aggregate updateRole() method (with SUPER_ADMIN protection)
      const updateRoleResult = await user.updateRole(newRole, deletedBy, this.userRepository);
      if (updateRoleResult.isFailure) {
        this.logger.error('Failed to downgrade Admin to USER', {
          operation: 'deleteUser',
          phase: 'downgrade',
          error: updateRoleResult.error,
          userId: command.id,
        });
        return Result.fail(updateRoleResult.error ?? 'Admin konnte nicht herabgestuft werden');
      }
    } else {
      // Soft Delete: Call Aggregate delete() method
      this.logger.log('Soft-deleting User', {
        operation: 'deleteUser',
        phase: 'delete',
        userId: command.id,
        role: user.role.value,
      });

      // Step 5: Use Aggregate delete() method (with SUPER_ADMIN protection + locked check)
      const deleteResult = await user.delete(deletedBy, this.userRepository);
      if (deleteResult.isFailure) {
        this.logger.error('Failed to delete User', {
          operation: 'deleteUser',
          phase: 'delete',
          error: deleteResult.error,
          userId: command.id,
        });
        return Result.fail(deleteResult.error ?? 'Benutzer konnte nicht gelöscht werden');
      }
    }

    // Step 6: Save User Aggregate (in Transaction)
    // Aggregate hat State Changes durch updateRole() oder delete() Methods
    // Events wurden bereits vom Aggregate emittiert
    const saveResult = await this.userRepository.save(user, tx);
    if (saveResult.isFailure) {
      this.logger.error('Failed to save User after deletion/downgrade', {
        operation: 'deleteUser',
        phase: 'save',
        error: saveResult.error,
        userId: command.id,
      });
      return Result.fail(saveResult.error ?? 'Benutzer konnte nicht gespeichert werden');
    }

    // Step 7: Extract Events from Aggregate
    const events = user.getDomainEvents();
    user.clearDomainEvents();

    // Step 8: Return Success mit Events (Base Class speichert in Outbox)
    return Result.ok({ result: undefined, events });
  }
}
