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
import type { MarkErledigtErinnerungCommand } from './mark-erledigt-erinnerung.command';
import { ERINNERUNG_ERROR_CODES } from '../../errors/erinnerung-error.codes';
import type { ErinnerungResponseDto } from '../../dto/erinnerung-response.dto';

/**
 * Handler zum Markieren einer Erinnerung als erledigt.
 *
 * **WARUM TransactionalCommandHandler:**
 * Garantiert atomare Konsistenz zwischen Status-Aenderung (ACKNOWLEDGED/ESKALIERT → ERLEDIGT)
 * und Event-Publikation (ErinnerungErledigtEvent). Ohne Transaktional Pattern
 * koennte der Status geaendert werden, aber das Event nicht in Outbox landen
 * (oder umgekehrt), was zu inkonsistenten Zustaenden fuehrt.
 *
 * **Story 2.5:** Erinnerung als erledigt markieren
 * - AC1: Nur Erinnerungen mit Status ACKNOWLEDGED oder ESKALIERT können erledigt werden
 * - AC3: Status wechselt zu ERLEDIGT
 * - AC4: Domain Event wird publiziert für ETB-Integration
 * - AC5: Alle Timer/Alarme werden gestoppt (via WebSocket Event)
 *
 * **Transactional Outbox Pattern:**
 * - Erinnerung und ErinnerungErledigtEvent werden atomar in einer Transaktion gespeichert
 * - Event wird erst nach erfolgreichem Commit aus Outbox verarbeitet
 * - Garantiert Konsistenz zwischen Aggregate-State und Event-Store
 *
 * @see MarkErledigtErinnerungCommand - Input Validierung
 * @see Erinnerung.markErledigt() - Domain MarkErledigt Methode
 * @see ErinnerungErledigtEvent - Emittiertes Domain Event
 */
