import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Result } from '@domain/common/result';
import { EtbId } from '@domain/value-objects/etb-id';
import { UserId } from '@domain/value-objects/user-id';
import type { IEtbRepository } from '@domain/repositories/i-etb.repository';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import type { LockEtbCommand } from './lock-etb.command';

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
    @Inject('IEtbRepository')
    private readonly etbRepository: IEtbRepository,
    @Inject('IEventPublisher')
    private readonly eventPublisher: IEventPublisher,
  ) {}

  /**
   * Fuehrt das Lock-Command aus.
   *
   * @param command - Das LockEtbCommand mit etbId, userId und userRole
   * @returns Result<void> bei Erfolg
   * @throws ForbiddenException wenn User nicht ADMIN/SUPER_ADMIN ist
   * @throws NotFoundException wenn ETB nicht gefunden wird
   * @throws BadRequestException wenn ETB bereits gesperrt ist
   */
  async execute(command: LockEtbCommand): Promise<Result<void>> {
    // Step 1: DEFENSIVE AUTHORIZATION CHECK (Defense-in-Depth)
    // Controller sollte bereits pruefen, aber wir pruefen nochmals
    if (command.userRole !== 'ADMIN' && command.userRole !== 'SUPER_ADMIN') {
      this.logger.warn('Unauthorized lock attempt', {
        userRole: command.userRole,
        timestamp: new Date().toISOString(),
      });
      throw new ForbiddenException('Nur Administratoren können ETB sperren');
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
      throw new NotFoundException('ETB nicht gefunden');
    }

    // Step 5: Delegate to domain method (validates business rules)
    const lockResult = aggregate.lock(userId);
    if (lockResult.isFailure) {
      // Domain-level validation failure (e.g., already locked)
      throw new BadRequestException(lockResult.error);
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

    // Step 7: Publish domain events (AFTER successful save)
    await this.eventPublisher.publishAll(aggregate.getDomainEvents());
    aggregate.clearDomainEvents();

    return Result.ok<void>(undefined);
  }
}
