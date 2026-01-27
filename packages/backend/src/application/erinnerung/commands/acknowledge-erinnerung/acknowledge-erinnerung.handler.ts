import { Inject, Injectable } from '@nestjs/common';
import type { DomainEvent } from '@domain/common/domain-event';
import { Result } from '@domain/common/result';
import type { TransactionContext } from '@domain/common/transaction';
import type { ILogger } from '@domain/ports/i-logger.port';
import type { IErinnerungRepository } from '@domain/repositories/i-erinnerung.repository';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import { UserId } from '@domain/value-objects/user-id';
import { TransactionalCommandHandler } from '@/application/common/handlers/transactional-command.handler';
// biome-ignore lint/style/useImportType: PrismaService is an Injectable class, not just a type - needed for DI at runtime
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ERINNERUNG_REPOSITORY, LOGGER, OUTBOX_REPOSITORY } from '@infrastructure/di-tokens';
import type { AcknowledgeErinnerungCommand } from './acknowledge-erinnerung.command';
import { ERINNERUNG_ERROR_CODES } from '../../errors/erinnerung-error.codes';
import type { ErinnerungResponseDto } from '../../dto/erinnerung-response.dto';
// biome-ignore lint/style/useImportType: ErinnerungResponseFactory is an Injectable class, needed for DI
import { ErinnerungResponseFactory } from '../../dto/erinnerung-response.factory';

/**
 * Handler zum Bestaetigen einer ausgeloesten Erinnerung (1-Tap Acknowledge).
 *
 * **WARUM TransactionalCommandHandler:**
 * Garantiert atomare Konsistenz zwischen Status-Aenderung (AUSGELOEST → ACKNOWLEDGED)
 * und Event-Publikation (ErinnerungAcknowledgedEvent). Ohne Transaktional Pattern
 * koennte der Status geaendert werden, aber das Event nicht in Outbox landen
 * (oder umgekehrt), was zu inkonsistenten Zustaenden fuehrt.
 *
 * **Story 1.6:** Erinnerung mit 1-Tap acknowledgen
 * - AC1: Nur AUSGELOEST Status kann acknowledged werden
 * - AC2: Status wechselt zu ACKNOWLEDGED
 * - AC3: Audio-Alarm wird im Frontend gestoppt (via WebSocket Event)
 * - AC5: ETB-Eintrag wird automatisch erstellt (via Event Handler)
 *
 * **Transactional Outbox Pattern:**
 * - Erinnerung und ErinnerungAcknowledgedEvent werden atomar in einer Transaktion gespeichert
 * - Event wird erst nach erfolgreichem Commit aus Outbox verarbeitet
 * - Garantiert Konsistenz zwischen Aggregate-State und Event-Store
 *
 * @see AcknowledgeErinnerungCommand - Input Validierung
 * @see Erinnerung.acknowledge() - Domain Acknowledge Methode
 * @see ErinnerungAcknowledgedEvent - Emittiertes Domain Event
 */
@Injectable()
export class AcknowledgeErinnerungHandler extends TransactionalCommandHandler<AcknowledgeErinnerungCommand, ErinnerungResponseDto> {
  constructor(
    prisma: PrismaService,
    @Inject(OUTBOX_REPOSITORY) outboxRepository: IOutboxRepository,
    @Inject(ERINNERUNG_REPOSITORY)
    private readonly erinnerungRepository: IErinnerungRepository,
    @Inject(LOGGER) private readonly logger: ILogger,
    private readonly erinnerungResponseFactory: ErinnerungResponseFactory,
  ) {
    super(prisma, outboxRepository);
  }

