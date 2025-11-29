import { Result } from '@domain/common/result';
// biome-ignore lint/correctness/noUnusedImports: Required for DI at runtime
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import { UserId } from '@domain/value-objects/user-id';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CreateEinsatzCommand } from './create-einsatz.command';

/**
 * Handler für CreateEinsatzCommand.
 *
 * Orchestriert die Erstellung eines neuen Einsatzes:
 * 1. Validiert User-ID Format
 * 2. Erstellt EinsatzAggregate via Factory Method
 * 3. Speichert Aggregate über Repository
 * 4. Publiziert Domain Events
 *
 * **Business Rules (vom Aggregate enforced):**
 * - Alarmstichwort ist Pflichtfeld
 * - Initialer Status ist ANGELEGT
 * - Einsatznummer wird auto-generiert (E{YEAR}-{CUID-8})
 *
 * **Event Flow:**
 * - EinsatzCreatedEvent wird nach erfolgreicher Speicherung publiziert
 * - Event enthält einsatzId, nummer, alarmstichwort
 */
@Injectable()
export class CreateEinsatzHandler {
  private readonly logger = new Logger(CreateEinsatzHandler.name);

  constructor(
    @Inject('IEinsatzRepository')
    private readonly einsatzRepository: IEinsatzRepository,
    @Inject('IEventPublisher')
    private readonly eventPublisher: IEventPublisher,
  ) {}

  /**
   * Führt den CreateEinsatzCommand aus.
   *
   * @param command - Validierter CreateEinsatzCommand
   * @returns Result<EinsatzId> - Success mit EinsatzId oder Failure mit Error
   */
  async execute(command: CreateEinsatzCommand): Promise<Result<EinsatzId>> {
    // Step 1: Validate UserId format
    const userIdResult = UserId.create(command.createdBy);
    if (userIdResult.isFailure) {
      return Result.fail<EinsatzId>(userIdResult.error ?? 'Ungültige User-ID');
    }
    const userId = userIdResult.value;
    // Defensive Programming: TypeScript kann Result<T>.value nicht automatisch als non-null
    // narrowen nach isSuccess-Prüfung, da das Type-System diese Garantie nicht ausdrücken kann.
    // Dieser Check schützt vor Runtime-Fehlern falls das Result-Pattern inkorrekt implementiert
    // wird oder Type-Assertions fehlerhaft sind.
    if (!userId) {
      this.logger.error('Unexpected null UserId after successful validation');
      return Result.fail<EinsatzId>('Ungültige User-ID');
    }

    // Step 2: Create Aggregate via Factory Method
    // Business Rules werden vom Aggregate enforced (alarmstichwort required, status = ANGELEGT)
    const aggregateResult = Einsatz.create({
      alarmstichwort: command.alarmstichwort,
      createdBy: userId,
      einsatzort: command.einsatzort,
      bemerkung: command.bemerkung,
    });

    if (aggregateResult.isFailure) {
      this.logger.warn('Einsatz creation failed', {
        error: aggregateResult.error,
        alarmstichwort: command.alarmstichwort,
      });
      return Result.fail<EinsatzId>(aggregateResult.error ?? 'Einsatz konnte nicht erstellt werden');
    }

    const einsatz = aggregateResult.value;
    if (!einsatz) {
      this.logger.error('Unexpected null Einsatz after successful creation');
      return Result.fail<EinsatzId>('Einsatz konnte nicht erstellt werden');
    }

    // Step 3: Save Aggregate via Repository
    const saveResult = await this.einsatzRepository.save(einsatz);
    if (saveResult.isFailure) {
      this.logger.error('Failed to save Einsatz', {
        error: saveResult.error,
        einsatzId: einsatz.id.value,
      });
      return Result.fail<EinsatzId>(saveResult.error ?? 'Einsatz konnte nicht gespeichert werden');
    }

    // Step 4: Publish Domain Events (AFTER successful save - transactional consistency)
    // EinsatzCreatedEvent was added by Einsatz.create()
    await this.eventPublisher.publishAll(einsatz.getDomainEvents());
    einsatz.clearDomainEvents();

    this.logger.log('Einsatz created successfully', {
      einsatzId: einsatz.id.value,
      nummer: einsatz.nummer,
      alarmstichwort: einsatz.alarmstichwort,
    });

    return Result.ok(einsatz.id);
  }
}
