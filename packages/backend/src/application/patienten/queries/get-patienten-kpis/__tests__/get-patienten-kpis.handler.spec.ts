import { Result } from '@domain/common/result';
import type { ILogger } from '@domain/ports/i-logger.port';
import type { PatientRepository } from '@domain/patienten/repositories/patient.repository';
import { GetPatientenKpisHandler } from '../get-patienten-kpis.handler';
import { GetPatientenKpisQuery } from '../get-patienten-kpis.query';

function buildHandler(repoMock: Partial<jest.Mocked<PatientRepository>>) {
  const logger: jest.Mocked<ILogger> = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
  const repo = { getKpiCounts: jest.fn(), ...repoMock } as unknown as PatientRepository;
  return { handler: new GetPatientenKpisHandler(repo, logger), repo, logger };
}

describe('GetPatientenKpisHandler', () => {
  it('liefert KpiAggregatDto mit allen Buckets, totalPatienten und stand-Timestamp', async () => {
    const { handler, repo, logger } = buildHandler({
      getKpiCounts: jest.fn().mockResolvedValue(
        Result.ok({
          skRows: [
            { aktuelleSk: 'SK_I', count: 12 },
            { aktuelleSk: 'SK_II', count: 48 },
            { aktuelleSk: 'SK_III', count: 130 },
            { aktuelleSk: 'SK_IV', count: 55 },
            { aktuelleSk: 'TOT', count: 5 },
          ],
          behandlungRows: [{ behandlungsstatus: 'UNVERSORGT', count: 60 }],
          transportRows: [{ transportstatus: 'WARTEND', count: 200 }],
        }),
      ),
    });

    const before = new Date();
    const result = await handler.execute(new GetPatientenKpisQuery('einsatz-1'));
    const after = new Date();

    expect(result.isSuccess).toBe(true);
    const dto = result.value!;
    expect(dto.sk).toEqual({ SK_I: 12, SK_II: 48, SK_III: 130, SK_IV: 55, TOT: 5 });
    expect(dto.behandlung.UNVERSORGT).toBe(60);
    expect(dto.behandlung.IN_BEHANDLUNG).toBe(0);
    expect(dto.transport.WARTEND).toBe(200);
    expect(dto.transport.IM_KRANKENHAUS).toBe(0);
    expect(dto.totalPatienten).toBe(250);

    const standTime = new Date(dto.stand).getTime();
    expect(standTime).toBeGreaterThanOrEqual(before.getTime());
    expect(standTime).toBeLessThanOrEqual(after.getTime());

    expect(repo.getKpiCounts).toHaveBeenCalledWith('einsatz-1');
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('kpi-aggregat-computed einsatz=einsatz-1 total=250'));
  });

  it('mappt leeren Einsatz auf 0-Buckets', async () => {
    const { handler } = buildHandler({
      getKpiCounts: jest.fn().mockResolvedValue(Result.ok({ skRows: [], behandlungRows: [], transportRows: [] })),
    });

    const result = await handler.execute(new GetPatientenKpisQuery('einsatz-empty'));

    expect(result.isSuccess).toBe(true);
    expect(result.value!.totalPatienten).toBe(0);
    expect(result.value!.sk).toEqual({ SK_I: 0, SK_II: 0, SK_III: 0, SK_IV: 0, TOT: 0 });
  });

  it('reicht Repository-Fehler weiter und loggt sie', async () => {
    const { handler, logger } = buildHandler({
      getKpiCounts: jest.fn().mockResolvedValue(Result.fail('Infrastructure:PatientKpiCountsFailed:DB down')),
    });

    const result = await handler.execute(new GetPatientenKpisQuery('einsatz-1'));

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('Infrastructure:PatientKpiCountsFailed:DB down');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Infrastructure:PatientKpiCountsFailed'));
  });

  it('lehnt leere einsatzId mit Validation-Sentinel ab', async () => {
    const { handler, repo } = buildHandler({
      getKpiCounts: jest.fn(),
    });

    const result = await handler.execute(new GetPatientenKpisQuery('   '));

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('Validation:EinsatzIdErforderlich');
    expect(repo.getKpiCounts).not.toHaveBeenCalled();
  });
});
