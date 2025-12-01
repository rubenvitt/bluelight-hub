import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { UpdateEinsatzStatusCommand } from './update-status.command';
import { TransactionalCommandHandler } from '@application/common/handlers/transactional-command.handler';
// biome-ignore lint/style/useImportType: PrismaService needed for DI at runtime
import { PrismaService } from '@/prisma/prisma.service';
import type { IOutboxRepository, PrismaTransaction } from '@/infrastructure/outbox/prisma-outbox.repository';
import type { DomainEvent } from '@domain/common/domain-event';

/**
 * Handler für UpdateEinsatzStatusCommand mit Transactional Outbox Pattern.
 *
 * Erweitert TransactionalCommandHandler für atomare Persistierung von
 * Status-Änderungen und Domain Events in einer Datenbank-Transaktion.
 *
 * **Transactional Flow:**
 * 1. Validiert EinsatzId Format
 * 2. Konvertiert newStatus String zu EinsatzStatus Value Object
 * 3. Lädt Aggregate via Repository (außerhalb Transaction - nur Read)
 * 4. Ruft aggregate.updateStatus(newStatus) auf
 * 5. Speichert Aggregate in Transaction
 * 6. Extrahiert Domain Events vom Aggregate
 * 7. Base Handler speichert Events in Outbox (atomar in gleicher TX)
 * 8. Transaction Commit → Aggregate + Events persistent
 * 9. OutboxEventPublisher pollt und publiziert Events asynchron
 *
 * **Business Rules (vom Aggregate enforced):**
 * - Nur Vorwärts-Transitions erlaubt (ANGELEGT → IN_BEARBEITUNG → ABGESCHLOSSEN → ARCHIVIERT)
 * - Rückwärts-Transitions sind verboten
 * - Archivierte Einsätze können nicht geändert werden (immutable)
 *
 * **Event Flow:**
 * - EinsatzStatusChangedEvent wird in Outbox persistiert (PENDING status)
 * - OutboxEventPublisher pollt und publiziert zu Event Bus (max 7s Latenz)
 *
 * **Warum Transactional Outbox Pattern:**
 * - Garantiert atomare Persistierung: Aggregate + Events committed oder beide rollback
 * - Keine "lost events" bei DB-Fehlern nach Aggregate-Save
 * - Retry-Safe: Events in Outbox können bei Fehler erneut publiziert werden
 */
@Injectable()
export class UpdateEinsatzStatusHandler extends TransactionalCommandHandler<UpdateEinsatzStatusCommand, void> {
  private readonly logger = new Logger(UpdateEinsatzStatusHandler.name);

  constructor(
    prisma: PrismaService,
    @Inject('IOutboxRepository') outboxRepository: IOutboxRepository,
    @Inject('IEinsatzRepository')
    private readonly einsatzRepository: IEinsatzRepository,
  ) {
    super(prisma, outboxRepository);
  }

  /**
   * Führt die Status-Änderung innerhalb einer Datenbank-Transaktion aus.
   *
   * Diese Methode implementiert die Business Logic für UpdateEinsatzStatusCommand:
   * 1. Validiert EinsatzId Format
   * 2. Konvertiert newStatus String zu EinsatzStatus Value Object
   * 3. Lädt Aggregate via Repository
   * 4. Ruft aggregate.updateStatus() auf (State Machine Validation)
   * 5. Speichert Aggregate in Transaction
   * 6. Extrahiert Domain Events für Outbox
   *
   * WICHTIG: Nutzt `tx` Parameter für save() Operation (NICHT this.prisma).
   * Base Handler koordiniert Transaction Commit und Outbox-Persistierung.
   *
   * **Warum Exceptions statt Result<T> hier:**
   * - TransactionalCommandHandler erwartet Exceptions für Transaction Rollback
   * - Result<T> Pattern wird nur für Validierung/Business Rules genutzt
   * - Exceptions triggern automatisch Transaction Rollback
   *
   * @param command - Validierter UpdateEinsatzStatusCommand
   * @param tx - Prisma Transaction Client (MUSS für save() verwendet werden)
   * @returns result: void, events: Domain Events für Outbox
   * @throws Error bei Business Rule Violations (triggert Transaction Rollback)
   */
  protected async executeInTransaction(command: UpdateEinsatzStatusCommand, tx: PrismaTransaction): Promise<{ result: undefined; events: DomainEvent[] }> {
    // Step 1: Validate EinsatzId format
    const einsatzIdResult = EinsatzId.create(command.einsatzId);
    if (einsatzIdResult.isFailure) {
      const error = einsatzIdResult.error ?? 'Ungültige Einsatz-ID';
      this.logger.warn('EinsatzId validation failed', { error, einsatzId: command.einsatzId });
      throw new Error(error);
    }
    const einsatzId = einsatzIdResult.value;
    if (!einsatzId) {
      this.logger.error('Unexpected null EinsatzId after successful validation');
      throw new Error('Ungültige Einsatz-ID');
    }

    // Step 2: Convert newStatus String to EinsatzStatus Value Object
    const statusResult = EinsatzStatus.create(command.newStatus);
    if (statusResult.isFailure) {
      const error = statusResult.error ?? `Ungültiger Status: ${command.newStatus}`;
      this.logger.warn('EinsatzStatus validation failed', { error, newStatus: command.newStatus });
      throw new Error(error);
    }
    const newStatus = statusResult.value;
    if (!newStatus) {
      this.logger.error('Unexpected null EinsatzStatus after successful validation');
      throw new Error(`Ungültiger Status: ${command.newStatus}`);
    }

    // Step 3: Load Aggregate via Repository
    // WICHTIG: findById benötigt KEINE Transaction (nur Read-Operation)
    const findResult = await this.einsatzRepository.findById(einsatzId);
    if (findResult.isFailure) {
      const error = findResult.error ?? 'Einsatz konnte nicht geladen werden';
      this.logger.error('Failed to load Einsatz', { error, einsatzId: command.einsatzId });
      throw new Error(error);
    }

    const einsatz = findResult.value;
    if (!einsatz) {
      this.logger.warn('Einsatz not found', { einsatzId: command.einsatzId });
      throw new Error('Einsatz nicht gefunden');
    }

    // Step 4: Call aggregate.updateStatus() - State Machine Validation happens inside
    const updateResult = einsatz.updateStatus(newStatus);
    if (updateResult.isFailure) {
      const error = updateResult.error ?? 'Status-Änderung fehlgeschlagen';
      this.logger.warn('Einsatz status update failed', {
        einsatzId: command.einsatzId,
        currentStatus: einsatz.status.value,
        newStatus: command.newStatus,
        error,
      });
      throw new Error(error);
    }

    // Step 5: Save Aggregate in Transaction (WICHTIG: Nutze tx, nicht this.prisma)
    const saveResult = await this.einsatzRepository.save(einsatz, tx);
    if (saveResult.isFailure) {
      const error = saveResult.error ?? 'Einsatz konnte nicht gespeichert werden';
      this.logger.error('Failed to save Einsatz', {
        error,
        einsatzId: command.einsatzId,
      });
      throw new Error(error);
    }

    // Step 6: Extract Domain Events for Outbox
    // Base Handler wird Events in Outbox persistieren (atomar in gleicher TX)
    // Repository cleared bereits nach Transaction Commit
    const events = einsatz.getDomainEvents();

    this.logger.log('Einsatz status updated successfully', {
      einsatzId: command.einsatzId,
      newStatus: command.newStatus,
      eventCount: events.length,
    });

    // Step 7: Return result + events für Base Handler
    return {
      result: undefined,
      events,
    };
  }
}
