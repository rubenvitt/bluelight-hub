import { Inject, Injectable } from '@nestjs/common';
import type { DomainEvent } from '@domain/common/domain-event';
import { Result } from '@domain/common/result';
import type { TransactionContext } from '@domain/common/transaction';
import type { ILogger } from '@domain/ports/i-logger.port';
import type { IErinnerungRepository } from '@domain/repositories/i-erinnerung.repository';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import { TransactionalCommandHandler } from '@/application/common/handlers/transactional-command.handler';
// biome-ignore lint/style/useImportType: PrismaService is an Injectable class, not just a type - needed for DI at runtime
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ERINNERUNG_REPOSITORY, LOGGER, OUTBOX_REPOSITORY } from '@infrastructure/di-tokens';
import type { TriggerErinnerungCommand } from './trigger-erinnerung.command';
import { ERINNERUNG_ERROR_CODES } from '../../errors/erinnerung-error.codes';
import type { ErinnerungResponseDto } from '../../dto/erinnerung-response.dto';

/**
 * Handler zum Ausloesen einer Erinnerung bei Faelligkeit.
 *
 * **WARUM TransactionalCommandHandler:**
 * Garantiert atomare Konsistenz zwischen Status-Aenderung (GEPLANT/SNOOZED → AUSGELOEST)
 * und Event-Publikation. Ohne Transaktional Pattern koennte der Status geaendert werden,
 * aber das Event nicht in Outbox landen (oder umgekehrt), was zu inkonsistenten Zustaenden fuehrt.
 *
 * **Story 1.5:** Alarm bei Faelligkeit ausloesen
 * - AC1: Status wechselt zu AUSGELOEST (bei GEPLANT)
 * - AC4: WebSocket Event wird emittiert (via Outbox)
 * - AC5: ETB-Eintrag wird automatisch erstellt (via Event Handler)
 *
 * **Story 2.2:** Nach Snooze erneut ausloesen
 * - AC1: Status wechselt von SNOOZED zurueck zu AUSGELOEST
 * - AC2: Emittiert ErinnerungRetriggeredEvent mit snoozeCount fuer ETB
 * - AC4: WebSocket Event wird emittiert (via Outbox)
 *
 * **Transactional Outbox Pattern:**
 * - Erinnerung und Event werden atomar in einer Transaktion gespeichert
 * - Event wird erst nach erfolgreichem Commit aus Outbox verarbeitet
 * - Garantiert Konsistenz zwischen Aggregate-State und Event-Store
 *
 * @see TriggerErinnerungCommand - Input Validierung
 * @see Erinnerung.ausloesen() - Domain Trigger Methode (akzeptiert GEPLANT und SNOOZED)
 * @see ErinnerungAusgeloestEvent - Emittiert bei erstem Trigger
 * @see ErinnerungRetriggeredEvent - Emittiert bei Re-Trigger nach Snooze
 */
