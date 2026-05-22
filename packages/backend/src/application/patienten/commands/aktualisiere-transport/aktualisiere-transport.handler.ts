import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@/generated/prisma/client';
import type { DomainEvent } from '@domain/common/domain-event';
import { Result } from '@domain/common/result';
import type { TransactionContext } from '@domain/common/transaction';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import type { IEtbRepository } from '@domain/repositories';
import type { ILogger } from '@domain/ports/i-logger.port';
import { Patient, PatientId } from '@domain/patienten/aggregates/patient.aggregate';
import { ErfasserRef } from '@domain/patienten/value-objects/erfasser-ref.vo';
import type { PatientRepository } from '@domain/patienten/repositories/patient.repository';
import { Transportstatus } from '@domain/patienten/value-objects/transportstatus.vo';
import { PatientEtbContextSchema } from '@domain/patienten/schemas/etb-context.schema';
import { EintragKontext } from '@domain/value-objects/eintrag-kontext';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EtbKategorie } from '@domain/value-objects/etb-kategorie';
import { UserId } from '@domain/value-objects/user-id';
import { TransactionalCommandHandler } from '@/application/common/handlers/transactional-command.handler';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ETB_REPOSITORY, LOGGER, OUTBOX_REPOSITORY, PATIENT_REPOSITORY } from '@infrastructure/di-tokens';
import type { PatientDto } from '../../dto/patient.dto';
import { PatientMapper } from '../../mappers/patient.mapper';
import { AKTUALISIERE_TRANSPORT_ERROR_CODES } from '../../errors/aktualisiere-transport-error.codes';
import { AktualisiereTransportCommand } from './aktualisiere-transport.command';

/**
 * Handler für den `aktualisiere-transport`-Use-Case (Story 1.4, FR19, AC2/AC6).
 *
 * Persistiert in einer einzigen Prisma-Tx: PatientTransportGestartet bzw.
 * PatientTransportAbgeschlossen + Snapshot + ETB-Eintrag + Outbox.
 */
@Injectable()
export class AktualisiereTransportHandler extends TransactionalCommandHandler<AktualisiereTransportCommand, PatientDto> {
  constructor(
    prisma: PrismaService,
    @Inject(OUTBOX_REPOSITORY) outboxRepository: IOutboxRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(ETB_REPOSITORY) private readonly etbRepository: IEtbRepository,
    @Inject(LOGGER) private readonly logger: ILogger,
    private readonly patientMapper: PatientMapper,
  ) {
    super(prisma, outboxRepository);
  }

  protected async executeInTransaction(command: AktualisiereTransportCommand, tx: TransactionContext): Promise<Result<PatientDto> | { result: PatientDto; events: DomainEvent[] }> {
    if (!command.einsatzId || command.einsatzId.trim().length === 0) {
      return Result.fail<PatientDto>(AKTUALISIERE_TRANSPORT_ERROR_CODES.EINSATZ_ID_REQUIRED);
    }
    if (!command.patientId || command.patientId.trim().length === 0) {
      return Result.fail<PatientDto>(AKTUALISIERE_TRANSPORT_ERROR_CODES.PATIENT_ID_REQUIRED);
    }
    if (command.clockDriftSeconds !== undefined && (!Number.isFinite(command.clockDriftSeconds) || !Number.isInteger(command.clockDriftSeconds))) {
      return Result.fail<PatientDto>(AKTUALISIERE_TRANSPORT_ERROR_CODES.CLOCK_DRIFT_INVALID);
    }

    const statusResult = Transportstatus.create(command.neuerStatus);
    if (statusResult.isFailure || !statusResult.value) {
      return Result.fail<PatientDto>(AKTUALISIERE_TRANSPORT_ERROR_CODES.NEUER_STATUS_INVALID);
    }

    const actorResult = this.buildActor(command);
    if (actorResult.isFailure || !actorResult.value) {
      return Result.fail<PatientDto>(AKTUALISIERE_TRANSPORT_ERROR_CODES.ACTOR_INVALID);
    }
    const actorRef = actorResult.value;

    const patientIdResult = PatientId.create(command.patientId);
    if (patientIdResult.isFailure || !patientIdResult.value) {
      return Result.fail<PatientDto>(AKTUALISIERE_TRANSPORT_ERROR_CODES.PATIENT_NICHT_GEFUNDEN);
    }
    const patient = await this.patientRepository.findById(patientIdResult.value as PatientId, tx);
    if (!patient) {
      return Result.fail<PatientDto>(AKTUALISIERE_TRANSPORT_ERROR_CODES.PATIENT_NICHT_GEFUNDEN);
    }
    if (patient.einsatzId !== command.einsatzId) {
      return Result.fail<PatientDto>(AKTUALISIERE_TRANSPORT_ERROR_CODES.PATIENT_NICHT_GEFUNDEN);
    }

    const vorher = patient.transportstatus.code;
    const neu = command.neuerStatus;

    const options = {
      actorUserId: actorRef.data.type === 'user' ? actorRef.data.userId : undefined,
      actorDeviceId: actorRef.data.type === 'device' ? actorRef.data.deviceId : undefined,
      originSessionId: actorRef.data.type === 'device' ? actorRef.data.captureSessionId : undefined,
      clockDriftSeconds: command.clockDriftSeconds,
    };

    let domainResult: Result<void>;
    let kind: 'patient.transport-gestartet' | 'patient.transport-abgeschlossen';
    if (neu === 'IM_TRANSPORT') {
      domainResult = patient.transportStarten(options);
      kind = 'patient.transport-gestartet';
    } else if (neu === 'IM_KRANKENHAUS') {
      domainResult = patient.transportAbschliessen(options);
      kind = 'patient.transport-abgeschlossen';
    } else {
      // WARTEND als Ziel-Status: Übergangs-Validierung blockt; nur Korrektur erlaubt
      return Result.fail<PatientDto>('BusinessRule:TransportUngueltigerUebergang');
    }
    if (domainResult.isFailure) {
      return Result.fail<PatientDto>(domainResult.error ?? 'BusinessRule:TransportUpdateFehlgeschlagen');
    }

    const patientEvents = [...patient.getDomainEvents()];

    let saveResult: Result<void>;
    try {
      saveResult = await this.patientRepository.save(patient, tx);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail<PatientDto>(`${AKTUALISIERE_TRANSPORT_ERROR_CODES.PATIENT_SAVE_FAILED}:${message}`);
    }
    if (saveResult.isFailure) {
      return Result.fail<PatientDto>(saveResult.error ?? AKTUALISIERE_TRANSPORT_ERROR_CODES.PATIENT_SAVE_FAILED);
    }

    const etbResult = await this.appendEtbEintrag(command, tx, patient, kind, vorher, neu, actorRef);
    if (etbResult.isFailure) {
      return Result.fail<PatientDto>(etbResult.error ?? AKTUALISIERE_TRANSPORT_ERROR_CODES.ETB_APPEND_FAILED);
    }
    const etbEvents = etbResult.value!;

    const events: DomainEvent[] = [...patientEvents, ...etbEvents];

    this.logger.log(
      `Patient ${patient.patientennummer.value}: Transport ${kind === 'patient.transport-gestartet' ? 'gestartet' : 'abgeschlossen'} (${vorher} → ${neu})`,
      'AktualisiereTransportHandler',
    );

    return {
      result: this.patientMapper.toDto(patient),
      events,
    };
  }

