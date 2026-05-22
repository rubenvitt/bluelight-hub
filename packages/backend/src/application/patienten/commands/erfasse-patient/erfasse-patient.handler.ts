import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@/generated/prisma/client';
import type { DomainEvent } from '@domain/common/domain-event';
import { Result } from '@domain/common/result';
import type { TransactionContext } from '@domain/common/transaction';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import type { IEtbRepository } from '@domain/repositories';
import type { ILogger } from '@domain/ports/i-logger.port';
import { Patient } from '@domain/patienten/aggregates/patient.aggregate';
import { EinsatztagebuchAggregate } from '@domain/aggregates/einsatztagebuch.aggregate';
import { DiviVakNummer } from '@domain/patienten/value-objects/divi-vak-nummer.vo';
import { ErfasserRef } from '@domain/patienten/value-objects/erfasser-ref.vo';
import type { PatientRepository } from '@domain/patienten/repositories/patient.repository';
import { Sichtungskategorie } from '@domain/patienten/value-objects/sichtungskategorie.vo';
import { PatientEtbContextSchema } from '@domain/patienten/schemas/etb-context.schema';
import { EintragKontext } from '@domain/value-objects/eintrag-kontext';
import { EtbKategorie } from '@domain/value-objects/etb-kategorie';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { TransactionalCommandHandler } from '@/application/common/handlers/transactional-command.handler';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ETB_REPOSITORY, LOGGER, OUTBOX_REPOSITORY, PATIENT_REPOSITORY } from '@infrastructure/di-tokens';
import type { PatientDto } from '../../dto/patient.dto';
import { PatientMapper } from '../../mappers/patient.mapper';
import { PATIENT_ERFASSEN_ERROR_CODES } from '../../errors/patient-erfassen-error.codes';
import { ErfassePatientCommand } from './erfasse-patient.command';

/**
 * Handler für den `erfasse-patient`-Use-Case (Story 1.2, AC1).
 *
 * Persistiert in einer einzigen Prisma-Transaktion:
 *  1. `Patient`-Aggregate (`patient_repository.save`)
 *  2. `PatientErfasst`-Event in `patient_events` (Repository, Architecture §D-1)
 *  3. ETB-Eintrag mit `kontextType='patient'` (Architecture §D-6)
 *  4. Outbox-Event `patient.erfasst` (via `TransactionalCommandHandler`-Basis)
 *
 * Wenn der Einsatz noch kein ETB hat, legt der Handler eines an
 * (`EinsatztagebuchAggregate.create()`) — derselbe Auto-Create-Pattern, den der
 * AddEintragHandler in der nicht-transaktionalen Variante verwendet, hier aber
 * tx-aware via direkter Repository-Methoden (kein `CreateEtbHandler`-Aufruf,
 * der eigene Transaktion öffnen würde, vgl. Architecture-Trade-off).
 */
@Injectable()
export class ErfassePatientHandler extends TransactionalCommandHandler<ErfassePatientCommand, PatientDto> {
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

