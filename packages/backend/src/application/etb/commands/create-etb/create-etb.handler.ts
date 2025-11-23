import { Inject, Injectable, Logger } from '@nestjs/common';
import { Result } from '@domain/common/result';
import { EinsatztagebuchAggregate } from '@domain/aggregates/einsatztagebuch.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { EtbId } from '@domain/value-objects/etb-id';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import type { IEtbRepository } from '@domain/repositories/i-etb.repository';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import { EtbCreatedEvent } from '@domain/events/etb-created.event';
import type { CreateEtbCommand } from './create-etb.command';

/**
 * Handler für CreateEtbCommand.
 *
 * Orchestriert die Erstellung eines neuen Einsatztagebuchs (ETB).
 * Validiert Einsatz-Existenz, prüft auf Duplikate, und delegiert
 * Business-Logic an das EinsatztagebuchAggregate.
 *
 * Security: Sanitized error messages prevent ID disclosure to API consumers,
 * while server-side logging preserves full diagnostic context for debugging.
 * This prevents OWASP A01:2021 (Broken Access Control) information leakage.
 *
 * Nach erfolgreichem Save werden Domain Events via IEventPublisher publiziert
 * (transaktionale Konsistenz: Events nur nach erfolgreicher Persistenz).
 */
@Injectable()
export class CreateEtbHandler {
  private readonly logger = new Logger(CreateEtbHandler.name);

  constructor(
    @Inject('IEinsatzRepository')
    private readonly einsatzRepository: IEinsatzRepository,
    @Inject('IEtbRepository')
    private readonly etbRepository: IEtbRepository,
    @Inject('IEventPublisher')
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(command: CreateEtbCommand): Promise<Result<EtbId>> {
    // Step 1: Validate EinsatzId format
    const einsatzIdResult = EinsatzId.create(command.einsatzId);
    if (einsatzIdResult.isFailure) {
      return Result.fail<EtbId>(einsatzIdResult.error ?? 'Invalid Einsatz ID');
    }
    const einsatzId = einsatzIdResult.value;
    if (!einsatzId) {
      this.logger.error('Unexpected null EinsatzId after successful validation', {
        command: command.constructor.name,
      });
      return Result.fail<EtbId>('Invalid Einsatz ID result');
    }

    // Step 2: Check Einsatz exists
    const einsatzExistsResult = await this.einsatzRepository.exists(einsatzId);
    if (einsatzExistsResult.isFailure) {
      return Result.fail<EtbId>(einsatzExistsResult.error ?? 'Failed to verify Einsatz existence');
    }
    if (!einsatzExistsResult.value) {
      // Server-side logging with full diagnostic context
      this.logger.warn('Einsatz not found during ETB creation', {
        einsatzId: einsatzId.value,
        timestamp: new Date().toISOString(),
      });

      // User-facing sanitized message (NO internal IDs)
      return Result.fail<EtbId>('Einsatz nicht gefunden');
    }

    // Step 3: Check ETB doesn't already exist for this Einsatz (1:1 Beziehung)
    const existingEtb = await this.etbRepository.findByEinsatzId(einsatzId);
    if (existingEtb !== null) {
      // Server-side logging with full diagnostic context
      this.logger.warn('Attempted to create duplicate ETB', {
        einsatzId: einsatzId.value,
        existingEtbId: existingEtb.id.value,
        timestamp: new Date().toISOString(),
      });

      // User-facing sanitized message (NO internal IDs)
      return Result.fail<EtbId>('ETB für diesen Einsatz existiert bereits');
    }

    // Step 4: Create aggregate via Factory Method
    const aggregateResult = EinsatztagebuchAggregate.create(einsatzId);
    if (aggregateResult.isFailure) {
      return Result.fail<EtbId>(aggregateResult.error ?? 'Failed to create ETB aggregate');
    }
    const aggregate = aggregateResult.value;
    if (!aggregate) {
      this.logger.error('Unexpected null aggregate after successful creation', {
        command: command.constructor.name,
      });
      return Result.fail<EtbId>('Invalid ETB aggregate result');
    }

    // Step 5: Save aggregate
    try {
      await this.etbRepository.save(aggregate);
    } catch (error) {
      this.logger.error('Failed to save ETB', {
        error: error instanceof Error ? error.message : String(error),
        etbId: aggregate.id.value,
        einsatzId: command.einsatzId,
      });
      return Result.fail<EtbId>('ETB konnte nicht gespeichert werden');
    }

    // Step 6: Publish domain events (AFTER successful save - transactional consistency)
    // Create EtbCreatedEvent explicitly since Aggregate.create() doesn't emit events
    const etbCreatedEvent = new EtbCreatedEvent(aggregate.id, einsatzId);
    await this.eventPublisher.publish(etbCreatedEvent);
    aggregate.clearDomainEvents();

    return Result.ok(aggregate.id);
  }
}
