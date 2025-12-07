import type { IEinsatzRepository } from '@domain/repositories';
import { EinsatzArchivalPolicy } from '@domain/services/einsatz-archival.policy';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { CommandHandler } from '@nestjs/cqrs';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ArchiveEinsatzCommand } from './archive-einsatz.command';
import { TransactionalCommandHandler } from '@application/common/handlers/transactional-command.handler';
// biome-ignore lint/style/useImportType: PrismaService needed for DI at runtime
import { PrismaService } from '@/prisma/prisma.service';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import type { DomainEvent } from '@domain/common/domain-event';
import type { TransactionContext } from '@domain/common';
import { Result } from '@domain/common/result';
import { EINSATZ_REPOSITORY, OUTBOX_REPOSITORY } from '@infrastructure/di-tokens';

/**
 * Handler für ArchiveEinsatzCommand mit Transactional Outbox Pattern.
 *
 * Erweitert TransactionalCommandHandler für atomare Persistierung von
 * Einsatz-Archivierung und Domain Events in einer Datenbank-Transaktion.
 *
 * **Transactional Flow:**
 * 1. Validiert EinsatzId und UserId Format
 * 2. Lädt Aggregate via Repository (außerhalb Transaction - nur Read)
 * 3. Validiert 10-Jahres-Policy via EinsatzArchivalPolicy
 * 4. Ruft aggregate.archive(userId) auf
 * 5. Speichert Aggregate in Transaction
 * 6. Extrahiert Domain Events vom Aggregate
 * 7. Base Handler speichert Events in Outbox (atomar in gleicher TX)
 * 8. Transaction Commit → Aggregate + Events persistent
 * 9. OutboxEventPublisher pollt und publiziert Events asynchron
 *
 * **Business Rules (vom Aggregate/Policy enforced):**
 * - Status muss ABGESCHLOSSEN sein
 * - abgeschlossenAt muss mindestens 10 Jahre alt sein (DRK-Compliance)
 * - Nach Archivierung ist Einsatz immutable
 *
 * **Event Flow:**
 * - EinsatzArchivedEvent wird in Outbox persistiert (PENDING status)
 * - EinsatzStatusChangedEvent wird ebenfalls in Outbox persistiert
 * - OutboxEventPublisher pollt und publiziert zu Event Bus (max 7s Latenz)
 *
 * **Warum Transactional Outbox Pattern:**
 * - Garantiert atomare Persistierung: Aggregate + Events committed oder beide rollback
 * - Keine "lost events" bei DB-Fehlern nach Aggregate-Save
 * - Retry-Safe: Events in Outbox können bei Fehler erneut publiziert werden
 */
@CommandHandler(ArchiveEinsatzCommand)
@Injectable()
export class ArchiveEinsatzHandler extends TransactionalCommandHandler<ArchiveEinsatzCommand, void> {
  private readonly logger = new Logger(ArchiveEinsatzHandler.name);
  /** Stateless Domain Policy - direkte Instanziierung da keine Dependencies */
  private readonly archivalPolicy = new EinsatzArchivalPolicy();

  constructor(
    prisma: PrismaService,
    @Inject(OUTBOX_REPOSITORY) outboxRepository: IOutboxRepository,
    @Inject(EINSATZ_REPOSITORY)
    private readonly einsatzRepository: IEinsatzRepository,
  ) {
    super(prisma, outboxRepository);
  }