@Injectable()
export class TriggerErinnerungHandler extends TransactionalCommandHandler<TriggerErinnerungCommand, ErinnerungResponseDto> {
  constructor(
    prisma: PrismaService,
    @Inject(OUTBOX_REPOSITORY) outboxRepository: IOutboxRepository,
    @Inject(ERINNERUNG_REPOSITORY)
    private readonly erinnerungRepository: IErinnerungRepository,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {
    super(prisma, outboxRepository);
  }

  /**
   * Fuehrt das Ausloesen der Erinnerung in einer Transaktion aus.
   *
   * **Flow:**
   * 1. Value Objects erstellen (ErinnerungId)
   * 2. Erinnerung Aggregate laden
   * 3. Entity.ausloesen() aufrufen (Business Rules enforced)
   * 4. Domain Events sammeln
   * 5. Im Repository persistieren (status + ausgeloestAm)
   * 6. Response DTO erstellen und zurueckgeben
   *
   * @param command - Validierter TriggerErinnerungCommand
   * @param tx - Transaction Context fuer atomare Operationen
   * @returns Result mit ErinnerungResponseDto oder Error
   */
  protected async executeInTransaction(command: TriggerErinnerungCommand, tx: TransactionContext): Promise<Result<ErinnerungResponseDto> | { result: ErinnerungResponseDto; events: DomainEvent[] }> {
    // ════════════════════════════════════════════════════════════════════════
    // 1. Value Objects erstellen
    // ════════════════════════════════════════════════════════════════════════
    const erinnerungIdResult = ErinnerungId.create(command.erinnerungId);
    if (erinnerungIdResult.isFailure || !erinnerungIdResult.value) {
      return Result.fail<ErinnerungResponseDto>(erinnerungIdResult.error ?? ERINNERUNG_ERROR_CODES.ID_INVALID);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. Erinnerung Aggregate laden
    // ════════════════════════════════════════════════════════════════════════
    const findResult = await this.erinnerungRepository.findById(erinnerungIdResult.value, tx);
    if (findResult.isFailure) {
      this.logger.error(`Failed to load Erinnerung: ${findResult.error}`, 'TriggerErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(findResult.error ?? ERINNERUNG_ERROR_CODES.NOT_FOUND);
    }

    const erinnerung = findResult.value;
    if (!erinnerung) {
      this.logger.warn(`Erinnerung not found: ${command.erinnerungId}`, 'TriggerErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(ERINNERUNG_ERROR_CODES.NOT_FOUND);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3. Entity.ausloesen() aufrufen (Business Rules enforced)
    // ════════════════════════════════════════════════════════════════════════
    const triggerResult = erinnerung.ausloesen();

    if (triggerResult.isFailure) {
      // Mappe Domain Errors zu Error Codes
      const errorCode = this.mapDomainErrorToCode(triggerResult.error);
      this.logger.warn(`Trigger failed: ${triggerResult.error} (id: ${command.erinnerungId})`, 'TriggerErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(errorCode);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 4. Domain Events sammeln (VOR save() fuer Exception Safety)
    // ════════════════════════════════════════════════════════════════════════
    // M1 Fix: Events werden VOR save() extrahiert. Falls save() fehlschlaegt,
    // werden keine Events in Outbox geschrieben (TransactionalCommandHandler Rollback).
    // Das garantiert: Kein Event ohne persistiertes Aggregate.
    const events = erinnerung.getDomainEvents();
    erinnerung.clearDomainEvents();

    // ════════════════════════════════════════════════════════════════════════
    // 5. Im Repository persistieren (status + ausgeloestAm werden gesetzt)
    // ════════════════════════════════════════════════════════════════════════
    const saveResult = await this.erinnerungRepository.save(erinnerung, tx);
    if (saveResult.isFailure) {
      this.logger.error(`Failed to save triggered Erinnerung: ${saveResult.error}`, 'TriggerErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(saveResult.error ?? ERINNERUNG_ERROR_CODES.SAVE_FAILED);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 6. Audit-Trail loggen (Story 2.2: unterscheide Trigger vs Re-Trigger)
    // ════════════════════════════════════════════════════════════════════════
    const isRetrigger = erinnerung.snoozeCount > 0;
    if (isRetrigger) {
      // Story 2.2: Re-Trigger nach Snooze
      this.logger.log(`Erinnerung erneut ausgeloest (id: ${erinnerung.id.toString()}, titel: "${erinnerung.titel.value}", snoozeCount: ${erinnerung.snoozeCount})`, 'TriggerErinnerungHandler');
    } else {
      // Story 1.5: Erster Trigger
      this.logger.log(`Erinnerung ausgeloest (id: ${erinnerung.id.toString()}, titel: "${erinnerung.titel.value}")`, 'TriggerErinnerungHandler');
    }

    // ════════════════════════════════════════════════════════════════════════
    // 7. Response DTO erstellen und zurueckgeben
    // ════════════════════════════════════════════════════════════════════════
    const responseDto: ErinnerungResponseDto = {
      id: erinnerung.id.toString(),
      einsatzId: erinnerung.einsatzId.toString(),
      titel: erinnerung.titel.value,
      beschreibung: erinnerung.beschreibung ?? null,
      faelligAm: erinnerung.faelligAm.toISOString(),
      status: erinnerung.status.value,
      erstelltVon: erinnerung.erstelltVon.toString(),
      createdAt: erinnerung.createdAt.toISOString(),
      updatedAt: erinnerung.updatedAt.toISOString(),
      snoozeCount: erinnerung.snoozeCount,
    };

    return {
      result: responseDto,
      events,
    };
  }

  /**
   * Mappt Domain Error Strings zu Error Codes.
   *
   * Entity.ausloesen() gibt Strings zurueck - wir mappen diese zu
   * standardisierten Error Codes fuer konsistente API Responses.
   */
  private mapDomainErrorToCode(domainError: string | undefined): string {
    if (!domainError) return ERINNERUNG_ERROR_CODES.NOT_TRIGGERABLE;

    if (domainError.includes('NOT_TRIGGERABLE')) {
      return ERINNERUNG_ERROR_CODES.NOT_TRIGGERABLE;
    }
    return domainError;
  }
}
