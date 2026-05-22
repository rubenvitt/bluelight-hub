import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
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
import { ListPatientenHandler, type ListPatientenHandlerResult } from '@/application/patienten/queries/list-patienten';
import type { PatientListItemDto } from '@/application/patienten/dto/patient-list-item.dto';
import { PatientenController } from '../patienten.controller';

describe('PatientenController.list (Story 1.6)', () => {
  let listHandler: jest.Mocked<ListPatientenHandler>;
  let controller: PatientenController;

  beforeEach(async () => {
    listHandler = { execute: jest.fn() } as unknown as jest.Mocked<ListPatientenHandler>;

    const module = await Test.createTestingModule({
      controllers: [PatientenController],
      providers: [
        { provide: ErfassePatientHandler, useValue: { execute: jest.fn() } },
        { provide: AktualisiereSichtungHandler, useValue: { execute: jest.fn() } },
        { provide: AktualisiereBehandlungHandler, useValue: { execute: jest.fn() } },
        { provide: AktualisiereTransportHandler, useValue: { execute: jest.fn() } },
        { provide: KorrigierePatientHandler, useValue: { execute: jest.fn() } },
        { provide: GetPatientenKpisHandler, useValue: { execute: jest.fn() } },
        { provide: ListPatientenHandler, useValue: listHandler },
        { provide: GetPatientDetailHandler, useValue: { execute: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(EinsatzScopeGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(PatientenController);
  });

  function buildItem(overrides: Partial<PatientListItemDto> = {}): PatientListItemDto {
    return {
      id: 'pat_1',
      patientennummer: 'P-001',
      diviVakNummer: null,
      name: null,
      aktuelleSk: 'SK_II',
      behandlungsstatus: 'UNVERSORGT',
      transportstatus: 'WARTEND',
      erfasstAm: '2026-05-20T10:00:00.000Z',
      eventVersion: 1,
      ...overrides,
    };
  }

  function buildResult(items: PatientListItemDto[], total: number, page = 1, pageSize = 50): ListPatientenHandlerResult {
    const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
    return {
      items,
      pagination: { page, pageSize, total, totalPages },
    };
  }

  it('Default-Aufruf mappt auf Defaults und liefert Wrapper-Shape', async () => {
    listHandler.execute.mockResolvedValueOnce(Result.ok(buildResult([buildItem()], 1)));
    const response = await controller.list('ein_1', {});

    expect(response.data).toHaveLength(1);
    expect(response.pagination).toEqual({ page: 1, pageSize: 50, total: 1, totalPages: 1 });
    const query = listHandler.execute.mock.calls[0][0];
    expect(query.einsatzId).toBe('ein_1');
    expect(query.sort).toEqual({ field: 'sk', direction: 'asc' });
    expect(query.pagination).toEqual({ page: 1, pageSize: 50 });
    expect(query.filters).toEqual({});
  });

  it('CSV-Filter werden auf String-Arrays geparst und an die Query weitergegeben', async () => {
    listHandler.execute.mockResolvedValueOnce(Result.ok(buildResult([], 0)));
    await controller.list('ein_1', {
      sk: 'SK_I,SK_II',
      behandlungsstatus: 'TRANSPORTBEREIT',
      transportstatus: 'WARTEND',
      search: 'Mueller',
    });

    const query = listHandler.execute.mock.calls[0][0];
    expect(query.filters.sk).toEqual(['SK_I', 'SK_II']);
    expect(query.filters.behandlungsstatus).toEqual(['TRANSPORTBEREIT']);
    expect(query.filters.transportstatus).toEqual(['WARTEND']);
    expect(query.filters.search).toBe('Mueller');
  });

  it('leere CSV-Werte landen als kein Filter (Defense gegen ?sk=)', async () => {
    listHandler.execute.mockResolvedValueOnce(Result.ok(buildResult([], 0)));
    await controller.list('ein_1', { sk: '', behandlungsstatus: ',  ,' });

    const query = listHandler.execute.mock.calls[0][0];
    expect(query.filters.sk).toBeUndefined();
    expect(query.filters.behandlungsstatus).toBeUndefined();
  });

  it('Sort + Pagination werden aus DTO übernommen', async () => {
    listHandler.execute.mockResolvedValueOnce(Result.ok(buildResult([], 0, 3, 25)));
    await controller.list('ein_1', { sortBy: 'zeit', sortDir: 'desc', page: 3, pageSize: 25 });

    const query = listHandler.execute.mock.calls[0][0];
    expect(query.sort).toEqual({ field: 'zeit', direction: 'desc' });
    expect(query.pagination).toEqual({ page: 3, pageSize: 25 });
  });

  it('unbekannter SK-Wert wirft BadRequest aus Query-Factory-Validation', async () => {
    await expect(controller.list('ein_1', { sk: 'FOO' })).rejects.toThrow(BadRequestException);
    expect(listHandler.execute).not.toHaveBeenCalled();
  });

  it('Handler-Failure (Infrastructure) wird durch mapErrorToHttp übersetzt', async () => {
    listHandler.execute.mockResolvedValueOnce(Result.fail('Infrastructure:PatientListQueryFailed:boom'));
    await expect(controller.list('ein_1', {})).rejects.toThrow();
  });
});

describe('PatientenController.list — ValidationPipe-Integration (Story 1.6)', () => {
  let app: INestApplication;
  let listHandler: jest.Mocked<ListPatientenHandler>;

  beforeAll(async () => {
    listHandler = { execute: jest.fn() } as unknown as jest.Mocked<ListPatientenHandler>;
    const moduleRef = await Test.createTestingModule({
      controllers: [PatientenController],
      providers: [
        { provide: ErfassePatientHandler, useValue: { execute: jest.fn() } },
        { provide: AktualisiereSichtungHandler, useValue: { execute: jest.fn() } },
        { provide: AktualisiereBehandlungHandler, useValue: { execute: jest.fn() } },
        { provide: AktualisiereTransportHandler, useValue: { execute: jest.fn() } },
        { provide: KorrigierePatientHandler, useValue: { execute: jest.fn() } },
        { provide: GetPatientenKpisHandler, useValue: { execute: jest.fn() } },
        { provide: ListPatientenHandler, useValue: listHandler },
        { provide: GetPatientDetailHandler, useValue: { execute: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(EinsatzScopeGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lehnt nicht-numerische page-Werte über ValidationPipe ab (400)', async () => {
    await request(app.getHttpServer()).get('/api/v1/einsaetze/ein_1/patienten').query({ page: 'abc' }).expect(400);
    expect(listHandler.execute).not.toHaveBeenCalled();
  });

  it('lehnt zu großen pageSize-Wert über ValidationPipe ab (400)', async () => {
    await request(app.getHttpServer()).get('/api/v1/einsaetze/ein_1/patienten').query({ pageSize: 999 }).expect(400);
    expect(listHandler.execute).not.toHaveBeenCalled();
  });

  it('akzeptiert vollständig validen Aufruf und reicht ihn an den Handler durch', async () => {
    listHandler.execute.mockResolvedValueOnce(
      Result.ok({
        items: [],
        pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
      }),
    );
    await request(app.getHttpServer()).get('/api/v1/einsaetze/ein_1/patienten').query({ sk: 'SK_I,SK_II', sortBy: 'zeit', sortDir: 'desc' }).expect(200);

    expect(listHandler.execute).toHaveBeenCalledTimes(1);
    const query = listHandler.execute.mock.calls[0][0];
    expect(query.filters.sk).toEqual(['SK_I', 'SK_II']);
    expect(query.sort).toEqual({ field: 'zeit', direction: 'desc' });
  });
});