  private buildActor(command: AktualisiereTransportCommand): Result<ErfasserRef> {
    if (command.actor.type === 'user') {
      return ErfasserRef.user(command.actor.userId);
    }
    if (command.actor.type === 'device') {
      return ErfasserRef.device(command.actor.deviceId, command.actor.captureSessionId);
    }
    return Result.fail<ErfasserRef>(AKTUALISIERE_TRANSPORT_ERROR_CODES.ACTOR_INVALID);
  }

  private async appendEtbEintrag(
    command: AktualisiereTransportCommand,
    tx: TransactionContext,
    patient: Patient,
    kind: 'patient.transport-gestartet' | 'patient.transport-abgeschlossen',
    vorher: string,
    neu: string,
    actorRef: ErfasserRef,
  ): Promise<Result<DomainEvent[]>> {
    const einsatzIdResult = EinsatzId.create(command.einsatzId);
    if (einsatzIdResult.isFailure || !einsatzIdResult.value) {
      return Result.fail<DomainEvent[]>(AKTUALISIERE_TRANSPORT_ERROR_CODES.EINSATZ_ID_REQUIRED);
    }

    const aggregate = await this.etbRepository.findByEinsatzId(einsatzIdResult.value, tx);
    if (aggregate === null) {
      return Result.fail<DomainEvent[]>(`${AKTUALISIERE_TRANSPORT_ERROR_CODES.ETB_APPEND_FAILED}:ETB-Aggregat fehlt für einsatzId=${command.einsatzId}`);
    }

    if (actorRef.data.type !== 'user') {
      return Result.fail<DomainEvent[]>(AKTUALISIERE_TRANSPORT_ERROR_CODES.ACTOR_INVALID);
    }
    const userIdResult = UserId.create(actorRef.data.userId);
    if (userIdResult.isFailure || !userIdResult.value) {
      return Result.fail<DomainEvent[]>(AKTUALISIERE_TRANSPORT_ERROR_CODES.ACTOR_INVALID);
    }

    const payload = { vorher, neu };
    const contextValidation = PatientEtbContextSchema.safeParse({
      kind,
      patientId: patient.id.value,
      patientennummer: patient.patientennummer.value,
      ...payload,
    });
    if (!contextValidation.success) {
      this.logger.error('PatientEtbContext-Validierung fehlgeschlagen', { error: contextValidation.error.message });
      return Result.fail<DomainEvent[]>(AKTUALISIERE_TRANSPORT_ERROR_CODES.ETB_CONTEXT_INVALID);
    }

    const kontext = EintragKontext.patient({
      kind,
      patientId: patient.id.value,
      patientennummer: patient.patientennummer.value,
      payload,
    });

    const action = kind === 'patient.transport-gestartet' ? 'Transport gestartet' : 'Transport abgeschlossen';
    const text = `Patient ${patient.patientennummer.value}: ${action} (${vorher} → ${neu})`;
    const now = new Date();

    const addResult = aggregate.addEintrag(text, userIdResult.value, EtbKategorie.SONSTIGES(), undefined, undefined, undefined, now, {
      kontext,
      ereignisZeitpunkt: now,
    });
    if (addResult.isFailure) {
      return Result.fail<DomainEvent[]>(`${AKTUALISIERE_TRANSPORT_ERROR_CODES.ETB_APPEND_FAILED}:${addResult.error ?? 'unknown'}`);
    }

    try {
      await this.etbRepository.save(aggregate, tx as Prisma.TransactionClient);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail<DomainEvent[]>(`${AKTUALISIERE_TRANSPORT_ERROR_CODES.ETB_APPEND_FAILED}:${message}`);
    }

    const events = aggregate.getDomainEvents();
    aggregate.clearDomainEvents();
    return Result.ok<DomainEvent[]>(events);
  }
}
