import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Result } from '@domain/common/result';
import { EtbId } from '@domain/value-objects/etb-id';
import { EintragId } from '@domain/value-objects/eintrag-id';
import { UserId } from '@domain/value-objects/user-id';
import type { IEtbRepository } from '@domain/repositories/i-etb.repository';
import type { UpdateEintragCommand } from './update-eintrag.command';

/**
 * Handler für UpdateEintragCommand.
 *
 * Orchestriert das Aktualisieren eines bestehenden Eintrags im Einsatztagebuch.
 * Lädt das ETB-Aggregate, delegiert Business-Logic an das Aggregate,
 * und publiziert Events nach erfolgreichem Save.
 *
 * **Versioning Pattern (DRK-Compliance):**
 * Das Aggregate erstellt automatisch einen Snapshot VOR der Mutation.
 * Dies ermöglicht vollständigen Audit-Trail und Rollback-Fähigkeit.
 *
 * **Change Tracking:**
 * Der alte Text wird automatisch vom Aggregate erfasst und im
 * EintragUpdatedEvent gespeichert (für Diff-Generierung und Audit).
 *
 * Security: Sanitized error messages prevent ID disclosure to API consumers.
 */
@Injectable()
export class UpdateEintragHandler {
  private readonly logger = new Logger(UpdateEintragHandler.name);

  constructor(
    @Inject('IEtbRepository')
    private readonly etbRepository: IEtbRepository,
  ) {}

  async execute(command: UpdateEintragCommand): Promise<Result<void>> {
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
      this.logger.warn('ETB not found during UpdateEintrag', {
        etbId: etbId.value,
        timestamp: new Date().toISOString(),
      });

      // User-facing sanitized message (NO internal IDs)
      throw new NotFoundException('ETB nicht gefunden');
    }

    // Step 5: Delegate to domain method (validates business rules, creates snapshot)
    // Business rules checked by aggregate:
    // - ETB must not be locked (status !== LOCKED)
    // - Text must not be empty
    // - Eintrag must exist
    // - Eintrag must not be deleted (soft-delete check)
    // Aggregate also:
    // - Creates snapshot BEFORE mutation (DRK-Compliance)
    // - Captures oldText for change tracking
    // - Creates EintragUpdatedEvent with old + new text
    const updateResult = aggregate.updateEintrag(eintragId, command.newText, userId);
    if (updateResult.isFailure) {
      // Domain-level validation failure
      throw new BadRequestException(updateResult.error);
    }

    // Step 6: Save aggregate (repository handles snapshot persistence)
    try {
      await this.etbRepository.save(aggregate);
    } catch (error) {
      this.logger.error('Failed to save ETB after updating entry', {
        error: error instanceof Error ? error.message : String(error),
        etbId: command.etbId,
        eintragId: command.eintragId,
        userId: command.userId,
      });
      return Result.fail<void>('Eintrag konnte nicht aktualisiert werden');
    }

    // Domain Events werden automatisch in Outbox persistiert (Story 4-4: Transactional Outbox Pattern)
    // Repository.save() → Outbox → Polling Worker → Event Handler

    return Result.ok<void>(undefined);
  }
}
