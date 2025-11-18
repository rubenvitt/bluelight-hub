import { Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { Poi } from '@domain/entities/poi.entity';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { UserId } from '@domain/value-objects/user-id';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import type { CreateLagekarteCommand } from './create-lagekarte.command';

/**
 * Handler für CreateLagekarteCommand.
 *
 * Orchestriert die Erstellung einer Lagekarte über das Domain-Aggregate.
 * Validiert Einsatz-Existenz, konvertiert Koordinaten, delegiert Business-Logic
 * an LagekarteAggregate.
 *
 * Warum Koordinaten-Konversion hier: Application Layer ist zuständig für
 * Format-Transformation (Lat/Lng → MGRS). Domain Layer arbeitet ausschließlich
 * mit MGRS (DRK-Standard).
 *
 * TODO (Epic 2.7): Event Publishing via IEventPublisher nach save() hinzufügen.
 */
@Injectable()
export class CreateLagekarteCommandHandler {
  constructor(
    private readonly einsatzRepository: IEinsatzRepository,
    private readonly lagekarteRepository: ILagekarteRepository,
  ) {}

  async execute(command: CreateLagekarteCommand): Promise<Result<LagekarteId>> {
    // Step 1: Validate EinsatzId
    const einsatzIdResult = EinsatzId.create(command.einsatzId);
    if (einsatzIdResult.isFailure) {
      return Result.fail<LagekarteId>(einsatzIdResult.error!);
    }
    const einsatzId = einsatzIdResult.value!;

    // Step 2: Check Einsatz exists
    const einsatzExistsResult = await this.einsatzRepository.exists(einsatzId);
    if (einsatzExistsResult.isFailure) {
      return Result.fail<LagekarteId>(einsatzExistsResult.error!);
    }
    if (!einsatzExistsResult.value) {
      return Result.fail<LagekarteId>(`Einsatz with ID ${einsatzId.value} not found`);
    }

    // Step 3: Check Lagekarte doesn't already exist
    const existingLagekarte = await this.lagekarteRepository.findByEinsatzId(einsatzId);
    if (existingLagekarte !== null) {
      return Result.fail<LagekarteId>(`Lagekarte already exists for Einsatz ${einsatzId.value}`);
    }

    // Step 4: Create Poi entity if initialPoi provided
    let initialPoi: Poi | undefined;
    if (command.initialPoi) {
      // Convert coordinate to MGRS
      let mgrsCoordinate: MgrsCoordinate;
      if ('mgrs' in command.initialPoi.coordinate) {
        const mgrsResult = MgrsCoordinate.fromString(command.initialPoi.coordinate.mgrs);
        if (mgrsResult.isFailure) {
          return Result.fail<LagekarteId>(`Invalid MGRS coordinate: ${mgrsResult.error}`);
        }
        mgrsCoordinate = mgrsResult.value!;
      } else {
        const mgrsResult = MgrsCoordinate.fromLatLng(command.initialPoi.coordinate.lat, command.initialPoi.coordinate.lng);
        if (mgrsResult.isFailure) {
          return Result.fail<LagekarteId>(`Invalid Lat/Lng coordinate: ${mgrsResult.error}`);
        }
        mgrsCoordinate = mgrsResult.value!;
      }

      // Create PoiCategory
      const categoryResult = PoiCategory.create(command.initialPoi.category);
      if (categoryResult.isFailure) {
        return Result.fail<LagekarteId>(`Invalid POI category: ${categoryResult.error}`);
      }

      // Placeholder UserId until auth implemented (auto-generate for now)
      // TODO: Replace with actual authenticated user ID when auth is implemented
      const userIdResult = UserId.create();
      if (userIdResult.isFailure) {
        return Result.fail<LagekarteId>(userIdResult.error!);
      }

      // Create Poi entity using factory method
      initialPoi = Poi.create(command.initialPoi.name, mgrsCoordinate, categoryResult.value!, userIdResult.value!);
    }

    // Step 5: Create aggregate
    const aggregateResult = LagekarteAggregate.create(einsatzId, initialPoi);
    if (aggregateResult.isFailure) {
      return Result.fail<LagekarteId>(aggregateResult.error!);
    }
    const aggregate = aggregateResult.value!;

    // Step 6: Save
    try {
      await this.lagekarteRepository.save(aggregate);
    } catch (error) {
      return Result.fail<LagekarteId>(`Failed to save Lagekarte: ${error instanceof Error ? error.message : String(error)}`);
    }

    // TODO (Epic 2.7): Publish domain events
    // await this.eventPublisher.publishAll(aggregate.getDomainEvents());
    // aggregate.clearDomainEvents();

    return Result.ok(aggregate.id);
  }
}
