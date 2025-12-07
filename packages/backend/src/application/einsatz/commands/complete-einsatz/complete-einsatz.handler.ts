import type { IEinsatzRepository } from '@domain/repositories';
import { EinsatzCompletenessService } from '@domain/services/einsatz-completeness.service';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { CommandHandler } from '@nestjs/cqrs';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CompleteEinsatzCommand } from './complete-einsatz.command';
import { TransactionalCommandHandler } from '@application/common/handlers/transactional-command.handler';
// biome-ignore lint/style/useImportType: PrismaService needed for DI at runtime
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import type { DomainEvent } from '@domain/common/domain-event';
import type { TransactionContext } from '@domain/common';
import { Result } from '@domain/common/result';
import { EINSATZ_REPOSITORY, OUTBOX_REPOSITORY } from '@infrastructure/di-tokens';

/**
 * Handler für CompleteEinsatzCommand mit Transactional Outbox Pattern.
 *
 * Erweitert TransactionalCommandHandler für atomare Persistierung von
 * Einsatz-Abschluss und Domain Events in einer Datenbank-Transaktion.
 *
 * **Transactional Flow:**
 * 1. Validiert EinsatzId und UserId Format
 * 2. Lädt Aggregate via Repository (außerhalb Transaction - nur Read)
 * 3. Validiert Vollständigkeit via EinsatzCompletenessService
 * 4. Ruft aggregate.complete(userId) auf
 * 5. Speichert Aggregate in Transaction
 * 6. Extrahiert Domain Events vom Aggregate
 * 7. Base Handler speichert Events in Outbox (atomar in gleicher TX)
 * 8. Transaction Commit → Aggregate + Events persistent
 * 9. OutboxEventPublisher pollt und publiziert Events asynchron
 *
 * **Business Rules (vom Aggregate/Service enforced):**
 * - Status muss IN_BEARBEITUNG sein
 * - Alarmstichwort muss gesetzt sein
 * - Einsatzort muss gesetzt sein (optional, konfigurierbar)
 * - Setzt abgeschlossenAt Timestamp
 *
 * **Event Flow:**
 * - EinsatzCompletedEvent wird in Outbox persistiert (PENDING status)
 * - EinsatzStatusChangedEvent wird ebenfalls in Outbox persistiert
 * - OutboxEventPublisher pollt und publiziert zu Event Bus (max 7s Latenz)
 *
 * **Warum Transactional Outbox Pattern:**
 * - Garantiert atomare Persistierung: Aggregate + Events committed oder beide rollback
 * - Keine "lost events" bei DB-Fehlern nach Aggregate-Save
 * - Retry-Safe: Events in Outbox können bei Fehler erneut publiziert werden
 */
@CommandHandler(CompleteEinsatzCommand)
@Injectable()
export class CompleteEinsatzHandler extends TransactionalCommandHandler<CompleteEinsatzCommand, void> {
  private readonly logger = new Logger(CompleteEinsatzHandler.name);

  constructor(
    prisma: PrismaService,
    @Inject(OUTBOX_REPOSITORY) outboxRepository: IOutboxRepository,
    @Inject(EINSATZ_REPOSITORY)
    private readonly einsatzRepository: IEinsatzRepository,
    @Inject(EinsatzCompletenessService)
    private readonly completenessService: EinsatzCompletenessService,
  ) {
    super(prisma, outboxRepository);
  }

