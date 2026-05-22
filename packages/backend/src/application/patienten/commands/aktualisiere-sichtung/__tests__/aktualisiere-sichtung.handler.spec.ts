// @ts-nocheck
import { Test, type TestingModule } from '@nestjs/testing';
import { createId } from '@paralleldrive/cuid2';
import { Result } from '@domain/common/result';
import { Patient } from '@domain/patienten/aggregates/patient.aggregate';
import { ErfasserRef } from '@domain/patienten/value-objects/erfasser-ref.vo';
import { Patientennummer } from '@domain/patienten/value-objects/patientennummer.vo';
import { Sichtungskategorie } from '@domain/patienten/value-objects/sichtungskategorie.vo';
import { PatientSichtungAktualisiert } from '@domain/patienten/events/patient-sichtung-aktualisiert.event';
import type { PatientRepository } from '@domain/patienten/repositories/patient.repository';
import type { IEtbRepository } from '@domain/repositories';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import type { ILogger } from '@domain/ports/i-logger.port';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ETB_REPOSITORY, LOGGER, OUTBOX_REPOSITORY, PATIENT_REPOSITORY } from '@infrastructure/di-tokens';
import { PatientMapper } from '../../../mappers/patient.mapper';
import { AKTUALISIERE_SICHTUNG_ERROR_CODES } from '../../../errors/aktualisiere-sichtung-error.codes';
import { AktualisiereSichtungCommand } from '../aktualisiere-sichtung.command';
import { AktualisiereSichtungHandler } from '../aktualisiere-sichtung.handler';

const VALID_EINSATZ_ID = createId();
const FOREIGN_EINSATZ_ID = createId();
const VALID_USER_ID = createId();
const VALID_PATIENT_ID = createId();

/**
 * Unit-Tests für AktualisiereSichtungHandler (Story 1.3, AC1/AC3/AC6).
 *
 * Mockt Repositories und PrismaService — testet ausschließlich Handler-
 * Orchestrierung. Integration-Test (echte DB + Auth + Tx-Rollback) folgt in
 * der Controller-/Repository-Integration-Spec.
 */
