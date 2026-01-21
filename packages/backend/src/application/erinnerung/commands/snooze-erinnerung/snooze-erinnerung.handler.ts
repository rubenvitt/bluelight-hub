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
import type { SnoozeErinnerungCommand } from './snooze-erinnerung.command';
import { ERINNERUNG_ERROR_CODES } from '../../errors/erinnerung-error.codes';
import type { ErinnerungResponseDto } from '../../dto/erinnerung-response.dto';

/**
 * Handler zum Verschieben (Snoozen) einer ausgelösten Erinnerung.
 *
 * **WARUM TransactionalCommandHandler:**
 * Garantiert atomare Konsistenz zwischen Status-Änderung (AUSGELOEST → SNOOZED)
 * und Event-Publikation (ErinnerungSnoozedEvent). Ohne Transaktional Pattern
 * könnte der Status geändert werden, aber das Event nicht in Outbox landen
 * (oder umgekehrt), was zu inkonsistenten Zuständen führt.
 *
 * **Story 2.1:** Erinnerung mit Preset-Zeiten snoozen
 * - AC1: Snooze-Buttons mit Presets 1 Min, 5 Min, 10 Min
 * - AC2: Status wechselt zu SNOOZED, neue Fälligkeit wird berechnet
 * - AC3: Audio-Alarm wird im Frontend gestoppt (via WebSocket Event)
 * - ETB-Eintrag wird automatisch erstellt (via Event Handler)
 *
 * **Transactional Outbox Pattern:**
 * - Erinnerung und ErinnerungSnoozedEvent werden atomar in einer Transaktion gespeichert
 * - Event wird erst nach erfolgreichem Commit aus Outbox verarbeitet
 * - Garantiert Konsistenz zwischen Aggregate-State und Event-Store
 *
 * @see SnoozeErinnerungCommand - Input Validierung
 * @see Erinnerung.snooze() - Domain Snooze Methode
 * @see ErinnerungSnoozedEvent - Emittiertes Domain Event
 */
@Injectable()
export class SnoozeErinnerungHandler extends TransactionalCommandHandler<SnoozeErinnerungCommand, ErinnerungResponseDto> {
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
   * Führt das Snoozen der Erinnerung in einer Transaktion aus.
   *
   * **Flow:**
   * 1. Value Objects erstellen (ErinnerungId, UserId)
   * 2. Erinnerung Aggregate laden
   * 3. Entity.snooze() aufrufen (Business Rules enforced)
   * 4. Domain Events sammeln
   * 5. Im Repository persistieren (status + snoozedAt + snoozedUntil + snoozedBy + snoozeCount)
   * 6. Response DTO erstellen und zurückgeben
   *
   * @param command - Validierter SnoozeErinnerungCommand
   * @param tx - Transaction Context für atomare Operationen
   * @returns Result mit ErinnerungResponseDto oder Error
   */
  protected async executeInTransaction(command: SnoozeErinnerungCommand, tx: TransactionContext): Promise<Result<ErinnerungResponseDto> | { result: ErinnerungResponseDto; events: DomainEvent[] }> {
    // ════════════════════════════════════════════════════════════════════════
    // 1. Value Objects erstellen
    // ════════════════════════════════════════════════════════════════════════
    const erinnerungIdResult = ErinnerungId.create(command.erinnerungId);
    if (erinnerungIdResult.isFailure || !erinnerungIdResult.value) {
      return Result.fail<ErinnerungResponseDto>(erinnerungIdResult.error ?? ERINNERUNG_ERROR_CODES.ID_INVALID);
    }

    const userIdResult = UserId.create(command.snoozedBy);
    if (userIdResult.isFailure || !userIdResult.value) {
      return Result.fail<ErinnerungResponseDto>(userIdResult.error ?? ERINNERUNG_ERROR_CODES.USER_ID_INVALID);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. Erinnerung Aggregate laden
    // ════════════════════════════════════════════════════════════════════════
    const findResult = await this.erinnerungRepository.findById(erinnerungIdResult.value, tx);
    if (findResult.isFailure) {
      this.logger.error(`Failed to load Erinnerung: ${findResult.error}`, 'SnoozeErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(findResult.error ?? ERINNERUNG_ERROR_CODES.NOT_FOUND);
    }

    const erinnerung = findResult.value;
    if (!erinnerung) {
      this.logger.warn(`Erinnerung not found: ${command.erinnerungId}`, 'SnoozeErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(ERINNERUNG_ERROR_CODES.NOT_FOUND);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3. Entity.snooze() aufrufen (Business Rules enforced)
    // ════════════════════════════════════════════════════════════════════════
    const snoozeResult = erinnerung.snooze(userIdResult.value, command.snoozeMinutes);

    if (snoozeResult.isFailure) {
      // Mappe Domain Errors zu Error Codes
      const errorCode = this.mapDomainErrorToCode(snoozeResult.error);
      this.logger.warn(`Snooze failed: ${snoozeResult.error} (id: ${command.erinnerungId})`, 'SnoozeErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(errorCode);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 4. Domain Events sammeln (VOR save() für Exception Safety)
    // ════════════════════════════════════════════════════════════════════════
    // Events werden VOR save() extrahiert. Falls save() fehlschlägt,
    // werden keine Events in Outbox geschrieben (TransactionalCommandHandler Rollback).
    // Das garantiert: Kein Event ohne persistiertes Aggregate.
    const events = erinnerung.getDomainEvents();
    erinnerung.clearDomainEvents();

    // ════════════════════════════════════════════════════════════════════════
    // 5. Im Repository persistieren (snooze-Felder werden gesetzt)
    // ════════════════════════════════════════════════════════════════════════
    const saveResult = await this.erinnerungRepository.save(erinnerung, tx);
    if (saveResult.isFailure) {
      this.logger.error(`Failed to save snoozed Erinnerung: ${saveResult.error}`, 'SnoozeErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(saveResult.error ?? ERINNERUNG_ERROR_CODES.SAVE_FAILED);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 6. Audit-Trail loggen
    // ════════════════════════════════════════════════════════════════════════
    this.logger.log(`Erinnerung snoozed (id: ${erinnerung.id.toString()}, titel: "${erinnerung.titel.value}", minutes: ${command.snoozeMinutes}, by: ${command.snoozedBy})`, 'SnoozeErinnerungHandler');

    // ════════════════════════════════════════════════════════════════════════
    // 7. Response DTO erstellen und zurückgeben
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
   * Entity.snooze() gibt Strings zurück - wir mappen diese zu
   * standardisierten Error Codes für konsistente API Responses.
   */
  private mapDomainErrorToCode(domainError: string | undefined): string {
    if (!domainError) return ERINNERUNG_ERROR_CODES.NOT_SNOOZEABLE;

    if (domainError.includes('NOT_SNOOZEABLE')) {
      return ERINNERUNG_ERROR_CODES.NOT_SNOOZEABLE;
    }
    if (domainError.includes('SNOOZE_MINUTES_INVALID')) {
      return ERINNERUNG_ERROR_CODES.SNOOZE_MINUTES_INVALID;
    }
    return domainError;
  }
}
