// @ts-nocheck
import { Test, type TestingModule } from '@nestjs/testing';
import { createId } from '@paralleldrive/cuid2';
import { Result } from '@domain/common/result';
import { Patient } from '@domain/patienten/aggregates/patient.aggregate';
import { ErfasserRef } from '@domain/patienten/value-objects/erfasser-ref.vo';
import { Patientennummer } from '@domain/patienten/value-objects/patientennummer.vo';
import { PatientBehandlungAbgeschlossen } from '@domain/patienten/events/patient-behandlung-abgeschlossen.event';
import { PatientBehandlungBegonnen } from '@domain/patienten/events/patient-behandlung-begonnen.event';
import type { PatientRepository } from '@domain/patienten/repositories/patient.repository';
import type { IEtbRepository } from '@domain/repositories';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import type { ILogger } from '@domain/ports/i-logger.port';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ETB_REPOSITORY, LOGGER, OUTBOX_REPOSITORY, PATIENT_REPOSITORY } from '@infrastructure/di-tokens';
import { PatientMapper } from '../../../mappers/patient.mapper';
import { AKTUALISIERE_BEHANDLUNG_ERROR_CODES } from '../../../errors/aktualisiere-behandlung-error.codes';
import { AktualisiereBehandlungCommand } from '../aktualisiere-behandlung.command';
import { AktualisiereBehandlungHandler } from '../aktualisiere-behandlung.handler';

const VALID_EINSATZ_ID = createId();
const FOREIGN_EINSATZ_ID = createId();
const VALID_USER_ID = createId();
const VALID_PATIENT_ID = createId();