describe('AktualisiereSichtungHandler', () => {
  let handler: AktualisiereSichtungHandler;
  let patientRepository: jest.Mocked<PatientRepository>;
  let etbRepository: jest.Mocked<IEtbRepository>;
  let outboxRepository: jest.Mocked<IOutboxRepository>;
  let logger: jest.Mocked<ILogger>;
  let prismaService: { $transaction: jest.Mock };

  function makePatient(initialSk: 'SK_I' | 'SK_II' | 'SK_III' | 'SK_IV' | 'TOT' = 'SK_III', einsatzId: string = VALID_EINSATZ_ID): Patient {
    const result = Patient.create({
      id: VALID_PATIENT_ID,
      einsatzId,
      patientennummer: Patientennummer.fromSequence(3).value!,
      erfasserRef: ErfasserRef.user(VALID_USER_ID).value!,
      erfasstAm: new Date('2026-05-19T09:00:00Z'),
      initialeSk: Sichtungskategorie.create(initialSk).value!,
    });
    const patient = result.value!;
    patient.clearDomainEvents();
    return patient;
  }

  const validCommand = (overrides: Partial<ConstructorParameters<typeof AktualisiereSichtungCommand>[0]> = {}): AktualisiereSichtungCommand =>
    new AktualisiereSichtungCommand({
      einsatzId: VALID_EINSATZ_ID,
      patientId: VALID_PATIENT_ID,
      neueSk: 'SK_I',
      sichtungArt: 'aerztlich',
      sichter: { type: 'user', userId: VALID_USER_ID },
      ...overrides,
    });

  const minimalEtbAggregate = () => ({
    addEintrag: jest.fn().mockReturnValue(Result.ok({ id: 'etb-1' })),
    getDomainEvents: jest.fn().mockReturnValue([]),
    clearDomainEvents: jest.fn(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    patientRepository = {
      save: jest.fn().mockResolvedValue(Result.ok<void>(undefined)),
      findById: jest.fn().mockResolvedValue(makePatient('SK_III')),
      nextPatientennummer: jest.fn(),
    } as jest.Mocked<PatientRepository>;

    etbRepository = {
      findById: jest.fn(),
      findByEinsatzId: jest.fn().mockResolvedValue(minimalEtbAggregate()),
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IEtbRepository>;

    outboxRepository = {
      save: jest.fn().mockResolvedValue(undefined),
      findPendingEvents: jest.fn(),
      markAsPublished: jest.fn(),
      markAsFailed: jest.fn(),
      getRetryCount: jest.fn(),
    } as unknown as jest.Mocked<IOutboxRepository>;

    logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as unknown as jest.Mocked<ILogger>;

    prismaService = {
      $transaction: jest.fn().mockImplementation(async (callback) => callback({})),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AktualisiereSichtungHandler,
        PatientMapper,
        { provide: PrismaService, useValue: prismaService },
        { provide: OUTBOX_REPOSITORY, useValue: outboxRepository },
        { provide: PATIENT_REPOSITORY, useValue: patientRepository },
        { provide: ETB_REPOSITORY, useValue: etbRepository },
        { provide: LOGGER, useValue: logger },
      ],
    }).compile();

    handler = module.get(AktualisiereSichtungHandler);
  });

  it('Happy-Path: PatientSichtungAktualisiert + ETB-Eintrag + Outbox-Event in einer Transaktion', async () => {
    const result = await handler.execute(validCommand());

    expect(result.isSuccess).toBe(true);
    expect(result.value?.aktuelleSk).toBe('SK_I');
    expect(result.value?.eventVersion).toBe(2);
    expect(patientRepository.findById).toHaveBeenCalledTimes(1);
    expect(patientRepository.save).toHaveBeenCalledTimes(1);
    expect(etbRepository.findByEinsatzId).toHaveBeenCalledTimes(1);
    expect(etbRepository.save).toHaveBeenCalledTimes(1);
    expect(prismaService.$transaction).toHaveBeenCalledTimes(1);

    const outboxCalls = outboxRepository.save.mock.calls;
    expect(outboxCalls.length).toBe(1);
    const events = outboxCalls[0][0];
    expect(events.some((e: object) => e instanceof PatientSichtungAktualisiert)).toBe(true);
    const sichtungEvent = events.find((e: object) => e instanceof PatientSichtungAktualisiert) as PatientSichtungAktualisiert;
    expect(sichtungEvent.vorher).toBe('SK_III');
    expect(sichtungEvent.neu).toBe('SK_I');
  });

  it('Patient-not-found → PATIENT_NICHT_GEFUNDEN (HTTP 404 nach Mapping)', async () => {
    patientRepository.findById.mockResolvedValueOnce(null);
    const result = await handler.execute(validCommand());

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(AKTUALISIERE_SICHTUNG_ERROR_CODES.PATIENT_NICHT_GEFUNDEN);
    expect(patientRepository.save).not.toHaveBeenCalled();
    expect(etbRepository.save).not.toHaveBeenCalled();
  });

  it('Patient gehört zu fremdem Einsatz → PATIENT_NICHT_GEFUNDEN (kein Info-Leak)', async () => {
    patientRepository.findById.mockResolvedValueOnce(makePatient('SK_III', FOREIGN_EINSATZ_ID));
    const result = await handler.execute(validCommand());

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(AKTUALISIERE_SICHTUNG_ERROR_CODES.PATIENT_NICHT_GEFUNDEN);
  });

  it('TOT-Block → BusinessRule:SichtungVonTotNichtErlaubt-Sentinel propagiert', async () => {
    patientRepository.findById.mockResolvedValueOnce(makePatient('TOT'));
    const result = await handler.execute(validCommand({ neueSk: 'SK_I' }));

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('BusinessRule:SichtungVonTotNichtErlaubt');
    expect(etbRepository.save).not.toHaveBeenCalled();
  });

  it('No-Op (vorher === neu) → BusinessRule:SichtungUnveraendert', async () => {
    patientRepository.findById.mockResolvedValueOnce(makePatient('SK_I'));
    const result = await handler.execute(validCommand({ neueSk: 'SK_I' }));

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('BusinessRule:SichtungUnveraendert');
    expect(etbRepository.save).not.toHaveBeenCalled();
  });

  it('grund wird im ETB-Text-Slot gespiegelt (echte Umlaute)', async () => {
    const aggregateSpy = minimalEtbAggregate();
    etbRepository.findByEinsatzId.mockResolvedValueOnce(aggregateSpy);

    await handler.execute(validCommand({ grund: 'Vitalwerte verschlechtert' }));

    expect(aggregateSpy.addEintrag).toHaveBeenCalledTimes(1);
    const [text] = aggregateSpy.addEintrag.mock.calls[0];
    expect(text).toContain('Patient P-003');
    expect(text).toContain('SK III → SK I');
    expect(text).toContain('ärztliche Sichtung');
    expect(text).toContain('Vitalwerte verschlechtert');
  });

  it('ETB-Save-Fehler → ETB_APPEND_FAILED, kein Outbox-Persist (Rollback via Throw)', async () => {
    etbRepository.save.mockRejectedValueOnce(new Error('DB-Constraint-Violation'));

    const result = await handler.execute(validCommand());
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(AKTUALISIERE_SICHTUNG_ERROR_CODES.ETB_APPEND_FAILED);
    // Outbox.save wurde nie aufgerufen, weil executeInTransaction Result.fail
    // zurückgibt und die Basisklasse das nicht weiterreicht
    expect(outboxRepository.save).not.toHaveBeenCalled();
  });

  it('Result.fail bei invalidem SK-Code', async () => {
    const cmd = new AktualisiereSichtungCommand({
      einsatzId: VALID_EINSATZ_ID,
      patientId: VALID_PATIENT_ID,
      neueSk: 'SK_VI' as never,
      sichtungArt: 'aerztlich',
      sichter: { type: 'user', userId: VALID_USER_ID },
    });

    const result = await handler.execute(cmd);

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(AKTUALISIERE_SICHTUNG_ERROR_CODES.NEUE_SK_REQUIRED);
  });

  it('Result.fail bei zu langem grund (> 500 Zeichen)', async () => {
    const result = await handler.execute(validCommand({ grund: 'x'.repeat(501) }));
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(AKTUALISIERE_SICHTUNG_ERROR_CODES.GRUND_INVALID);
  });

  it('Result.fail bei ETB-Aggregat fehlt (Race-Case)', async () => {
    etbRepository.findByEinsatzId.mockResolvedValueOnce(null);
    const result = await handler.execute(validCommand());
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(AKTUALISIERE_SICHTUNG_ERROR_CODES.ETB_APPEND_FAILED);
  });
});
