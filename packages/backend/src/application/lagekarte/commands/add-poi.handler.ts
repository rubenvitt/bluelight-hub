import { CoordinateConverter } from '@application/common/coordinate-converter';
import { Result } from '@domain/common/result';
// biome-ignore lint/correctness/noUnusedImports: Required for DI at runtime
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { PoiCategory } from '@domain/value-objects/poi-category';
import type { PoiId } from '@domain/value-objects/poi-id';
import { UserId } from '@domain/value-objects/user-id';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AddPoiCommand } from './add-poi.command';

/**
 * Handler für AddPoiCommand.
 *
 * Orchestriert das Hinzufügen eines POI zu einer bestehenden Lagekarte.
 * Validiert Lagekarte-Existenz, konvertiert Koordinaten via CoordinateConverter,
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
@CommandHandler(AddPoiCommand)
export class AddPoiCommandHandler implements ICommandHandler<AddPoiCommand, Result<PoiId>> {
  private readonly logger = new Logger(AddPoiCommandHandler.name);

  constructor(
    @Inject('ILagekarteRepository')
    private readonly lagekarteRepository: ILagekarteRepository,
    @Inject('IEventPublisher')
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(command: AddPoiCommand): Promise<Result<PoiId>> {
    // Step 1: Validate LagekarteId
    const lagekarteIdResult = LagekarteId.create(command.lagekarteId);
    if (lagekarteIdResult.isFailure) {
      return Result.fail<PoiId>(lagekarteIdResult.error ?? 'Invalid Lagekarte ID');
    }
    const lagekarteId = lagekarteIdResult.value;
    if (!lagekarteId) {
      this.logger.error('Unexpected null LagekarteId after successful validation', {
        command: command.constructor.name,
      });
      return Result.fail<PoiId>('Invalid Lagekarte ID result');
    }

    // Step 2: Load aggregate
    const aggregate = await this.lagekarteRepository.findById(lagekarteId);
    if (!aggregate) {
      // Server-side logging with full diagnostic context
      this.logger.warn('Lagekarte not found during POI addition', {
        lagekarteId: lagekarteId.value,
        timestamp: new Date().toISOString(),
      });

      // User-facing sanitized message (NO internal IDs)
      return Result.fail<PoiId>('Lagekarte not found');
    }

    // Step 3: Convert coordinate to MGRS
    const mgrsResult = CoordinateConverter.toMgrs(command.coordinate);
    if (mgrsResult.isFailure) {
      return Result.fail<PoiId>(mgrsResult.error ?? 'Invalid coordinate format');
    }
    const mgrsCoordinate = mgrsResult.value;
    if (!mgrsCoordinate) {
      this.logger.error('Unexpected null MGRS coordinate after successful conversion', {
        command: command.constructor.name,
      });
      return Result.fail<PoiId>('Invalid coordinate conversion result');
    }

    // Step 4: Create PoiCategory
    const categoryResult = PoiCategory.create(command.category);
    if (categoryResult.isFailure) {
      return Result.fail<PoiId>(`Invalid POI category: ${categoryResult.error}`);
    }

    // Step 5: Get UserId (auto-generate until auth implemented)
    // TODO: Replace with actual authenticated user ID when auth is implemented
    const userIdResult = UserId.create();
    if (userIdResult.isFailure) {
      return Result.fail<PoiId>(userIdResult.error ?? 'Failed to generate User ID');
    }

    const category = categoryResult.value;
    if (!category) {
      this.logger.error('Unexpected null POI category after successful validation', {
        command: command.constructor.name,
      });
      return Result.fail<PoiId>('Invalid POI category result');
    }

    const userId = userIdResult.value;
    if (!userId) {
      this.logger.error('Unexpected null UserId after successful creation', {
        command: command.constructor.name,
      });
      return Result.fail<PoiId>('Invalid User ID result');
    }

    // Step 6: Add POI to aggregate (business logic delegation)
    const addPoiResult = aggregate.addPoi(command.name, mgrsCoordinate, category, userId, command.beschreibung);
    if (addPoiResult.isFailure) {
      return Result.fail<PoiId>(addPoiResult.error ?? 'Failed to add POI to Lagekarte');
    }
    const poi = addPoiResult.value;
    if (!poi) {
      this.logger.error('Unexpected null POI after successful addition', {
        command: command.constructor.name,
      });
      return Result.fail<PoiId>('Invalid POI addition result');
    }

    // Step 7: Save aggregate
    try {
      await this.lagekarteRepository.save(aggregate);
    } catch (error) {
      return Result.fail<PoiId>(`Failed to save Lagekarte: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Step 8: Publish domain events
    // Transactional consistency: Events are published AFTER successful save
    const domainEvents = aggregate.getDomainEvents();
    if (domainEvents.length > 0) {
      await this.eventPublisher.publishAll(domainEvents);
      aggregate.clearDomainEvents();
    }

    return Result.ok(poi.id);
  }
}
