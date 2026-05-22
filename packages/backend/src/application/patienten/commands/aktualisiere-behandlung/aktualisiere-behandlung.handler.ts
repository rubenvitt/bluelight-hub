import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@/generated/prisma/client';
import type { DomainEvent } from '@domain/common/domain-event';
import { Result } from '@domain/common/result';
import type { TransactionContext } from '@domain/common/transaction';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import type { IEtbRepository } from '@domain/repositories';
import type { ILogger } from '@domain/ports/i-logger.port';
import { Patient, PatientId } from '@domain/patienten/aggregates/patient.aggregate';
import { Behandlungsstatus } from '@domain/patienten/value-objects/behandlungsstatus.vo';
import { ErfasserRef } from '@domain/patienten/value-objects/erfasser-ref.vo';
import type { PatientRepository } from '@domain/patienten/repositories/patient.repository';
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
import { AKTUALISIERE_BEHANDLUNG_ERROR_CODES } from '../../errors/aktualisiere-behandlung-error.codes';
import { AktualisiereBehandlungCommand } from './aktualisiere-behandlung.command';

/**
 * Handler für den `aktualisiere-behandlung`-Use-Case (Story 1.4, FR18, AC1/AC6).
 *
 * Persistiert in einer einzigen Prisma-Transaktion (Append-only, NFR-S5,
 * Architecture §D-2):
 *  1. `PatientBehandlungBegonnen` oder `PatientBehandlungAbgeschlossen`-Event
 *  2. Denormalisierter `Patient.behandlungsstatus`-Snapshot
 *  3. ETB-Eintrag mit `kontextType='patient'`, `kind='patient.behandlung-…'`
 *  4. Outbox-Event (via Basisklasse — Vorbereitung Story 3.1 WS-Broadcast)
 *
 * **Defense-in-Depth Scope-Check (ADR-012):** `patient.einsatzId !== command.einsatzId`
 * → `PATIENT_NICHT_GEFUNDEN` (kein Info-Leak).
 *
 * **Lessons-Learned aus Story 1.3:** `vorher` wird im Handler aus dem Snapshot
 * **vor** der Aggregate-Mutation festgehalten — nicht aus emittierten Events
 * extrahiert.
 */
@Injectable()
export class AktualisiereBehandlungHandler extends TransactionalCommandHandler<AktualisiereBehandlungCommand, PatientDto> {
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

  protected async executeInTransaction(command: AktualisiereBehandlungCommand, tx: TransactionContext): Promise<Result<PatientDto> | { result: PatientDto; events: DomainEvent[] }> {
    // 1. Pflichtfeld-Validierung
    if (!command.einsatzId || command.einsatzId.trim().length === 0) {
      return Result.fail<PatientDto>(AKTUALISIERE_BEHANDLUNG_ERROR_CODES.EINSATZ_ID_REQUIRED);
    }
    if (!command.patientId || command.patientId.trim().length === 0) {
      return Result.fail<PatientDto>(AKTUALISIERE_BEHANDLUNG_ERROR_CODES.PATIENT_ID_REQUIRED);
    }
    if (command.clockDriftSeconds !== undefined && (!Number.isFinite(command.clockDriftSeconds) || !Number.isInteger(command.clockDriftSeconds))) {
      return Result.fail<PatientDto>(AKTUALISIERE_BEHANDLUNG_ERROR_CODES.CLOCK_DRIFT_INVALID);
    }

    // 2. VO-Validierung (Enum-Mismatch früh erkennen)
    const statusResult = Behandlungsstatus.create(command.neuerStatus);
    if (statusResult.isFailure || !statusResult.value) {
      return Result.fail<PatientDto>(AKTUALISIERE_BEHANDLUNG_ERROR_CODES.NEUER_STATUS_INVALID);
    }

    const actorResult = this.buildActor(command);
    if (actorResult.isFailure || !actorResult.value) {
      return Result.fail<PatientDto>(AKTUALISIERE_BEHANDLUNG_ERROR_CODES.ACTOR_INVALID);
    }
    const actorRef = actorResult.value;

    // 3. Patient laden + Scope-Check
    const patientIdResult = PatientId.create(command.patientId);
    if (patientIdResult.isFailure || !patientIdResult.value) {
      return Result.fail<PatientDto>(AKTUALISIERE_BEHANDLUNG_ERROR_CODES.PATIENT_NICHT_GEFUNDEN);
    }
    const patient = await this.patientRepository.findById(patientIdResult.value as PatientId, tx);
    if (!patient) {
      return Result.fail<PatientDto>(AKTUALISIERE_BEHANDLUNG_ERROR_CODES.PATIENT_NICHT_GEFUNDEN);
    }
    if (patient.einsatzId !== command.einsatzId) {
      return Result.fail<PatientDto>(AKTUALISIERE_BEHANDLUNG_ERROR_CODES.PATIENT_NICHT_GEFUNDEN);
    }

    // Snapshot des alten Status FESTHALTEN — Lessons-Learned 1.3
    const vorher = patient.behandlungsstatus.code;
    const neu = command.neuerStatus;

    // 4. Dispatch auf Aggregate-Methode anhand Ziel-Status
    const options = {
      actorUserId: actorRef.data.type === 'user' ? actorRef.data.userId : undefined,
      actorDeviceId: actorRef.data.type === 'device' ? actorRef.data.deviceId : undefined,
      originSessionId: actorRef.data.type === 'device' ? actorRef.data.captureSessionId : undefined,
      clockDriftSeconds: command.clockDriftSeconds,
    };

    let domainResult: Result<void>;
    let kind: 'patient.behandlung-begonnen' | 'patient.behandlung-abgeschlossen';
    if (neu === 'IN_BEHANDLUNG') {
      domainResult = patient.behandlungBeginnen(options);
      kind = 'patient.behandlung-begonnen';
    } else if (neu === 'VERSORGT' || neu === 'TRANSPORTBEREIT') {
      domainResult = patient.behandlungAbschliessen(neu, options);
      kind = 'patient.behandlung-abgeschlossen';
    } else {
      // UNVERSORGT als regulärer Ziel-Status: blockt über Übergangs-Validierung; das ist explizit
      // Korrektur-Pfad-Territorium (Story 1.4 FR42)
      return Result.fail<PatientDto>('BusinessRule:BehandlungUngueltigerUebergang');
    }
    if (domainResult.isFailure) {
      return Result.fail<PatientDto>(domainResult.error ?? 'BusinessRule:BehandlungUpdateFehlgeschlagen');
    }

    // Snapshot der Events VOR save (save() ruft clearDomainEvents auf)
    const patientEvents = [...patient.getDomainEvents()];

    let saveResult: Result<void>;
    try {
      saveResult = await this.patientRepository.save(patient, tx);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail<PatientDto>(`${AKTUALISIERE_BEHANDLUNG_ERROR_CODES.PATIENT_SAVE_FAILED}:${message}`);
    }
    if (saveResult.isFailure) {
      return Result.fail<PatientDto>(saveResult.error ?? AKTUALISIERE_BEHANDLUNG_ERROR_CODES.PATIENT_SAVE_FAILED);
    }

    // 5. ETB-Eintrag
    const etbResult = await this.appendEtbEintrag(command, tx, patient, kind, vorher, neu, actorRef);
    if (etbResult.isFailure) {
      return Result.fail<PatientDto>(etbResult.error ?? AKTUALISIERE_BEHANDLUNG_ERROR_CODES.ETB_APPEND_FAILED);
    }
    const etbEvents = etbResult.value!;

    const events: DomainEvent[] = [...patientEvents, ...etbEvents];

    this.logger.log(
      `Patient ${patient.patientennummer.value}: Behandlung ${kind === 'patient.behandlung-begonnen' ? 'begonnen' : 'abgeschlossen'} (${vorher} → ${neu})`,
      'AktualisiereBehandlungHandler',
    );

    return {
      result: this.patientMapper.toDto(patient),
      events,
    };
  }

