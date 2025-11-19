import { Injectable, Logger } from '@nestjs/common';
import { Result } from '@domain/common/result';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { PoiId } from '@domain/value-objects/poi-id';
import { UserId } from '@domain/value-objects/user-id';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import type { RemovePoiCommand } from './remove-poi.command';

/**
 * Handler für RemovePoiCommand.
 *
 * Orchestriert das Entfernen eines POI von einer bestehenden Lagekarte.
 * Validiert Lagekarte-Existenz, POI-Existenz, delegiert Business-Logic
 * an LagekarteAggregate.
 *
 * Warum void Return: Lösch-Operationen haben keinen Rückgabewert außer Erfolg/Fehler.
 * Result<void> signalisiert Operation ohne Ergebnis-Payload (analog zu HTTP 204 No Content).
 *
 * Security: Sanitized error messages prevent ID disclosure to API consumers,
 * while server-side logging preserves full diagnostic context for debugging.
 * This prevents OWASP A01:2021 (Broken Access Control) information leakage.
 *
 * TODO (Epic 2.7): Event Publishing via IEventPublisher nach save() hinzufügen.
 */
@Injectable()
export class RemovePoiCommandHandler {
  private readonly logger = new Logger(RemovePoiCommandHandler.name);

  constructor(private readonly lagekarteRepository: ILagekarteRepository) {}

  async execute(command: RemovePoiCommand): Promise<Result<void>> {
    // Step 1: Validate LagekarteId
    const lagekarteIdResult = LagekarteId.create(command.lagekarteId);
    if (lagekarteIdResult.isFailure) {
      return Result.fail(lagekarteIdResult.error!);
    }

    // Step 2: Validate PoiId
    const poiIdResult = PoiId.create(command.poiId);
    if (poiIdResult.isFailure) {
      return Result.fail(poiIdResult.error!);
    }

    // Step 3: Load aggregate
    const aggregate = await this.lagekarteRepository.findById(lagekarteIdResult.value!);
    if (!aggregate) {
      // Server-side logging with full diagnostic context
      this.logger.warn('Lagekarte not found during POI removal', {
        lagekarteId: lagekarteIdResult.value!.value,
        timestamp: new Date().toISOString(),
      });

      // User-facing sanitized message (NO internal IDs)
      return Result.fail('Lagekarte not found');
    }

    // Step 4: Get UserId (auto-generate until auth implemented)
    // TODO: Replace with actual authenticated user ID when auth is implemented
    const userIdResult = UserId.create();
    if (userIdResult.isFailure) {
      return Result.fail(userIdResult.error!);
    }

    // Step 5: Remove POI (business logic delegation)
    const removeResult = aggregate.removePoi(poiIdResult.value!, userIdResult.value!);
    if (removeResult.isFailure) {
      return Result.fail(removeResult.error!);
    }

    // Step 6: Save
    try {
      await this.lagekarteRepository.save(aggregate);
    } catch (error) {
      return Result.fail(`Failed to save Lagekarte: ${error instanceof Error ? error.message : String(error)}`);
    }

    // TODO (Epic 2.7): Publish domain events
    // await this.eventPublisher.publishAll(aggregate.getDomainEvents());
    // aggregate.clearDomainEvents();

    return Result.ok(undefined);
  }
}
