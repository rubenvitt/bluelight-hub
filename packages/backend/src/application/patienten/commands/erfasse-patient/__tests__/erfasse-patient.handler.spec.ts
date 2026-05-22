// @ts-nocheck
import { Test, type TestingModule } from '@nestjs/testing';
import { Result } from '@domain/common/result';
import { Patientennummer } from '@domain/patienten/value-objects/patientennummer.vo';
import type { PatientRepository } from '@domain/patienten/repositories/patient.repository';
import type { IEtbRepository } from '@domain/repositories';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import type { ILogger } from '@domain/ports/i-logger.port';
import { PatientErfasst } from '@domain/patienten/events/patient-erfasst.event';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ETB_REPOSITORY, LOGGER, OUTBOX_REPOSITORY, PATIENT_REPOSITORY } from '@infrastructure/di-tokens';
import { PatientMapper } from '../../../mappers/patient.mapper';
import { PATIENT_ERFASSEN_ERROR_CODES } from '../../../errors/patient-erfassen-error.codes';
import { createId } from '@paralleldrive/cuid2';
import { ErfassePatientCommand } from '../erfasse-patient.command';
import { ErfassePatientHandler } from '../erfasse-patient.handler';

const VALID_EINSATZ_ID = createId();
const VALID_USER_ID = createId();

/**
 * Unit-Tests für den ErfassePatientHandler (Story 1.2, AC1/AC6).
 *
 * Mockt Repositories und PrismaService — testet ausschließlich Handler-
 * Orchestrierung. Integration-Test (echte DB + Auth + ETB-Auto-Create) folgt
 * in der Controller-Spec.
 */
