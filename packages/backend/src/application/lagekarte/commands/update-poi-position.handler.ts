import { Injectable, Logger, Inject } from '@nestjs/common';
import { Result } from '@domain/common/result';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { PoiId } from '@domain/value-objects/poi-id';
import { UserId } from '@domain/value-objects/user-id';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
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
 * Security: Sanitized error messages prevent ID disclosure to API consumers,
 * while server-side logging preserves full diagnostic context for debugging.
 * This prevents OWASP A01:2021 (Broken Access Control) information leakage.
 *
 * Nach erfolgreichem Save werden Domain Events via IEventPublisher publiziert
 * (transaktionale Konsistenz: Events nur nach erfolgreicher Persistenz).
 */
@Injectable()
export class UpdatePoiPositionCommandHandler {
  private readonly logger = new Logger(UpdatePoiPositionCommandHandler.name);

  constructor(
    @Inject('ILagekarteRepository')
    private readonly lagekarteRepository: ILagekarteRepository,
    @Inject('IEventPublisher')
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(command: UpdatePoiPositionCommand): Promise<Result<void>> {
    // Step 1: Validate LagekarteId
    const lagekarteIdResult = LagekarteId.create(command.lagekarteId);
    if (lagekarteIdResult.isFailure) {
      return Result.fail(lagekarteIdResult.error ?? 'Invalid Lagekarte ID');
    }
    const lagekarteId = lagekarteIdResult.value;
    if (!lagekarteId) {
      this.logger.error('Unexpected null LagekarteId after successful validation', {
        command: command.constructor.name,
      });
      return Result.fail('Invalid Lagekarte ID result');
    }

    // Step 2: Validate PoiId
    const poiIdResult = PoiId.create(command.poiId);
    if (poiIdResult.isFailure) {
      return Result.fail(poiIdResult.error ?? 'Invalid POI ID');
    }
    const poiId = poiIdResult.value;
    if (!poiId) {
      this.logger.error('Unexpected null PoiId after successful validation', {
        command: command.constructor.name,
      });
      return Result.fail('Invalid POI ID result');
    }

    // Step 3: Load aggregate
    const aggregate = await this.lagekarteRepository.findById(lagekarteId);
    if (!aggregate) {
      // Server-side logging with full diagnostic context
      this.logger.warn('Lagekarte not found during POI position update', {
        lagekarteId: lagekarteId.value,
        timestamp: new Date().toISOString(),
      });

      // User-facing sanitized message (NO internal IDs)
      return Result.fail('Lagekarte not found');
    }

    // Step 4: Convert coordinate to MGRS
    const mgrsResult = CoordinateConverter.toMgrs(command.newCoordinate);
    if (mgrsResult.isFailure) {
      return Result.fail(mgrsResult.error ?? 'Invalid coordinate format');
    }
    const mgrsCoordinate = mgrsResult.value;
    if (!mgrsCoordinate) {
      this.logger.error('Unexpected null MGRS coordinate after successful conversion', {
        command: command.constructor.name,
      });
      return Result.fail('Invalid coordinate conversion result');
    }

    // Step 5: Get UserId (auto-generate until auth implemented)
    // TODO: Replace with actual authenticated user ID when auth is implemented
    const userIdResult = UserId.create();
    if (userIdResult.isFailure) {
      return Result.fail(userIdResult.error ?? 'Failed to generate User ID');
    }

    const userId = userIdResult.value;
    if (!userId) {
      this.logger.error('Unexpected null UserId after successful creation', {
        command: command.constructor.name,
      });
      return Result.fail('Invalid User ID result');
    }

    // Step 6: Update POI position (business logic delegation)
    const updateResult = aggregate.updatePoiPosition(poiId, mgrsCoordinate, userId);
    if (updateResult.isFailure) {
      return Result.fail(updateResult.error ?? 'Failed to update POI position');
    }

    // Step 7: Save
    try {
      await this.lagekarteRepository.save(aggregate);
    } catch (error) {
      return Result.fail(`Failed to save Lagekarte: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Step 8: Publish domain events (AFTER successful save - transactional consistency)
    await this.eventPublisher.publishAll(aggregate.getDomainEvents());
    aggregate.clearDomainEvents();

    return Result.ok(undefined);
  }
}
