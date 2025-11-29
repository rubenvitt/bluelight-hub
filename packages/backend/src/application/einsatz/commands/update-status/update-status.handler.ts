import { Result } from '@domain/common/result';
// biome-ignore lint/correctness/noUnusedImports: Required for DI at runtime
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { UpdateEinsatzStatusCommand } from './update-status.command';

/**
 * Handler für UpdateEinsatzStatusCommand.
 *
 * Orchestriert die Status-Änderung eines Einsatzes (State Machine):
 * 1. Validiert EinsatzId Format
 * 2. Konvertiert newStatus String zu EinsatzStatus Value Object
 * 3. Lädt Aggregate via Repository
 * 4. Ruft aggregate.updateStatus(newStatus) auf
 * 5. Speichert Aggregate über Repository
 * 6. Publiziert Domain Events
 *
 * **Business Rules (vom Aggregate enforced):**
 * - Nur Vorwärts-Transitions erlaubt (ANGELEGT → IN_BEARBEITUNG → ABGESCHLOSSEN → ARCHIVIERT)
 * - Rückwärts-Transitions sind verboten
 * - Archivierte Einsätze können nicht geändert werden (immutable)
 *
 * **Event Flow:**
 * - EinsatzStatusChangedEvent wird nach erfolgreicher Speicherung publiziert
 */
@Injectable()
export class UpdateEinsatzStatusHandler {
  private readonly logger = new Logger(UpdateEinsatzStatusHandler.name);

  constructor(
    @Inject('IEinsatzRepository')
    private readonly einsatzRepository: IEinsatzRepository,
    @Inject('IEventPublisher')
    private readonly eventPublisher: IEventPublisher,
  ) {}

  /**
   * Führt den UpdateEinsatzStatusCommand aus.
   *
   * @param command - Validierter UpdateEinsatzStatusCommand
   * @returns Result<void> - Success oder Failure mit Error
   */
  async execute(command: UpdateEinsatzStatusCommand): Promise<Result<void>> {
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

    // Step 2: Convert newStatus String to EinsatzStatus Value Object
    const statusResult = EinsatzStatus.create(command.newStatus);
    if (statusResult.isFailure) {
      return Result.fail<void>(statusResult.error ?? `Ungültiger Status: ${command.newStatus}`);
    }
    const newStatus = statusResult.value;
    if (!newStatus) {
      this.logger.error('Unexpected null EinsatzStatus after successful validation');
      return Result.fail<void>(`Ungültiger Status: ${command.newStatus}`);
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

    // Step 4: Call aggregate.updateStatus() - State Machine Validation happens inside
    const updateResult = einsatz.updateStatus(newStatus);
    if (updateResult.isFailure) {
      this.logger.warn('Einsatz status update failed', {
        einsatzId: command.einsatzId,
        currentStatus: einsatz.status.value,
        newStatus: command.newStatus,
        error: updateResult.error,
      });
      return Result.fail<void>(updateResult.error ?? 'Status-Änderung fehlgeschlagen');
    }

    // Step 5: Save Aggregate via Repository
    const saveResult = await this.einsatzRepository.save(einsatz);
    if (saveResult.isFailure) {
      this.logger.error('Failed to save Einsatz', {
        error: saveResult.error,
        einsatzId: command.einsatzId,
      });
      return Result.fail<void>(saveResult.error ?? 'Einsatz konnte nicht gespeichert werden');
    }

    // Step 6: Publish Domain Events (AFTER successful save)
    await this.eventPublisher.publishAll(einsatz.getDomainEvents());
    einsatz.clearDomainEvents();

    this.logger.log('Einsatz status updated successfully', {
      einsatzId: command.einsatzId,
      newStatus: command.newStatus,
    });

    return Result.ok(undefined);
  }
}
