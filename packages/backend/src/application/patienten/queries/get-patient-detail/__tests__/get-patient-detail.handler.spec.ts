import { createId } from '@paralleldrive/cuid2';
import { Result } from '@domain/common/result';
import type { ILogger } from '@domain/ports/i-logger.port';
import type { Patient } from '@domain/patienten/aggregates/patient.aggregate';
import type { PatientEventRow, PatientRepository } from '@domain/patienten/repositories/patient.repository';
import { PatientMapper } from '../../../mappers/patient.mapper';
import { PatientDetailMapper } from '../../../mappers/patient-detail.mapper';
import { GetPatientDetailHandler, PATIENT_DETAIL_CROSS_EINSATZ_ACCESS, PATIENT_DETAIL_NOT_FOUND } from '../get-patient-detail.handler';
import { GetPatientDetailQuery } from '../get-patient-detail.query';

const PATIENT_CUID = createId();

function makePatient(overrides: Partial<{ einsatzId: string; id: string }> = {}): Patient {
  const patient = {
    einsatzId: overrides.einsatzId ?? 'ein-A',
    id: { value: overrides.id ?? PATIENT_CUID },
    patientennummer: { value: 'P-003' },
    diviVakNummer: null,
    aktuelleSk: { code: 'SK_III' },
    behandlungsstatus: { code: 'UNVERSORGT' },
    transportstatus: { code: 'WARTEND' },
    erfasstAm: new Date('2026-05-20T14:21:01.234Z'),
    erfasserRef: { data: { type: 'user', userId: 'usr-42' } },
    eventVersion: 7,
    clockDriftSeconds: null,
  } as unknown as Patient;
  return patient;
}

function makeEventRow(eventVersion: number, eventType = 'patient.gesichtet'): PatientEventRow {
  return {
    id: `evt-${eventVersion}`,
    patientId: PATIENT_CUID,
    einsatzId: 'ein-A',
    eventType,
    eventVersion,
    payload: { kind: eventType },
    occurredAt: new Date(`2026-05-20T14:${21 + eventVersion}:01.234Z`),
    recordedAt: new Date(`2026-05-20T14:${21 + eventVersion}:01.500Z`),
    actorUserId: 'usr-42',
    actorDeviceId: null,
    originSessionId: null,
    clockDriftSeconds: null,
  };
}

function buildHandler(repoMock: Partial<jest.Mocked<PatientRepository>>) {
  const logger: jest.Mocked<ILogger> = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
  const repo = { findById: jest.fn(), findEventsByPatientId: jest.fn(), ...repoMock } as unknown as PatientRepository;
  const mapper = new PatientDetailMapper(new PatientMapper());
  return { handler: new GetPatientDetailHandler(repo, logger, mapper), repo, logger };
}

