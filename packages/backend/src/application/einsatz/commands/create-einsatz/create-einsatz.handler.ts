import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import { UserId } from '@domain/value-objects/user-id';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { CommandHandler } from '@nestjs/cqrs';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CreateEinsatzCommand } from './create-einsatz.command';
import { TransactionalCommandHandler } from '@application/common/handlers/transactional-command.handler';
// biome-ignore lint/style/useImportType: PrismaService needed for DI at runtime
import { PrismaService } from '@/prisma/prisma.service';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import type { DomainEvent } from '@domain/common/domain-event';
import type { TransactionContext } from '@domain/common/transaction';
import { EinsatzValidationException, EinsatzPersistenceException } from '@domain/common/exceptions';
import { EINSATZ_REPOSITORY, OUTBOX_REPOSITORY } from '@infrastructure/di-tokens';

/**
 * Handler für CreateEinsatzCommand mit Transactional Outbox Pattern.
 *
 * Erweitert TransactionalCommandHandler für atomare Persistierung von
 * Aggregate und Domain Events in einer Datenbank-Transaktion.
 *
 * **Transactional Flow:**
 * 1. Validiert User-ID Format
 * 2. Erstellt EinsatzAggregate via Factory Method
 * 3. Speichert Aggregate in Transaction (via Repository)
 * 4. Extrahiert Domain Events vom Aggregate
 * 5. Base Handler speichert Events in Outbox (atomar in gleicher TX)
 * 6. Transaction Commit → Aggregate + Events persistent
 * 7. OutboxEventPublisher pollt und publiziert Events asynchron
 *
 * **Business Rules (vom Aggregate enforced):**
 * - Alarmstichwort ist Pflichtfeld
 * - Initialer Status ist ANGELEGT
 * - Einsatznummer wird auto-generiert (E{YEAR}-{CUID-8})
 *
 * **Event Flow:**
 * - EinsatzCreatedEvent wird in Outbox persistiert (PENDING status)
 * - OutboxEventPublisher pollt und publiziert zu Event Bus (max 7s Latenz)
 * - EtbAutoCreationHandler reagiert auf Event und erstellt ETB
 *
 * **Warum Transactional Outbox Pattern:**
 * - Garantiert atomare Persistierung: Aggregate + Events committed oder beide rollback
 * - Keine "lost events" bei DB-Fehlern nach Aggregate-Save
 * - ETB auto-creation via Outbox statt direkter Event-Emission
 * - Retry-Safe: Events in Outbox können bei Fehler erneut publiziert werden
 */
@CommandHandler(CreateEinsatzCommand)
@Injectable()
export class CreateEinsatzHandler extends TransactionalCommandHandler<CreateEinsatzCommand, string> {
  private readonly logger = new Logger(CreateEinsatzHandler.name);

  constructor(
    prisma: PrismaService,
    @Inject(OUTBOX_REPOSITORY) outboxRepository: IOutboxRepository,
    @Inject(EINSATZ_REPOSITORY)
    private readonly einsatzRepository: IEinsatzRepository,
  ) {
    super(prisma, outboxRepository);
  }

