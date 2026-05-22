// @ts-nocheck
import { Test, type TestingModule } from '@nestjs/testing';
import { createId } from '@paralleldrive/cuid2';
import { Result } from '@domain/common/result';
import { Patient } from '@domain/patienten/aggregates/patient.aggregate';
import { ErfasserRef } from '@domain/patienten/value-objects/erfasser-ref.vo';
import { Patientennummer } from '@domain/patienten/value-objects/patientennummer.vo';
import { Sichtungskategorie } from '@domain/patienten/value-objects/sichtungskategorie.vo';
import { PatientKorrigiert } from '@domain/patienten/events/patient-korrigiert.event';
import type { PatientRepository } from '@domain/patienten/repositories/patient.repository';
import type { IEtbRepository } from '@domain/repositories';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import type { ILogger } from '@domain/ports/i-logger.port';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ETB_REPOSITORY, LOGGER, OUTBOX_REPOSITORY, PATIENT_REPOSITORY } from '@infrastructure/di-tokens';
import { PatientMapper } from '../../../mappers/patient.mapper';
import { KORRIGIERE_PATIENT_ERROR_CODES } from '../../../errors/korrigiere-patient-error.codes';
import { KorrigierePatientCommand } from '../korrigiere-patient.command';
import { KorrigierePatientHandler } from '../korrigiere-patient.handler';

const VALID_EINSATZ_ID = createId();
const FOREIGN_EINSATZ_ID = createId();
const VALID_USER_ID = createId();
const VALID_PATIENT_ID = createId();

