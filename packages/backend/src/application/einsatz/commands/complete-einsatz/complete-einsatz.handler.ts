import { Result } from '@domain/common/result';
// biome-ignore lint/correctness/noUnusedImports: Required for DI at runtime
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import { EinsatzCompletenessService } from '@domain/services/einsatz-completeness.service';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CompleteEinsatzCommand } from './complete-einsatz.command';

/**
 * Handler für CompleteEinsatzCommand.
 *
 * Orchestriert das Abschließen eines Einsatzes:
 * 1. Validiert EinsatzId und UserId Format
 * 2. Lädt Aggregate via Repository
 * 3. Validiert Vollständigkeit via EinsatzCompletenessService
 * 4. Ruft aggregate.complete(userId) auf
 * 5. Speichert Aggregate über Repository
 * 6. Publiziert Domain Events
 *
 * **Business Rules (vom Aggregate/Service enforced):**
 * - Status muss IN_BEARBEITUNG sein
 * - Alarmstichwort muss gesetzt sein
 * - Einsatzort muss gesetzt sein (optional, konfigurierbar)
 * - Setzt abgeschlossenAt Timestamp
 *
 * **Event Flow:**
 * - EinsatzCompletedEvent wird nach erfolgreicher Speicherung publiziert
 * - EinsatzStatusChangedEvent wird ebenfalls publiziert
 */
@Injectable()
export class CompleteEinsatzHandler {
  private readonly logger = new Logger(CompleteEinsatzHandler.name);

  constructor(
    @Inject('IEinsatzRepository')
    private readonly einsatzRepository: IEinsatzRepository,
    @Inject('IEventPublisher')
    private readonly eventPublisher: IEventPublisher,
    @Inject(EinsatzCompletenessService)
    private readonly completenessService: EinsatzCompletenessService,
  ) {}

  /**
   * Führt den CompleteEinsatzCommand aus.
   *
   * @param command - Validierter CompleteEinsatzCommand
   * @returns Result<void> - Success oder Failure mit Error
   */
  async execute(command: CompleteEinsatzCommand): Promise<Result<void>> {
    // Step 1: Validate EinsatzId format
    const einsatzIdResult = EinsatzId.create(command.einsatzId);
    if (einsatzIdResult.isFailure) {
      return Result.fail<void>(einsatzIdResult.error ?? 'Ungültige Einsatz-ID');
    }
    const einsatzId = einsatzIdResult.value;
    if (!einsatzId) {
      this.logger.error('Unexpected null EinsatzId after successful validation');
      return Result.fail<void>('Ungültige Einsatz-ID');
    }

    // Step 2: Validate UserId format
    const userIdResult = UserId.create(command.completedBy);
    if (userIdResult.isFailure) {
      return Result.fail<void>(userIdResult.error ?? 'Ungültige User-ID');
    }
    const userId = userIdResult.value;
    if (!userId) {
      this.logger.error('Unexpected null UserId after successful validation');
      return Result.fail<void>('Ungültige User-ID');
    }

    // Step 3: Load Aggregate via Repository
    const findResult = await this.einsatzRepository.findById(einsatzId);
    if (findResult.isFailure) {
      this.logger.error('Failed to load Einsatz', { error: findResult.error, einsatzId: command.einsatzId });
      return Result.fail<void>(findResult.error ?? 'Einsatz konnte nicht geladen werden');
    }

    const einsatz = findResult.value;
    if (!einsatz) {
      return Result.fail<void>('Einsatz nicht gefunden');
    }

    // Step 4: Validate Completeness via Domain Service
    // requireOrt = false weil Einsatzort optional ist
    const completenessResult = this.completenessService.canBeCompleted(einsatz, false);
    if (completenessResult.isFailure) {
      this.logger.warn('Einsatz cannot be completed', {
        einsatzId: command.einsatzId,
        reason: completenessResult.error,
      });
      return Result.fail<void>(completenessResult.error ?? 'Einsatz kann nicht abgeschlossen werden');
    }

    // Step 5: Call aggregate.complete()
    const completeResult = einsatz.complete(userId);
    if (completeResult.isFailure) {
      this.logger.warn('Einsatz complete failed', {
        einsatzId: command.einsatzId,
        error: completeResult.error,
      });
      return Result.fail<void>(completeResult.error ?? 'Einsatz konnte nicht abgeschlossen werden');
    }

    // Step 6: Save Aggregate via Repository
    const saveResult = await this.einsatzRepository.save(einsatz);
    if (saveResult.isFailure) {
      this.logger.error('Failed to save Einsatz', {
        error: saveResult.error,
        einsatzId: command.einsatzId,
      });
      return Result.fail<void>(saveResult.error ?? 'Einsatz konnte nicht gespeichert werden');
    }

    // Step 7: Publish Domain Events (AFTER successful save)
    await this.eventPublisher.publishAll(einsatz.getDomainEvents());
    einsatz.clearDomainEvents();

    this.logger.log('Einsatz completed successfully', {
      einsatzId: command.einsatzId,
      completedBy: command.completedBy,
    });

    return Result.ok(undefined);
  }
}
