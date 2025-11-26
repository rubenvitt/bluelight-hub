import { CreateEtbCommand, type CreateEtbHandler } from '@application/etb/commands';
import { Result } from '@domain/common/result';
import type { EtbEintrag } from '@domain/entities/etb-eintrag.entity';
import type { IEtbRepository } from '@domain/repositories/i-etb.repository';
import { EtbId } from '@domain/value-objects/etb-id';
import { EtbKategorie } from '@domain/value-objects/etb-kategorie';
import { UserId } from '@domain/value-objects/user-id';
import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { AddEintragCommand } from './add-eintrag.command';

/**
 * Handler für AddEintragCommand.
 *
 * Orchestriert das Hinzufügen eines neuen Eintrags zum Einsatztagebuch.
 * Lädt das ETB-Aggregate, delegiert Business-Logic an das Aggregate,
 * und publiziert Events nach erfolgreichem Save.
 *
 * **Versioning Pattern (DRK-Compliance):**
 * Das Aggregate erstellt automatisch einen Snapshot VOR der Mutation.
 * Dies ermöglicht vollständigen Audit-Trail und Rollback-Fähigkeit.
 *
 * **Sequence Number:**
 * Wird automatisch vom Aggregate vergeben (auto-increment).
 * Garantiert lückenlose chronologische Sortierung.
 *
 * Security: Sanitized error messages prevent ID disclosure to API consumers.
 */
@Injectable()
export class AddEintragHandler {
  private readonly logger = new Logger(AddEintragHandler.name);

  constructor(
    @Inject('IEtbRepository')
    private readonly etbRepository: IEtbRepository,
    @Optional()
    private readonly createEtbHandler?: CreateEtbHandler,
  ) {}

  async execute(command: AddEintragCommand): Promise<Result<EtbEintrag>> {
    // Step 1: Validate EtbId format
    const etbIdResult = EtbId.create(command.etbId);
    if (etbIdResult.isFailure) {
      return Result.fail<EtbEintrag>(etbIdResult.error ?? 'Invalid ETB ID');
    }
    const etbId = etbIdResult.value;
    if (!etbId) {
      this.logger.error('Unexpected null EtbId after successful validation', {
        command: command.constructor.name,
      });
      return Result.fail<EtbEintrag>('Invalid ETB ID result');
    }

    // Step 2: Validate UserId format
    const userIdResult = UserId.create(command.userId);
    if (userIdResult.isFailure) {
      return Result.fail<EtbEintrag>(userIdResult.error ?? 'Invalid User ID');
    }
    const userId = userIdResult.value;
    if (!userId) {
      this.logger.error('Unexpected null UserId after successful validation', {
        command: command.constructor.name,
      });
      return Result.fail<EtbEintrag>('Invalid User ID result');
    }

    // Step 3: Load ETB Aggregate
    let aggregate = await this.etbRepository.findById(etbId);
    if (aggregate === null) {
      // Server-side logging with full diagnostic context
      this.logger.warn('ETB not found during AddEintrag', {
        etbId: etbId.value,
        timestamp: new Date().toISOString(),
      });

      // Try to auto-create ETB if einsatzId is provided (active Einsatz context)
      const einsatzId = command.einsatzId?.trim();

      if (!einsatzId) {
        this.logger.warn('Missing einsatzId for auto-creation after ETB miss', {
          etbId: etbId.value,
        });
        return Result.fail<EtbEintrag>('ETB nicht gefunden');
      }

      if (!this.createEtbHandler) {
        this.logger.error('CreateEtbHandler unavailable for ETB auto-creation', {
          etbId: etbId.value,
          einsatzId,
        });
        return Result.fail<EtbEintrag>('ETB konnte nicht automatisch erstellt werden');
      }

      // User-facing sanitized message (NO internal IDs)
      const newIdResult = CreateEtbCommand.create(einsatzId);
      if (newIdResult.isFailure || !newIdResult.value) {
        return Result.fail<EtbEintrag>(newIdResult.error ?? 'ETB konnte nicht erstellt werden');
      }

      const idResult = await this.createEtbHandler.execute(newIdResult.value);
      if (idResult.isFailure || !idResult.value) {
        this.logger.warn('ETB creation failed during addEintrag', {
          einsatzId,
          error: idResult.error,
        });
        return Result.fail<EtbEintrag>(idResult.error ?? 'ETB konnte nicht erstellt werden');
      }

      aggregate = await this.etbRepository.findById(idResult.value);
      if (!aggregate) {
        this.logger.error('ETB created but not found when reloading after addEintrag', {
          etbId: idResult.value.value,
          einsatzId,
        });
        return Result.fail<EtbEintrag>('ETB nicht gefunden');
      }
    }

    // Step 4: Convert Prisma enum to Domain Value Object
    // Application Layer verwendet Prisma Enum (fuer API-Validierung),
    // Domain Layer erwartet Value Object (Hexagonale Architektur)
    let kategorieVo: EtbKategorie | undefined;
    if (command.kategorie) {
      const kategorieResult = EtbKategorie.create(command.kategorie);
      if (kategorieResult.isFailure) {
        return Result.fail<EtbEintrag>(kategorieResult.error ?? 'Invalid Kategorie');
      }
      kategorieVo = kategorieResult.value as EtbKategorie;
    }

    // Step 5: Delegate to domain method (validates business rules, creates snapshot)
    // Business rules checked by aggregate:
    // - ETB must not be locked (status !== LOCKED)
    // - Text must not be empty
    // Aggregate also:
    // - Creates snapshot BEFORE mutation (DRK-Compliance)
    // - Auto-increments sequence number
    // - Creates EintragAddedEvent
    const addResult = aggregate.addEintrag(command.text, userId, kategorieVo);
    if (addResult.isFailure) {
      // Domain-level validation failure
      throw new BadRequestException(addResult.error);
    }
    const eintrag = addResult.value;
    if (!eintrag) {
      this.logger.error('Unexpected null eintrag after successful addEintrag', {
        command: command.constructor.name,
      });
      return Result.fail<EtbEintrag>('Invalid Eintrag result');
    }

    // Step 6: Save aggregate (repository handles snapshot persistence)
    try {
      await this.etbRepository.save(aggregate);
    } catch (error) {
      this.logger.error('Failed to save ETB after adding entry', {
        error: error instanceof Error ? error.message : String(error),
        etbId: command.etbId,
        userId: command.userId,
      });
      return Result.fail<EtbEintrag>('Eintrag konnte nicht gespeichert werden');
    }

    // Domain Events werden automatisch in Outbox persistiert (Story 4-4: Transactional Outbox Pattern)
    // Repository.save() → Outbox → Polling Worker → Event Handler

    return Result.ok(eintrag);
  }
}
