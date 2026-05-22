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
import { KORRIGIERE_PATIENT_ERROR_CODES } from '../../errors/korrigiere-patient-error.codes';
import { KorrigierePatientCommand } from './korrigiere-patient.command';

/**
 * Handler für den `korrigiere-patient`-Use-Case (Story 1.4, FR42, AC4/AC6).
 *
 * Append-only Korrektur-Pfad ohne Übergangs-Validierung. Persistiert in einer
 * Prisma-Tx: `PatientKorrigiert`-Event + denormalisierter Snapshot + ETB +
 * Outbox. Der `grund` ist Pflicht und wird im Audit-Trail (ETB-Text + Event-
 * Payload + Logger) gespiegelt.
 */
@Injectable()
export class KorrigierePatientHandler extends TransactionalCommandHandler<KorrigierePatientCommand, PatientDto> {
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

  protected async executeInTransaction(command: KorrigierePatientCommand, tx: TransactionContext): Promise<Result<PatientDto> | { result: PatientDto; events: DomainEvent[] }> {
    if (!command.einsatzId || command.einsatzId.trim().length === 0) {
      return Result.fail<PatientDto>(KORRIGIERE_PATIENT_ERROR_CODES.EINSATZ_ID_REQUIRED);
    }
    if (!command.patientId || command.patientId.trim().length === 0) {
      return Result.fail<PatientDto>(KORRIGIERE_PATIENT_ERROR_CODES.PATIENT_ID_REQUIRED);
    }
    if (command.feld !== 'sichtung' && command.feld !== 'behandlungsstatus' && command.feld !== 'transportstatus' && command.feld !== 'notiz') {
      return Result.fail<PatientDto>(KORRIGIERE_PATIENT_ERROR_CODES.FELD_INVALID);
    }
    // Story 1.7 (AC9): Für `feld='notiz'` ist `null` ein gültiger Wert
    // („Notiz löschen"). Für die Enum-Felder bleibt der nicht-leere-String-
    // Vertrag bestehen — sonst lässt der Aggregate-Pfad ohnehin den
    // KORREKTUR_NEUER_WERT_INVALID-Sentinel zurückkommen.
    if (command.feld === 'notiz') {
      if (command.neuerWert !== null && (typeof command.neuerWert !== 'string' || command.neuerWert.length > 500)) {
        return Result.fail<PatientDto>(KORRIGIERE_PATIENT_ERROR_CODES.NEUER_WERT_INVALID);
      }
    } else if (typeof command.neuerWert !== 'string' || command.neuerWert.length === 0) {
      return Result.fail<PatientDto>(KORRIGIERE_PATIENT_ERROR_CODES.NEUER_WERT_INVALID);
    }
    if (typeof command.grund !== 'string' || command.grund.length === 0 || command.grund.length > 500) {
      return Result.fail<PatientDto>(KORRIGIERE_PATIENT_ERROR_CODES.GRUND_REQUIRED);
    }
    if (command.clockDriftSeconds !== undefined && (!Number.isFinite(command.clockDriftSeconds) || !Number.isInteger(command.clockDriftSeconds))) {
      return Result.fail<PatientDto>(KORRIGIERE_PATIENT_ERROR_CODES.CLOCK_DRIFT_INVALID);
    }

    const actorResult = this.buildActor(command);
    if (actorResult.isFailure || !actorResult.value) {
      return Result.fail<PatientDto>(KORRIGIERE_PATIENT_ERROR_CODES.ACTOR_INVALID);
    }
    const actorRef = actorResult.value;

    const patientIdResult = PatientId.create(command.patientId);
    if (patientIdResult.isFailure || !patientIdResult.value) {
      return Result.fail<PatientDto>(KORRIGIERE_PATIENT_ERROR_CODES.PATIENT_NICHT_GEFUNDEN);
    }
    const patient = await this.patientRepository.findById(patientIdResult.value as PatientId, tx);
    if (!patient) {
      return Result.fail<PatientDto>(KORRIGIERE_PATIENT_ERROR_CODES.PATIENT_NICHT_GEFUNDEN);
    }
    if (patient.einsatzId !== command.einsatzId) {
      return Result.fail<PatientDto>(KORRIGIERE_PATIENT_ERROR_CODES.PATIENT_NICHT_GEFUNDEN);
    }

    // Snapshot des alten Werts VOR Aggregate-Mutation festhalten (Lessons-Learned 1.3)
    let vorher: string | null;
    if (command.feld === 'sichtung') {
      vorher = patient.aktuelleSk.code;
    } else if (command.feld === 'behandlungsstatus') {
      vorher = patient.behandlungsstatus.code;
    } else if (command.feld === 'transportstatus') {
      vorher = patient.transportstatus.code;
    } else {
      // Story 1.7 (AC9): feld='notiz' — `null` ist gültiger Vorher-Zustand
      // („noch nie gesetzt"). Spätere Notiz-Edit-Story (3.x) baut auf
      // diesem Pfad auf.
      vorher = patient.notiz;
    }

    const options = {
      actorUserId: actorRef.data.type === 'user' ? actorRef.data.userId : undefined,
      actorDeviceId: actorRef.data.type === 'device' ? actorRef.data.deviceId : undefined,
      originSessionId: actorRef.data.type === 'device' ? actorRef.data.captureSessionId : undefined,
      clockDriftSeconds: command.clockDriftSeconds,
      // Story 1.4 Code-Review Feature 2: nur `true` wird durchgereicht, alles
      // andere (undefined/false) führt im Aggregate zur expliziten Ablehnung der
      // TOT-Korrektur auf lebenden Patienten.
      bestaetigeTotKorrektur: command.bestaetigeTotKorrektur === true,
    };

    const domainResult = patient.korrigieren(command.feld, command.neuerWert, command.grund, options);
    if (domainResult.isFailure) {
      return Result.fail<PatientDto>(domainResult.error ?? 'BusinessRule:KorrekturFehlgeschlagen');
    }

    const patientEvents = [...patient.getDomainEvents()];

    let saveResult: Result<void>;
    try {
      saveResult = await this.patientRepository.save(patient, tx);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail<PatientDto>(`${KORRIGIERE_PATIENT_ERROR_CODES.PATIENT_SAVE_FAILED}:${message}`);
    }
    if (saveResult.isFailure) {
      return Result.fail<PatientDto>(saveResult.error ?? KORRIGIERE_PATIENT_ERROR_CODES.PATIENT_SAVE_FAILED);
    }

    const etbResult = await this.appendEtbEintrag(command, tx, patient, vorher, actorRef);
    if (etbResult.isFailure) {
      return Result.fail<PatientDto>(etbResult.error ?? KORRIGIERE_PATIENT_ERROR_CODES.ETB_APPEND_FAILED);
    }
    const etbEvents = etbResult.value!;

    const events: DomainEvent[] = [...patientEvents, ...etbEvents];

    // Logger nicht im Notiz-Pfad PII leaken — siehe `PatientEventLoggerHandler`
    // für die Pattern-Konsistenz.
    const logMessage =
      command.feld === 'notiz'
        ? `Patient ${patient.patientennummer.value}: Korrektur notiz (Freitext, redacted) — grundLength=${command.grund.length}`
        : `Patient ${patient.patientennummer.value}: Korrektur ${command.feld} (${vorher} → ${command.neuerWert}) — ${command.grund}`;
    this.logger.log(logMessage, 'KorrigierePatientHandler');

    return {
      result: this.patientMapper.toDto(patient),
      events,
    };
  }

