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
import type { ErinnerungResponseFactory } from '../../dto/erinnerung-response.factory';
import type { UpdateErinnerungCommand } from './update-erinnerung.command';
import { ERINNERUNG_ERROR_CODES } from '../../errors/erinnerung-error.codes';
import type { ErinnerungResponseDto } from '../../dto/erinnerung-response.dto';

/**
 * Handler zum Aktualisieren einer bestehenden Erinnerung.
 *
 * Nutzt TransactionalCommandHandler für atomare Persistenz mit Outbox-Events.
 * Aktualisiert eine Erinnerung und emittiert ErinnerungAktualisiertEvent.
 *
 * **Transactional Outbox Pattern:**
 * - Erinnerung und ErinnerungAktualisiertEvent werden atomar in einer Transaktion gespeichert
 * - Event wird erst nach erfolgreichem Commit aus Outbox verarbeitet
 * - Garantiert Konsistenz zwischen Aggregate-State und Event-Store
 *
 * **Business Rules:**
 * - Nur Erinnerungen im Status GEPLANT können bearbeitet werden
 * - Mindestens ein Feld muss geändert werden
 * - Bei Zeit-Änderung: Timer wird neu berechnet (via Event Handler)
 *
 * @see UpdateErinnerungCommand - Input Validierung
 * @see Erinnerung.update() - Domain Update Methode
 * @see ErinnerungAktualisiertEvent - Emittiertes Domain Event
 */
@Injectable()
export class UpdateErinnerungHandler extends TransactionalCommandHandler<UpdateErinnerungCommand, ErinnerungResponseDto> {
  constructor(
    prisma: PrismaService,
    @Inject(OUTBOX_REPOSITORY) outboxRepository: IOutboxRepository,
    @Inject(ERINNERUNG_REPOSITORY)
    private readonly erinnerungRepository: IErinnerungRepository,
    @Inject(LOGGER) private readonly logger: ILogger,
    private readonly responseFactory: ErinnerungResponseFactory,
  ) {
    super(prisma, outboxRepository);
  }

  /**
   * Führt die Erinnerung-Aktualisierung in einer Transaktion aus.
   *
   * **Flow:**
   * 1. ErinnerungId Value Object erstellen
   * 2. Erinnerung Aggregate laden
   * 3. Entity.update() aufrufen (Business Rules enforced)
   * 4. Im Repository persistieren (innerhalb Transaction)
   * 5. Domain Events sammeln
   * 6. Result mit aktualisiertem DTO zurückgeben
   *
   * @param command - Validierter UpdateErinnerungCommand
   * @param tx - Transaction Context für atomare Operationen
   * @returns Result mit ErinnerungResponseDto oder Error
   */
  protected async executeInTransaction(command: UpdateErinnerungCommand, tx: TransactionContext): Promise<Result<ErinnerungResponseDto> | { result: ErinnerungResponseDto; events: DomainEvent[] }> {
    // ════════════════════════════════════════════════════════════════════════
    // 1. Value Objects erstellen
    // ════════════════════════════════════════════════════════════════════════
    const erinnerungIdResult = ErinnerungId.create(command.erinnerungId);
    if (erinnerungIdResult.isFailure || !erinnerungIdResult.value) {
      return Result.fail<ErinnerungResponseDto>(erinnerungIdResult.error ?? ERINNERUNG_ERROR_CODES.ID_INVALID);
    }

    const userIdResult = UserId.create(command.aktualisierVon);
    if (userIdResult.isFailure || !userIdResult.value) {
      return Result.fail<ErinnerungResponseDto>(userIdResult.error ?? 'USER_ID_INVALID');
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. Erinnerung Aggregate laden
    // ════════════════════════════════════════════════════════════════════════
    const findResult = await this.erinnerungRepository.findById(erinnerungIdResult.value, tx);
    if (findResult.isFailure) {
      this.logger.error(`Failed to load Erinnerung: ${findResult.error}`, 'UpdateErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(findResult.error ?? ERINNERUNG_ERROR_CODES.NOT_FOUND);
    }

    const erinnerung = findResult.value;
    if (!erinnerung) {
      this.logger.warn(`Erinnerung not found: ${command.erinnerungId}`, 'UpdateErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(ERINNERUNG_ERROR_CODES.NOT_FOUND);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3. Entity.update() aufrufen (Business Rules enforced)
    // ════════════════════════════════════════════════════════════════════════
    const updateResult = erinnerung.update({
      titel: command.titel,
      beschreibung: command.beschreibung,
      faelligAm: command.faelligAm,
      aktualisierVon: userIdResult.value,
      eskalationsPersonId: command.eskalationsPersonId !== undefined ? (command.eskalationsPersonId ? UserId.create(command.eskalationsPersonId).value : null) : undefined,
    });

    if (updateResult.isFailure) {
      this.logger.warn(`Update failed: ${updateResult.error} (id: ${command.erinnerungId})`, 'UpdateErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(updateResult.error ?? ERINNERUNG_ERROR_CODES.NOT_EDITABLE);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 4. Im Repository persistieren
    // ════════════════════════════════════════════════════════════════════════
    const saveResult = await this.erinnerungRepository.save(erinnerung, tx);
    if (saveResult.isFailure) {
      this.logger.error(`Failed to save Erinnerung: ${saveResult.error}`, 'UpdateErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(saveResult.error ?? ERINNERUNG_ERROR_CODES.SAVE_FAILED);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 5. Audit-Trail loggen
    // ════════════════════════════════════════════════════════════════════════
    const changedFields: string[] = [];
    if (command.titel !== undefined) changedFields.push('titel');
    if (command.beschreibung !== undefined) changedFields.push('beschreibung');
    if (command.faelligAm !== undefined) changedFields.push('faelligAm');

    this.logger.log(`Erinnerung aktualisiert (id: ${erinnerung.id.toString()}, geänderte Felder: [${changedFields.join(', ')}])`, 'UpdateErinnerungHandler');

    // ════════════════════════════════════════════════════════════════════════
    // 6. Domain Events sammeln
    // ════════════════════════════════════════════════════════════════════════
    const events = erinnerung.getDomainEvents();
    erinnerung.clearDomainEvents();

    // ════════════════════════════════════════════════════════════════════════
    // 7. Response DTO erstellen und zurückgeben
    // ════════════════════════════════════════════════════════════════════════
    // ════════════════════════════════════════════════════════════════════════
    // 7. Response DTO erstellen und zurückgeben
    // ════════════════════════════════════════════════════════════════════════
    const responseDto = await this.responseFactory.create(erinnerung);

    return {
      result: responseDto,
      events,
    };
  }
}