  protected async executeInTransaction(command: ErfassePatientCommand, tx: TransactionContext): Promise<Result<PatientDto> | { result: PatientDto; events: DomainEvent[] }> {
    // 1. Pflicht-Felder validieren
    if (!command.einsatzId || command.einsatzId.trim().length === 0) {
      return Result.fail<PatientDto>(PATIENT_ERFASSEN_ERROR_CODES.EINSATZ_ID_REQUIRED);
    }
    if (command.clockDriftSeconds !== undefined && (!Number.isFinite(command.clockDriftSeconds) || !Number.isInteger(command.clockDriftSeconds))) {
      return Result.fail<PatientDto>(PATIENT_ERFASSEN_ERROR_CODES.CLOCK_DRIFT_INVALID);
    }

    // 2. Value-Objects bauen
    const initialeSkResult = Sichtungskategorie.create(command.initialeSk);
    if (initialeSkResult.isFailure || !initialeSkResult.value) {
      return Result.fail<PatientDto>(PATIENT_ERFASSEN_ERROR_CODES.INITIALE_SK_REQUIRED);
    }
    const initialeSk = initialeSkResult.value;

    const erfasserRefResult = this.buildErfasserRef(command);
    if (erfasserRefResult.isFailure || !erfasserRefResult.value) {
      return Result.fail<PatientDto>(PATIENT_ERFASSEN_ERROR_CODES.ERFASSER_REF_INVALID);
    }
    const erfasserRef = erfasserRefResult.value;

    let diviVakNummer: DiviVakNummer | undefined;
    const diviVakNummerInput = command.diviVakNummer?.trim();
    if (diviVakNummerInput !== undefined && diviVakNummerInput.length > 0) {
      const diviResult = DiviVakNummer.create(diviVakNummerInput);
      if (diviResult.isFailure || !diviResult.value) {
        return Result.fail<PatientDto>(PATIENT_ERFASSEN_ERROR_CODES.DIVI_VAK_NUMMER_INVALID);
      }
      diviVakNummer = diviResult.value;
    }

    const notiz = command.notiz?.trim();
    if (notiz !== undefined) {
      if (notiz.length === 0 || notiz.length > 500) {
        return Result.fail<PatientDto>(PATIENT_ERFASSEN_ERROR_CODES.NOTIZ_INVALID);
      }
    }

    // 3. Nächste Patientennummer (Advisory-Lock pro Einsatz)
    const patientennummerResult = await this.patientRepository.nextPatientennummer(command.einsatzId, tx);
    if (patientennummerResult.isFailure || !patientennummerResult.value) {
      return Result.fail<PatientDto>(patientennummerResult.error ?? PATIENT_ERFASSEN_ERROR_CODES.PATIENTENNUMMER_KONFLIKT);
    }
    const patientennummer = patientennummerResult.value;

    // 4. Aggregat erzeugen + persistieren — emittiert PatientErfasst-Event
    const patientResult = Patient.create({
      einsatzId: command.einsatzId,
      patientennummer,
      erfasserRef,
      erfasstAm: new Date(),
      initialeSk,
      diviVakNummer,
      clockDriftSeconds: command.clockDriftSeconds,
    });
    if (patientResult.isFailure || !patientResult.value) {
      return Result.fail<PatientDto>(patientResult.error ?? 'BusinessRule:PatientErzeugenFehlgeschlagen');
    }
    const patient = patientResult.value;

    // Snapshot der Events VOR save (save() ruft clearDomainEvents auf)
    const patientEvents = [...patient.getDomainEvents()];

    const saveResult = await this.patientRepository.save(patient, tx);
    if (saveResult.isFailure) {
      if (saveResult.error?.startsWith('ConflictDetected:PatientennummerVergeben')) {
        return Result.fail<PatientDto>(`${PATIENT_ERFASSEN_ERROR_CODES.PATIENTENNUMMER_KONFLIKT}:${patientennummer.value}`);
      }
      return Result.fail<PatientDto>(saveResult.error ?? 'Infrastructure:PatientSaveFailed');
    }

    // 5. ETB-Auto-Create + Eintrag im selben TX
    const etbResult = await this.appendPatientEtbEintrag(command, tx, patient, patientennummer.value, notiz, diviVakNummer?.value, erfasserRef.data);
    if (etbResult.isFailure) {
      return Result.fail<PatientDto>(etbResult.error ?? PATIENT_ERFASSEN_ERROR_CODES.ETB_APPEND_FAILED);
    }
    const etbEvents = etbResult.value!;

    // 6. Outbox-Events sammeln (Patient + ETB) — Basisklasse persistiert sie
    const events: DomainEvent[] = [...patientEvents, ...etbEvents];

    this.logger.log(`Patient ${patientennummer.value} erfasst (${initialeSk.code}, einsatz=${command.einsatzId})`, 'ErfassePatientHandler');

    return {
      result: this.patientMapper.toDto(patient),
      events,
    };
  }

  private buildErfasserRef(command: ErfassePatientCommand): Result<ErfasserRef> {
    if (command.erfasserRef.type === 'user') {
      return ErfasserRef.user(command.erfasserRef.userId);
    }
    if (command.erfasserRef.type === 'device') {
      return ErfasserRef.device(command.erfasserRef.deviceId, command.erfasserRef.captureSessionId);
    }
    return Result.fail<ErfasserRef>(PATIENT_ERFASSEN_ERROR_CODES.ERFASSER_REF_INVALID);
  }

