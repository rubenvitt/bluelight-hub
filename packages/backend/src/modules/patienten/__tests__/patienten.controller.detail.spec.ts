import { ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Result } from '@domain/common/result';
import request from 'supertest';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { EinsatzScopeGuard } from '@/modules/auth/guards/einsatz-scope.guard';
import { AktualisiereBehandlungHandler } from '@/application/patienten/commands/aktualisiere-behandlung/aktualisiere-behandlung.handler';
import { AktualisiereSichtungHandler } from '@/application/patienten/commands/aktualisiere-sichtung/aktualisiere-sichtung.handler';
import { AktualisiereTransportHandler } from '@/application/patienten/commands/aktualisiere-transport/aktualisiere-transport.handler';
import { ErfassePatientHandler } from '@/application/patienten/commands/erfasse-patient/erfasse-patient.handler';
import { KorrigierePatientHandler } from '@/application/patienten/commands/korrigiere-patient/korrigiere-patient.handler';
import { GetPatientDetailHandler } from '@/application/patienten/queries/get-patient-detail';
import { GetPatientenKpisHandler } from '@/application/patienten/queries/get-patienten-kpis';
import { ListPatientenHandler } from '@/application/patienten/queries/list-patienten';
import type { PatientDetailDto } from '@/application/patienten/dto/patient-detail.dto';
import { PatientenController } from '../patienten.controller';

/**
 * Controller-Spec für `GET /api/v1/einsaetze/:einsatzId/patienten/:patientId`
 * (Story 1.7, AC1/AC5). Echtes NestJS-App-Setup mit ValidationPipe — keine
 * Vacuous-Mocks (Lessons-Learned 1.4-Review).
 */
