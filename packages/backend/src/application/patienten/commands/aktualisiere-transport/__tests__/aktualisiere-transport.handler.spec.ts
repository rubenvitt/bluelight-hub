// @ts-nocheck
import { Test, type TestingModule } from '@nestjs/testing';
import { createId } from '@paralleldrive/cuid2';
import { Result } from '@domain/common/result';
import { Patient } from '@domain/patienten/aggregates/patient.aggregate';
import { ErfasserRef } from '@domain/patienten/value-objects/erfasser-ref.vo';
import { Patientennummer } from '@domain/patienten/value-objects/patientennummer.vo';
import { PatientTransportAbgeschlossen } from '@domain/patienten/events/patient-transport-abgeschlossen.event';
import { PatientTransportGestartet } from '@domain/patienten/events/patient-transport-gestartet.event';
import type { PatientRepository } from '@domain/patienten/repositories/patient.repository';
import type { IEtbRepository } from '@domain/repositories';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import type { ILogger } from '@domain/ports/i-logger.port';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ETB_REPOSITORY, LOGGER, OUTBOX_REPOSITORY, PATIENT_REPOSITORY } from '@infrastructure/di-tokens';
import { PatientMapper } from '../../../mappers/patient.mapper';
import { AKTUALISIERE_TRANSPORT_ERROR_CODES } from '../../../errors/aktualisiere-transport-error.codes';
import { AktualisiereTransportCommand } from '../aktualisiere-transport.command';
import { AktualisiereTransportHandler } from '../aktualisiere-transport.handler';

const VALID_EINSATZ_ID = createId();
const FOREIGN_EINSATZ_ID = createId();
const VALID_USER_ID = createId();
const VALID_PATIENT_ID = createId();