  /**
   * Führt die Einsatz-Erstellung innerhalb einer Datenbank-Transaktion aus.
   *
   * Diese Methode implementiert die Business Logic für CreateEinsatzCommand:
   * 1. Validiert User-ID Format
   * 2. Erstellt Einsatz Aggregate via Factory Method
   * 3. Speichert Aggregate in Transaction
   * 4. Extrahiert Domain Events für Outbox
   *
   * WICHTIG: Nutzt `tx` Parameter für alle DB-Operationen (NICHT this.prisma).
   * Base Handler koordiniert Transaction Commit und Outbox-Persistierung.
   *
   * **Warum Exceptions statt Result<T> hier:**
   * - TransactionalCommandHandler erwartet Exceptions für Transaction Rollback
   * - Result<T> Pattern wird in execute() der Base Class genutzt
   * - Exceptions triggern automatisch Transaction Rollback
   *
   * @param command - Validierter CreateEinsatzCommand
   * @param tx - Transaction Context (framework-agnostisch, Infrastructure castet zu Prisma)
   * @returns result: EinsatzId String, events: Domain Events für Outbox
   * @throws EinsatzValidationException bei Business Rule Violations (triggert Transaction Rollback)
   * @throws EinsatzPersistenceException bei Persistierungs-Fehlern (triggert Transaction Rollback)
   */
  protected async executeInTransaction(command: CreateEinsatzCommand, tx: TransactionContext): Promise<{ result: string; events: DomainEvent[] }> {
    // Step 1: Validate UserId format
    const userIdResult = UserId.create(command.createdBy);
    if (userIdResult.isFailure) {
      const error = userIdResult.error ?? 'Ungültige User-ID';
      this.logger.warn('UserId validation failed', {
        error,
        createdBy: command.createdBy,
        operation: 'createEinsatz',
        phase: 'validation',
        errorType: 'EinsatzValidationException',
      });
      throw new EinsatzValidationException(error, 'createdBy');
    }
    const userId = userIdResult.value;

    // Defensive Programming: TypeScript kann Result<T>.value nicht automatisch als non-null
    // narrowen nach isSuccess-Prüfung, da das Type-System diese Garantie nicht ausdrücken kann.
    if (!userId) {
      this.logger.error('Unexpected null UserId after successful validation', {
        operation: 'createEinsatz',
        phase: 'validation',
        errorType: 'EinsatzValidationException',
      });
      throw new EinsatzValidationException('Ungültige User-ID', 'createdBy');
    }

    // Step 2: Create Aggregate via Factory Method
    // Business Rules werden vom Aggregate enforced (alarmstichwort required, status = ANGELEGT)
    const aggregateResult = Einsatz.create({
      alarmstichwort: command.alarmstichwort,
      createdBy: userId,
      einsatzort: command.einsatzort,
      bemerkung: command.bemerkung,
    });

    if (aggregateResult.isFailure) {
      const error = aggregateResult.error ?? 'Einsatz konnte nicht erstellt werden';
      this.logger.warn('Einsatz creation failed', {
        error,
        alarmstichwort: command.alarmstichwort,
        operation: 'createEinsatz',
        phase: 'validation',
        errorType: 'EinsatzValidationException',
      });
      throw new EinsatzValidationException(error, 'alarmstichwort');
    }

    const einsatz = aggregateResult.value;
    if (!einsatz) {
      this.logger.error('Unexpected null Einsatz after successful creation', {
        operation: 'createEinsatz',
        phase: 'validation',
        errorType: 'EinsatzValidationException',
      });
      throw new EinsatzValidationException('Einsatz konnte nicht erstellt werden');
    }

    // Step 3: Save Aggregate in Transaction (WICHTIG: Nutze tx, nicht this.prisma)
    const saveResult = await this.einsatzRepository.save(einsatz, tx);
    if (saveResult.isFailure) {
      const error = saveResult.error ?? 'Einsatz konnte nicht gespeichert werden';
      this.logger.error('Failed to save Einsatz', {
        error,
        einsatzId: einsatz.id.value,
        operation: 'createEinsatz',
        phase: 'persistence',
        errorType: 'EinsatzPersistenceException',
      });
      throw new EinsatzPersistenceException(error, einsatz.id.value);
    }

    // Step 4: Extract Domain Events for Outbox
    // Base Handler wird Events in Outbox persistieren (atomar in gleicher TX)
    // Repository cleared bereits nach Transaction Commit
    const events = einsatz.getDomainEvents();

    this.logger.log('Einsatz created successfully', {
      einsatzId: einsatz.id.value,
      nummer: einsatz.nummer,
      alarmstichwort: einsatz.alarmstichwort,
      eventCount: events.length,
    });

    // Step 5: Return result + events für Base Handler
    // Base Handler committed Transaction wenn alles erfolgreich
    return {
      result: einsatz.id.value,
      events,
    };
  }
}
