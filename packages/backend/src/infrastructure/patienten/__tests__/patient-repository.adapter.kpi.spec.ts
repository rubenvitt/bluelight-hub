import type { PrismaService } from '@/infrastructure/database/prisma.service';
import type { EventSerializer } from '@/infrastructure/outbox/event-serializer';
import { PatientRepositoryAdapter } from '../patient-repository.adapter';

/**
 * Unit-Test für den KPI-Pfad des Repository-Adapters (Story 1.5, AC1).
 *
 * Fokus:
 *  - Die drei `groupBy`-Calls werden **parallel** abgesetzt (Promise.all),
 *    nicht sequenziell — verifiziert über deferred Promises + zeitliche
 *    Reihenfolge der Promise-Erzeugung.
 *  - Result-Shape mapped korrekt von `_count._all` auf das flache
 *    `{ <dim>, count }`-Format des Domain-Ports.
 *  - Prisma-Fehler werden in `Result.fail('Infrastructure:PatientKpiCountsFailed:...')` übersetzt.
 */
describe('PatientRepositoryAdapter.getKpiCounts', () => {
  function buildAdapter(groupByImpl: jest.Mock) {
    const prisma = {
      patient: { groupBy: groupByImpl },
    } as unknown as PrismaService;
    const serializer = {} as EventSerializer;
    return new PatientRepositoryAdapter(prisma, serializer);
  }

  it('setzt die drei groupBy-Calls parallel ab (Promise.all)', async () => {
    const callOrder: string[] = [];
    const groupByImpl = jest.fn((args: { by: string[] }) => {
      const dim = args.by[0];
      callOrder.push(dim);
      // Verzögerte Resolves: wenn parallel, sammeln sich alle drei Dim-Marker
      // _vor_ dem ersten Resolve.
      return new Promise((resolve) => setTimeout(() => resolve([]), 5));
    });
    const adapter = buildAdapter(groupByImpl);

    const promise = adapter.getKpiCounts('einsatz-1');

    // Microtask-Tick: Promise.all sollte alle drei Calls _vor_ jedem Resolve abgesetzt haben.
    await Promise.resolve();
    expect(callOrder).toEqual(['aktuelleSk', 'behandlungsstatus', 'transportstatus']);

    const result = await promise;
    expect(result.isSuccess).toBe(true);
    expect(groupByImpl).toHaveBeenCalledTimes(3);
  });

  it('mappt _count._all-Strukturen auf das flache count-Feld', async () => {
    const groupByImpl = jest.fn((args: { by: string[] }) => {
      const dim = args.by[0];
      if (dim === 'aktuelleSk') {
        return Promise.resolve([
          { aktuelleSk: 'SK_I', _count: { _all: 3 } },
          { aktuelleSk: 'SK_III', _count: { _all: 7 } },
        ]);
      }
      if (dim === 'behandlungsstatus') {
        return Promise.resolve([{ behandlungsstatus: 'UNVERSORGT', _count: { _all: 5 } }]);
      }
      return Promise.resolve([{ transportstatus: 'WARTEND', _count: { _all: 4 } }]);
    });
    const adapter = buildAdapter(groupByImpl);

    const result = await adapter.getKpiCounts('einsatz-1');

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({
      skRows: [
        { aktuelleSk: 'SK_I', count: 3 },
        { aktuelleSk: 'SK_III', count: 7 },
      ],
      behandlungRows: [{ behandlungsstatus: 'UNVERSORGT', count: 5 }],
      transportRows: [{ transportstatus: 'WARTEND', count: 4 }],
    });
  });

  it('liefert leere Rows bei Einsatz ohne Patienten (kein Fehler)', async () => {
    const groupByImpl = jest.fn(() => Promise.resolve([]));
    const adapter = buildAdapter(groupByImpl);

    const result = await adapter.getKpiCounts('einsatz-empty');

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({ skRows: [], behandlungRows: [], transportRows: [] });
  });

  it('übersetzt Prisma-Fehler in Infrastructure:PatientKpiCountsFailed-Sentinel', async () => {
    const groupByImpl = jest.fn(() => Promise.reject(new Error('DB connection lost')));
    const adapter = buildAdapter(groupByImpl);

    const result = await adapter.getKpiCounts('einsatz-1');

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^Infrastructure:PatientKpiCountsFailed:DB connection lost$/);
  });
});