  /**
   * Fuehrt das Bestaetigen der Erinnerung in einer Transaktion aus.
   *
   * **Flow:**
   * 1. Value Objects erstellen (ErinnerungId, UserId)
   * 2. Erinnerung Aggregate laden
   * 3. Entity.acknowledge() aufrufen (Business Rules enforced)
   * 4. Domain Events sammeln
   * 5. Im Repository persistieren (status + acknowledgedAm + acknowledgedBy)
   * 6. Response DTO erstellen und zurueckgeben
   *
   * @param command - Validierter AcknowledgeErinnerungCommand
   * @param tx - Transaction Context fuer atomare Operationen
   * @returns Result mit ErinnerungResponseDto oder Error
   */
  protected async executeInTransaction(
    command: AcknowledgeErinnerungCommand,
    tx: TransactionContext,
  ): Promise<Result<ErinnerungResponseDto> | { result: ErinnerungResponseDto; events: DomainEvent[] }> {
    // ════════════════════════════════════════════════════════════════════════
    // 1. Value Objects erstellen
    // ════════════════════════════════════════════════════════════════════════
    const erinnerungIdResult = ErinnerungId.create(command.erinnerungId);
    if (erinnerungIdResult.isFailure || !erinnerungIdResult.value) {
      return Result.fail<ErinnerungResponseDto>(erinnerungIdResult.error ?? ERINNERUNG_ERROR_CODES.ID_INVALID);
    }

    const userIdResult = UserId.create(command.acknowledgedBy);
    if (userIdResult.isFailure || !userIdResult.value) {
      return Result.fail<ErinnerungResponseDto>(userIdResult.error ?? ERINNERUNG_ERROR_CODES.USER_ID_INVALID);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. Erinnerung Aggregate laden
    // ════════════════════════════════════════════════════════════════════════
    const findResult = await this.erinnerungRepository.findById(erinnerungIdResult.value, tx);
    if (findResult.isFailure) {
      this.logger.error(`Failed to load Erinnerung: ${findResult.error}`, 'AcknowledgeErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(findResult.error ?? ERINNERUNG_ERROR_CODES.NOT_FOUND);
    }

    const erinnerung = findResult.value;
    if (!erinnerung) {
      this.logger.warn(`Erinnerung not found: ${command.erinnerungId}`, 'AcknowledgeErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(ERINNERUNG_ERROR_CODES.NOT_FOUND);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3. Entity.acknowledge() aufrufen (Business Rules enforced)
    // ════════════════════════════════════════════════════════════════════════
    const acknowledgeResult = erinnerung.acknowledge(userIdResult.value);

    if (acknowledgeResult.isFailure) {
      // Mappe Domain Errors zu Error Codes
      const errorCode = this.mapDomainErrorToCode(acknowledgeResult.error);
      this.logger.warn(`Acknowledge failed: ${acknowledgeResult.error} (id: ${command.erinnerungId})`, 'AcknowledgeErinnerungHandler');
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
    // 5. Im Repository persistieren (status + acknowledgedAm + acknowledgedBy werden gesetzt)
    // ════════════════════════════════════════════════════════════════════════
    const saveResult = await this.erinnerungRepository.save(erinnerung, tx);
    if (saveResult.isFailure) {
      this.logger.error(`Failed to save acknowledged Erinnerung: ${saveResult.error}`, 'AcknowledgeErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(saveResult.error ?? ERINNERUNG_ERROR_CODES.SAVE_FAILED);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 6. Audit-Trail loggen
    // ════════════════════════════════════════════════════════════════════════
    this.logger.log(`Erinnerung acknowledged (id: ${erinnerung.id.toString()}, titel: "${erinnerung.titel.value}", by: ${command.acknowledgedBy})`, 'AcknowledgeErinnerungHandler');

    // ════════════════════════════════════════════════════════════════════════
    // 7. Response DTO erstellen und zurueckgeben
    // ════════════════════════════════════════════════════════════════════════
    const responseDto = await this.erinnerungResponseFactory.create(erinnerung);

    return {
      result: responseDto,
      events,
    };
  }

  /**
   * Mappt Domain Error Strings zu Error Codes.
   *
   * Entity.acknowledge() gibt Strings zurueck - wir mappen diese zu
   * standardisierten Error Codes fuer konsistente API Responses.
   */
  private mapDomainErrorToCode(domainError: string | undefined): string {
    if (!domainError) return ERINNERUNG_ERROR_CODES.NOT_ACKNOWLEDGEABLE;

    if (domainError.includes('NOT_ACKNOWLEDGEABLE')) {
      return ERINNERUNG_ERROR_CODES.NOT_ACKNOWLEDGEABLE;
    }
    return domainError;
  }
}
