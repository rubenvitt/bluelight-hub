import { Result } from '@domain/common/result';
import type { ILogger } from '@domain/ports/i-logger.port';
import type { PatientRepository } from '@domain/patienten/repositories/patient.repository';
import { GetPatientenKpisHandler } from '../get-patienten-kpis.handler';
import { GetPatientenKpisQuery } from '../get-patienten-kpis.query';

/**
 * Mikro-Benchmark für den KPI-Read-Pfad (Story 1.5, AC1, NFR-P6/NFR-SC1).
 *
 * Verifiziert NICHT die Postgres-Latenz (kein DB-Test-Setup verfügbar —
 * Defer auf Story 1.6/1.7 dokumentiert in `deferred-work.md`), sondern den
 * Application-Layer-Overhead: Mapper, Result-Plumbing, Logger-Call.
 *
 * Synthetische Repository-Antwort mit n=250 bzw. n=500 Rows pro Dimension;
 * Repo selbst antwortet sofort (microtask), das gemessene p95 ist also rein
 * der Application-Layer-Overhead. Erwartung: p95 deutlich < 5 ms — damit
 * bleibt das 100/120-ms-NFR-Budget vollständig der DB überlassen.
 *
 * Kein hartes Fail-Threshold (CI-Hardware variiert) — der Test loggt das
 * gemessene p95 und schlägt nur an, wenn der Overhead absurd hoch wird
 * (> 50 ms p95). Echte Latenz-Verifikation in der DB-Integrations-Suite.
 */
describe('GetPatientenKpisHandler — synthetischer p95-Benchmark', () => {
  function buildSyntheticRepo(n: number): PatientRepository {
    const skCategories = ['SK_I', 'SK_II', 'SK_III', 'SK_IV', 'TOT'] as const;
    const behandlungCategories = ['UNVERSORGT', 'IN_BEHANDLUNG', 'VERSORGT', 'TRANSPORTBEREIT'] as const;
    const transportCategories = ['WARTEND', 'IM_TRANSPORT', 'IM_KRANKENHAUS'] as const;
    // Gleichverteilung über die Buckets; Rest landet im jeweils ersten Bucket.
    const skRows = skCategories.map((cat, idx) => ({
      aktuelleSk: cat,
      count: idx === 0 ? n - Math.floor(n / skCategories.length) * (skCategories.length - 1) : Math.floor(n / skCategories.length),
    }));
    const behandlungRows = behandlungCategories.map((cat, idx) => ({
      behandlungsstatus: cat,
      count: idx === 0 ? n - Math.floor(n / behandlungCategories.length) * (behandlungCategories.length - 1) : Math.floor(n / behandlungCategories.length),
    }));
    const transportRows = transportCategories.map((cat, idx) => ({
      transportstatus: cat,
      count: idx === 0 ? n - Math.floor(n / transportCategories.length) * (transportCategories.length - 1) : Math.floor(n / transportCategories.length),
    }));

    return {
      save: jest.fn(),
      findById: jest.fn(),
      nextPatientennummer: jest.fn(),
      getKpiCounts: jest.fn().mockResolvedValue(Result.ok({ skRows, behandlungRows, transportRows })),
    } as unknown as PatientRepository;
  }

  const silentLogger: ILogger = { log: () => {}, error: () => {}, warn: () => {}, debug: () => {} };

  async function measureP95(handler: GetPatientenKpisHandler, runs: number) {
    const durations: number[] = [];
    for (let i = 0; i < runs; i++) {
      const startedAt = performance.now();
      await handler.execute(new GetPatientenKpisQuery('einsatz-1'));
      durations.push(performance.now() - startedAt);
    }
    durations.sort((a, b) => a - b);
    return {
      p50: durations[Math.floor(durations.length * 0.5)],
      p95: durations[Math.floor(durations.length * 0.95)],
      max: durations[durations.length - 1],
    };
  }

  it('Application-Overhead bei n=250 bleibt p95 < 50 ms (NFR-P6-Headroom)', async () => {
    const handler = new GetPatientenKpisHandler(buildSyntheticRepo(250), silentLogger);
    // 5 Warmup-Iterationen, danach 50 gemessene Runs.
    for (let i = 0; i < 5; i++) await handler.execute(new GetPatientenKpisQuery('warmup'));
    const stats = await measureP95(handler, 50);

    // Reporting (kein harter Threshold gegen Mapper-Overhead — n=250 mit
    // gemockter DB liegt typisch bei < 1 ms p95).
    // eslint-disable-next-line no-console
    console.log(`[kpi-bench n=250] p50=${stats.p50.toFixed(3)}ms p95=${stats.p95.toFixed(3)}ms max=${stats.max.toFixed(3)}ms`);
    expect(stats.p95).toBeLessThan(50);
  });

  it('Application-Overhead bei n=500 bleibt p95 < 50 ms (NFR-SC1-Headroom)', async () => {
    const handler = new GetPatientenKpisHandler(buildSyntheticRepo(500), silentLogger);
    for (let i = 0; i < 5; i++) await handler.execute(new GetPatientenKpisQuery('warmup'));
    const stats = await measureP95(handler, 50);

    // eslint-disable-next-line no-console
    console.log(`[kpi-bench n=500] p50=${stats.p50.toFixed(3)}ms p95=${stats.p95.toFixed(3)}ms max=${stats.max.toFixed(3)}ms`);
    expect(stats.p95).toBeLessThan(50);
  });
});