describe('PatientenController.detail (Story 1.7)', () => {
  let app: INestApplication;
  let detailHandler: jest.Mocked<GetPatientDetailHandler>;
  let kpisHandler: jest.Mocked<GetPatientenKpisHandler>;

  beforeEach(async () => {
    detailHandler = { execute: jest.fn() } as unknown as jest.Mocked<GetPatientDetailHandler>;
    kpisHandler = { execute: jest.fn() } as unknown as jest.Mocked<GetPatientenKpisHandler>;

    const module = await Test.createTestingModule({
      controllers: [PatientenController],
      providers: [
        { provide: ErfassePatientHandler, useValue: { execute: jest.fn() } },
        { provide: AktualisiereSichtungHandler, useValue: { execute: jest.fn() } },
        { provide: AktualisiereBehandlungHandler, useValue: { execute: jest.fn() } },
        { provide: AktualisiereTransportHandler, useValue: { execute: jest.fn() } },
        { provide: KorrigierePatientHandler, useValue: { execute: jest.fn() } },
        { provide: GetPatientenKpisHandler, useValue: kpisHandler },
        { provide: ListPatientenHandler, useValue: { execute: jest.fn() } },
        { provide: GetPatientDetailHandler, useValue: detailHandler },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(EinsatzScopeGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  function buildDetailDto(): PatientDetailDto {
    return {
      id: 'pat_01',
      einsatzId: 'ein_01',
      patientennummer: 'P-001',
      diviVakNummer: undefined,
      aktuelleSk: 'SK_II',
      behandlungsstatus: 'UNVERSORGT',
      transportstatus: 'WARTEND',
      erfasstAm: '2026-05-20T10:00:00.000Z',
      erfasserRef: { type: 'user', userId: 'usr-42' },
      eventVersion: 1,
      clockDriftSeconds: undefined,
      events: [
        {
          id: 'evt_01',
          eventVersion: 1,
          eventType: 'patient.erfasst',
          occurredAt: '2026-05-20T10:00:00.000Z',
          recordedAt: '2026-05-20T10:00:00.500Z',
          actorUserId: 'usr-42',
          actorDeviceId: null,
          originSessionId: null,
          clockDriftSeconds: null,
          payload: { kind: 'patient.erfasst', patientennummer: 'P-001' },
        },
      ],
    } as unknown as PatientDetailDto;
  }

  it('200 → Wrapper-Shape { data: PatientDetailDto } mit Snapshot + Event-Liste', async () => {
    detailHandler.execute.mockResolvedValue(Result.ok(buildDetailDto()));

    const res = await request(app.getHttpServer()).get('/api/v1/einsaetze/ein_01/patienten/pat_01').expect(200);

    expect(res.body.data.patientennummer).toBe('P-001');
    expect(res.body.data.events).toHaveLength(1);
    expect(res.body.data.events[0].eventType).toBe('patient.erfasst');
    expect(detailHandler.execute).toHaveBeenCalledWith(expect.objectContaining({ einsatzId: 'ein_01', patientId: 'pat_01' }));
  });

  it('404 mit code=PATIENT_NOT_FOUND + message="Patient nicht gefunden", wenn Patient nicht existiert', async () => {
    detailHandler.execute.mockResolvedValue(Result.fail('PATIENT_NOT_FOUND:patient does not exist'));

    const res = await request(app.getHttpServer()).get('/api/v1/einsaetze/ein_01/patienten/pat_unknown').expect(404);

    expect(res.body.code).toBe('PATIENT_NOT_FOUND');
    expect(res.body.message).toBe('Patient nicht gefunden');
  });

  it('404 mit IDENTISCHEM Body, wenn Patient zu fremdem Einsatz gehört (kein Existenz-Leak)', async () => {
    detailHandler.execute.mockResolvedValue(Result.fail('PATIENT_NOT_FOUND:cross-einsatz-access'));

    const res = await request(app.getHttpServer()).get('/api/v1/einsaetze/ein_A/patienten/pat_fremd').expect(404);

    expect(res.body.code).toBe('PATIENT_NOT_FOUND');
    expect(res.body.message).toBe('Patient nicht gefunden');
  });

  it('403, wenn EinsatzScopeGuard wirft (Defense-in-Depth: Handler darf nicht aufgerufen werden)', async () => {
    // Separater Testmodul-Build mit denyingGuard — Pattern aus 1.4-Review.
    const denyingGuard = {
      canActivate: () => {
        throw new ForbiddenException('EinsatzScope:NichtZugeordnet');
      },
    };
    const denyingModule = await Test.createTestingModule({
      controllers: [PatientenController],
      providers: [
        { provide: ErfassePatientHandler, useValue: { execute: jest.fn() } },
        { provide: AktualisiereSichtungHandler, useValue: { execute: jest.fn() } },
        { provide: AktualisiereBehandlungHandler, useValue: { execute: jest.fn() } },
        { provide: AktualisiereTransportHandler, useValue: { execute: jest.fn() } },
        { provide: KorrigierePatientHandler, useValue: { execute: jest.fn() } },
        { provide: GetPatientenKpisHandler, useValue: { execute: jest.fn() } },
        { provide: ListPatientenHandler, useValue: { execute: jest.fn() } },
        { provide: GetPatientDetailHandler, useValue: detailHandler },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(EinsatzScopeGuard)
      .useValue(denyingGuard)
      .compile();

    const denyingApp = denyingModule.createNestApplication();
    await denyingApp.init();

    await request(denyingApp.getHttpServer()).get('/api/v1/einsaetze/ein_fremd/patienten/pat_01').expect(403);
    expect(detailHandler.execute).not.toHaveBeenCalled();
    await denyingApp.close();
  });

  it('Route-Ordering: GET /patienten/kpis matched KEIN :patientId (kpis vor :patientId deklariert)', async () => {
    kpisHandler.execute.mockResolvedValue(
      Result.ok({
        sk: { SK_I: 0, SK_II: 0, SK_III: 0, SK_IV: 0, TOT: 0 },
        behandlung: { UNVERSORGT: 0, IN_BEHANDLUNG: 0, VERSORGT: 0, TRANSPORTBEREIT: 0 },
        transport: { WARTEND: 0, IM_TRANSPORT: 0, IM_KRANKENHAUS: 0 },
        totalPatienten: 0,
        stand: '2026-05-21T10:00:00.000Z',
      }),
    );

    await request(app.getHttpServer()).get('/api/v1/einsaetze/ein_01/patienten/kpis').expect(200);

    expect(kpisHandler.execute).toHaveBeenCalled();
    expect(detailHandler.execute).not.toHaveBeenCalled();
  });
});