  private buildActor(command: KorrigierePatientCommand): Result<ErfasserRef> {
    if (command.actor.type === 'user') {
      return ErfasserRef.user(command.actor.userId);
    }
    if (command.actor.type === 'device') {
      return ErfasserRef.device(command.actor.deviceId, command.actor.captureSessionId);
    }
    return Result.fail<ErfasserRef>(KORRIGIERE_PATIENT_ERROR_CODES.ACTOR_INVALID);
  }

  private async appendEtbEintrag(command: KorrigierePatientCommand, tx: TransactionContext, patient: Patient, vorher: string | null, actorRef: ErfasserRef): Promise<Result<DomainEvent[]>> {
    const einsatzIdResult = EinsatzId.create(command.einsatzId);
    if (einsatzIdResult.isFailure || !einsatzIdResult.value) {
      return Result.fail<DomainEvent[]>(KORRIGIERE_PATIENT_ERROR_CODES.EINSATZ_ID_REQUIRED);
    }

    const aggregate = await this.etbRepository.findByEinsatzId(einsatzIdResult.value, tx);
    if (aggregate === null) {
      return Result.fail<DomainEvent[]>(`${KORRIGIERE_PATIENT_ERROR_CODES.ETB_APPEND_FAILED}:ETB-Aggregat fehlt für einsatzId=${command.einsatzId}`);
    }

    if (actorRef.data.type !== 'user') {
      return Result.fail<DomainEvent[]>(KORRIGIERE_PATIENT_ERROR_CODES.ACTOR_INVALID);
    }
    const userIdResult = UserId.create(actorRef.data.userId);
    if (userIdResult.isFailure || !userIdResult.value) {
      return Result.fail<DomainEvent[]>(KORRIGIERE_PATIENT_ERROR_CODES.ACTOR_INVALID);
    }

    // Story 1.7 (AC9): „neu"-Wert immer aus dem kanonischen Aggregat-Zustand
    // nach `korrigieren()` ableiten — nicht aus `command.neuerWert` erneut
    // normalisieren. Andernfalls können Aggregate-Trim und Handler-Trim
    // divergieren und ETB-Payload weicht von PatientEvent-Snapshot ab.
    const neuForPayload: string | null = command.feld === 'notiz' ? patient.notiz : command.neuerWert;

    const payload = {
      feld: command.feld,
      vorher,
      neu: neuForPayload,
      grund: command.grund,
    };

    const contextValidation = PatientEtbContextSchema.safeParse({
      kind: 'patient.korrigiert',
      patientId: patient.id.value,
      patientennummer: patient.patientennummer.value,
      ...payload,
    });
    if (!contextValidation.success) {
      this.logger.error('PatientEtbContext-Validierung fehlgeschlagen', { error: contextValidation.error.message });
      return Result.fail<DomainEvent[]>(KORRIGIERE_PATIENT_ERROR_CODES.ETB_CONTEXT_INVALID);
    }

    const kontext = EintragKontext.patient({
      kind: 'patient.korrigiert',
      patientId: patient.id.value,
      patientennummer: patient.patientennummer.value,
      payload,
    });

    // Story 1.7 (AC9): Notiz-Korrektur leakt sonst PII (Freitext) in den
    // ETB-Text. Wir nutzen einen redacted Marker; die Vollform liegt im
    // PatientEvent-Payload (Audit-Sink: PatientEvent, nicht ETB-Klartext).
    const text =
      command.feld === 'notiz'
        ? `Patient ${patient.patientennummer.value}: Korrektur — notiz (Freitext, gespeichert im PatientEvent) — ${command.grund}`
        : `Patient ${patient.patientennummer.value}: Korrektur — ${command.feld} ${vorher} → ${command.neuerWert} — ${command.grund}`;
    const now = new Date();

    const addResult = aggregate.addEintrag(text, userIdResult.value, EtbKategorie.SONSTIGES(), undefined, undefined, undefined, now, {
      kontext,
      ereignisZeitpunkt: now,
    });
    if (addResult.isFailure) {
      return Result.fail<DomainEvent[]>(`${KORRIGIERE_PATIENT_ERROR_CODES.ETB_APPEND_FAILED}:${addResult.error ?? 'unknown'}`);
    }

    try {
      await this.etbRepository.save(aggregate, tx as Prisma.TransactionClient);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail<DomainEvent[]>(`${KORRIGIERE_PATIENT_ERROR_CODES.ETB_APPEND_FAILED}:${message}`);
    }

    const events = aggregate.getDomainEvents();
    aggregate.clearDomainEvents();
    return Result.ok<DomainEvent[]>(events);
  }
}
