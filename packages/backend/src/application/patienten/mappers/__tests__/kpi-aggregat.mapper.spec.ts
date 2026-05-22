import { KpiAggregatMapper } from '../kpi-aggregat.mapper';

describe('KpiAggregatMapper.fromCounts', () => {
  const stand = '2026-05-20T14:23:01.234Z';

  it('füllt fehlende SK-/Behandlungs-/Transport-Buckets explizit auf 0 (leerer Einsatz)', () => {
    const dto = KpiAggregatMapper.fromCounts({ skRows: [], behandlungRows: [], transportRows: [], stand });

    expect(dto.sk).toEqual({ SK_I: 0, SK_II: 0, SK_III: 0, SK_IV: 0, TOT: 0 });
    expect(dto.behandlung).toEqual({ UNVERSORGT: 0, IN_BEHANDLUNG: 0, VERSORGT: 0, TRANSPORTBEREIT: 0 });
    expect(dto.transport).toEqual({ WARTEND: 0, IM_TRANSPORT: 0, IM_KRANKENHAUS: 0 });
    expect(dto.totalPatienten).toBe(0);
    expect(dto.stand).toBe(stand);
  });

  it('mappt alle Enum-Werte korrekt und summiert totalPatienten aus der SK-Dimension', () => {
    const dto = KpiAggregatMapper.fromCounts({
      skRows: [
        { aktuelleSk: 'SK_I', count: 12 },
        { aktuelleSk: 'SK_II', count: 48 },
        { aktuelleSk: 'SK_III', count: 130 },
        { aktuelleSk: 'SK_IV', count: 55 },
        { aktuelleSk: 'TOT', count: 5 },
      ],
      behandlungRows: [
        { behandlungsstatus: 'UNVERSORGT', count: 60 },
        { behandlungsstatus: 'IN_BEHANDLUNG', count: 80 },
        { behandlungsstatus: 'VERSORGT', count: 70 },
        { behandlungsstatus: 'TRANSPORTBEREIT', count: 40 },
      ],
      transportRows: [
        { transportstatus: 'WARTEND', count: 200 },
        { transportstatus: 'IM_TRANSPORT', count: 30 },
        { transportstatus: 'IM_KRANKENHAUS', count: 20 },
      ],
      stand,
    });

    expect(dto.sk).toEqual({ SK_I: 12, SK_II: 48, SK_III: 130, SK_IV: 55, TOT: 5 });
    expect(dto.behandlung).toEqual({ UNVERSORGT: 60, IN_BEHANDLUNG: 80, VERSORGT: 70, TRANSPORTBEREIT: 40 });
    expect(dto.transport).toEqual({ WARTEND: 200, IM_TRANSPORT: 30, IM_KRANKENHAUS: 20 });
    expect(dto.totalPatienten).toBe(250);
  });

  it('mischt vorhandene Rows mit Defaults (nur SK_II und IM_TRANSPORT vorhanden)', () => {
    const dto = KpiAggregatMapper.fromCounts({
      skRows: [{ aktuelleSk: 'SK_II', count: 7 }],
      behandlungRows: [{ behandlungsstatus: 'IN_BEHANDLUNG', count: 3 }],
      transportRows: [{ transportstatus: 'IM_TRANSPORT', count: 2 }],
      stand,
    });

    expect(dto.sk).toEqual({ SK_I: 0, SK_II: 7, SK_III: 0, SK_IV: 0, TOT: 0 });
    expect(dto.behandlung.IN_BEHANDLUNG).toBe(3);
    expect(dto.behandlung.UNVERSORGT).toBe(0);
    expect(dto.transport.IM_TRANSPORT).toBe(2);
    expect(dto.transport.WARTEND).toBe(0);
    expect(dto.totalPatienten).toBe(7);
  });

  it('gibt eine neue Instanz pro Aufruf zurück (keine geteilten Default-Referenzen)', () => {
    const a = KpiAggregatMapper.fromCounts({ skRows: [], behandlungRows: [], transportRows: [], stand });
    const b = KpiAggregatMapper.fromCounts({ skRows: [{ aktuelleSk: 'SK_I', count: 5 }], behandlungRows: [], transportRows: [], stand });

    expect(a.sk).not.toBe(b.sk);
    expect(a.sk.SK_I).toBe(0);
    expect(b.sk.SK_I).toBe(5);
  });

  // Story-1.5-Code-Review: Unbekannte Enum-Werte (Schema-Drift, `null`,
  // Cast-Schwäche) müssen geloggt **und** verworfen werden — kein stilles
  // Bucket-Pollution wie `sk[null] = 17`.
  it('verwirft unbekannte SK-Werte und meldet sie über onWarning (keine Bucket-Pollution)', () => {
    const warnings: string[] = [];
    const dto = KpiAggregatMapper.fromCounts(
      {
        skRows: [
          { aktuelleSk: 'SK_I', count: 5 },
          // Simulation: Prisma liefert einen unbekannten Enum-Wert (Schema-Drift).
          { aktuelleSk: 'SK_V' as unknown as 'SK_I', count: 17 },
          { aktuelleSk: null as unknown as 'SK_I', count: 3 },
        ],
        behandlungRows: [],
        transportRows: [],
        stand,
      },
      (msg) => warnings.push(msg),
    );

    expect(dto.sk).toEqual({ SK_I: 5, SK_II: 0, SK_III: 0, SK_IV: 0, TOT: 0 });
    expect(dto.totalPatienten).toBe(5);
    expect(warnings).toEqual([
      expect.stringContaining('kpi-mapper-unknown-bucket:sk:SK_V:count=17'),
      expect.stringContaining('kpi-mapper-unknown-bucket:sk:null:count=3'),
      // Drift wird zusätzlich gemeldet, weil 0+0 ≠ 5.
      expect.stringContaining('kpi-mapper-dimension-drift'),
    ]);
  });

  it('meldet Cross-Dimension-Drift, wenn sum(behandlung) ≠ sum(sk)', () => {
    const warnings: string[] = [];
    KpiAggregatMapper.fromCounts(
      {
        skRows: [{ aktuelleSk: 'SK_I', count: 10 }],
        // Drift: behandlung summiert auf 7, sk auf 10 — z. B. paralleler
        // INSERT zwischen groupBy-Call 1 und groupBy-Call 2.
        behandlungRows: [{ behandlungsstatus: 'UNVERSORGT', count: 7 }],
        transportRows: [{ transportstatus: 'WARTEND', count: 10 }],
        stand,
      },
      (msg) => warnings.push(msg),
    );

    expect(warnings).toEqual(['kpi-mapper-dimension-drift:sk=10:behandlung=7:transport=10']);
  });

  it('arbeitet ohne onWarning-Callback (Default-Pfad — kein Throw)', () => {
    expect(() =>
      KpiAggregatMapper.fromCounts({
        skRows: [{ aktuelleSk: 'SK_V' as unknown as 'SK_I', count: 17 }],
        behandlungRows: [],
        transportRows: [],
        stand,
      }),
    ).not.toThrow();
  });
});