describe('GetPatientDetailHandler (Story 1.7)', () => {
  it('liefert Patient + chronologisch sortierte Event-Historie (Branch 1: success)', async () => {
    const patient = makePatient();
    const events = [makeEventRow(1, 'patient.erfasst'), makeEventRow(2, 'patient.gesichtet'), makeEventRow(3, 'patient.sichtung-aktualisiert')];
    const { handler, logger } = buildHandler({
      findById: jest.fn().mockResolvedValue(patient),
      findEventsByPatientId: jest.fn().mockResolvedValue(Result.ok(events)),
    });

    const result = await handler.execute(new GetPatientDetailQuery('ein-A', PATIENT_CUID));

    expect(result.isSuccess).toBe(true);
    const dto = result.value!;
    expect(dto.events).toHaveLength(3);
    expect(dto.events[0]?.eventType).toBe('patient.erfasst');
    expect(dto.events[2]?.eventType).toBe('patient.sichtung-aktualisiert');
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining(`patient-detail-queried einsatz=ein-A patient=${PATIENT_CUID} eventCount=3`));
  });

  it('Branch 2: Patient nicht gefunden → PATIENT_NOT_FOUND', async () => {
    const { handler } = buildHandler({
      findById: jest.fn().mockResolvedValue(null),
      findEventsByPatientId: jest.fn().mockResolvedValue(Result.ok([])),
    });

    const result = await handler.execute(new GetPatientDetailQuery('ein-A', createId()));

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(PATIENT_DETAIL_NOT_FOUND);
  });

  it('Branch 3: Patient gehört zu anderem Einsatz → identische 404 + Logger-Warn', async () => {
    const patient = makePatient({ einsatzId: 'ein-FREMD' });
    const { handler, logger } = buildHandler({
      findById: jest.fn().mockResolvedValue(patient),
      findEventsByPatientId: jest.fn().mockResolvedValue(Result.ok([])),
    });

    const result = await handler.execute(new GetPatientDetailQuery('ein-A', PATIENT_CUID));

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(PATIENT_DETAIL_CROSS_EINSATZ_ACCESS);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('patient-detail-cross-einsatz-access-attempt'));
  });

  it('Branch 4: Repository-Events-Fehler wird opak propagiert (Detail nur im Log)', async () => {
    const patient = makePatient();
    const { handler, logger } = buildHandler({
      findById: jest.fn().mockResolvedValue(patient),
      findEventsByPatientId: jest.fn().mockResolvedValue(Result.fail('Infrastructure:PatientEventsQueryFailed:DB down — sensitive=secret')),
    });

    const result = await handler.execute(new GetPatientDetailQuery('ein-A', PATIENT_CUID));

    expect(result.isFailure).toBe(true);
    // Stem ohne Detail-Suffix nach außen — sonst leakt z. B. Connection-String.
    expect(result.error).toBe('Infrastructure:PatientEventsQueryFailed');
    expect(result.error).not.toContain('sensitive=secret');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('patient-detail-events-failed'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('sensitive=secret'));
  });

  it('Branch 6: malformed patientId (PatientId.create failure) → PATIENT_NOT_FOUND ohne Existenz-Leak', async () => {
    const findById = jest.fn();
    const findEventsByPatientId = jest.fn();
    const { handler, repo } = buildHandler({ findById, findEventsByPatientId } as Partial<jest.Mocked<PatientRepository>>);

    // PatientId.create lehnt offensichtlich invalides Format ab (Non-CUID).
    const result = await handler.execute(new GetPatientDetailQuery('ein-A', 'definitiv-keine-cuid'));

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(PATIENT_DETAIL_NOT_FOUND);
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('Branch 5: Patient existiert, hat 0 Events → success mit events=[]', async () => {
    const patient = makePatient();
    const { handler } = buildHandler({
      findById: jest.fn().mockResolvedValue(patient),
      findEventsByPatientId: jest.fn().mockResolvedValue(Result.ok([])),
    });

    const result = await handler.execute(new GetPatientDetailQuery('ein-A', PATIENT_CUID));

    expect(result.isSuccess).toBe(true);
    expect(result.value!.events).toEqual([]);
  });

  it('lehnt leere einsatzId mit Validation-Sentinel ab (kein Repository-Call)', async () => {
    const repoMock = { findById: jest.fn(), findEventsByPatientId: jest.fn() };
    const { handler, repo } = buildHandler(repoMock);

    const result = await handler.execute(new GetPatientDetailQuery('   ', 'pat-1'));

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('Validation:EinsatzIdErforderlich');
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('lehnt leere patientId mit Validation-Sentinel ab (kein Repository-Call)', async () => {
    const repoMock = { findById: jest.fn(), findEventsByPatientId: jest.fn() };
    const { handler, repo } = buildHandler(repoMock);

    const result = await handler.execute(new GetPatientDetailQuery('ein-A', '  '));

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('Validation:PatientIdErforderlich');
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('parallelisiert findById + findEventsByPatientId via Promise.all (echte Concurrency)', async () => {
    // Beide Repository-Calls verzögern um je 50 ms. Bei Parallelität ist die
    // Gesamtdauer ~50 ms, bei sequentiellem Await wären es ~100 ms. Die
    // Schwelle (<75 ms) toleriert Scheduling-Jitter.
    const findById = jest.fn(() => new Promise((resolve) => setTimeout(() => resolve(makePatient()), 50)));
    const findEventsByPatientId = jest.fn(() => new Promise((resolve) => setTimeout(() => resolve(Result.ok([])), 50)));
    const { handler } = buildHandler({ findById, findEventsByPatientId } as Partial<jest.Mocked<PatientRepository>>);

    const startedAt = Date.now();
    const result = await handler.execute(new GetPatientDetailQuery('ein-A', PATIENT_CUID));
    const elapsed = Date.now() - startedAt;

    expect(result.isSuccess).toBe(true);
    expect(elapsed).toBeLessThan(75);
  });
});
