import { Injectable, Logger } from '@nestjs/common';
import { Result } from '@domain/common/result';
import { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { Poi } from '@domain/entities/poi.entity';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { UserId } from '@domain/value-objects/user-id';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import { CoordinateConverter } from '@application/common/coordinate-converter';
import type { CreateLagekarteCommand } from './create-lagekarte.command';

/**
 * Handler für CreateLagekarteCommand.
 *
 * Orchestriert die Erstellung einer Lagekarte über das Domain-Aggregate.
 * Validiert Einsatz-Existenz, konvertiert Koordinaten via CoordinateConverter,
 * delegiert Business-Logic an LagekarteAggregate.
 *
 * Security: Sanitized error messages prevent ID disclosure to API consumers,
 * while server-side logging preserves full diagnostic context for debugging.
 * This prevents OWASP A01:2021 (Broken Access Control) information leakage.
 *
 * TODO (Epic 2.7): Event Publishing via IEventPublisher nach save() hinzufügen.
 */
@Injectable()
export class CreateLagekarteCommandHandler {
  private readonly logger = new Logger(CreateLagekarteCommandHandler.name);

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
      // Server-side logging with full diagnostic context
      this.logger.warn('Einsatz not found during Lagekarte creation', {
        einsatzId: einsatzId.value,
        timestamp: new Date().toISOString(),
      });

      // User-facing sanitized message (NO internal IDs)
      return Result.fail<LagekarteId>('Einsatz not found');
    }

    // Step 3: Check Lagekarte doesn't already exist
    const existingLagekarte = await this.lagekarteRepository.findByEinsatzId(einsatzId);
    if (existingLagekarte !== null) {
      // Server-side logging with full diagnostic context
      this.logger.warn('Attempted to create duplicate Lagekarte', {
        einsatzId: einsatzId.value,
        existingLagekarteId: existingLagekarte.id.value,
        timestamp: new Date().toISOString(),
      });

      // User-facing sanitized message (NO internal IDs)
      return Result.fail<LagekarteId>('Lagekarte for this Einsatz already exists');
    }

    // Step 4: Create Poi entity if initialPoi provided
    let initialPoi: Poi | undefined;
    if (command.initialPoi) {
      // Convert coordinate to MGRS
      const mgrsResult = CoordinateConverter.toMgrs(command.initialPoi.coordinate);
      if (mgrsResult.isFailure) {
        return Result.fail<LagekarteId>(mgrsResult.error!);
      }
      const mgrsCoordinate = mgrsResult.value!;

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
