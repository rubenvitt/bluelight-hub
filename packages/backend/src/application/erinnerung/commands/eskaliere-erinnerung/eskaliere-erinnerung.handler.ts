import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Inject, Injectable } from '@nestjs/common';
import type { DomainEvent } from '@domain/common/domain-event';
import { Result } from '@domain/common/result';
import type { TransactionContext } from '@domain/common/transaction';
import type { ILogger } from '@domain/ports/i-logger.port';
import type { IErinnerungRepository } from '@domain/repositories/i-erinnerung.repository';
import type { IUserRepository } from '@domain/repositories/i-user.repository';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import { UserId } from '@domain/value-objects/user-id';
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import { TransactionalCommandHandler } from '@/application/common/handlers/transactional-command.handler';
// biome-ignore lint/style/useImportType: PrismaService is an Injectable class, not just a type needed for runtime DI
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ERINNERUNG_REPOSITORY, LOGGER, OUTBOX_REPOSITORY, USER_REPOSITORY } from '@infrastructure/di-tokens';
import { EskaliereErinnerungCommand } from './eskaliere-erinnerung.command';
import { ERINNERUNG_ERROR_CODES } from '../../errors/erinnerung-error.codes';
import type { ErinnerungResponseDto } from '../../dto/erinnerung-response.dto';
// biome-ignore lint/style/useImportType: ErinnerungResponseFactory is an Injectable class, needed for DI
import { ErinnerungResponseFactory } from '../../dto/erinnerung-response.factory';

/**
 * Handler zum Eskalieren einer Erinnerung.
 *
 * **Flow:**
 * 1. Lädt Erinnerung
 * 2. Ruft `erinnerung.eskalieren()` auf
 * 3. Persistiert Statusänderung und emittiert `ErinnerungEskaliertEvent` (Outbox)
 *
 * **Transactional:**
 * - Nutzt TransactionalCommandHandler für Atomicity von State + Event
 */
@Injectable()
@CommandHandler(EskaliereErinnerungCommand)
export class EskaliereErinnerungHandler extends TransactionalCommandHandler<EskaliereErinnerungCommand, ErinnerungResponseDto> implements ICommandHandler<EskaliereErinnerungCommand> {
  constructor(
    prisma: PrismaService,
    @Inject(OUTBOX_REPOSITORY) outboxRepository: IOutboxRepository,
    @Inject(ERINNERUNG_REPOSITORY)
    private readonly erinnerungRepository: IErinnerungRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(LOGGER) private readonly logger: ILogger,
    private readonly responseFactory: ErinnerungResponseFactory,
  ) {
    super(prisma, outboxRepository);
  }