  /**
   * Führt die Einsatz-Archivierung innerhalb einer Datenbank-Transaktion aus.
   *
   * Diese Methode implementiert die Business Logic für ArchiveEinsatzCommand:
   * 1. Validiert EinsatzId und UserId Format
   * 2. Lädt Aggregate via Repository
   * 3. Validiert 10-Jahres-Policy
   * 4. Ruft aggregate.archive() auf
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
   * @param command - Validierter ArchiveEinsatzCommand
   * @param tx - Transaction Context (framework-agnostisch, Infrastructure castet zu Prisma)
   * @returns Result<{ result: TResult; events: DomainEvent[] }> - Success oder Failure
   * @throws Error bei Business Rule Violations (triggert Transaction Rollback)
   */
  protected async executeInTransaction(command: ArchiveEinsatzCommand, tx: TransactionContext): Promise<Result<{ result: undefined; events: DomainEvent[] }>> {
    // Step 1: Validate EinsatzId format
    const einsatzIdResult = EinsatzId.create(command.einsatzId);
    if (einsatzIdResult.isFailure) {
      const error = einsatzIdResult.error ?? 'Ungültige Einsatz-ID';
      this.logger.warn('EinsatzId validation failed', {
        operation: 'archiveEinsatz',
        phase: 'validation',
        error,
        einsatzId: command.einsatzId,
      });
      return Result.fail(error);
    }
    const einsatzId = einsatzIdResult.value;
    if (!einsatzId) {
      this.logger.error('Unexpected null EinsatzId after successful validation', {
        operation: 'archiveEinsatz',
        phase: 'validation',
      });
      return Result.fail('Ungültige Einsatz-ID');
    }

    // Step 2: Validate UserId format
    const userIdResult = UserId.create(command.archivedBy);
    if (userIdResult.isFailure) {
      const error = userIdResult.error ?? 'Ungültige User-ID';
      this.logger.warn('UserId validation failed', {
        operation: 'archiveEinsatz',
        phase: 'validation',
        error,
        archivedBy: command.archivedBy,
      });
      return Result.fail(error);
    }
    const userId = userIdResult.value;
    if (!userId) {
      this.logger.error('Unexpected null UserId after successful validation', {
        operation: 'archiveEinsatz',
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
        operation: 'archiveEinsatz',
        phase: 'load',
        error,
        einsatzId: command.einsatzId,
      });
      return Result.fail(error);
    }

    const einsatz = findResult.value;
    if (!einsatz) {
      this.logger.warn('Einsatz not found', {
        operation: 'archiveEinsatz',
        phase: 'load',
        einsatzId: command.einsatzId,
      });
      return Result.fail(command.einsatzId);
    }

    // Step 4: Validate 10-Year Policy via Domain Policy
    const currentDate = new Date();
    if (!this.archivalPolicy.canBeArchived(einsatz, currentDate)) {
      // Determine reason for failure
      const status = einsatz.status.value;
      if (status !== 'ABGESCHLOSSEN') {
        const error = `Einsatz kann nicht archiviert werden: Status muss ABGESCHLOSSEN sein (aktuell: ${status})`;
        this.logger.warn('Archive policy failed: wrong status', {
          operation: 'archiveEinsatz',
          phase: 'businessRule',
          einsatzId: command.einsatzId,
          status,
        });
        return Result.fail(error);
      }
      // Status is ABGESCHLOSSEN but 10-year period not reached
      const error = 'Einsatz kann noch nicht archiviert werden: 10-Jahres-Aufbewahrungsfrist nicht abgelaufen';
      this.logger.warn('Archive policy failed: 10-year period not reached', {
        operation: 'archiveEinsatz',
        phase: 'businessRule',
        einsatzId: command.einsatzId,
      });
      return Result.fail(error);
    }

    // Step 5: Call aggregate.archive()
    const archiveResult = einsatz.archive(userId);
    if (archiveResult.isFailure) {
      const error = archiveResult.error ?? 'Einsatz konnte nicht archiviert werden';
      this.logger.warn('Einsatz archive failed', {
        operation: 'archiveEinsatz',
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
        operation: 'archiveEinsatz',
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

    this.logger.log('Einsatz archived successfully', {
      einsatzId: command.einsatzId,
      archivedBy: command.archivedBy,
      eventCount: events.length,
    });

    // Step 8: Return result + events für Base Handler
    return Result.ok({ result: undefined, events });
  }
}
