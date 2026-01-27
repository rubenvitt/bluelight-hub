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
import type { AssignErinnerungCommand } from './assign-erinnerung.command';
import { ERINNERUNG_ERROR_CODES } from '../../errors/erinnerung-error.codes';
import type { ErinnerungResponseDto } from '../../dto/erinnerung-response.dto';
import type { Prisma } from '@/generated/prisma/client';

/**
 * Handler zum Zuweisen einer bestehenden Erinnerung an einen anderen Benutzer.
 *
 * Nutzt TransactionalCommandHandler für atomare Persistenz mit Outbox-Events.
 * Validiert dass der zugewiesene User ein aktiver Einsatz-Teilnehmer ist.
 *
 * **Story 3.4 AC1:**
 * - Bestehende Erinnerung nachträglich zuweisen
 * - Teilnehmer aus aktiven Einsatz-Teilnehmern auswählen
 * - Nach Speichern erhält der Teilnehmer die Notification
 *
 * **Story 3.4 AC2:**
 * - Nach Zuweisung verschwindet Erinnerung aus "Meine Erinnerungen" des alten Besitzers
 * - Bleibt in "Team-Erinnerungen" sichtbar
 *
 * **Transactional Outbox Pattern:**
 * - Erinnerung und ErinnerungAssignedEvent werden atomar in einer Transaktion gespeichert
 * - Event wird erst nach erfolgreichem Commit aus Outbox verarbeitet
 *
 * @see AssignErinnerungCommand - Input Validierung
 * @see Erinnerung.assignToUser - Domain Operation
 * @see ErinnerungAssignedEvent - Emittiertes Domain Event
 */