  private buildActor(command: AktualisiereBehandlungCommand): Result<ErfasserRef> {
    if (command.actor.type === 'user') {
      return ErfasserRef.user(command.actor.userId);
    }
    if (command.actor.type === 'device') {
      return ErfasserRef.device(command.actor.deviceId, command.actor.captureSessionId);
    }
    return Result.fail<ErfasserRef>(AKTUALISIERE_BEHANDLUNG_ERROR_CODES.ACTOR_INVALID);
  }

  private async appendEtbEintrag(
    command: AktualisiereBehandlungCommand,
    tx: TransactionContext,
    patient: Patient,
    kind: 'patient.behandlung-begonnen' | 'patient.behandlung-abgeschlossen',
    vorher: string,
    neu: string,
    actorRef: ErfasserRef,
  ): Promise<Result<DomainEvent[]>> {
    const einsatzIdResult = EinsatzId.create(command.einsatzId);
    if (einsatzIdResult.isFailure || !einsatzIdResult.value) {
      return Result.fail<DomainEvent[]>(AKTUALISIERE_BEHANDLUNG_ERROR_CODES.EINSATZ_ID_REQUIRED);
    }

    const aggregate = await this.etbRepository.findByEinsatzId(einsatzIdResult.value, tx);
    if (aggregate === null) {
      return Result.fail<DomainEvent[]>(`${AKTUALISIERE_BEHANDLUNG_ERROR_CODES.ETB_APPEND_FAILED}:ETB-Aggregat fehlt für einsatzId=${command.einsatzId}`);
    }

    if (actorRef.data.type !== 'user') {
      return Result.fail<DomainEvent[]>(AKTUALISIERE_BEHANDLUNG_ERROR_CODES.ACTOR_INVALID);
    }
    const userIdResult = UserId.create(actorRef.data.userId);
    if (userIdResult.isFailure || !userIdResult.value) {
      return Result.fail<DomainEvent[]>(AKTUALISIERE_BEHANDLUNG_ERROR_CODES.ACTOR_INVALID);
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
      return Result.fail<DomainEvent[]>(AKTUALISIERE_BEHANDLUNG_ERROR_CODES.ETB_CONTEXT_INVALID);
    }

    const kontext = EintragKontext.patient({
      kind,
      patientId: patient.id.value,
      patientennummer: patient.patientennummer.value,
      payload,
    });

    const action = kind === 'patient.behandlung-begonnen' ? 'Behandlung begonnen' : 'Behandlung abgeschlossen';
    const text = `Patient ${patient.patientennummer.value}: ${action} (${vorher} → ${neu})`;
    const now = new Date();

    const addResult = aggregate.addEintrag(text, userIdResult.value, EtbKategorie.SONSTIGES(), undefined, undefined, undefined, now, {
      kontext,
      ereignisZeitpunkt: now,
    });
    if (addResult.isFailure) {
      return Result.fail<DomainEvent[]>(`${AKTUALISIERE_BEHANDLUNG_ERROR_CODES.ETB_APPEND_FAILED}:${addResult.error ?? 'unknown'}`);
    }

    try {
      await this.etbRepository.save(aggregate, tx as Prisma.TransactionClient);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail<DomainEvent[]>(`${AKTUALISIERE_BEHANDLUNG_ERROR_CODES.ETB_APPEND_FAILED}:${message}`);
    }

    const events = aggregate.getDomainEvents();
    aggregate.clearDomainEvents();
    return Result.ok<DomainEvent[]>(events);
  }
}
