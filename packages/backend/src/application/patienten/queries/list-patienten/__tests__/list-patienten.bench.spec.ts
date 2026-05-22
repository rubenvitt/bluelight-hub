import { Result } from '@domain/common/result';
import type { ILogger } from '@domain/ports/i-logger.port';
import type { PatientListResult, PatientListRow, PatientRepository } from '@domain/patienten/repositories/patient.repository';
import { ListPatientenHandler } from '../list-patienten.handler';
import { ListPatientenQuery } from '../list-patienten.query';

/**
 * Mikro-Bench für `ListPatientenHandler` (Story 1.6, AC1, NFR-P6).
 *
 * **Scope:** misst nur die Mapping- und Pagination-Overhead-Latenz im
 * Application-Layer — Repository-Calls werden gemockt. Damit decken wir den
 * Bench-Anspruch aus Task 7.2 (synthetisch, kein hartes Fail) ab; die echte
 * Postgres-Latenz wird im Integration-Test verifiziert (`patient-repository.adapter.list.spec.ts`).
 *
 * **Threshold:** 50 ms für 250 Items @ Application-Layer (NFR-P6 ist 150 ms
 * E2E inkl. DB → wir lassen großzügig Luft für den DB-Anteil).
 */
describe('ListPatientenHandler — Mikro-Bench (Story 1.6, AC1/NFR-P6)', () => {
  function buildRow(idx: number): PatientListRow {
    return {
      id: `pat_${idx}`,
      einsatzId: 'ein_bench',
      patientennummer: `P-${String(idx).padStart(4, '0')}`,
      diviVakNummer: idx % 7 === 0 ? `DIVI-${idx}` : null,
      aktuelleSk: (['SK_I', 'SK_II', 'SK_III', 'SK_IV', 'TOT'] as const)[idx % 5],
      behandlungsstatus: (['UNVERSORGT', 'IN_BEHANDLUNG', 'VERSORGT', 'TRANSPORTBEREIT'] as const)[idx % 4],
      transportstatus: (['WARTEND', 'IM_TRANSPORT', 'IM_KRANKENHAUS'] as const)[idx % 3],
      erfasstAm: new Date(Date.UTC(2026, 4, 20, 12, 0, idx % 60)),
      eventVersion: 1 + (idx % 5),
    };
  }

  function buildHandler(items: PatientListRow[], total: number) {
    const result: PatientListResult = { items, total };
    const repository: PatientRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      nextPatientennummer: jest.fn(),
      getKpiCounts: jest.fn(),
      findManyByEinsatz: jest.fn().mockResolvedValue(Result.ok(result)),
    };
    const logger: ILogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
    return new ListPatientenHandler(repository, logger);
  }

  it('verarbeitet 250 Items in < 50 ms Application-Layer-Overhead', async () => {
    const rows = Array.from({ length: 250 }, (_, i) => buildRow(i));
    const handler = buildHandler(rows, 250);
    const query = ListPatientenQuery.create({ einsatzId: 'ein_bench', pagination: { page: 1, pageSize: 50 } }).value!;

    // Warmup
    await handler.execute(query);

    const iterations = 20;
    const samples: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      const result = await handler.execute(query);
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      expect(result.isSuccess).toBe(true);
      samples.push(elapsedMs);
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))];

    // Sanity-check, NICHT als harte SLA — Application-Layer mit gemocktem
    // Repository soll deutlich unter dem 150-ms-E2E-Budget bleiben.
    expect(p95).toBeLessThan(50);
  });

  it('verarbeitet 500 Items im erweiterten Bench unter 100 ms', async () => {
    const rows = Array.from({ length: 500 }, (_, i) => buildRow(i));
    const handler = buildHandler(rows, 500);
    const query = ListPatientenQuery.create({ einsatzId: 'ein_bench', pagination: { page: 1, pageSize: 100 } }).value!;

    await handler.execute(query);
    const start = process.hrtime.bigint();
    const result = await handler.execute(query);
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;

    expect(result.isSuccess).toBe(true);
    expect(elapsedMs).toBeLessThan(100);
  });
});