@Injectable()
export class AssignErinnerungHandler extends TransactionalCommandHandler<AssignErinnerungCommand, ErinnerungResponseDto> {
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
   * Führt die Erinnerung-Zuweisung in einer Transaktion aus.
   *
   * **Flow:**
   * 1. Erinnerung laden und existenz prüfen
   * 2. Validieren dass assignedToId ein aktiver Einsatz-Teilnehmer ist
   * 3. Domain Operation: assignToUser aufrufen
   * 4. Im Repository persistieren
   * 5. Domain Events sammeln
   * 6. Response DTO zurückgeben
   *
   * @param command - Validierter AssignErinnerungCommand
   * @param tx - Transaction Context für atomare Operationen
   * @returns Result mit ErinnerungResponseDto oder Error
   */
  protected async executeInTransaction(command: AssignErinnerungCommand, tx: TransactionContext): Promise<Result<ErinnerungResponseDto> | { result: ErinnerungResponseDto; events: DomainEvent[] }> {
    const prismaClient = tx as Prisma.TransactionClient;

    // ════════════════════════════════════════════════════════════════════════
    // 1. Erinnerung laden
    // ════════════════════════════════════════════════════════════════════════
    const erinnerungIdResult = ErinnerungId.create(command.erinnerungId);
    if (erinnerungIdResult.isFailure || !erinnerungIdResult.value) {
      return Result.fail<ErinnerungResponseDto>(erinnerungIdResult.error ?? ERINNERUNG_ERROR_CODES.ID_INVALID);
    }

    const erinnerungResult = await this.erinnerungRepository.findById(erinnerungIdResult.value, tx);
    if (erinnerungResult.isFailure || !erinnerungResult.value) {
      return Result.fail<ErinnerungResponseDto>(erinnerungResult.error ?? ERINNERUNG_ERROR_CODES.NOT_FOUND);
    }
    const erinnerung = erinnerungResult.value;

    // Validate einsatzId matches
    if (erinnerung.einsatzId.toString() !== command.einsatzId) {
      this.logger.warn(`Erinnerung ${command.erinnerungId} does not belong to Einsatz ${command.einsatzId}`, 'AssignErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(ERINNERUNG_ERROR_CODES.NOT_FOUND);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. Validiere assignedToId ist aktiver Einsatz-Teilnehmer
    // ════════════════════════════════════════════════════════════════════════
    const assignedToIdResult = UserId.create(command.assignedToId);
    if (assignedToIdResult.isFailure || !assignedToIdResult.value) {
      return Result.fail<ErinnerungResponseDto>(assignedToIdResult.error ?? ERINNERUNG_ERROR_CODES.INVALID_ASSIGNED_TO);
    }

    const isActiveTeilnehmer = await prismaClient.einsatzTeilnehmer.findFirst({
      where: {
        einsatzId: command.einsatzId,
        userId: command.assignedToId,
        leftAt: null, // Nur aktive Teilnehmer
      },
      select: { id: true },
    });

    if (!isActiveTeilnehmer) {
      this.logger.warn(`User ${command.assignedToId} is not an active participant of Einsatz ${command.einsatzId}`, 'AssignErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(ERINNERUNG_ERROR_CODES.INVALID_ASSIGNED_TO);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3. Validiere assignedById (User der die Zuweisung vornimmt)
    // ════════════════════════════════════════════════════════════════════════
    const assignedByIdResult = UserId.create(command.assignedById);
    if (assignedByIdResult.isFailure || !assignedByIdResult.value) {
      return Result.fail<ErinnerungResponseDto>(assignedByIdResult.error ?? ERINNERUNG_ERROR_CODES.USER_ID_INVALID);
    }

    // Story 4.2 AC: Only current assignee can delegate (if already assigned)
    if (erinnerung.assignedToId && erinnerung.assignedToId.toString() !== command.assignedById) {
      this.logger.warn(`User ${command.assignedById} tried to delegate reminder assigned to ${erinnerung.assignedToId}`, 'AssignErinnerungHandler');
      // Using generic unauthorized if explicit code not available, but prefer specific
      return Result.fail<ErinnerungResponseDto>(ERINNERUNG_ERROR_CODES.NOT_AUTHORIZED);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 4. Domain Operation: assignToUser aufrufen
    // ════════════════════════════════════════════════════════════════════════
    const assignResult = erinnerung.assignToUser(assignedToIdResult.value, assignedByIdResult.value);
    if (assignResult.isFailure) {
      this.logger.warn(`Failed to assign Erinnerung: ${assignResult.error}`, 'AssignErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(assignResult.error ?? ERINNERUNG_ERROR_CODES.NOT_EDITABLE);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 5. Im Repository persistieren
    // ════════════════════════════════════════════════════════════════════════
    const saveResult = await this.erinnerungRepository.save(erinnerung, tx);
    if (saveResult.isFailure) {
      this.logger.error(`Failed to save Erinnerung: ${saveResult.error}`, 'AssignErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(saveResult.error ?? ERINNERUNG_ERROR_CODES.SAVE_FAILED);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 6. Audit-Trail loggen
    // ════════════════════════════════════════════════════════════════════════
    this.logger.log(`Erinnerung zugewiesen (id: ${erinnerung.id.toString()}, assignedTo: ${command.assignedToId}, assignedBy: ${command.assignedById})`, 'AssignErinnerungHandler');

    // ════════════════════════════════════════════════════════════════════════
    // 7. Domain Events sammeln
    // ════════════════════════════════════════════════════════════════════════
    const events = erinnerung.getDomainEvents();
    erinnerung.clearDomainEvents();

    // ════════════════════════════════════════════════════════════════════════
    // 8. AssignedTo Name aus DB laden
    // ════════════════════════════════════════════════════════════════════════
    const assignedUser = await prismaClient.user.findUnique({
      where: { id: command.assignedToId },
      select: { username: true },
    });
    const assignedToName = assignedUser?.username ?? null;

    // ════════════════════════════════════════════════════════════════════════
    // 9. Response DTO erstellen und zurückgeben
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
      requiresNote: erinnerung.requiresNote,
      assignedToId: command.assignedToId,
      assignedToName,
    };

    return {
      result: responseDto,
      events,
    };
  }
}
