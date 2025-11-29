import { Result } from '@domain/common/result';
// biome-ignore lint/correctness/noUnusedImports: Required for DI at runtime
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { UpdateEinsatzCommand } from './update-einsatz.command';

/**
 * Handler für UpdateEinsatzCommand.
 *
 * Orchestriert das Aktualisieren eines existierenden Einsatzes:
 * 1. Validiert EinsatzId Format
 * 2. Lädt Aggregate via Repository
 * 3. Delegiert Update an Aggregate (Business Rules)
 * 4. Speichert Aggregate
 * 5. Publiziert Domain Events
 *
 * **Business Rules (vom Aggregate enforced):**
 * - Archivierte Einsätze können nicht geändert werden
 * - Partial Update: Nur übergebene Felder werden aktualisiert
 * - Alarmstichwort darf nicht leer sein
 *
 * **Event Flow:**
 * - EinsatzUpdatedEvent wird nach erfolgreicher Speicherung publiziert
 * - Event enthält nur geänderte Felder (Delta Pattern)
 */
@Injectable()
export class UpdateEinsatzHandler {
  private readonly logger = new Logger(UpdateEinsatzHandler.name);

  constructor(
    @Inject('IEinsatzRepository')
    private readonly einsatzRepository: IEinsatzRepository,
    @Inject('IEventPublisher')
    private readonly eventPublisher: IEventPublisher,
  ) {}

  /**
   * Führt den UpdateEinsatzCommand aus.
   *
   * @param command - Validierter UpdateEinsatzCommand
   * @returns Result<void> - Success oder Failure mit Error
   */
  async execute(command: UpdateEinsatzCommand): Promise<Result<void>> {
    // Step 1: Validate EinsatzId format
    const einsatzIdResult = EinsatzId.create(command.einsatzId);
    if (einsatzIdResult.isFailure) {
      return Result.fail<void>(einsatzIdResult.error ?? 'Ungültige Einsatz-ID');
    }
    const einsatzId = einsatzIdResult.value;
    // Defensive Programming: TypeScript kann Result<T>.value nicht automatisch als non-null
    // narrowen nach isSuccess-Prüfung, da das Type-System diese Garantie nicht ausdrücken kann.
    // Dieser Check schützt vor Runtime-Fehlern falls das Result-Pattern inkorrekt implementiert
    // wird oder Type-Assertions fehlerhaft sind.
    if (!einsatzId) {
      this.logger.error('Unexpected null EinsatzId after successful validation');
      return Result.fail<void>('Ungültige Einsatz-ID');
    }

    // Step 2: Load Aggregate via Repository
    const findResult = await this.einsatzRepository.findById(einsatzId);
    if (findResult.isFailure) {
      this.logger.error('Failed to load Einsatz', {
        error: findResult.error,
        einsatzId: command.einsatzId,
      });
      return Result.fail<void>(findResult.error ?? 'Einsatz konnte nicht geladen werden');
    }

    const einsatz = findResult.value;
    if (!einsatz) {
      this.logger.warn('Einsatz not found', { einsatzId: command.einsatzId });
      return Result.fail<void>('Einsatz not found');
    }

    // Step 3: Delegate to Aggregate (Business Rules enforced there)
    const updateResult = einsatz.update({
      alarmstichwort: command.alarmstichwort,
      einsatzort: command.einsatzort,
      bemerkung: command.bemerkung,
    });

    if (updateResult.isFailure) {
      this.logger.warn('Einsatz update failed', {
        error: updateResult.error,
        einsatzId: command.einsatzId,
      });
      return Result.fail<void>(updateResult.error ?? 'Einsatz konnte nicht aktualisiert werden');
    }

    // Step 4: Save Aggregate
    const saveResult = await this.einsatzRepository.save(einsatz);
    if (saveResult.isFailure) {
      this.logger.error('Failed to save updated Einsatz', {
        error: saveResult.error,
        einsatzId: command.einsatzId,
      });
      return Result.fail<void>(saveResult.error ?? 'Einsatz konnte nicht gespeichert werden');
    }

    // Step 5: Publish Domain Events (AFTER successful save)
    await this.eventPublisher.publishAll(einsatz.getDomainEvents());
    einsatz.clearDomainEvents();

    this.logger.log('Einsatz updated successfully', {
      einsatzId: command.einsatzId,
    });

    return Result.ok<void>(undefined);
  }
}