describe('AktualisiereBehandlungHandler (Story 1.4, FR18)', () => {
  let handler: AktualisiereBehandlungHandler;
  let patientRepository: jest.Mocked<PatientRepository>;
  let etbRepository: jest.Mocked<IEtbRepository>;
  let outboxRepository: jest.Mocked<IOutboxRepository>;
  let logger: jest.Mocked<ILogger>;
  let prismaService: { $transaction: jest.Mock };

  function makePatient(einsatzId: string = VALID_EINSATZ_ID, withBehandlung: 'UNVERSORGT' | 'IN_BEHANDLUNG' | 'VERSORGT' | 'TRANSPORTBEREIT' = 'UNVERSORGT'): Patient {
    const result = Patient.create({
      id: VALID_PATIENT_ID,
      einsatzId,
      patientennummer: Patientennummer.fromSequence(3).value!,
      erfasserRef: ErfasserRef.user(VALID_USER_ID).value!,
      erfasstAm: new Date('2026-05-19T09:00:00Z'),
    });
    const patient = result.value!;
    // Bring aggregate into desired starting state via VO-erlaubte Übergänge
    if (withBehandlung === 'IN_BEHANDLUNG' || withBehandlung === 'VERSORGT' || withBehandlung === 'TRANSPORTBEREIT') {
      patient.behandlungBeginnen();
    }
    if (withBehandlung === 'VERSORGT') patient.behandlungAbschliessen('VERSORGT');
    if (withBehandlung === 'TRANSPORTBEREIT') patient.behandlungAbschliessen('TRANSPORTBEREIT');
    patient.clearDomainEvents();
    return patient;
  }

  const validCommand = (overrides: Partial<ConstructorParameters<typeof AktualisiereBehandlungCommand>[0]> = {}): AktualisiereBehandlungCommand =>
    new AktualisiereBehandlungCommand({
      einsatzId: VALID_EINSATZ_ID,
      patientId: VALID_PATIENT_ID,
      neuerStatus: 'IN_BEHANDLUNG',
      actor: { type: 'user', userId: VALID_USER_ID },
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
      findById: jest.fn().mockResolvedValue(makePatient(VALID_EINSATZ_ID, 'UNVERSORGT')),
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
        AktualisiereBehandlungHandler,
        PatientMapper,
        { provide: PrismaService, useValue: prismaService },
        { provide: OUTBOX_REPOSITORY, useValue: outboxRepository },
        { provide: PATIENT_REPOSITORY, useValue: patientRepository },
        { provide: ETB_REPOSITORY, useValue: etbRepository },
        { provide: LOGGER, useValue: logger },
      ],
    }).compile();

    handler = module.get(AktualisiereBehandlungHandler);
  });

  it('Happy-Path UNVERSORGT → IN_BEHANDLUNG emittiert PatientBehandlungBegonnen mit vorher/neu', async () => {
    const etbAggregate = minimalEtbAggregate();
    etbRepository.findByEinsatzId.mockResolvedValueOnce(etbAggregate);
    const result = await handler.execute(validCommand());
    expect(result.isSuccess).toBe(true);
    expect(result.value?.behandlungsstatus).toBe('IN_BEHANDLUNG');

    // Exakt EIN Outbox-Write (Duplikat-Detector)
    expect(outboxRepository.save.mock.calls.length).toBe(1);

    const events = outboxRepository.save.mock.calls[0][0];
    const event = events.find((e: object) => e instanceof PatientBehandlungBegonnen) as PatientBehandlungBegonnen;
    expect(event).toBeDefined();
    expect(event.vorher).toBe('UNVERSORGT');
    expect(event.neu).toBe('IN_BEHANDLUNG');

    // ETB-Text-Slot exakt geprüft
    expect(etbAggregate.addEintrag).toHaveBeenCalledTimes(1);
    expect(etbAggregate.addEintrag.mock.calls[0][0]).toBe('Patient P-003: Behandlung begonnen (UNVERSORGT → IN_BEHANDLUNG)');
  });

  it('Happy-Path IN_BEHANDLUNG → TRANSPORTBEREIT emittiert PatientBehandlungAbgeschlossen', async () => {
    patientRepository.findById.mockResolvedValueOnce(makePatient(VALID_EINSATZ_ID, 'IN_BEHANDLUNG'));
    const result = await handler.execute(validCommand({ neuerStatus: 'TRANSPORTBEREIT' }));
    expect(result.isSuccess).toBe(true);
    expect(result.value?.behandlungsstatus).toBe('TRANSPORTBEREIT');

    const events = outboxRepository.save.mock.calls[0][0];
    const event = events.find((e: object) => e instanceof PatientBehandlungAbgeschlossen) as PatientBehandlungAbgeschlossen;
    expect(event).toBeDefined();
    expect(event.vorher).toBe('IN_BEHANDLUNG');
    expect(event.neu).toBe('TRANSPORTBEREIT');
  });

  it('Patient-not-found → PATIENT_NICHT_GEFUNDEN', async () => {
    patientRepository.findById.mockResolvedValueOnce(null);
    const result = await handler.execute(validCommand());
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(AKTUALISIERE_BEHANDLUNG_ERROR_CODES.PATIENT_NICHT_GEFUNDEN);
    expect(patientRepository.save).not.toHaveBeenCalled();
  });

  it('Fremder Einsatz → PATIENT_NICHT_GEFUNDEN (Defense-in-Depth, kein Info-Leak)', async () => {
    patientRepository.findById.mockResolvedValueOnce(makePatient(FOREIGN_EINSATZ_ID, 'UNVERSORGT'));
    const result = await handler.execute(validCommand());
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(AKTUALISIERE_BEHANDLUNG_ERROR_CODES.PATIENT_NICHT_GEFUNDEN);
  });

  it('Illegaler Übergang UNVERSORGT → VERSORGT propagiert BusinessRule:BehandlungUngueltigerUebergang (Sentinel ohne Suffix)', async () => {
    const result = await handler.execute(validCommand({ neuerStatus: 'VERSORGT' }));
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('BusinessRule:BehandlungUngueltigerUebergang');
  });

  it('No-Op (IN_BEHANDLUNG → IN_BEHANDLUNG) propagiert BusinessRule:BehandlungUnveraendert', async () => {
    patientRepository.findById.mockResolvedValueOnce(makePatient(VALID_EINSATZ_ID, 'IN_BEHANDLUNG'));
    const result = await handler.execute(validCommand({ neuerStatus: 'IN_BEHANDLUNG' }));
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('BusinessRule:BehandlungUnveraendert');
  });

  it('Ungültiger neuerStatus → NEUER_STATUS_INVALID', async () => {
    const result = await handler.execute(validCommand({ neuerStatus: 'FOOBAR' as never }));
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(AKTUALISIERE_BEHANDLUNG_ERROR_CODES.NEUER_STATUS_INVALID);
  });

  it('ETB-Save-Fehler propagiert ETB_APPEND_FAILED (Rollback durch Tx)', async () => {
    etbRepository.save.mockRejectedValueOnce(new Error('boom'));
    const result = await handler.execute(validCommand());
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^Infrastructure:EtbAppendFailed:.+/);
  });

  it('patientRepository.save throws → PATIENT_SAVE_FAILED mit Cause-Suffix', async () => {
    patientRepository.save.mockRejectedValueOnce(new Error('boom'));
    const result = await handler.execute(validCommand());
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('Infrastructure:PatientSaveFailed:boom');
  });
});
