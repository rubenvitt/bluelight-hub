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
import { Sichtung } from '@domain/patienten/value-objects/sichtung.vo';
import { Sichtungskategorie } from '@domain/patienten/value-objects/sichtungskategorie.vo';
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
import { AKTUALISIERE_SICHTUNG_ERROR_CODES } from '../../errors/aktualisiere-sichtung-error.codes';
import { AktualisiereSichtungCommand } from './aktualisiere-sichtung.command';

/**
 * Handler für den `aktualisiere-sichtung`-Use-Case (Story 1.3, AC1/AC3/AC6).
 *
 * Persistiert in einer einzigen Prisma-Transaktion (Append-only, NFR-S5,
 * Architecture §D-2):
 *  1. `PatientSichtungAktualisiert`-Event in `patient_events`
 *  2. Denormalisierter `Patient.aktuelleSk`-Snapshot (UPSERT-Update-Branch
 *     aus Story 1.2 — der `PatientErfasst`-Originaleintrag bleibt unverändert
 *     im Event-Stream)
 *  3. ETB-Eintrag mit `kontextType='patient'`, `kind='patient.sichtung-aktualisiert'`
 *     (FR40, ADR-005)
 *  4. Outbox-Event `patient.sichtung-aktualisiert` (via `TransactionalCommandHandler`-Basis,
 *     Vorbereitung für Story 3.1 WS-Broadcast)
 *
 * **Defense-in-Depth Scope-Check (ADR-012):** wenn die geladene Patient-Identität
 * nicht zum `command.einsatzId` gehört, gibt der Handler `PATIENT_NICHT_GEFUNDEN`
 * zurück (kein Info-Leak über fremde Einsätze; `EinsatzScopeGuard` schützt nur
 * den Einsatz, nicht den nested Patient-Pfad).
 */
@Injectable()
export class AktualisiereSichtungHandler extends TransactionalCommandHandler<AktualisiereSichtungCommand, PatientDto> {
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

