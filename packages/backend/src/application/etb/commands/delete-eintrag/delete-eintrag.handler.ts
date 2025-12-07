import { Inject, Injectable, Logger } from '@nestjs/common';
import { Result } from '@domain/common/result';
import { EtbId } from '@domain/value-objects/etb-id';
import { EintragId } from '@domain/value-objects/eintrag-id';
import { UserId } from '@domain/value-objects/user-id';
import type { IEtbRepository } from '@domain/repositories';
import type { DeleteEintragCommand } from './delete-eintrag.command';
import { ETB_REPOSITORY } from '@infrastructure/di-tokens';

/**
 * Handler für DeleteEintragCommand.
 *
 * Orchestriert das Soft-Delete eines Eintrags aus dem Einsatztagebuch.
 * Lädt das ETB-Aggregate, delegiert Business-Logic an das Aggregate,
 * und publiziert Events nach erfolgreichem Save.
 *
 * **Soft-Delete Pattern (DRK-Compliance):**
 * Der Eintrag wird NICHT physisch entfernt, sondern mit `isDeleted=true`
 * markiert. Das Aggregate erstellt automatisch einen Snapshot VOR der Mutation.
 * Dies ermöglicht:
 * - Vollständigen Audit-Trail
 * - Rollback-Fähigkeit
 * - Revisionssichere Historie
 * - Forensische Nachvollziehbarkeit
 *
 * **Sequence Number Integrität:**
 * Durch Soft-Delete bleiben alle Sequenznummern erhalten. Es entstehen
 * keine Lücken in der Historie.
 *
 * Security: Sanitized error messages prevent ID disclosure to API consumers.
 */
@Injectable()
export class DeleteEintragHandler {
  private readonly logger = new Logger(DeleteEintragHandler.name);

  constructor(
    @Inject(ETB_REPOSITORY)
    private readonly etbRepository: IEtbRepository,
  ) {}

  async execute(command: DeleteEintragCommand): Promise<Result<void>> {
    // Step 1: Validate EtbId format
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

    // Step 2: Validate EintragId format
    const eintragIdResult = EintragId.create(command.eintragId);
    if (eintragIdResult.isFailure) {
      return Result.fail<void>(eintragIdResult.error ?? 'Invalid Eintrag ID');
    }
    const eintragId = eintragIdResult.value;
    if (!eintragId) {
      this.logger.error('Unexpected null EintragId after successful validation', {
        command: command.constructor.name,
      });
      return Result.fail<void>('Invalid Eintrag ID result');
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
      // Server-side logging with full diagnostic context
      this.logger.warn('ETB not found during DeleteEintrag', {
        etbId: etbId.value,
        eintragId: eintragId.value,
        timestamp: new Date().toISOString(),
      });

      // User-facing sanitized message (NO internal IDs)
      return Result.fail<void>('ETB nicht gefunden');
    }

    // Step 5: Delegate to domain method (validates business rules, creates snapshot)
    // Business rules checked by aggregate:
    // - ETB must not be locked (status !== LOCKED)
    // - Entry must exist in the ETB
    // Aggregate also:
    // - Creates snapshot BEFORE mutation (DRK-Compliance)
    // - Marks entry as deleted (isDeleted=true) - SOFT-DELETE
    // - Increments version
    // - Creates EintragDeletedEvent
    const deleteResult = aggregate.deleteEintrag(eintragId, userId);
    if (deleteResult.isFailure) {
      // Domain-level validation failure
      return Result.fail<void>(deleteResult.error ?? 'Eintrag konnte nicht gelöscht werden');
    }

    // Step 6: Save aggregate (repository handles snapshot persistence)
    try {
      await this.etbRepository.save(aggregate);
    } catch (error) {
      this.logger.error('Failed to save ETB after deleting entry', {
        error: error instanceof Error ? error.message : String(error),
        etbId: command.etbId,
        eintragId: command.eintragId,
        userId: command.userId,
      });
      return Result.fail<void>('Eintrag konnte nicht gelöscht werden');
    }

    // Domain Events werden automatisch in Outbox persistiert (Story 4-4: Transactional Outbox Pattern)
    // Repository.save() → Outbox → Polling Worker → Event Handler

    return Result.ok<void>(undefined);
  }
}
