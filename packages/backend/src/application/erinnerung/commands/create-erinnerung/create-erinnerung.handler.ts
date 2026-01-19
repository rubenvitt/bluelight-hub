import { Inject, Injectable } from '@nestjs/common';
import type { DomainEvent } from '@domain/common/domain-event';
import { Result } from '@domain/common/result';
import type { TransactionContext } from '@domain/common/transaction';
import { Erinnerung } from '@domain/entities/erinnerung.entity';
import type { ILogger } from '@domain/ports/i-logger.port';
import type { IErinnerungRepository } from '@domain/repositories/i-erinnerung.repository';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { TransactionalCommandHandler } from '@/application/common/handlers/transactional-command.handler';
// biome-ignore lint/style/useImportType: PrismaService is an Injectable class, not just a type - needed for DI at runtime
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ERINNERUNG_REPOSITORY, LOGGER, OUTBOX_REPOSITORY } from '@infrastructure/di-tokens';
import type { CreateErinnerungCommand } from './create-erinnerung.command';
import { ERINNERUNG_ERROR_CODES } from '../../errors/erinnerung-error.codes';
import type { ErinnerungResponseDto } from '../../dto/erinnerung-response.dto';

/**
 * Handler zum Erstellen einer neuen Erinnerung.
 *
 * Nutzt TransactionalCommandHandler für atomare Persistenz mit Outbox-Events.
 * Erstellt eine neue Erinnerung im Status GEPLANT und emittiert ErinnerungErstelltEvent.
 *
 * **Transactional Outbox Pattern:**
 * - Erinnerung und ErinnerungErstelltEvent werden atomar in einer Transaktion gespeichert
 * - Event wird erst nach erfolgreichem Commit aus Outbox verarbeitet
 * - Garantiert Konsistenz zwischen Aggregate-State und Event-Store
 *
 * **Business Rules:**
 * - Titel ist erforderlich (max 100 Zeichen)
 * - FaelligAm muss in der Zukunft liegen
 * - Status wird initial auf GEPLANT gesetzt
 *
 * @see CreateErinnerungCommand - Input Validierung
 * @see Erinnerung - Domain Entity
 * @see ErinnerungErstelltEvent - Emittiertes Domain Event
 */
@Injectable()
export class CreateErinnerungHandler extends TransactionalCommandHandler<CreateErinnerungCommand, ErinnerungResponseDto> {
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
   * Führt die Erinnerung-Erstellung in einer Transaktion aus.
   *
   * **Flow:**
   * 1. Value Objects erstellen (EinsatzId, UserId)
   * 2. Erinnerung Aggregate erstellen (Domain Logic + Event)
   * 3. Im Repository persistieren (innerhalb Transaction)
   * 4. Domain Events sammeln
   * 5. Result mit ID zurückgeben
   *
   * @param command - Validierter CreateErinnerungCommand
   * @param tx - Transaction Context für atomare Operationen
   * @returns Result mit ErinnerungId oder Error
   */
  protected async executeInTransaction(command: CreateErinnerungCommand, tx: TransactionContext): Promise<Result<ErinnerungResponseDto> | { result: ErinnerungResponseDto; events: DomainEvent[] }> {
    // ════════════════════════════════════════════════════════════════════════
    // 1. Value Objects erstellen
    // ════════════════════════════════════════════════════════════════════════
    const einsatzIdResult = EinsatzId.create(command.einsatzId);
    if (einsatzIdResult.isFailure || !einsatzIdResult.value) {
      return Result.fail<ErinnerungResponseDto>(einsatzIdResult.error ?? ERINNERUNG_ERROR_CODES.EINSATZ_ID_INVALID);
    }

    const userIdResult = UserId.create(command.erstelltVon);
    if (userIdResult.isFailure || !userIdResult.value) {
      return Result.fail<ErinnerungResponseDto>(userIdResult.error ?? ERINNERUNG_ERROR_CODES.ERSTELLT_VON_REQUIRED);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. Erinnerung Aggregate erstellen
    // ════════════════════════════════════════════════════════════════════════
    const erinnerungResult = Erinnerung.create({
      einsatzId: einsatzIdResult.value,
      titel: command.titel,
      beschreibung: command.beschreibung,
      faelligAm: command.faelligAm,
      erstelltVon: userIdResult.value,
    });

    if (erinnerungResult.isFailure || !erinnerungResult.value) {
      return Result.fail<ErinnerungResponseDto>(erinnerungResult.error ?? ERINNERUNG_ERROR_CODES.CREATION_FAILED);
    }

    const erinnerung = erinnerungResult.value;

    // ════════════════════════════════════════════════════════════════════════
    // 3. Im Repository persistieren
    // ════════════════════════════════════════════════════════════════════════
    const saveResult = await this.erinnerungRepository.save(erinnerung, tx);
    if (saveResult.isFailure) {
      this.logger.error(`Failed to save Erinnerung: ${saveResult.error}`, 'CreateErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(saveResult.error ?? ERINNERUNG_ERROR_CODES.SAVE_FAILED);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 4. Audit-Trail loggen
    // ════════════════════════════════════════════════════════════════════════
    this.logger.log(
      `Erinnerung erstellt (id: ${erinnerung.id.toString()}, titel: "${erinnerung.titel.value}", faelligAm: ${erinnerung.faelligAm.toISOString()}, einsatz: ${command.einsatzId}, ersteller: ${command.erstelltVon})`,
      'CreateErinnerungHandler',
    );

    // ════════════════════════════════════════════════════════════════════════
    // 5. Domain Events sammeln
    // ════════════════════════════════════════════════════════════════════════
    const events = erinnerung.getDomainEvents();
    erinnerung.clearDomainEvents();

    // ════════════════════════════════════════════════════════════════════════
    // 6. Response DTO erstellen und zurückgeben
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
    };

    return {
      result: responseDto,
      events,
    };
  }
}