@Injectable()
export class MarkErledigtErinnerungHandler extends TransactionalCommandHandler<MarkErledigtErinnerungCommand, ErinnerungResponseDto> {
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
   * Fuehrt das Erledigen der Erinnerung in einer Transaktion aus.
   *
   * **Flow:**
   * 1. Value Objects erstellen (ErinnerungId, UserId)
   * 2. Erinnerung Aggregate laden
   * 3. Entity.markErledigt() aufrufen (Business Rules enforced)
   * 4. Domain Events sammeln
   * 5. Im Repository persistieren (status + erledigtAm + erledigtBy + erledigungsNotiz)
   * 6. Response DTO erstellen und zurueckgeben
   *
   * @param command - Validierter MarkErledigtErinnerungCommand
   * @param tx - Transaction Context fuer atomare Operationen
   * @returns Result mit ErinnerungResponseDto oder Error
   */
  protected async executeInTransaction(
    command: MarkErledigtErinnerungCommand,
    tx: TransactionContext,
  ): Promise<Result<ErinnerungResponseDto> | { result: ErinnerungResponseDto; events: DomainEvent[] }> {
    // ════════════════════════════════════════════════════════════════════════
    // 1. Value Objects erstellen
    // ════════════════════════════════════════════════════════════════════════
    const erinnerungIdResult = ErinnerungId.create(command.erinnerungId);
    if (erinnerungIdResult.isFailure || !erinnerungIdResult.value) {
      return Result.fail<ErinnerungResponseDto>(erinnerungIdResult.error ?? ERINNERUNG_ERROR_CODES.ID_INVALID);
    }

    const userIdResult = UserId.create(command.erledigtBy);
    if (userIdResult.isFailure || !userIdResult.value) {
      return Result.fail<ErinnerungResponseDto>(userIdResult.error ?? ERINNERUNG_ERROR_CODES.USER_ID_INVALID);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. Erinnerung Aggregate laden
    // ════════════════════════════════════════════════════════════════════════
    const findResult = await this.erinnerungRepository.findById(erinnerungIdResult.value, tx);
    if (findResult.isFailure) {
      this.logger.error(`Failed to load Erinnerung: ${findResult.error}`, 'MarkErledigtErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(findResult.error ?? ERINNERUNG_ERROR_CODES.NOT_FOUND);
    }

    const erinnerung = findResult.value;
    if (!erinnerung) {
      this.logger.warn(`Erinnerung not found: ${command.erinnerungId}`, 'MarkErledigtErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(ERINNERUNG_ERROR_CODES.NOT_FOUND);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3. Entity.markErledigt() aufrufen (Business Rules enforced)
    // ════════════════════════════════════════════════════════════════════════
    const markErledvigtResult = erinnerung.markErledigt(userIdResult.value, command.erledigungsNotiz ?? undefined);

    if (markErledvigtResult.isFailure) {
      // Mappe Domain Errors zu Error Codes
      const errorCode = this.mapDomainErrorToCode(markErledvigtResult.error);
      this.logger.warn(`MarkErledigt failed: ${markErledvigtResult.error} (id: ${command.erinnerungId})`, 'MarkErledigtErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(errorCode);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 4. Domain Events sammeln (VOR save() fuer Exception Safety)
    // ════════════════════════════════════════════════════════════════════════
    // Events werden VOR save() extrahiert. Falls save() fehlschlaegt,
    // werden keine Events in Outbox geschrieben (TransactionalCommandHandler Rollback).
    // Das garantiert: Kein Event ohne persistiertes Aggregate.
    const events = erinnerung.getDomainEvents();
    erinnerung.clearDomainEvents();

    // ════════════════════════════════════════════════════════════════════════
    // 5. Im Repository persistieren (status + erledigtAm + erledigtBy + erledigungsNotiz)
    // ════════════════════════════════════════════════════════════════════════
    const saveResult = await this.erinnerungRepository.save(erinnerung, tx);
    if (saveResult.isFailure) {
      this.logger.error(`Failed to save erledigt Erinnerung: ${saveResult.error}`, 'MarkErledigtErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(saveResult.error ?? ERINNERUNG_ERROR_CODES.SAVE_FAILED);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 6. Audit-Trail loggen
    // ════════════════════════════════════════════════════════════════════════
    this.logger.log(
      `Erinnerung erledigt (id: ${erinnerung.id.toString()}, titel: "${erinnerung.titel.value}", by: ${command.erledigtBy}${command.erledigungsNotiz ? `, notiz: "${command.erledigungsNotiz.substring(0, 50)}..."` : ''})`,
      'MarkErledigtErinnerungHandler',
    );

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
      erledigtAm: erinnerung.erledigtAm?.toISOString() ?? null,
      erledigtBy: erinnerung.erledigtBy?.toString() ?? null,
      erledigungsNotiz: erinnerung.erledigungsNotiz ?? null,
      requiresNote: erinnerung.requiresNote,
    };

    return {
      result: responseDto,
      events,
    };
  }

  /**
   * Mappt Domain Error Strings zu Error Codes.
   *
   * Entity.markErledigt() gibt Strings zurueck - wir mappen diese zu
   * standardisierten Error Codes fuer konsistente API Responses.
   */
  private mapDomainErrorToCode(domainError: string | undefined): string {
    if (!domainError) return ERINNERUNG_ERROR_CODES.NOT_COMPLETEABLE;

    if (domainError.includes('ERINNERUNG_NOT_COMPLETEABLE')) {
      return ERINNERUNG_ERROR_CODES.NOT_COMPLETEABLE;
    }
    if (domainError.includes('ERINNERUNG_NOTIZ_TOO_LONG')) {
      return ERINNERUNG_ERROR_CODES.NOTIZ_TOO_LONG;
    }
    // Story 2.6: Pflicht-Notiz Validierung
    if (domainError.includes('ERINNERUNG_ERLEDIGUNGS_NOTIZ_REQUIRED')) {
      return ERINNERUNG_ERROR_CODES.ERLEDIGUNGS_NOTIZ_REQUIRED;
    }
    return domainError;
  }
}