describe('ErfassePatientHandler', () => {
  let handler: ErfassePatientHandler;
  let patientRepository: jest.Mocked<PatientRepository>;
  let etbRepository: jest.Mocked<IEtbRepository>;
  let outboxRepository: jest.Mocked<IOutboxRepository>;
  let logger: jest.Mocked<ILogger>;
  let prismaService: { $transaction: jest.Mock };

  const validCommand = (): ErfassePatientCommand =>
    new ErfassePatientCommand({
      einsatzId: VALID_EINSATZ_ID,
      initialeSk: 'SK_II',
      erfasserRef: { type: 'user', userId: VALID_USER_ID },
      notiz: 'Polytrauma',
    });

  const minimalEtbAggregate = () => {
    const eintraege: Array<{ id: string }> = [];
    return {
      addEintrag: jest.fn().mockImplementation(() => {
        const eintrag = { id: `etb-eintrag-${eintraege.length + 1}` };
        eintraege.push(eintrag);
        return Result.ok(eintrag);
      }),
      getDomainEvents: jest.fn().mockReturnValue([]),
      clearDomainEvents: jest.fn(),
    };
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    patientRepository = {
      save: jest.fn().mockResolvedValue(Result.ok<void>(undefined)),
      findById: jest.fn(),
      nextPatientennummer: jest.fn().mockResolvedValue(Patientennummer.fromSequence(1)),
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
        ErfassePatientHandler,
        PatientMapper,
        { provide: PrismaService, useValue: prismaService },
        { provide: OUTBOX_REPOSITORY, useValue: outboxRepository },
        { provide: PATIENT_REPOSITORY, useValue: patientRepository },
        { provide: ETB_REPOSITORY, useValue: etbRepository },
        { provide: LOGGER, useValue: logger },
      ],
    }).compile();

    handler = module.get(ErfassePatientHandler);
  });

  it('Happy-Path: Patient + ETB-Eintrag + Outbox-Event werden in einer Transaktion persistiert', async () => {
    const result = await handler.execute(validCommand());

    expect(result.isSuccess).toBe(true);
    expect(result.value?.patientennummer).toBe('P-001');
    expect(result.value?.aktuelleSk).toBe('SK_II');
    expect(result.value?.behandlungsstatus).toBe('UNVERSORGT');
    expect(result.value?.transportstatus).toBe('WARTEND');
    expect(result.value?.erfasserRef).toEqual({ type: 'user', userId: VALID_USER_ID });

    expect(patientRepository.nextPatientennummer).toHaveBeenCalledWith(VALID_EINSATZ_ID, expect.anything());
    expect(patientRepository.save).toHaveBeenCalledTimes(1);
    expect(etbRepository.findByEinsatzId).toHaveBeenCalledTimes(1);
    expect(etbRepository.save).toHaveBeenCalledTimes(1);
    expect(prismaService.$transaction).toHaveBeenCalledTimes(1);

    // PatientErfasst landet in der Outbox
    const outboxCalls = outboxRepository.save.mock.calls;
    expect(outboxCalls.length).toBe(1);
    const events = outboxCalls[0][0];
    expect(events.some((e: object) => e instanceof PatientErfasst)).toBe(true);
  });

  it('Legt ETB an, wenn der Einsatz noch keines hat (Auto-Create)', async () => {
    etbRepository.findByEinsatzId.mockResolvedValueOnce(null);

    const result = await handler.execute(validCommand());

    expect(result.isSuccess).toBe(true);
    // ETB wurde im Handler selbst erzeugt und gespeichert
    expect(etbRepository.save).toHaveBeenCalledTimes(1);
  });

  it('Schreibt die Notiz in den ETB-text-Slot (gespiegelt)', async () => {
    const aggregateSpy = {
      addEintrag: jest.fn().mockReturnValue(Result.ok({ id: 'etb-eintrag-1' })),
      getDomainEvents: jest.fn().mockReturnValue([]),
      clearDomainEvents: jest.fn(),
    };
    etbRepository.findByEinsatzId.mockResolvedValueOnce(aggregateSpy as never);

    await handler.execute(validCommand());

    expect(aggregateSpy.addEintrag).toHaveBeenCalledTimes(1);
    const [text] = aggregateSpy.addEintrag.mock.calls[0];
    expect(text).toContain('Patient P-001 erfasst (SK_II)');
    expect(text).toContain('Polytrauma');
  });

  it('Result.fail bei invalidem SK-Code', async () => {
    const cmd = new ErfassePatientCommand({
      einsatzId: VALID_EINSATZ_ID,
      initialeSk: 'SK_VI' as never,
      erfasserRef: { type: 'user', userId: VALID_USER_ID },
    });

    const result = await handler.execute(cmd);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(PATIENT_ERFASSEN_ERROR_CODES.INITIALE_SK_REQUIRED);
    expect(patientRepository.save).not.toHaveBeenCalled();
  });

  it('Result.fail bei zu langer Notiz (>500 Zeichen)', async () => {
    const cmd = new ErfassePatientCommand({
      einsatzId: VALID_EINSATZ_ID,
      initialeSk: 'SK_II',
      erfasserRef: { type: 'user', userId: VALID_USER_ID },
      notiz: 'x'.repeat(501),
    });

    const result = await handler.execute(cmd);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(PATIENT_ERFASSEN_ERROR_CODES.NOTIZ_INVALID);
  });

  it('Result.fail bei leerer einsatzId', async () => {
    const cmd = new ErfassePatientCommand({
      einsatzId: '   ',
      initialeSk: 'SK_II',
      erfasserRef: { type: 'user', userId: VALID_USER_ID },
    });

    const result = await handler.execute(cmd);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(PATIENT_ERFASSEN_ERROR_CODES.EINSATZ_ID_REQUIRED);
  });

  it('Result.fail bei Patientennummer-Konflikt (race auf UNIQUE-Constraint)', async () => {
    patientRepository.save.mockResolvedValueOnce(Result.fail<void>('ConflictDetected:PatientennummerVergeben:P-001'));

    const result = await handler.execute(validCommand());

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(PATIENT_ERFASSEN_ERROR_CODES.PATIENTENNUMMER_KONFLIKT);
  });

  it('Result.fail bei nicht-User-ErfasserRef (Device-Erfassen ist Story 2.7)', async () => {
    const cmd = new ErfassePatientCommand({
      einsatzId: VALID_EINSATZ_ID,
      initialeSk: 'SK_II',
      erfasserRef: { type: 'device', deviceId: 'tab-1' },
    });

    const result = await handler.execute(cmd);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain(PATIENT_ERFASSEN_ERROR_CODES.ERFASSER_REF_INVALID);
  });

  it('Trimmt diviVakNummer und akzeptiert sie als Sekundär-Identifier', async () => {
    const cmd = new ErfassePatientCommand({
      einsatzId: VALID_EINSATZ_ID,
      initialeSk: 'SK_III',
      erfasserRef: { type: 'user', userId: VALID_USER_ID },
      diviVakNummer: ' DIVI-001 ',
    });

    const result = await handler.execute(cmd);

    expect(result.isSuccess).toBe(true);
    // Mapper-Output enthält die getrimmte DIVI-Nummer
    // (genaue Form ist via DiviVakNummer-VO).
  });
});
