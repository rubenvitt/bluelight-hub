import { Injectable, Logger, Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Result } from '@domain/common/result';
import { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { Poi } from '@domain/entities/poi.entity';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { UserId } from '@domain/value-objects/user-id';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import { CoordinateConverter } from '@application/common/coordinate-converter';
import { CreateLagekarteCommand } from './create-lagekarte.command';

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
 * Nach erfolgreichem Save werden Domain Events via IEventPublisher publiziert
 * (transaktionale Konsistenz: Events nur nach erfolgreicher Persistenz).
 */
@Injectable()
@CommandHandler(CreateLagekarteCommand)
export class CreateLagekarteCommandHandler implements ICommandHandler<CreateLagekarteCommand, Result<LagekarteId>> {
  private readonly logger = new Logger(CreateLagekarteCommandHandler.name);

  constructor(
    @Inject('IEinsatzRepository')
    private readonly einsatzRepository: IEinsatzRepository,
    @Inject('ILagekarteRepository')
    private readonly lagekarteRepository: ILagekarteRepository,
    @Inject('IEventPublisher')
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(command: CreateLagekarteCommand): Promise<Result<LagekarteId>> {
    // Step 1: Validate EinsatzId
    const einsatzIdResult = EinsatzId.create(command.einsatzId);
    if (einsatzIdResult.isFailure) {
      return Result.fail<LagekarteId>(einsatzIdResult.error ?? 'Invalid Einsatz ID');
    }
    const einsatzId = einsatzIdResult.value;
    if (!einsatzId) {
      this.logger.error('Unexpected null EinsatzId after successful validation', {
        command: command.constructor.name,
      });
      return Result.fail<LagekarteId>('Invalid Einsatz ID result');
    }

    // Step 2: Check Einsatz exists
    const einsatzExistsResult = await this.einsatzRepository.exists(einsatzId);
    if (einsatzExistsResult.isFailure) {
      return Result.fail<LagekarteId>(einsatzExistsResult.error ?? 'Failed to verify Einsatz existence');
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

    // Step 4: Generate UserId for event (required for LagekarteCreatedEvent)
    // TODO: Replace with actual authenticated user ID when auth is implemented
    const userIdResult = UserId.create();
    if (userIdResult.isFailure) {
      return Result.fail<LagekarteId>(userIdResult.error ?? 'Failed to generate User ID');
    }
    const userId = userIdResult.value;
    if (!userId) {
      this.logger.error('Unexpected null UserId after successful creation', {
        command: command.constructor.name,
      });
      return Result.fail<LagekarteId>('Invalid User ID result');
    }

    // Step 5: Create Poi entity if initialPoi provided
    let initialPoi: Poi | undefined;
    if (command.initialPoi) {
      // Convert coordinate to MGRS
      const mgrsResult = CoordinateConverter.toMgrs(command.initialPoi.coordinate);
      if (mgrsResult.isFailure) {
        return Result.fail<LagekarteId>(mgrsResult.error ?? 'Invalid coordinate format');
      }
      const mgrsCoordinate = mgrsResult.value;
      if (!mgrsCoordinate) {
        this.logger.error('Unexpected null MGRS coordinate after successful conversion', {
          command: command.constructor.name,
        });
        return Result.fail<LagekarteId>('Invalid coordinate conversion result');
      }

      // Create PoiCategory
      const categoryResult = PoiCategory.create(command.initialPoi.category);
      if (categoryResult.isFailure) {
        return Result.fail<LagekarteId>(`Invalid POI category: ${categoryResult.error}`);
      }

      const category = categoryResult.value;
      if (!category) {
        this.logger.error('Unexpected null POI category after successful validation', {
          command: command.constructor.name,
        });
        return Result.fail<LagekarteId>('Invalid POI category result');
      }

      // Create Poi entity using factory method
      initialPoi = Poi.create(command.initialPoi.name, mgrsCoordinate, category, userId);
    }

    // Step 6: Create aggregate
    const aggregateResult = LagekarteAggregate.create(einsatzId, userId, initialPoi);
    if (aggregateResult.isFailure) {
      return Result.fail<LagekarteId>(aggregateResult.error ?? 'Failed to create Lagekarte aggregate');
    }
    const aggregate = aggregateResult.value;
    if (!aggregate) {
      this.logger.error('Unexpected null aggregate after successful creation', {
        command: command.constructor.name,
      });
      return Result.fail<LagekarteId>('Invalid Lagekarte aggregate result');
    }

    // Step 7: Save
    try {
      await this.lagekarteRepository.save(aggregate);
    } catch (error) {
      return Result.fail<LagekarteId>(`Failed to save Lagekarte: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Step 8: Publish domain events (AFTER successful save - transactional consistency)
    await this.eventPublisher.publishAll(aggregate.getDomainEvents());
    aggregate.clearDomainEvents();

    return Result.ok(aggregate.id);
  }
}
