import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { CommandHandler } from '@nestjs/cqrs';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { UpdateEinsatzCommand } from './update-einsatz.command';
import { TransactionalCommandHandler } from '@application/common/handlers/transactional-command.handler';
// biome-ignore lint/style/useImportType: PrismaService needed for DI at runtime
import { PrismaService } from '@/prisma/prisma.service';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import { OUTBOX_REPOSITORY } from '@infrastructure/di-tokens';
import type { DomainEvent } from '@domain/common/domain-event';
import type { TransactionContext } from '@domain/common/transaction';
import { EinsatzNotFoundException, EinsatzValidationException, EinsatzBusinessRuleException, EinsatzPersistenceException } from '@domain/common/exceptions';

/**
 * Handler für UpdateEinsatzCommand mit Transactional Outbox Pattern.
 *
 * Erweitert TransactionalCommandHandler für atomare Persistierung von
 * Aggregate-Änderungen und Domain Events in einer Datenbank-Transaktion.
 *
 * **Transactional Flow:**
 * 1. Validiert EinsatzId Format
 * 2. Lädt Aggregate via Repository (außerhalb Transaction - nur Read)
 * 3. Delegiert Update an Aggregate (Business Rules enforced)
 * 4. Speichert Aggregate in Transaction
 * 5. Extrahiert Domain Events vom Aggregate
 * 6. Base Handler speichert Events in Outbox (atomar in gleicher TX)
 * 7. Transaction Commit → Aggregate + Events persistent
 * 8. OutboxEventPublisher pollt und publiziert Events asynchron
 *
 * **Business Rules (vom Aggregate enforced):**
 * - Archivierte Einsätze können nicht geändert werden
 * - Partial Update: Nur übergebene Felder werden aktualisiert
 * - Alarmstichwort darf nicht leer sein
 *
 * **Event Flow:**
 * - EinsatzUpdatedEvent wird in Outbox persistiert (PENDING status)
 * - OutboxEventPublisher pollt und publiziert zu Event Bus (max 7s Latenz)
 * - Event enthält nur geänderte Felder (Delta Pattern)
 *
 * **Warum Transactional Outbox Pattern:**
 * - Garantiert atomare Persistierung: Aggregate + Events committed oder beide rollback
 * - Keine "lost events" bei DB-Fehlern nach Aggregate-Save
 * - Retry-Safe: Events in Outbox können bei Fehler erneut publiziert werden
 */
@CommandHandler(UpdateEinsatzCommand)
@Injectable()
export class UpdateEinsatzHandler extends TransactionalCommandHandler<UpdateEinsatzCommand, void> {
  private readonly logger = new Logger(UpdateEinsatzHandler.name);

  constructor(
    prisma: PrismaService,
    @Inject(OUTBOX_REPOSITORY) outboxRepository: IOutboxRepository,
    @Inject('IEinsatzRepository')
    private readonly einsatzRepository: IEinsatzRepository,
  ) {
    super(prisma, outboxRepository);
  }