describe('KorrigierePatientHandler (Story 1.4, FR42)', () => {
  let handler: KorrigierePatientHandler;
  let patientRepository: jest.Mocked<PatientRepository>;
  let etbRepository: jest.Mocked<IEtbRepository>;
  let outboxRepository: jest.Mocked<IOutboxRepository>;
  let logger: jest.Mocked<ILogger>;
  let prismaService: { $transaction: jest.Mock };

  function makePatient(einsatzId: string = VALID_EINSATZ_ID, initialSk: 'SK_I' | 'SK_II' | 'SK_III' | 'SK_IV' | 'TOT' = 'SK_III'): Patient {
    const result = Patient.create({
      id: VALID_PATIENT_ID,
      einsatzId,
      patientennummer: Patientennummer.fromSequence(7).value!,
      erfasserRef: ErfasserRef.user(VALID_USER_ID).value!,
      erfasstAm: new Date('2026-05-19T09:00:00Z'),
      initialeSk: Sichtungskategorie.create(initialSk).value!,
    });
    const patient = result.value!;
    patient.clearDomainEvents();
    return patient;
  }

  const validCommand = (overrides: Partial<ConstructorParameters<typeof KorrigierePatientCommand>[0]> = {}): KorrigierePatientCommand =>
    new KorrigierePatientCommand({
      einsatzId: VALID_EINSATZ_ID,
      patientId: VALID_PATIENT_ID,
      feld: 'sichtung',
      neuerWert: 'SK_II',
      grund: 'Falschmeldung Team A',
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
        KorrigierePatientHandler,
        PatientMapper,
        { provide: PrismaService, useValue: prismaService },
        { provide: OUTBOX_REPOSITORY, useValue: outboxRepository },
        { provide: PATIENT_REPOSITORY, useValue: patientRepository },
        { provide: ETB_REPOSITORY, useValue: etbRepository },
        { provide: LOGGER, useValue: logger },
      ],
    }).compile();
    handler = module.get(KorrigierePatientHandler);
  });

  it('Happy-Path feld=sichtung: TOT → SK_II emittiert PatientKorrigiert mit feld/vorher/neu/grund', async () => {
    patientRepository.findById.mockResolvedValueOnce(makePatient(VALID_EINSATZ_ID, 'TOT'));
    const etbAggregate = minimalEtbAggregate();
    etbRepository.findByEinsatzId.mockResolvedValueOnce(etbAggregate);
    const result = await handler.execute(validCommand({ feld: 'sichtung', neuerWert: 'SK_II', grund: 'Patient lebt — Falschmeldung' }));
    expect(result.isSuccess).toBe(true);
    expect(result.value?.aktuelleSk).toBe('SK_II');

    // Exakt EIN Outbox-Write (Duplikat-Detector)
    expect(outboxRepository.save.mock.calls.length).toBe(1);

    const events = outboxRepository.save.mock.calls[0][0];
    const event = events.find((e: object) => e instanceof PatientKorrigiert) as PatientKorrigiert;
    expect(event).toBeDefined();
    expect(event.feld).toBe('sichtung');
    expect(event.vorher).toBe('TOT');
    expect(event.neu).toBe('SK_II');
    expect(event.grund).toBe('Patient lebt — Falschmeldung');

    // ETB-Text-Slot exakt geprüft
    expect(etbAggregate.addEintrag).toHaveBeenCalledTimes(1);
    expect(etbAggregate.addEintrag.mock.calls[0][0]).toBe('Patient P-007: Korrektur — sichtung TOT → SK_II — Patient lebt — Falschmeldung');
  });

  it('Happy-Path feld=behandlungsstatus: setzt Snapshot ohne Übergangs-Check', async () => {
    const result = await handler.execute(validCommand({ feld: 'behandlungsstatus', neuerWert: 'TRANSPORTBEREIT', grund: 'Direkt-Setzen' }));
    expect(result.isSuccess).toBe(true);
    expect(result.value?.behandlungsstatus).toBe('TRANSPORTBEREIT');
  });

  it('Happy-Path feld=transportstatus: setzt Snapshot ohne Übergangs-Check', async () => {
    const result = await handler.execute(validCommand({ feld: 'transportstatus', neuerWert: 'IM_KRANKENHAUS', grund: 'Direkt-Setzen' }));
    expect(result.isSuccess).toBe(true);
    expect(result.value?.transportstatus).toBe('IM_KRANKENHAUS');
  });

  it('Patient-not-found → PATIENT_NICHT_GEFUNDEN', async () => {
    patientRepository.findById.mockResolvedValueOnce(null);
    const result = await handler.execute(validCommand());
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(KORRIGIERE_PATIENT_ERROR_CODES.PATIENT_NICHT_GEFUNDEN);
  });

  it('Fremder Einsatz → PATIENT_NICHT_GEFUNDEN', async () => {
    patientRepository.findById.mockResolvedValueOnce(makePatient(FOREIGN_EINSATZ_ID));
    const result = await handler.execute(validCommand());
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(KORRIGIERE_PATIENT_ERROR_CODES.PATIENT_NICHT_GEFUNDEN);
  });

  it('Unbekannter feld-Wert → FELD_INVALID', async () => {
    const result = await handler.execute(validCommand({ feld: 'foobar' as never }));
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(KORRIGIERE_PATIENT_ERROR_CODES.FELD_INVALID);
  });

  it('Ungültiger neuerWert für feld=sichtung propagiert BusinessRule:KorrekturNeuerWertInvalid', async () => {
    const result = await handler.execute(validCommand({ neuerWert: 'BOGUS' }));
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('BusinessRule:KorrekturNeuerWertInvalid');
  });

  it('Leerer grund (nach Trim) → GRUND_REQUIRED', async () => {
    const result = await handler.execute(validCommand({ grund: '   ' }));
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(KORRIGIERE_PATIENT_ERROR_CODES.GRUND_REQUIRED);
  });

  it('No-Op (vorher === neu) propagiert BusinessRule:KorrekturUnveraendert', async () => {
    const result = await handler.execute(validCommand({ neuerWert: 'SK_III', grund: 'Bestätigung' }));
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('BusinessRule:KorrekturUnveraendert');
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

  describe('Story 1.4 Code-Review Feature 2: TOT-Korrektur-Confirm-Flag', () => {
    it('feld=sichtung, neuerWert=TOT auf lebenden Patienten **ohne** `bestaetigeTotKorrektur` → KorrekturTotBenoetigtBestaetigung', async () => {
      patientRepository.findById.mockResolvedValueOnce(makePatient(VALID_EINSATZ_ID, 'SK_II'));
      const result = await handler.execute(validCommand({ feld: 'sichtung', neuerWert: 'TOT', grund: 'Patient verstorben' }));
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('BusinessRule:KorrekturTotBenoetigtBestaetigung');
      // Kein Save, kein Outbox-Write — Korrektur wurde im Aggregate abgelehnt.
      expect(patientRepository.save).not.toHaveBeenCalled();
      expect(outboxRepository.save).not.toHaveBeenCalled();
    });

    it('feld=sichtung, neuerWert=TOT auf lebenden Patienten **mit** `bestaetigeTotKorrektur=true` → Erfolg', async () => {
      patientRepository.findById.mockResolvedValueOnce(makePatient(VALID_EINSATZ_ID, 'SK_II'));
      const result = await handler.execute(
        validCommand({
          feld: 'sichtung',
          neuerWert: 'TOT',
          grund: 'Patient verstorben',
          bestaetigeTotKorrektur: true,
        }),
      );
      expect(result.isSuccess).toBe(true);
      expect(result.value?.aktuelleSk).toBe('TOT');
      expect(patientRepository.save).toHaveBeenCalledTimes(1);
    });

    it('feld=sichtung, neuerWert=TOT auf bereits TOT-markiertem Patienten ohne Flag → KorrekturUnveraendert (No-Op-Pfad hat Vorrang)', async () => {
      patientRepository.findById.mockResolvedValueOnce(makePatient(VALID_EINSATZ_ID, 'TOT'));
      const result = await handler.execute(validCommand({ feld: 'sichtung', neuerWert: 'TOT', grund: 'Bestätigung' }));
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('BusinessRule:KorrekturUnveraendert');
    });

    it('feld=sichtung, neuerWert=TOT auf lebenden Patienten mit `bestaetigeTotKorrektur=false` → KorrekturTotBenoetigtBestaetigung (Default-Safe)', async () => {
      patientRepository.findById.mockResolvedValueOnce(makePatient(VALID_EINSATZ_ID, 'SK_III'));
      const result = await handler.execute(
        validCommand({
          feld: 'sichtung',
          neuerWert: 'TOT',
          grund: 'Patient verstorben',
          bestaetigeTotKorrektur: false,
        }),
      );
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('BusinessRule:KorrekturTotBenoetigtBestaetigung');
    });
  });
});