  private async appendPatientEtbEintrag(
    command: ErfassePatientCommand,
    tx: TransactionContext,
    patient: Patient,
    patientennummer: string,
    notiz: string | undefined,
    diviVakNummer: string | undefined,
    erfasserRefData: ErfasserRef['data'],
  ): Promise<Result<DomainEvent[]>> {
    const einsatzIdResult = EinsatzId.create(command.einsatzId);
    if (einsatzIdResult.isFailure || !einsatzIdResult.value) {
      return Result.fail<DomainEvent[]>(PATIENT_ERFASSEN_ERROR_CODES.EINSATZ_ID_REQUIRED);
    }
    const einsatzId = einsatzIdResult.value;

    let aggregate = await this.etbRepository.findByEinsatzId(einsatzId, tx);
    if (aggregate === null) {
      const createResult = EinsatztagebuchAggregate.create(einsatzId);
      if (createResult.isFailure || !createResult.value) {
        return Result.fail<DomainEvent[]>(createResult.error ?? 'BusinessRule:EtbAutoCreateFehlgeschlagen');
      }
      aggregate = createResult.value;
    }

    // Erfasser-User für ETB-Eintrag (Pflichtfeld). Bei Device-Erfassung
    // (Story 2.7) wird captureSessionId verwendet; in Story 1.2 ist es immer
    // ein User. Pragma: ein synthetischer User für Device-Pfad würde NFR-A2
    // gegen die Audit-Anforderung verletzen — daher hartes Fail-Fast hier,
    // bevor wir ein illegales ETB-Mapping erzeugen.
    if (erfasserRefData.type !== 'user') {
      return Result.fail<DomainEvent[]>(PATIENT_ERFASSEN_ERROR_CODES.ERFASSER_REF_INVALID);
    }
    const userIdResult = UserId.create(erfasserRefData.userId);
    if (userIdResult.isFailure || !userIdResult.value) {
      return Result.fail<DomainEvent[]>(PATIENT_ERFASSEN_ERROR_CODES.ERFASSER_REF_INVALID);
    }

    // Zod-Validierung der Patient-ETB-Kontext-Payload (Architecture §D-6)
    const payload: Record<string, unknown> = {
      initialeSk: patient.aktuelleSk.code,
      erfasserRef: erfasserRefData,
    };
    if (diviVakNummer) payload.diviVakNummer = diviVakNummer;
    if (notiz) payload.notiz = notiz;

    const contextValidation = PatientEtbContextSchema.safeParse({
      kind: 'patient.erfasst',
      patientId: patient.id.value,
      patientennummer,
      ...payload,
    });
    if (!contextValidation.success) {
      this.logger.error('PatientEtbContext-Validierung fehlgeschlagen', { error: contextValidation.error.message });
      return Result.fail<DomainEvent[]>(PATIENT_ERFASSEN_ERROR_CODES.ETB_CONTEXT_INVALID);
    }

    const kontext = EintragKontext.patient({
      kind: 'patient.erfasst',
      patientId: patient.id.value,
      patientennummer,
      payload,
    });

    const text = this.buildEtbText(patientennummer, patient.aktuelleSk.code, notiz);

    const addResult = aggregate.addEintrag(text, userIdResult.value, EtbKategorie.SONSTIGES(), undefined, undefined, undefined, patient.erfasstAm, {
      kontext,
      ereignisZeitpunkt: patient.erfasstAm,
    });
    if (addResult.isFailure) {
      return Result.fail<DomainEvent[]>(`${PATIENT_ERFASSEN_ERROR_CODES.ETB_APPEND_FAILED}:${addResult.error ?? 'unknown'}`);
    }

    try {
      await this.etbRepository.save(aggregate, tx as Prisma.TransactionClient);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail<DomainEvent[]>(`${PATIENT_ERFASSEN_ERROR_CODES.ETB_APPEND_FAILED}:${message}`);
    }

    const events = aggregate.getDomainEvents();
    aggregate.clearDomainEvents();
    return Result.ok<DomainEvent[]>(events);
  }

  private buildEtbText(patientennummer: string, sk: string, notiz: string | undefined): string {
    const base = `Patient ${patientennummer} erfasst (${sk})`;
    if (notiz && notiz.length > 0) {
      return `${base} — ${notiz}`;
    }
    return base;
  }
}
