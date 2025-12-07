import { Inject, Injectable, Logger } from '@nestjs/common';
import { Result } from '@domain/common/result';
import { EtbId } from '@domain/value-objects/etb-id';
import { UserId } from '@domain/value-objects/user-id';
import type { IEtbRepository } from '@domain/repositories';
import type { LockEtbCommand } from './lock-etb.command';
import { ETB_REPOSITORY } from '@infrastructure/di-tokens';

/**
 * Handler fuer LockEtbCommand.
 *
 * Orchestriert das Sperren eines Einsatztagebuchs (irreversible Aktion).
 * Implementiert Defense-in-Depth durch zusaetzlichen Authorization-Check
 * (neben Controller-Level Guards).
 *
 * **DRK-Compliance:**
 * Die Sperrung ist IRREVERSIBEL - nach dem Lock sind keine Aenderungen
 * mehr moeglich. Dies garantiert die Integritaet finaler Einsatzberichte.
 *
 * **Security:**
 * - Defensive Authorization: Handler prueft userRole nochmals
 * - Sanitized Errors: Keine internen IDs in Error Messages
 * - Audit-Trail: EtbLockedEvent enthaelt lockedBy + lockedAt
 *
 * **Event Publishing:**
 * EtbLockedEvent wird NUR nach erfolgreichem Save publiziert.
 * Bei Fehlern werden KEINE Events emittiert (transaktionale Konsistenz).
 */
@Injectable()
export class LockEtbHandler {
  private readonly logger = new Logger(LockEtbHandler.name);

  constructor(
    @Inject(ETB_REPOSITORY)
    private readonly etbRepository: IEtbRepository,
  ) {}

  /**
   * Fuehrt das Lock-Command aus.
   *
   * @param command - Das LockEtbCommand mit etbId, userId und userRole
   * @returns Result<void> bei Erfolg, Result.fail() bei erwarteten Fehlern
   */
  async execute(command: LockEtbCommand): Promise<Result<void>> {
    // Step 1: DEFENSIVE AUTHORIZATION CHECK (Defense-in-Depth)
    // Controller sollte bereits pruefen, aber wir pruefen nochmals
    if (command.userRole !== 'ADMIN' && command.userRole !== 'SUPER_ADMIN') {
      this.logger.warn('Unauthorized lock attempt', {
        userRole: command.userRole,
        timestamp: new Date().toISOString(),
      });
      return Result.fail<void>('Nur Administratoren können ETB sperren');
    }

    // Step 2: Validate EtbId format
    const etbIdResult = EtbId.create(command.etbId);
    if (etbIdResult.isFailure) {
      return Result.fail<void>(etbIdResult.error ?? 'Invalid ETB ID');
    }
    const etbId = etbIdResult.value;
    if (!etbId) {
      this.logger.error('Unexpected null EtbId after successful validation', {
        command: command.constructor.name,
      });
      return Result.fail<void>('Invalid ETB ID result');
    }

    // Step 3: Validate UserId format
    const userIdResult = UserId.create(command.userId);
    if (userIdResult.isFailure) {
      return Result.fail<void>(userIdResult.error ?? 'Invalid User ID');
    }
    const userId = userIdResult.value;
    if (!userId) {
      this.logger.error('Unexpected null UserId after successful validation', {
        command: command.constructor.name,
      });
      return Result.fail<void>('Invalid User ID result');
    }

    // Step 4: Load ETB Aggregate
    const aggregate = await this.etbRepository.findById(etbId);
    if (aggregate === null) {
      this.logger.warn('ETB not found during Lock', {
        etbId: etbId.value,
        timestamp: new Date().toISOString(),
      });
      return Result.fail<void>('ETB nicht gefunden');
    }

    // Step 5: Delegate to domain method (validates business rules)
    const lockResult = aggregate.lock(userId);
    if (lockResult.isFailure) {
      // Domain-level validation failure (e.g., already locked)
      return Result.fail<void>(lockResult.error ?? 'ETB konnte nicht gesperrt werden');
    }

    // Step 6: Save aggregate
    try {
      await this.etbRepository.save(aggregate);
    } catch (error) {
      this.logger.error('Failed to save ETB after locking', {
        error: error instanceof Error ? error.message : String(error),
        etbId: command.etbId,
        userId: command.userId,
      });
      return Result.fail<void>('ETB konnte nicht gesperrt werden');
    }

    // Domain Events werden automatisch in Outbox persistiert (Story 4-4: Transactional Outbox Pattern)
    // Repository.save() → Outbox → Polling Worker → Event Handler

    return Result.ok<void>(undefined);
  }
}