  /**
   * Führt die Einsatz-Aktualisierung innerhalb einer Datenbank-Transaktion aus.
   *
   * Diese Methode implementiert die Business Logic für UpdateEinsatzCommand:
   * 1. Validiert EinsatzId Format
   * 2. Lädt Aggregate via Repository
   * 3. Delegiert Update an Aggregate
   * 4. Speichert Aggregate in Transaction
   * 5. Extrahiert Domain Events für Outbox
   *
   * WICHTIG: Nutzt `tx` Parameter für save() Operation (NICHT this.prisma).
   * Base Handler koordiniert Transaction Commit und Outbox-Persistierung.
   *
   * **Warum Exceptions statt Result<T> hier:**
   * - TransactionalCommandHandler erwartet Exceptions für Transaction Rollback
   * - Result<T> Pattern wird nur für Validierung/Business Rules genutzt
   * - Exceptions triggern automatisch Transaction Rollback
   *
   * @param command - Validierter UpdateEinsatzCommand
   * @param tx - Transaction Context (framework-agnostisch, Infrastructure castet zu Prisma) (MUSS für save() verwendet werden)
   * @returns result: void, events: Domain Events für Outbox
   * @throws Error bei Business Rule Violations (triggert Transaction Rollback)
   */
  protected async executeInTransaction(command: UpdateEinsatzCommand, tx: TransactionContext): Promise<{ result: undefined; events: DomainEvent[] }> {
    // Step 1: Validate EinsatzId format
    const einsatzIdResult = EinsatzId.create(command.einsatzId);
    if (einsatzIdResult.isFailure) {
      const error = einsatzIdResult.error ?? 'Ungültige Einsatz-ID';
      this.logger.warn('EinsatzId validation failed', {
        error,
        einsatzId: command.einsatzId,
        operation: 'updateEinsatz',
        phase: 'validation',
        errorType: 'EinsatzValidationException',
      });
      throw new EinsatzValidationException(error, 'einsatzId', command.einsatzId);
    }
    const einsatzId = einsatzIdResult.value;

    // Defensive Programming: TypeScript kann Result<T>.value nicht automatisch als non-null
    // narrowen nach isSuccess-Prüfung, da das Type-System diese Garantie nicht ausdrücken kann.
    if (!einsatzId) {
      this.logger.error('Unexpected null EinsatzId after successful validation', {
        operation: 'updateEinsatz',
        phase: 'validation',
        errorType: 'EinsatzValidationException',
      });
      throw new EinsatzValidationException('Ungültige Einsatz-ID', 'einsatzId', command.einsatzId);
    }

    // Step 2: Load Aggregate via Repository
    // WICHTIG: findById benötigt KEINE Transaction (nur Read-Operation)
    const findResult = await this.einsatzRepository.findById(einsatzId);
    if (findResult.isFailure) {
      const error = findResult.error ?? 'Einsatz konnte nicht geladen werden';
      this.logger.error('Failed to load Einsatz', {
        error,
        einsatzId: command.einsatzId,
        operation: 'updateEinsatz',
        phase: 'load',
        errorType: 'EinsatzPersistenceException',
      });
      throw new EinsatzPersistenceException(error, command.einsatzId);
    }

    const einsatz = findResult.value;
    if (!einsatz) {
      this.logger.warn('Einsatz not found', {
        einsatzId: command.einsatzId,
        operation: 'updateEinsatz',
        phase: 'load',
        errorType: 'EinsatzNotFoundException',
      });
      throw new EinsatzNotFoundException(command.einsatzId);
    }

    // Step 3: Delegate to Aggregate (Business Rules enforced there)
    const updateResult = einsatz.update({
      alarmstichwort: command.alarmstichwort,
      einsatzort: command.einsatzort,
      bemerkung: command.bemerkung,
    });

    if (updateResult.isFailure) {
      const error = updateResult.error ?? 'Einsatz konnte nicht aktualisiert werden';
      this.logger.warn('Einsatz update failed', {
        error,
        einsatzId: command.einsatzId,
        operation: 'updateEinsatz',
        phase: 'businessRule',
        errorType: 'EinsatzBusinessRuleException',
      });
      throw new EinsatzBusinessRuleException(error, command.einsatzId, 'update');
    }

    // Step 4: Save Aggregate in Transaction (WICHTIG: Nutze tx, nicht this.prisma)
    const saveResult = await this.einsatzRepository.save(einsatz, tx);
    if (saveResult.isFailure) {
      const error = saveResult.error ?? 'Einsatz konnte nicht gespeichert werden';
      this.logger.error('Failed to save updated Einsatz', {
        error,
        einsatzId: command.einsatzId,
        operation: 'updateEinsatz',
        phase: 'persist',
        errorType: 'EinsatzPersistenceException',
      });
      throw new EinsatzPersistenceException(error, command.einsatzId);
    }

    // Step 5: Extract Domain Events for Outbox
    // Base Handler wird Events in Outbox persistieren (atomar in gleicher TX)
    // Repository cleared bereits nach Transaction Commit
    const events = einsatz.getDomainEvents();

    this.logger.log('Einsatz updated successfully', {
      einsatzId: command.einsatzId,
      eventCount: events.length,
    });

    // Step 6: Return result + events für Base Handler
    return {
      result: undefined,
      events,
    };
  }
}
