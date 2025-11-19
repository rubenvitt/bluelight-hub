import { Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { PoiCategory } from '@domain/value-objects/poi-category';
import type { PoiId } from '@domain/value-objects/poi-id';
import { UserId } from '@domain/value-objects/user-id';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import { CoordinateConverter } from '@application/common/coordinate-converter';
import type { AddPoiCommand } from './add-poi.command';

/**
 * Handler für AddPoiCommand.
 *
 * Orchestriert das Hinzufügen eines POI zu einer bestehenden Lagekarte.
 * Validiert Lagekarte-Existenz, konvertiert Koordinaten via CoordinateConverter,
 * delegiert Business-Logic an LagekarteAggregate.
 *
 * TODO (Epic 2.7): Event Publishing via IEventPublisher nach save() hinzufügen.
 */
@Injectable()
export class AddPoiCommandHandler {
  constructor(private readonly lagekarteRepository: ILagekarteRepository) {}

  async execute(command: AddPoiCommand): Promise<Result<PoiId>> {
    // Step 1: Validate LagekarteId
    const lagekarteIdResult = LagekarteId.create(command.lagekarteId);
    if (lagekarteIdResult.isFailure) {
      return Result.fail<PoiId>(lagekarteIdResult.error!);
    }
    const lagekarteId = lagekarteIdResult.value!;

    // Step 2: Load aggregate
    const aggregate = await this.lagekarteRepository.findById(lagekarteId);
    if (!aggregate) {
      return Result.fail<PoiId>(`Lagekarte with ID ${lagekarteId.value} not found`);
    }

    // Step 3: Convert coordinate to MGRS
    const mgrsResult = CoordinateConverter.toMgrs(command.coordinate);
    if (mgrsResult.isFailure) {
      return Result.fail<PoiId>(mgrsResult.error);
    }
    const mgrsCoordinate = mgrsResult.value;

    // Step 4: Create PoiCategory
    const categoryResult = PoiCategory.create(command.category);
    if (categoryResult.isFailure) {
      return Result.fail<PoiId>(`Invalid POI category: ${categoryResult.error}`);
    }

    // Step 5: Get UserId (auto-generate until auth implemented)
    // TODO: Replace with actual authenticated user ID when auth is implemented
    const userIdResult = UserId.create();
    if (userIdResult.isFailure) {
      return Result.fail<PoiId>(userIdResult.error!);
    }

    // Step 6: Add POI to aggregate (business logic delegation)
    const addPoiResult = aggregate.addPoi(command.name, mgrsCoordinate, categoryResult.value!, userIdResult.value!, command.beschreibung);
    if (addPoiResult.isFailure) {
      return Result.fail<PoiId>(addPoiResult.error!);
    }
    const poi = addPoiResult.value!;

    // Step 7: Save aggregate
    try {
      await this.lagekarteRepository.save(aggregate);
    } catch (error) {
      return Result.fail<PoiId>(`Failed to save Lagekarte: ${error instanceof Error ? error.message : String(error)}`);
    }

    // TODO (Epic 2.7): Publish domain events
    // await this.eventPublisher.publishAll(aggregate.getDomainEvents());
    // aggregate.clearDomainEvents();

    return Result.ok(poi.id);
  }
}
