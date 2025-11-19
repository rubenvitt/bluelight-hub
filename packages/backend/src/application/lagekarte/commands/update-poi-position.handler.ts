import { Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { PoiId } from '@domain/value-objects/poi-id';
import { UserId } from '@domain/value-objects/user-id';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import { CoordinateConverter } from '@application/common/coordinate-converter';
import type { UpdatePoiPositionCommand } from './update-poi-position.command';

/**
 * Handler für UpdatePoiPositionCommand.
 *
 * Orchestriert das Aktualisieren der POI-Position in einer bestehenden Lagekarte.
 * Validiert Lagekarte-Existenz, konvertiert Koordinaten via CoordinateConverter,
 * delegiert Business-Logic an LagekarteAggregate.
 *
 * Event-Carried State Transfer: Handler speichert alte + neue Position im Event,
 * damit Event-Handler Distanzen ohne zusätzliche DB-Queries berechnen können
 * (z.B. für Alarmierungsradius-Anpassungen bei >500m Positionsänderungen).
 *
 * TODO (Epic 2.7): Event Publishing via IEventPublisher nach save() hinzufügen.
 */
@Injectable()
export class UpdatePoiPositionCommandHandler {
  constructor(private readonly lagekarteRepository: ILagekarteRepository) {}

  async execute(command: UpdatePoiPositionCommand): Promise<Result<void>> {
    // Step 1: Validate LagekarteId
    const lagekarteIdResult = LagekarteId.create(command.lagekarteId);
    if (lagekarteIdResult.isFailure) {
      return Result.fail(lagekarteIdResult.error!);
    }
    const lagekarteId = lagekarteIdResult.value!;

    // Step 2: Validate PoiId
    const poiIdResult = PoiId.create(command.poiId);
    if (poiIdResult.isFailure) {
      return Result.fail(poiIdResult.error!);
    }
    const poiId = poiIdResult.value!;

    // Step 3: Load aggregate
    const aggregate = await this.lagekarteRepository.findById(lagekarteId);
    if (!aggregate) {
      return Result.fail(`Lagekarte with ID ${command.lagekarteId} not found`);
    }

    // Step 4: Convert coordinate to MGRS
    const mgrsResult = CoordinateConverter.toMgrs(command.newCoordinate);
    if (mgrsResult.isFailure) {
      return Result.fail(mgrsResult.error);
    }
    const mgrsCoordinate = mgrsResult.value;

    // Step 5: Get UserId (auto-generate until auth implemented)
    // TODO: Replace with actual authenticated user ID when auth is implemented
    const userIdResult = UserId.create();
    if (userIdResult.isFailure) {
      return Result.fail(userIdResult.error!);
    }

    // Step 6: Update POI position (business logic delegation)
    const updateResult = aggregate.updatePoiPosition(poiId, mgrsCoordinate, userIdResult.value!);
    if (updateResult.isFailure) {
      return Result.fail(updateResult.error!);
    }

    // Step 7: Save
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