  protected async executeInTransaction(command: EskaliereErinnerungCommand, tx: TransactionContext): Promise<Result<ErinnerungResponseDto> | { result: ErinnerungResponseDto; events: DomainEvent[] }> {
    // 1. ID validieren
    const erinnerungIdResult = ErinnerungId.create(command.erinnerungId);
    if (erinnerungIdResult.isFailure || !erinnerungIdResult.value) {
      return Result.fail<ErinnerungResponseDto>(erinnerungIdResult.error ?? ERINNERUNG_ERROR_CODES.ID_INVALID);
    }

    // 2. Erinnerung laden
    const findResult = await this.erinnerungRepository.findById(erinnerungIdResult.value, tx);
    if (findResult.isFailure || !findResult.value) {
      if (findResult.isFailure) {
        this.logger.error(`Failed to load Erinnerung: ${findResult.error}`, 'EskaliereErinnerungHandler');
      }
      return Result.fail<ErinnerungResponseDto>(findResult.error ?? ERINNERUNG_ERROR_CODES.NOT_FOUND);
    }
    const erinnerung = findResult.value;

    // 2.5. UserId validieren (falls vorhanden)
    let eskaliertVon: UserId | 'SYSTEM' = 'SYSTEM';
    if (command.eskaliertVon && command.eskaliertVon !== 'SYSTEM') {
      // Import UserId if not imported? It is imported at line 8
      const userIdResult = UserId.create(command.eskaliertVon);
      if (userIdResult.isFailure || !userIdResult.value) {
        return Result.fail<ErinnerungResponseDto>(userIdResult.error ?? 'USER_ID_INVALID');
      }
      eskaliertVon = userIdResult.value;
    }

    // 3. Domain Logic: eskalieren()

    // Story 4.8: Multi-Level Escalation Resolution
    let nextTargetId: UserId | null = null;

    // Wenn bereits eskaliert, suchen wir nach der nächsten Stufe
    if (erinnerung.status.isEskaliert() && erinnerung.assignedToId) {
      const assigneeResult = await this.userRepository.findById(erinnerung.assignedToId);
      if (assigneeResult.isSuccess && assigneeResult.value) {
        nextTargetId = assigneeResult.value.defaultEscalationTargetId;
        if (nextTargetId) {
          this.logger.debug(`Multi-Level Escalation: Found next target ${nextTargetId.toString()} for user ${erinnerung.assignedToId.toString()}`, 'EskaliereErinnerungHandler');
        }
      }
    }

    const eskalierenResult = erinnerung.eskalieren(eskaliertVon, nextTargetId);
    if (eskalierenResult.isFailure) {
      const errorCode = eskalierenResult.error as string;

      // Diese Fehler sind NICHT kritisch - sie bedeuten, dass die Erinnerung
      // bereits von einem anderen Handler/Prozess verarbeitet wurde (Race Condition)
      // oder das Intensivierungs-Limit erreicht hat. In beiden Fällen ist kein
      // Action erforderlich - wir loggen nur und geben Success zurück.
      if (errorCode === 'ERINNERUNG_NOT_ESCALATABLE') {
        this.logger.debug(`Erinnerung bereits eskaliert oder nicht mehr im Status AUSGELOEST (id: ${command.erinnerungId}) - Skip`, 'EskaliereErinnerungHandler');
        // Lade aktuelle Version und gib sie zurück (ohne Events)
        const currentDto = await this.responseFactory.create(erinnerung);
        return { result: currentDto, events: [] };
      }

      if (errorCode === 'INTENSIVIERUNG_LIMIT_ERREICHT') {
        this.logger.log(`Intensivierungs-Limit erreicht für Erinnerung (id: ${command.erinnerungId}) - keine weitere Intensivierung`, 'EskaliereErinnerungHandler');
        // Lade aktuelle Version und gib sie zurück (ohne Events)
        const currentDto = await this.responseFactory.create(erinnerung);
        return { result: currentDto, events: [] };
      }

      // Andere Fehler sind weiterhin kritisch
      this.logger.warn(`Escalation failed: ${errorCode} (id: ${command.erinnerungId})`);
      return Result.fail<ErinnerungResponseDto>(errorCode);
    }

    // 4. Events extrahieren
    const events = erinnerung.getDomainEvents();
    erinnerung.clearDomainEvents();

    // 5. Speichern
    const saveResult = await this.erinnerungRepository.save(erinnerung, tx);
    if (saveResult.isFailure) {
      this.logger.error(`Failed to save escalated Erinnerung: ${saveResult.error}`, 'EskaliereErinnerungHandler');
      return Result.fail<ErinnerungResponseDto>(saveResult.error ?? ERINNERUNG_ERROR_CODES.SAVE_FAILED);
    }

    // Check which event was emitted to log correctly
    const isEskaliert = events.some((e) => e.constructor.name === 'ErinnerungEskaliertEvent');
    const isIntensiviert = events.some((e) => e.constructor.name === 'ErinnerungIntensiviertEvent');

    if (isEskaliert) {
      this.logger.log(`Erinnerung eskaliert (id: ${erinnerung.id.toString()}, an: ${erinnerung.eskalationsPersonId?.toString()})`, 'EskaliereErinnerungHandler');
    } else if (isIntensiviert) {
      this.logger.debug(`Erinnerung intensiviert (id: ${erinnerung.id.toString()}, neuer intensivierungsCount: ${erinnerung.intensivierungsCount})`, 'EskaliereErinnerungHandler');
    } else {
      this.logger.warn(`Erinnerung eskalieren() called but no relevant event found (id: ${erinnerung.id.toString()})`, 'EskaliereErinnerungHandler');
    }

    // 6. Response
    try {
      const dto = await this.responseFactory.create(erinnerung);

      return {
        result: dto,
        events,
      };
    } catch (error) {
      this.logger.warn(`Failed to create full response DTO: ${error}. Attempting partial recovery...`, 'EskaliereErinnerungHandler');

      // Attempt to resolve names manually to avoid empty UI
      let erstellerName = 'Unknown';
      let eskalationsPersonName: string | null = null;
      let assignedToName: string | null = null;
      let previousAssigneeName: string | null = null;
      let _erledigtByName: string | null = null;

      try {
        const userIds = [
          erinnerung.erstelltVon.value,
          erinnerung.eskalationsPersonId?.value,
          erinnerung.assignedToId?.value,
          erinnerung.previousAssigneeId?.value,
          erinnerung.erledigtBy?.value,
        ].filter((id): id is string => !!id);

        if (userIds.length > 0) {
          const users = await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true },
          });

          const getName = (id: string | undefined) => {
            if (!id) return null;
            const u = users.find((user) => user.id === id);
            return u ? u.username : 'Unknown';
          };

          erstellerName = getName(erinnerung.erstelltVon.value) ?? 'Unknown';
          eskalationsPersonName = getName(erinnerung.eskalationsPersonId?.value);
          assignedToName = getName(erinnerung.assignedToId?.value);
          previousAssigneeName = getName(erinnerung.previousAssigneeId?.value);
          _erledigtByName = getName(erinnerung.erledigtBy?.value);
        }
      } catch (innerError) {
        this.logger.error(`Partial recovery failed: ${innerError}`, 'EskaliereErinnerungHandler');
      }

      const basicDto: ErinnerungResponseDto = {
        id: erinnerung.id.toString(),
        einsatzId: erinnerung.einsatzId.toString(),
        titel: erinnerung.titel.value,
        beschreibung: erinnerung.beschreibung ?? null,
        faelligAm: erinnerung.faelligAm.toISOString(),
        status: erinnerung.status.value,
        ausgeloestAm: erinnerung.ausgeloestAm?.toISOString() ?? null,
        erstelltVon: erinnerung.erstelltVon.toString(),
        erstellerName,
        createdAt: erinnerung.createdAt.toISOString(),
        updatedAt: erinnerung.updatedAt.toISOString(),
        snoozeCount: erinnerung.snoozeCount,
        requiresNote: erinnerung.requiresNote,
        assignedToId: erinnerung.assignedToId?.toString() ?? null,
        assignedToName,
        eskalationsPersonId: erinnerung.eskalationsPersonId?.toString() ?? null,
        eskalationsPersonName,
        erledigtBy: erinnerung.erledigtBy?.toString() ?? null,
        // erledigtByName: erledigtByName, // Not in DTO interface yet
        erledigungsNotiz: erinnerung.erledigungsNotiz ?? null,
        escalatedAt: erinnerung.escalatedAt?.toISOString() ?? null,
        previousAssigneeId: erinnerung.previousAssigneeId?.toString() ?? null,
        previousAssigneeName,
      };

      return {
        result: basicDto,
        events,
      };
    }
  }
}