  protected async executeInTransaction(command: AktualisiereSichtungCommand, tx: TransactionContext): Promise<Result<PatientDto> | { result: PatientDto; events: DomainEvent[] }> {
    // 1. Pflichtfelder-Validierung
    if (!command.einsatzId || command.einsatzId.trim().length === 0) {
      return Result.fail<PatientDto>(AKTUALISIERE_SICHTUNG_ERROR_CODES.EINSATZ_ID_REQUIRED);
    }
    if (!command.patientId || command.patientId.trim().length === 0) {
      return Result.fail<PatientDto>(AKTUALISIERE_SICHTUNG_ERROR_CODES.PATIENT_ID_REQUIRED);
    }
    if (command.clockDriftSeconds !== undefined && (!Number.isFinite(command.clockDriftSeconds) || !Number.isInteger(command.clockDriftSeconds))) {
      return Result.fail<PatientDto>(AKTUALISIERE_SICHTUNG_ERROR_CODES.CLOCK_DRIFT_INVALID);
    }
    if (command.grund !== undefined && (command.grund.length === 0 || command.grund.length > 500)) {
      return Result.fail<PatientDto>(AKTUALISIERE_SICHTUNG_ERROR_CODES.GRUND_INVALID);
    }

    // 2. Value-Objects bauen
    const neueSkResult = Sichtungskategorie.create(command.neueSk);
    if (neueSkResult.isFailure || !neueSkResult.value) {
      return Result.fail<PatientDto>(AKTUALISIERE_SICHTUNG_ERROR_CODES.NEUE_SK_REQUIRED);
    }

    const sichterResult = this.buildSichter(command);
    if (sichterResult.isFailure || !sichterResult.value) {
      return Result.fail<PatientDto>(AKTUALISIERE_SICHTUNG_ERROR_CODES.SICHTER_INVALID);
    }
    const sichterRef = sichterResult.value;

    const sichtungResult = Sichtung.create({
      sk: neueSkResult.value,
      sichter: sichterRef.data,
      sichtungArt: command.sichtungArt,
      gesichtetAm: new Date(),
    });
    if (sichtungResult.isFailure || !sichtungResult.value) {
      return Result.fail<PatientDto>(AKTUALISIERE_SICHTUNG_ERROR_CODES.SICHTUNG_ART_INVALID);
    }
    const sichtung = sichtungResult.value;

    // 3. Patient laden (Snapshot inkl. eventVersion aus Story-1.1-Repository)
    const patientIdResult = PatientId.create(command.patientId);
    if (patientIdResult.isFailure || !patientIdResult.value) {
      return Result.fail<PatientDto>(AKTUALISIERE_SICHTUNG_ERROR_CODES.PATIENT_NICHT_GEFUNDEN);
    }
    const patient = await this.patientRepository.findById(patientIdResult.value as PatientId, tx);
    if (!patient) {
      return Result.fail<PatientDto>(AKTUALISIERE_SICHTUNG_ERROR_CODES.PATIENT_NICHT_GEFUNDEN);
    }
    if (patient.einsatzId !== command.einsatzId) {
      // Defense-in-Depth: kein Info-Leak über fremde Einsätze
      return Result.fail<PatientDto>(AKTUALISIERE_SICHTUNG_ERROR_CODES.PATIENT_NICHT_GEFUNDEN);
    }

    // 4. Domain-Methode aufrufen (Domain-Sentinels propagieren bei Fehlern)
    const sichtungUpdateResult = patient.sichtungAktualisieren(sichtung, {
      actorUserId: sichterRef.data.type === 'user' ? sichterRef.data.userId : undefined,
      actorDeviceId: sichterRef.data.type === 'device' ? sichterRef.data.deviceId : undefined,
      originSessionId: sichterRef.data.type === 'device' ? sichterRef.data.captureSessionId : undefined,
      clockDriftSeconds: command.clockDriftSeconds,
      grund: command.grund,
    });
    if (sichtungUpdateResult.isFailure) {
      return Result.fail<PatientDto>(sichtungUpdateResult.error ?? 'BusinessRule:SichtungUpdateFehlgeschlagen');
    }

    // Snapshot der Events VOR save (save() ruft clearDomainEvents auf)
    const patientEvents = [...patient.getDomainEvents()];

    const saveResult = await this.patientRepository.save(patient, tx);
    if (saveResult.isFailure) {
      return Result.fail<PatientDto>(saveResult.error ?? 'Infrastructure:PatientSaveFailed');
    }

    // 5. ETB-Eintrag im selben TX
    const etbResult = await this.appendEtbEintrag(command, tx, patient, sichtung, sichterRef);
    if (etbResult.isFailure) {
      return Result.fail<PatientDto>(etbResult.error ?? AKTUALISIERE_SICHTUNG_ERROR_CODES.ETB_APPEND_FAILED);
    }
    const etbEvents = etbResult.value!;

    // 6. Outbox-Events sammeln (Patient + ETB) — Basisklasse persistiert sie
    const events: DomainEvent[] = [...patientEvents, ...etbEvents];

    this.logger.log(`Patient ${patient.patientennummer.value}: Sichtung aktualisiert (${command.einsatzId}, neueSk=${command.neueSk}, art=${command.sichtungArt})`, 'AktualisiereSichtungHandler');

    return {
      result: this.patientMapper.toDto(patient),
      events,
    };
  }

  private buildSichter(command: AktualisiereSichtungCommand): Result<ErfasserRef> {
    if (command.sichter.type === 'user') {
      return ErfasserRef.user(command.sichter.userId);
    }
    if (command.sichter.type === 'device') {
      return ErfasserRef.device(command.sichter.deviceId, command.sichter.captureSessionId);
    }
    return Result.fail<ErfasserRef>(AKTUALISIERE_SICHTUNG_ERROR_CODES.SICHTER_INVALID);
  }

