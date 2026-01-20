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

/**
 * Handler zum Ausloesen einer Erinnerung bei Faelligkeit.
 *
 * Nutzt TransactionalCommandHandler fuer atomare Persistenz mit Outbox-Events.
 * Fuehrt Status-Wechsel zu AUSGELOEST durch und emittiert ErinnerungAusgeloestEvent.
 *
 * **Story 1.5:** Alarm bei Faelligkeit ausloesen
 * - AC1: Status wechselt zu AUSGELOEST
 * - AC4: WebSocket Event wird emittiert (via Outbox)
 * - AC5: ETB-Eintrag wird automatisch erstellt (via Event Handler)
 *
 * **Transactional Outbox Pattern:**
 * - Erinnerung und ErinnerungAusgeloestEvent werden atomar in einer Transaktion gespeichert
 * - Event wird erst nach erfolgreichem Commit aus Outbox verarbeitet
 * - Garantiert Konsistenz zwischen Aggregate-State und Event-Store
 *
 * @see TriggerErinnerungCommand - Input Validierung
 * @see Erinnerung.ausloesen() - Domain Trigger Methode
 * @see ErinnerungAusgeloestEvent - Emittiertes Domain Event
 */
@Injectable()
export class TriggerErinnerungHandler extends TransactionalCommandHandler<TriggerErinnerungCommand, void> {
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
   * 4. Im Repository persistieren (status + ausgeloestAm)
   * 5. Domain Events sammeln
   * 6. void Result zurueckgeben
   *
   * @param command - Validierter TriggerErinnerungCommand
   * @param tx - Transaction Context fuer atomare Operationen
   * @returns Result mit void oder Error
   */
  protected async executeInTransaction(command: TriggerErinnerungCommand, tx: TransactionContext): Promise<Result<void> | { result: void; events: DomainEvent[] }> {
    // ════════════════════════════════════════════════════════════════════════
    // 1. Value Objects erstellen
    // ════════════════════════════════════════════════════════════════════════
    const erinnerungIdResult = ErinnerungId.create(command.erinnerungId);
    if (erinnerungIdResult.isFailure || !erinnerungIdResult.value) {
      return Result.fail<void>(erinnerungIdResult.error ?? ERINNERUNG_ERROR_CODES.ID_INVALID);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. Erinnerung Aggregate laden
    // ════════════════════════════════════════════════════════════════════════
    const findResult = await this.erinnerungRepository.findById(erinnerungIdResult.value, tx);
    if (findResult.isFailure) {
      this.logger.error(`Failed to load Erinnerung: ${findResult.error}`, 'TriggerErinnerungHandler');
      return Result.fail<void>(findResult.error ?? ERINNERUNG_ERROR_CODES.NOT_FOUND);
    }

    const erinnerung = findResult.value;
    if (!erinnerung) {
      this.logger.warn(`Erinnerung not found: ${command.erinnerungId}`, 'TriggerErinnerungHandler');
      return Result.fail<void>(ERINNERUNG_ERROR_CODES.NOT_FOUND);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3. Entity.ausloesen() aufrufen (Business Rules enforced)
    // ════════════════════════════════════════════════════════════════════════
    const triggerResult = erinnerung.ausloesen();

    if (triggerResult.isFailure) {
      // Mappe Domain Errors zu Error Codes
      const errorCode = this.mapDomainErrorToCode(triggerResult.error);
      this.logger.warn(`Trigger failed: ${triggerResult.error} (id: ${command.erinnerungId})`, 'TriggerErinnerungHandler');
      return Result.fail<void>(errorCode);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 4. Im Repository persistieren (status + ausgeloestAm werden gesetzt)
    // ════════════════════════════════════════════════════════════════════════
    const saveResult = await this.erinnerungRepository.save(erinnerung, tx);
    if (saveResult.isFailure) {
      this.logger.error(`Failed to save triggered Erinnerung: ${saveResult.error}`, 'TriggerErinnerungHandler');
      return Result.fail<void>(saveResult.error ?? ERINNERUNG_ERROR_CODES.SAVE_FAILED);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 5. Audit-Trail loggen
    // ════════════════════════════════════════════════════════════════════════
    this.logger.log(`Erinnerung ausgeloest (id: ${erinnerung.id.toString()}, titel: "${erinnerung.titel.value}")`, 'TriggerErinnerungHandler');

    // ════════════════════════════════════════════════════════════════════════
    // 6. Domain Events sammeln
    // ════════════════════════════════════════════════════════════════════════
    const events = erinnerung.getDomainEvents();
    erinnerung.clearDomainEvents();

    // ════════════════════════════════════════════════════════════════════════
    // 7. void Result mit Events zurueckgeben
    // ════════════════════════════════════════════════════════════════════════
    return {
      result: undefined,
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
