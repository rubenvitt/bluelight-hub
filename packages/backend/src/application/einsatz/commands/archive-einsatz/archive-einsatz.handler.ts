import { Result } from '@domain/common/result';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import type { EinsatzArchivalPolicy } from '@domain/services/einsatz-archival.policy';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ArchiveEinsatzCommand } from './archive-einsatz.command';

/**
 * Handler für ArchiveEinsatzCommand.
 *
 * Orchestriert das Archivieren eines Einsatzes (finale Transition):
 * 1. Validiert EinsatzId und UserId Format
 * 2. Lädt Aggregate via Repository
 * 3. Validiert 10-Jahres-Policy via EinsatzArchivalPolicy
 * 4. Ruft aggregate.archive(userId) auf
 * 5. Speichert Aggregate über Repository
 * 6. Publiziert Domain Events
 *
 * **Business Rules (vom Aggregate/Policy enforced):**
 * - Status muss ABGESCHLOSSEN sein
 * - abgeschlossenAt muss mindestens 10 Jahre alt sein (DRK-Compliance)
 * - Nach Archivierung ist Einsatz immutable
 *
 * **Event Flow:**
 * - EinsatzArchivedEvent wird nach erfolgreicher Speicherung publiziert
 * - EinsatzStatusChangedEvent wird ebenfalls publiziert
 */
@Injectable()
export class ArchiveEinsatzHandler {
  private readonly logger = new Logger(ArchiveEinsatzHandler.name);

  constructor(
    @Inject('IEinsatzRepository')
    private readonly einsatzRepository: IEinsatzRepository,
    @Inject('IEventPublisher')
    private readonly eventPublisher: IEventPublisher,
    private readonly archivalPolicy: EinsatzArchivalPolicy,
  ) {}

  /**
   * Führt den ArchiveEinsatzCommand aus.
   *
   * @param command - Validierter ArchiveEinsatzCommand
   * @returns Result<void> - Success oder Failure mit Error
   */
  async execute(command: ArchiveEinsatzCommand): Promise<Result<void>> {
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
    const userIdResult = UserId.create(command.archivedBy);
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

    // Step 4: Validate 10-Year Policy via Domain Policy
    const currentDate = new Date();
    if (!this.archivalPolicy.canBeArchived(einsatz, currentDate)) {
      // Determine reason for failure
      const status = einsatz.status.value;
      if (status !== 'ABGESCHLOSSEN') {
        return Result.fail<void>(`Einsatz kann nicht archiviert werden: Status muss ABGESCHLOSSEN sein (aktuell: ${status})`);
      }
      // Status is ABGESCHLOSSEN but 10-year period not reached
      return Result.fail<void>('Einsatz kann noch nicht archiviert werden: 10-Jahres-Aufbewahrungsfrist nicht abgelaufen');
    }

    // Step 5: Call aggregate.archive()
    const archiveResult = einsatz.archive(userId);
    if (archiveResult.isFailure) {
      this.logger.warn('Einsatz archive failed', {
        einsatzId: command.einsatzId,
        error: archiveResult.error,
      });
      return Result.fail<void>(archiveResult.error ?? 'Einsatz konnte nicht archiviert werden');
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

    this.logger.log('Einsatz archived successfully', {
      einsatzId: command.einsatzId,
      archivedBy: command.archivedBy,
    });

    return Result.ok(undefined);
  }
}