  private async appendEtbEintrag(command: AktualisiereSichtungCommand, tx: TransactionContext, patient: Patient, sichtung: Sichtung, sichterRef: ErfasserRef): Promise<Result<DomainEvent[]>> {
    const einsatzIdResult = EinsatzId.create(command.einsatzId);
    if (einsatzIdResult.isFailure || !einsatzIdResult.value) {
      return Result.fail<DomainEvent[]>(AKTUALISIERE_SICHTUNG_ERROR_CODES.EINSATZ_ID_REQUIRED);
    }

    // Story 1.2 garantiert, dass der ETB beim ersten Patient-Eintrag angelegt wird —
    // Reevaluierung läuft *nach* der Erfassung, also existiert der ETB bereits.
    // Defensive-Fallback: falls die DB einen Race-Case zulässt, propagieren wir
    // ein Infrastructure-Fail (sanity check, kein Auto-Create-Pfad hier).
    const aggregate = await this.etbRepository.findByEinsatzId(einsatzIdResult.value, tx);
    if (aggregate === null) {
      return Result.fail<DomainEvent[]>(`${AKTUALISIERE_SICHTUNG_ERROR_CODES.ETB_APPEND_FAILED}:ETB-Aggregat fehlt für einsatzId=${command.einsatzId}`);
    }

    // ETB-Eintrag benötigt User-ID. Story 1.3 verdrahtet im Controller nur den
    // user-Branch (Device-Branch ist Epic-2-Scope).
    if (sichterRef.data.type !== 'user') {
      return Result.fail<DomainEvent[]>(AKTUALISIERE_SICHTUNG_ERROR_CODES.SICHTER_INVALID);
    }
    const userIdResult = UserId.create(sichterRef.data.userId);
    if (userIdResult.isFailure || !userIdResult.value) {
      return Result.fail<DomainEvent[]>(AKTUALISIERE_SICHTUNG_ERROR_CODES.SICHTER_INVALID);
    }

    const vorherSk = this.extractVorherSk(patient);
    const neuSk = sichtung.sk.code;

    const payload: Record<string, unknown> = {
      vorher: vorherSk,
      neu: neuSk,
      sichter: sichterRef.data,
      sichtungArt: sichtung.sichtungArt,
    };
    if (command.grund !== undefined && command.grund.length > 0) {
      payload.grund = command.grund;
    }

    const contextValidation = PatientEtbContextSchema.safeParse({
      kind: 'patient.sichtung-aktualisiert',
      patientId: patient.id.value,
      patientennummer: patient.patientennummer.value,
      ...payload,
    });
    if (!contextValidation.success) {
      this.logger.error('PatientEtbContext-Validierung fehlgeschlagen', { error: contextValidation.error.message });
      return Result.fail<DomainEvent[]>(AKTUALISIERE_SICHTUNG_ERROR_CODES.ETB_CONTEXT_INVALID);
    }

    const kontext = EintragKontext.patient({
      kind: 'patient.sichtung-aktualisiert',
      patientId: patient.id.value,
      patientennummer: patient.patientennummer.value,
      payload,
    });

    const text = this.buildEtbText(patient.patientennummer.value, vorherSk, neuSk, sichtung.sichtungArt, command.grund);

    const addResult = aggregate.addEintrag(text, userIdResult.value, EtbKategorie.SONSTIGES(), undefined, undefined, undefined, sichtung.gesichtetAm, {
      kontext,
      ereignisZeitpunkt: sichtung.gesichtetAm,
    });
    if (addResult.isFailure) {
      return Result.fail<DomainEvent[]>(`${AKTUALISIERE_SICHTUNG_ERROR_CODES.ETB_APPEND_FAILED}:${addResult.error ?? 'unknown'}`);
    }

    try {
      await this.etbRepository.save(aggregate, tx as Prisma.TransactionClient);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail<DomainEvent[]>(`${AKTUALISIERE_SICHTUNG_ERROR_CODES.ETB_APPEND_FAILED}:${message}`);
    }

    const events = aggregate.getDomainEvents();
    aggregate.clearDomainEvents();
    return Result.ok<DomainEvent[]>(events);
  }

  /**
   * Liest die *vorherige* SK aus dem zuletzt emittierten Aggregate-Event. Die
   * Mutation in `sichtungAktualisieren()` hat den Snapshot bereits auf den
   * neuen Wert gesetzt; `vorher` muss aus dem Event kommen, damit ETB-Text und
   * Payload den Übergang korrekt abbilden.
   */
  private extractVorherSk(patient: Patient): string {
    const lastEvent = patient.getDomainEvents().at(-1);
    if (lastEvent && 'vorher' in lastEvent && typeof (lastEvent as { vorher?: unknown }).vorher === 'string') {
      return (lastEvent as { vorher: string }).vorher;
    }
    return patient.aktuelleSk.code;
  }

  private buildEtbText(patientennummer: string, vorher: string, neu: string, sichtungArt: string, grund: string | undefined): string {
    const sichtungArtLabel = sichtungArt === 'aerztlich' ? 'ärztliche Sichtung' : 'Vorsichtung';
    const skLabel = (code: string): string => (code === 'TOT' ? 'TOT' : `SK ${code.replace('SK_', '')}`);
    const base = `Patient ${patientennummer}: ${skLabel(vorher)} → ${skLabel(neu)} (${sichtungArtLabel})`;
    if (grund && grund.length > 0) {
      return `${base} — ${grund}`;
    }
    return base;
  }
}
