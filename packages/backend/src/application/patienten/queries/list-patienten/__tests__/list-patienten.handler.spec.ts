import { Result } from '@domain/common/result';
import type { ILogger } from '@domain/ports/i-logger.port';
import type { PatientListResult, PatientRepository } from '@domain/patienten/repositories/patient.repository';
import { ListPatientenHandler } from '../list-patienten.handler';
import { ListPatientenQuery } from '../list-patienten.query';

function buildHandler(repoOverride: Partial<PatientRepository> = {}) {
  const repository: PatientRepository = {
    save: jest.fn(),
    findById: jest.fn(),
    nextPatientennummer: jest.fn(),
    getKpiCounts: jest.fn(),
    findManyByEinsatz: jest.fn(),
    ...repoOverride,
  };
  const logger: ILogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return { handler: new ListPatientenHandler(repository, logger), repository, logger };
}

describe('ListPatientenHandler (Story 1.6)', () => {
  it('mappt Repository-Erfolg auf Items + PaginationMetaDto', async () => {
    const repoResult: PatientListResult = {
      items: [
        {
          id: 'pat_1',
          einsatzId: 'ein_1',
          patientennummer: 'P-001',
          diviVakNummer: null,
          aktuelleSk: 'SK_I',
          behandlungsstatus: 'UNVERSORGT',
          transportstatus: 'WARTEND',
          erfasstAm: new Date('2026-05-20T10:00:00Z'),
          eventVersion: 2,
        },
        {
          id: 'pat_2',
          einsatzId: 'ein_1',
          patientennummer: 'P-002',
          diviVakNummer: 'DIVI-1',
          aktuelleSk: 'SK_II',
          behandlungsstatus: 'IN_BEHANDLUNG',
          transportstatus: 'WARTEND',
          erfasstAm: new Date('2026-05-20T10:10:00Z'),
          eventVersion: 4,
        },
      ],
      total: 47,
    };
    const findManyByEinsatz = jest.fn().mockResolvedValue(Result.ok(repoResult));
    const { handler } = buildHandler({ findManyByEinsatz });

    const query = ListPatientenQuery.create({
      einsatzId: 'ein_1',
      pagination: { page: 2, pageSize: 10 },
    }).value!;

    const result = await handler.execute(query);

    expect(result.isSuccess).toBe(true);
    expect(findManyByEinsatz).toHaveBeenCalledWith('ein_1', {}, { field: 'sk', direction: 'asc' }, { page: 2, pageSize: 10 });
    expect(result.value!.items).toHaveLength(2);
    expect(result.value!.items[0].patientennummer).toBe('P-001');
    expect(result.value!.items[1].patientennummer).toBe('P-002');
    expect(result.value!.pagination).toEqual({ page: 2, pageSize: 10, total: 47, totalPages: 5 });
  });

  it('liefert leere Liste + total=0 bei leerem Repository-Ergebnis', async () => {
    const findManyByEinsatz = jest.fn().mockResolvedValue(Result.ok({ items: [], total: 0 } satisfies PatientListResult));
    const { handler } = buildHandler({ findManyByEinsatz });

    const query = ListPatientenQuery.create({ einsatzId: 'ein_x' }).value!;
    const result = await handler.execute(query);

    expect(result.isSuccess).toBe(true);
    expect(result.value!.items).toEqual([]);
    expect(result.value!.pagination).toEqual({ page: 1, pageSize: 50, total: 0, totalPages: 0 });
  });

  it('propagiert Repository-Failure mit Sentinel-Code', async () => {
    const findManyByEinsatz = jest.fn().mockResolvedValue(Result.fail<PatientListResult>('Infrastructure:PatientListQueryFailed:db-down'));
    const { handler, logger } = buildHandler({ findManyByEinsatz });

    const query = ListPatientenQuery.create({ einsatzId: 'ein_x' }).value!;
    const result = await handler.execute(query);

    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Infrastructure:PatientListQueryFailed');
    expect(logger.error).toHaveBeenCalled();
  });
});