describe('AktualisiereTransportHandler (Story 1.4, FR19)', () => {
  let handler: AktualisiereTransportHandler;
  let patientRepository: jest.Mocked<PatientRepository>;
  let etbRepository: jest.Mocked<IEtbRepository>;
  let outboxRepository: jest.Mocked<IOutboxRepository>;
  let logger: jest.Mocked<ILogger>;
  let prismaService: { $transaction: jest.Mock };

  function makePatient(einsatzId: string = VALID_EINSATZ_ID, withTransport: 'WARTEND' | 'IM_TRANSPORT' | 'IM_KRANKENHAUS' = 'WARTEND'): Patient {
    const result = Patient.create({
      id: VALID_PATIENT_ID,
      einsatzId,
      patientennummer: Patientennummer.fromSequence(3).value!,
      erfasserRef: ErfasserRef.user(VALID_USER_ID).value!,
      erfasstAm: new Date('2026-05-19T09:00:00Z'),
    });
    const patient = result.value!;
    if (withTransport === 'IM_TRANSPORT' || withTransport === 'IM_KRANKENHAUS') patient.transportStarten();
    if (withTransport === 'IM_KRANKENHAUS') patient.transportAbschliessen();
    patient.clearDomainEvents();
    return patient;
  }

  const validCommand = (overrides: Partial<ConstructorParameters<typeof AktualisiereTransportCommand>[0]> = {}): AktualisiereTransportCommand =>
    new AktualisiereTransportCommand({
      einsatzId: VALID_EINSATZ_ID,
      patientId: VALID_PATIENT_ID,
      neuerStatus: 'IM_TRANSPORT',
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
      findById: jest.fn().mockResolvedValue(makePatient()),
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
    prismaService = { $transaction: jest.fn().mockImplementation(async (callback) => callback({})) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AktualisiereTransportHandler,
        PatientMapper,
        { provide: PrismaService, useValue: prismaService },
        { provide: OUTBOX_REPOSITORY, useValue: outboxRepository },
        { provide: PATIENT_REPOSITORY, useValue: patientRepository },
        { provide: ETB_REPOSITORY, useValue: etbRepository },
        { provide: LOGGER, useValue: logger },
      ],
    }).compile();
    handler = module.get(AktualisiereTransportHandler);
  });

  it('Happy-Path WARTEND → IM_TRANSPORT emittiert PatientTransportGestartet', async () => {
    const etbAggregate = minimalEtbAggregate();
    etbRepository.findByEinsatzId.mockResolvedValueOnce(etbAggregate);
    const result = await handler.execute(validCommand());
    expect(result.isSuccess).toBe(true);
    expect(result.value?.transportstatus).toBe('IM_TRANSPORT');

    // Exakt EIN Outbox-Write (Duplikat-Detector)
    expect(outboxRepository.save.mock.calls.length).toBe(1);

    const events = outboxRepository.save.mock.calls[0][0];
    const event = events.find((e: object) => e instanceof PatientTransportGestartet) as PatientTransportGestartet;
    expect(event).toBeDefined();
    expect(event.vorher).toBe('WARTEND');
    expect(event.neu).toBe('IM_TRANSPORT');

    // ETB-Text-Slot exakt geprüft
    expect(etbAggregate.addEintrag).toHaveBeenCalledTimes(1);
    expect(etbAggregate.addEintrag.mock.calls[0][0]).toBe('Patient P-003: Transport gestartet (WARTEND → IM_TRANSPORT)');
  });

  it('Happy-Path IM_TRANSPORT → IM_KRANKENHAUS emittiert PatientTransportAbgeschlossen', async () => {
    patientRepository.findById.mockResolvedValueOnce(makePatient(VALID_EINSATZ_ID, 'IM_TRANSPORT'));
    const result = await handler.execute(validCommand({ neuerStatus: 'IM_KRANKENHAUS' }));
    expect(result.isSuccess).toBe(true);
    const events = outboxRepository.save.mock.calls[0][0];
    const event = events.find((e: object) => e instanceof PatientTransportAbgeschlossen) as PatientTransportAbgeschlossen;
    expect(event).toBeDefined();
    expect(event.neu).toBe('IM_KRANKENHAUS');
  });

  it('Patient-not-found → PATIENT_NICHT_GEFUNDEN', async () => {
    patientRepository.findById.mockResolvedValueOnce(null);
    const result = await handler.execute(validCommand());
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(AKTUALISIERE_TRANSPORT_ERROR_CODES.PATIENT_NICHT_GEFUNDEN);
  });

  it('Fremder Einsatz → PATIENT_NICHT_GEFUNDEN', async () => {
    patientRepository.findById.mockResolvedValueOnce(makePatient(FOREIGN_EINSATZ_ID));
    const result = await handler.execute(validCommand());
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(AKTUALISIERE_TRANSPORT_ERROR_CODES.PATIENT_NICHT_GEFUNDEN);
  });

  it('Illegaler Übergang WARTEND → IM_KRANKENHAUS propagiert BusinessRule:TransportUngueltigerUebergang', async () => {
    const result = await handler.execute(validCommand({ neuerStatus: 'IM_KRANKENHAUS' }));
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('BusinessRule:TransportUngueltigerUebergang');
  });

  it('No-Op IM_TRANSPORT → IM_TRANSPORT propagiert BusinessRule:TransportUnveraendert', async () => {
    patientRepository.findById.mockResolvedValueOnce(makePatient(VALID_EINSATZ_ID, 'IM_TRANSPORT'));
    const result = await handler.execute(validCommand({ neuerStatus: 'IM_TRANSPORT' }));
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('BusinessRule:TransportUnveraendert');
  });

  it('Ungültiger neuerStatus → NEUER_STATUS_INVALID', async () => {
    const result = await handler.execute(validCommand({ neuerStatus: 'BOGUS' as never }));
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(AKTUALISIERE_TRANSPORT_ERROR_CODES.NEUER_STATUS_INVALID);
  });

  it('ETB-Save-Fehler propagiert ETB_APPEND_FAILED', async () => {
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