  /**
   * Führt den Einsatz-Abschluss innerhalb einer Datenbank-Transaktion aus.
   *
   * Diese Methode implementiert die Business Logic für CompleteEinsatzCommand:
   * 1. Validiert EinsatzId und UserId Format
   * 2. Lädt Aggregate via Repository
   * 3. Validiert Vollständigkeit via Domain Service
   * 4. Ruft aggregate.complete() auf
   * 5. Speichert Aggregate in Transaction
   * 6. Extrahiert Domain Events für Outbox
   *
   * WICHTIG: Nutzt `tx` Parameter für save() Operation (NICHT this.prisma).
   * Base Handler koordiniert Transaction Commit und Outbox-Persistierung.
   *   *
   * **Result Pattern (AC4):**
   * - Gibt Result<T> zurück für erwartete Fehler (Validierung, Business Rules)
   * - Exceptions nur für unerwartete Fehler (DB-Fehler, Programming Errors)
   * - Bei Result.fail(): Transaction wird automatisch zurückgerollt
   *
   * @param command - Validierter CompleteEinsatzCommand
   * @param tx - Transaction Context (framework-agnostisch, Infrastructure castet zu Prisma) (MUSS für save() verwendet werden)
   * @returns Result<{ result: TResult; events: DomainEvent[] }> - Success oder Failure
   * @throws Error bei Business Rule Violations (triggert Transaction Rollback)
   */
  protected async executeInTransaction(command: CompleteEinsatzCommand, tx: TransactionContext): Promise<Result<{ result: undefined; events: DomainEvent[] }>> {
    // Step 1: Validate EinsatzId format
    const einsatzIdResult = EinsatzId.create(command.einsatzId);
    if (einsatzIdResult.isFailure) {
      const error = einsatzIdResult.error ?? 'Ungültige Einsatz-ID';
      this.logger.warn('EinsatzId validation failed', {
        operation: 'completeEinsatz',
        phase: 'validation',
        error,
        einsatzId: command.einsatzId,
      });
      return Result.fail(error);
    }
    const einsatzId = einsatzIdResult.value;
    if (!einsatzId) {
      this.logger.error('Unexpected null EinsatzId after successful validation', {
        operation: 'completeEinsatz',
        phase: 'validation',
      });
      return Result.fail('Ungültige Einsatz-ID');
    }

    // Step 2: Validate UserId format
    const userIdResult = UserId.create(command.completedBy);
    if (userIdResult.isFailure) {
      const error = userIdResult.error ?? 'Ungültige User-ID';
      this.logger.warn('UserId validation failed', {
        operation: 'completeEinsatz',
        phase: 'validation',
        error,
        completedBy: command.completedBy,
      });
      return Result.fail(error);
    }
    const userId = userIdResult.value;
    if (!userId) {
      this.logger.error('Unexpected null UserId after successful validation', {
        operation: 'completeEinsatz',
        phase: 'validation',
      });
      return Result.fail('Ungültige User-ID');
    }

    // Step 3: Load Aggregate via Repository
    // WICHTIG: findById benötigt KEINE Transaction (nur Read-Operation)
    const findResult = await this.einsatzRepository.findById(einsatzId);
    if (findResult.isFailure) {
      const error = findResult.error ?? 'Einsatz konnte nicht geladen werden';
      this.logger.error('Failed to load Einsatz', {
        operation: 'completeEinsatz',
        phase: 'load',
        error,
        einsatzId: command.einsatzId,
      });
      return Result.fail(error);
    }

    const einsatz = findResult.value;
    if (!einsatz) {
      this.logger.warn('Einsatz not found', {
        operation: 'completeEinsatz',
        phase: 'load',
        einsatzId: command.einsatzId,
      });
      return Result.fail(command.einsatzId);
    }

    // Step 4: Validate Completeness via Domain Service
    // requireOrt = false weil Einsatzort optional ist
    const completenessResult = this.completenessService.canBeCompleted(einsatz, false);
    if (completenessResult.isFailure) {
      const error = completenessResult.error ?? 'Einsatz kann nicht abgeschlossen werden';
      this.logger.warn('Einsatz cannot be completed', {
        operation: 'completeEinsatz',
        phase: 'businessRule',
        einsatzId: command.einsatzId,
        reason: error,
      });
      return Result.fail(error);
    }

    // Step 5: Call aggregate.complete()
    const completeResult = einsatz.complete(userId);
    if (completeResult.isFailure) {
      const error = completeResult.error ?? 'Einsatz konnte nicht abgeschlossen werden';
      this.logger.warn('Einsatz complete failed', {
        operation: 'completeEinsatz',
        phase: 'businessRule',
        einsatzId: command.einsatzId,
        error,
      });
      return Result.fail(error);
    }

    // Step 6: Save Aggregate in Transaction (WICHTIG: Nutze tx, nicht this.prisma)
    const saveResult = await this.einsatzRepository.save(einsatz, tx);
    if (saveResult.isFailure) {
      const error = saveResult.error ?? 'Einsatz konnte nicht gespeichert werden';
      this.logger.error('Failed to save Einsatz', {
        operation: 'completeEinsatz',
        phase: 'persist',
        error,
        einsatzId: command.einsatzId,
      });
      return Result.fail(error);
    }

    // Step 7: Extract Domain Events for Outbox
    // Base Handler wird Events in Outbox persistieren (atomar in gleicher TX)
    // Repository cleared bereits nach Transaction Commit
    const events = einsatz.getDomainEvents();

    this.logger.log('Einsatz completed successfully', {
      einsatzId: command.einsatzId,
      completedBy: command.completedBy,
      eventCount: events.length,
    });

    // Step 8: Return result + events für Base Handler
    return Result.ok({ result: undefined, events });
  }
}
