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
import type { DeleteErinnerungCommand } from './delete-erinnerung.command';
import { ERINNERUNG_ERROR_CODES } from '../../errors/erinnerung-error.codes';

/**
 * Handler zum Loeschen einer Erinnerung (Soft-Delete).
 *
 * Nutzt TransactionalCommandHandler fuer atomare Persistenz mit Outbox-Events.
 * Fuehrt Soft-Delete durch und emittiert ErinnerungGeloeschtEvent.
 *
 * **Story 1.4:** Erinnerung loeschen
 * - AC1: Nur GEPLANT oder AUSGELOEST Status loeschbar
 * - AC3: Soft-Delete (deletedAt, deletedBy werden gesetzt)
 * - AC4: ErinnerungGeloeschtEvent wird emittiert
 * - AC5: ETB-Eintrag wird automatisch erstellt (via Event Handler)
 *
 * **Transactional Outbox Pattern:**
 * - Erinnerung und ErinnerungGeloeschtEvent werden atomar in einer Transaktion gespeichert
 * - Event wird erst nach erfolgreichem Commit aus Outbox verarbeitet
 * - Garantiert Konsistenz zwischen Aggregate-State und Event-Store
 *
 * @see DeleteErinnerungCommand - Input Validierung
 * @see Erinnerung.delete() - Domain Delete Methode
 * @see ErinnerungGeloeschtEvent - Emittiertes Domain Event
 */
@Injectable()
export class DeleteErinnerungHandler extends TransactionalCommandHandler<DeleteErinnerungCommand, void> {
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
   * Fuehrt das Loeschen der Erinnerung in einer Transaktion aus.
   *
   * **Flow:**
   * 1. Value Objects erstellen (ErinnerungId, UserId)
   * 2. Erinnerung Aggregate laden
   * 3. Entity.delete() aufrufen (Business Rules enforced)
   * 4. Im Repository persistieren (Soft-Delete Felder)
   * 5. Domain Events sammeln
   * 6. void Result zurueckgeben
   *
   * @param command - Validierter DeleteErinnerungCommand
   * @param tx - Transaction Context fuer atomare Operationen
   * @returns Result mit void oder Error
   */
  protected async executeInTransaction(command: DeleteErinnerungCommand, tx: TransactionContext): Promise<Result<void> | { result: undefined; events: DomainEvent[] }> {
    // ════════════════════════════════════════════════════════════════════════
    // 1. Value Objects erstellen
    // ════════════════════════════════════════════════════════════════════════
    const erinnerungIdResult = ErinnerungId.create(command.erinnerungId);
    if (erinnerungIdResult.isFailure || !erinnerungIdResult.value) {
      return Result.fail<void>(erinnerungIdResult.error ?? ERINNERUNG_ERROR_CODES.ID_INVALID);
    }

    const userIdResult = UserId.create(command.geloeschtVon);
    if (userIdResult.isFailure || !userIdResult.value) {
      return Result.fail<void>(userIdResult.error ?? 'USER_ID_INVALID');
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. Erinnerung Aggregate laden
    // ════════════════════════════════════════════════════════════════════════
    const findResult = await this.erinnerungRepository.findById(erinnerungIdResult.value, tx);
    if (findResult.isFailure) {
      this.logger.error(`Failed to load Erinnerung: ${findResult.error}`, 'DeleteErinnerungHandler');
      return Result.fail<void>(findResult.error ?? ERINNERUNG_ERROR_CODES.NOT_FOUND);
    }

    const erinnerung = findResult.value;
    if (!erinnerung) {
      this.logger.warn(`Erinnerung not found: ${command.erinnerungId}`, 'DeleteErinnerungHandler');
      return Result.fail<void>(ERINNERUNG_ERROR_CODES.NOT_FOUND);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3. Entity.delete() aufrufen (Business Rules enforced)
    // ════════════════════════════════════════════════════════════════════════
    const deleteResult = erinnerung.delete(userIdResult.value);

    if (deleteResult.isFailure) {
      // Mappe Domain Errors zu Error Codes
      const errorCode = this.mapDomainErrorToCode(deleteResult.error);
      this.logger.warn(`Delete failed: ${deleteResult.error} (id: ${command.erinnerungId})`, 'DeleteErinnerungHandler');
      return Result.fail<void>(errorCode);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 4. Im Repository persistieren (Soft-Delete Felder werden gesetzt)
    // ════════════════════════════════════════════════════════════════════════
    const saveResult = await this.erinnerungRepository.save(erinnerung, tx);
    if (saveResult.isFailure) {
      this.logger.error(`Failed to save deleted Erinnerung: ${saveResult.error}`, 'DeleteErinnerungHandler');
      return Result.fail<void>(saveResult.error ?? ERINNERUNG_ERROR_CODES.SAVE_FAILED);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 5. Audit-Trail loggen
    // ════════════════════════════════════════════════════════════════════════
    this.logger.log(`Erinnerung geloescht (id: ${erinnerung.id.toString()}, titel: "${erinnerung.titel.value}", geloeschtVon: ${userIdResult.value.toString()})`, 'DeleteErinnerungHandler');

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
   * Entity.delete() gibt Strings zurueck - wir mappen diese zu
   * standardisierten Error Codes fuer konsistente API Responses.
   */
  private mapDomainErrorToCode(domainError: string | undefined): string {
    if (!domainError) return ERINNERUNG_ERROR_CODES.NOT_DELETABLE;

    if (domainError.includes('NOT_DELETABLE')) {
      return ERINNERUNG_ERROR_CODES.NOT_DELETABLE;
    }
    if (domainError.includes('ALREADY_DELETED')) {
      return ERINNERUNG_ERROR_CODES.ALREADY_DELETED;
    }
    return domainError;
  }
}
