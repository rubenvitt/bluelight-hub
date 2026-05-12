import { EigenschutzVorfall } from '@domain/eigenschutz/aggregates/eigenschutz-vorfall.aggregate';
import { Beteiligter } from '@domain/eigenschutz/value-objects/beteiligter.vo';
import { Wo } from '@domain/eigenschutz/value-objects/wo.vo';
import type { ILogger } from '@domain/ports/i-logger.port';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PrismaEigenschutzVorfallRepository } from '../prisma-eigenschutz-vorfall.repository';
import { PrismaEigenschutzVorfallMapper } from '../mappers/eigenschutz-vorfall.mapper';

const EINSATZ_ID = 'clw3h8x9y0000qwertyui05001';
const EINHEIT_ID = 'clw3h8x9y0000qwertyui05002';
const USER_ID = 'clw3h8x9y0000qwertyui05003';

interface PrismaTxLike {
  eigenschutzVorfall: {
    create: jest.Mock;
    findUnique: jest.Mock;
    count: jest.Mock;
  };
}

function makeTx(): PrismaTxLike {
  return {
    eigenschutzVorfall: {
      create: jest.fn().mockResolvedValue(undefined),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  };
}

const noopLogger: ILogger = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

const VALID_SNAPSHOT = {
  schemaVersion: 1 as const,
  snapshotAt: '2026-05-06T10:00:00.000+00:00',
  einsatzId: EINSATZ_ID,
  einheitId: EINHEIT_ID,
  gefaehrdungsbeurteilung: null,
  aktivePsaProfile: [],
  sicherheitsregeln: [],
};

function buildAggregate(overrides: { wo?: Wo | null; beteiligte?: Beteiligter[] } = {}): EigenschutzVorfall {
  return EigenschutzVorfall.create({
    einsatzId: EINSATZ_ID,
    einheitId: EINHEIT_ID,
    vorfallZeit: new Date('2026-05-06T10:00:00.000Z'),
    wann: new Date('2026-05-06T10:00:00.000Z'),
    was: 'Sturz beim Aufbau',
    wo: overrides.wo ?? null,
    beteiligte: overrides.beteiligte ?? [],
    massnahmen: 'Erstversorgung',
    unfallkasseRelevant: true,
    erfasstVonUserId: USER_ID,
    kontextSnapshot: VALID_SNAPSHOT,
    now: new Date('2026-05-06T10:00:00.000Z'),
  }).value!;
}

describe('PrismaEigenschutzVorfallRepository (Story 5.1 + 5.2)', () => {
  it('(1) save() schreibt Aggregate-Row mit V1-kontextSnapshot und wo="" bei null-Wo', async () => {
    const tx = makeTx();
    const repo = new PrismaEigenschutzVorfallRepository({} as unknown as PrismaService, noopLogger);
    const aggregate = buildAggregate({ wo: null });

    const result = await repo.save(aggregate, tx as never);

    expect(result.isSuccess).toBe(true);
    expect(tx.eigenschutzVorfall.create).toHaveBeenCalledTimes(1);
    const call = tx.eigenschutzVorfall.create.mock.calls[0][0];
    expect(call.data.id).toBe(aggregate.id.value);
    expect(call.data.einsatzId).toBe(EINSATZ_ID);
    expect(call.data.wo).toBe('');
    expect(call.data.kontextSnapshot.schemaVersion).toBe(1);
    expect(call.data.unfallkasseRelevant).toBe(true);
  });

  it('(2) save() serialisiert Wo-Freitext als JSON-String', async () => {
    const tx = makeTx();
    const repo = new PrismaEigenschutzVorfallRepository({} as unknown as PrismaService, noopLogger);
    const wo = Wo.create({ kind: 'freitext', text: 'Eingang Süd' }).value!;
    const aggregate = buildAggregate({ wo });

    const result = await repo.save(aggregate, tx as never);

    expect(result.isSuccess).toBe(true);
    const call = tx.eigenschutzVorfall.create.mock.calls[0][0];
    expect(call.data.wo).toBe(JSON.stringify({ kind: 'freitext', text: 'Eingang Süd' }));
  });

  it('(3) save() persistiert Beteiligter-Array 1:1 als JSON', async () => {
    const tx = makeTx();
    const repo = new PrismaEigenschutzVorfallRepository({} as unknown as PrismaService, noopLogger);
    const beteiligte = [Beteiligter.create({ kind: 'einsatzPerson', einsatzPersonId: USER_ID }).value!, Beteiligter.create({ kind: 'freitext', name: 'Max Mustermann', rolle: 'Sanitäter' }).value!];
    const aggregate = buildAggregate({ beteiligte });

    await repo.save(aggregate, tx as never);

    const call = tx.eigenschutzVorfall.create.mock.calls[0][0];
    expect(call.data.beteiligte).toEqual([
      { kind: 'einsatzPerson', einsatzPersonId: USER_ID },
      { kind: 'freitext', name: 'Max Mustermann', rolle: 'Sanitäter' },
    ]);
  });

  it('(4) save() liefert Failure bei DB-Fehler und loggt', async () => {
    const tx = makeTx();
    tx.eigenschutzVorfall.create = jest.fn().mockRejectedValue(new Error('DB-Fehler'));
    const errorLogger = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    const repo = new PrismaEigenschutzVorfallRepository({} as unknown as PrismaService, errorLogger as unknown as ILogger);

    const result = await repo.save(buildAggregate(), tx as never);

    expect(result.isFailure).toBe(true);
    expect(errorLogger.error).toHaveBeenCalled();
  });

  it('(5) findById() liefert Aggregate aus Mapper-Round-Trip (wo="" → null)', async () => {
    const aggregate = buildAggregate({ wo: null });
    const row = {
      ...PrismaEigenschutzVorfallMapper.toPrismaCreateInput(aggregate),
      // mapped row also requires erfasstAm/Date fields — duplicate
      vorfallZeit: aggregate.vorfallZeit,
      wann: aggregate.wann,
      erfasstAm: aggregate.erfasstAm,
      gefBeurteilungVersionId: null,
    };
    const prismaMock = { eigenschutzVorfall: { findUnique: jest.fn().mockResolvedValue(row), count: jest.fn() } };
    const repo = new PrismaEigenschutzVorfallRepository(prismaMock as unknown as PrismaService, noopLogger);

    const result = await repo.findById(aggregate.id.value);

    expect(result.isSuccess).toBe(true);
    expect(result.value).not.toBeNull();
    expect(result.value!.wo).toBeNull();
    expect(result.value!.einsatzId).toBe(EINSATZ_ID);
  });

  it('(6) findById() liefert ok(null) wenn nicht gefunden', async () => {
    const prismaMock = { eigenschutzVorfall: { findUnique: jest.fn().mockResolvedValue(null), count: jest.fn() } };
    const repo = new PrismaEigenschutzVorfallRepository(prismaMock as unknown as PrismaService, noopLogger);

    const result = await repo.findById('clw3h8x9y0000qwertyui05099');

    expect(result.isSuccess).toBe(true);
    expect(result.value).toBeNull();
  });

  it('(7) existsInEinsatz() filtert auf einsatzId+id', async () => {
    const prismaMock = { eigenschutzVorfall: { count: jest.fn().mockResolvedValue(1), findUnique: jest.fn() } };
    const repo = new PrismaEigenschutzVorfallRepository(prismaMock as unknown as PrismaService, noopLogger);

    const result = await repo.existsInEinsatz(EINSATZ_ID, 'clw3h8x9y0000qwertyui05050');

    expect(result.isSuccess).toBe(true);
    expect(result.value).toBe(true);
    expect(prismaMock.eigenschutzVorfall.count).toHaveBeenCalledWith({ where: { id: 'clw3h8x9y0000qwertyui05050', einsatzId: EINSATZ_ID } });
  });

  it('(8) existsInEinsatz() liefert false bei Cross-Einsatz-Mismatch', async () => {
    const prismaMock = { eigenschutzVorfall: { count: jest.fn().mockResolvedValue(0), findUnique: jest.fn() } };
    const repo = new PrismaEigenschutzVorfallRepository(prismaMock as unknown as PrismaService, noopLogger);

    const result = await repo.existsInEinsatz('clw3h8x9y0000qwertyui05098', 'clw3h8x9y0000qwertyui05050');

    expect(result.isSuccess).toBe(true);
    expect(result.value).toBe(false);
  });
});

describe('PrismaEigenschutzVorfallMapper (Story 5.1)', () => {
  it('parseWo: "" → null', () => {
    const result = PrismaEigenschutzVorfallMapper.parseWo('');
    expect(result.isSuccess).toBe(true);
    expect(result.value).toBeNull();
  });

  it('parseWo: Round-Trip Freitext', () => {
    const json = JSON.stringify({ kind: 'freitext', text: 'X' });
    const result = PrismaEigenschutzVorfallMapper.parseWo(json);
    expect(result.isSuccess).toBe(true);
    expect(result.value!.toJSON()).toEqual({ kind: 'freitext', text: 'X' });
  });

  it('parseWo: liefert Failure bei kaputtem JSON', () => {
    const result = PrismaEigenschutzVorfallMapper.parseWo('not-json');
    expect(result.isFailure).toBe(true);
  });

  it('serializeWo: null → "", Wo-Freitext → JSON', () => {
    expect(PrismaEigenschutzVorfallMapper.serializeWo(null)).toBe('');
    const wo = Wo.create({ kind: 'freitext', text: 'X' }).value!;
    expect(PrismaEigenschutzVorfallMapper.serializeWo(wo)).toBe(JSON.stringify({ kind: 'freitext', text: 'X' }));
  });
});

describe('PrismaEigenschutzVorfallMapper.parseKontextSnapshot (Story 5.2 AC9 fail-loud)', () => {
  it('akzeptiert literalen `{}` (5.1-Bestand)', () => {
    const result = PrismaEigenschutzVorfallMapper.parseKontextSnapshot({});
    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual({});
  });

  it('akzeptiert valide V1-Shape', () => {
    const result = PrismaEigenschutzVorfallMapper.parseKontextSnapshot(VALID_SNAPSHOT);
    expect(result.isSuccess).toBe(true);
    expect(result.value?.schemaVersion).toBe(1);
  });

  it('lehnt Array ab (fail-loud)', () => {
    const result = PrismaEigenschutzVorfallMapper.parseKontextSnapshot([]);
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^InfrastructureError:KontextSnapshotCorrupt:/);
  });

  it('lehnt nicht-V1-Shape ab (fail-loud)', () => {
    const result = PrismaEigenschutzVorfallMapper.parseKontextSnapshot({ schemaVersion: 2 });
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^InfrastructureError:KontextSnapshotCorrupt:/);
  });

  it('lehnt primitive Werte ab (fail-loud)', () => {
    const result = PrismaEigenschutzVorfallMapper.parseKontextSnapshot('not-an-object');
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^InfrastructureError:KontextSnapshotCorrupt:/);
  });
});

describe('PrismaEigenschutzVorfallRepository.findById (Story 5.2 AC9 fail-loud)', () => {
  it('mapped korrupten kontextSnapshot auf INFRASTRUCTURE_ERROR_RECONSTITUTE-Sentinel', async () => {
    const aggregate = buildAggregate({ wo: null });
    const row = {
      ...PrismaEigenschutzVorfallMapper.toPrismaCreateInput(aggregate),
      vorfallZeit: aggregate.vorfallZeit,
      wann: aggregate.wann,
      erfasstAm: aggregate.erfasstAm,
      gefBeurteilungVersionId: null,
      // Forced corruption: Array statt Objekt
      kontextSnapshot: [] as unknown,
    };
    const prismaMock = { eigenschutzVorfall: { findUnique: jest.fn().mockResolvedValue(row), count: jest.fn() } };
    const repo = new PrismaEigenschutzVorfallRepository(prismaMock as unknown as PrismaService, noopLogger);

    const result = await repo.findById(aggregate.id.value);

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^InfrastructureError:ReconstituteEigenschutzVorfall:/);
    expect(result.error).toContain('KontextSnapshotCorrupt');
  });
});

describe('PrismaEigenschutzVorfallRepository.findByEinsatzWithFilters (Story 5.3 AC1)', () => {
  function makeRow(overrides: Partial<{ id: string; einheitId: string; vorfallZeit: Date; was: string; unfallkasseRelevant: boolean; erfasstAm: Date; erfasstVonUserId: string }> = {}): {
    id: string;
    einsatzId: string;
    einheitId: string;
    vorfallZeit: Date;
    was: string;
    unfallkasseRelevant: boolean;
    erfasstAm: Date;
    erfasstVonUserId: string;
  } {
    return {
      id: overrides.id ?? 'clw3h8x9y0000qwertyui05101',
      einsatzId: EINSATZ_ID,
      einheitId: overrides.einheitId ?? EINHEIT_ID,
      vorfallZeit: overrides.vorfallZeit ?? new Date('2026-05-06T10:00:00.000Z'),
      was: overrides.was ?? 'Sturz beim Aufbau',
      unfallkasseRelevant: overrides.unfallkasseRelevant ?? true,
      erfasstAm: overrides.erfasstAm ?? new Date('2026-05-06T10:01:00.000Z'),
      erfasstVonUserId: overrides.erfasstVonUserId ?? USER_ID,
    };
  }

  it('(L1) ohne Filter: liefert alle Rows des Einsatzes mit Cap @ 200 + Sort vorfallZeit DESC, id DESC', async () => {
    const rows = [makeRow({ id: 'rowA' }), makeRow({ id: 'rowB' })];
    const findMany = jest.fn().mockResolvedValue(rows);
    const prismaMock = { eigenschutzVorfall: { findMany, findUnique: jest.fn(), count: jest.fn() } };
    const repo = new PrismaEigenschutzVorfallRepository(prismaMock as unknown as PrismaService, noopLogger);

    const result = await repo.findByEinsatzWithFilters(EINSATZ_ID, {});

    expect(result.isSuccess).toBe(true);
    expect(result.value).toHaveLength(2);
    const args = findMany.mock.calls[0][0];
    expect(args.where).toEqual({ einsatzId: EINSATZ_ID });
    expect(args.orderBy).toEqual([{ vorfallZeit: 'desc' }, { id: 'desc' }]);
    expect(args.take).toBe(200);
    // Defense-in-Depth: kontextSnapshot darf NICHT im select sein.
    expect(args.select).not.toHaveProperty('kontextSnapshot');
  });

  it('(L2) einheitIds-Filter (Single + Multi) wird auf where.einheitId.in gemappt', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prismaMock = { eigenschutzVorfall: { findMany, findUnique: jest.fn(), count: jest.fn() } };
    const repo = new PrismaEigenschutzVorfallRepository(prismaMock as unknown as PrismaService, noopLogger);

    await repo.findByEinsatzWithFilters(EINSATZ_ID, { einheitIds: [EINHEIT_ID] });
    expect(findMany.mock.calls[0][0].where.einheitId).toEqual({ in: [EINHEIT_ID] });

    findMany.mockClear();
    await repo.findByEinsatzWithFilters(EINSATZ_ID, { einheitIds: [EINHEIT_ID, 'clw3h8x9y0000qwertyui05004'] });
    expect(findMany.mock.calls[0][0].where.einheitId).toEqual({ in: [EINHEIT_ID, 'clw3h8x9y0000qwertyui05004'] });
  });

  it('(L3) leere einheitIds-Liste → Result.ok([]) ohne DB-Roundtrip', async () => {
    const findMany = jest.fn();
    const prismaMock = { eigenschutzVorfall: { findMany, findUnique: jest.fn(), count: jest.fn() } };
    const repo = new PrismaEigenschutzVorfallRepository(prismaMock as unknown as PrismaService, noopLogger);

    const result = await repo.findByEinsatzWithFilters(EINSATZ_ID, { einheitIds: [] });

    expect(result.isSuccess).toBe(true);
    expect(result.value).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('(L4) Zeitraum-Filter: halb-offenes Intervall via gte/lt; vorfallZeit === bis ist NICHT enthalten', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prismaMock = { eigenschutzVorfall: { findMany, findUnique: jest.fn(), count: jest.fn() } };
    const repo = new PrismaEigenschutzVorfallRepository(prismaMock as unknown as PrismaService, noopLogger);

    const von = new Date('2026-05-01T00:00:00.000Z');
    const bis = new Date('2026-05-08T00:00:00.000Z');

    await repo.findByEinsatzWithFilters(EINSATZ_ID, { vorfallZeitVon: von, vorfallZeitBis: bis });
    expect(findMany.mock.calls[0][0].where.vorfallZeit).toEqual({ gte: von, lt: bis });

    findMany.mockClear();
    await repo.findByEinsatzWithFilters(EINSATZ_ID, { vorfallZeitVon: von });
    expect(findMany.mock.calls[0][0].where.vorfallZeit).toEqual({ gte: von });

    findMany.mockClear();
    await repo.findByEinsatzWithFilters(EINSATZ_ID, { vorfallZeitBis: bis });
    expect(findMany.mock.calls[0][0].where.vorfallZeit).toEqual({ lt: bis });
  });

  it('(L5) UK-Filter: true / false werden auf where.unfallkasseRelevant gemappt; undefined → kein Filter', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prismaMock = { eigenschutzVorfall: { findMany, findUnique: jest.fn(), count: jest.fn() } };
    const repo = new PrismaEigenschutzVorfallRepository(prismaMock as unknown as PrismaService, noopLogger);

    await repo.findByEinsatzWithFilters(EINSATZ_ID, { unfallkasseRelevant: true });
    expect(findMany.mock.calls[0][0].where.unfallkasseRelevant).toBe(true);

    findMany.mockClear();
    await repo.findByEinsatzWithFilters(EINSATZ_ID, { unfallkasseRelevant: false });
    expect(findMany.mock.calls[0][0].where.unfallkasseRelevant).toBe(false);

    findMany.mockClear();
    await repo.findByEinsatzWithFilters(EINSATZ_ID, {});
    expect(findMany.mock.calls[0][0].where).not.toHaveProperty('unfallkasseRelevant');
  });

  it('(L6) Cap @ 200: take stets 200, Mapper-Output entspricht Reihenfolge der Rows', async () => {
    const rows = Array.from({ length: 200 }, (_, i) => makeRow({ id: `row-${String(i).padStart(3, '0')}`, vorfallZeit: new Date(`2026-05-06T10:0${(i % 9) + 1}:00.000Z`) }));
    const findMany = jest.fn().mockResolvedValue(rows);
    const prismaMock = { eigenschutzVorfall: { findMany, findUnique: jest.fn(), count: jest.fn() } };
    const repo = new PrismaEigenschutzVorfallRepository(prismaMock as unknown as PrismaService, noopLogger);

    const result = await repo.findByEinsatzWithFilters(EINSATZ_ID, {});

    expect(result.value).toHaveLength(200);
    expect(findMany.mock.calls[0][0].take).toBe(200);
    expect(result.value![0].id).toBe('row-000');
    expect(result.value![199].id).toBe('row-199');
  });

  it('(L7) DB-Failure: liefert Sentinel InfrastructureError:ListEigenschutzVorfaelle:* (Trim @ 200) und loggt', async () => {
    const errorLogger = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    const longMessage = 'X'.repeat(500);
    const findMany = jest.fn().mockRejectedValue(new Error(longMessage));
    const prismaMock = { eigenschutzVorfall: { findMany, findUnique: jest.fn(), count: jest.fn() } };
    const repo = new PrismaEigenschutzVorfallRepository(prismaMock as unknown as PrismaService, errorLogger as unknown as ILogger);

    const result = await repo.findByEinsatzWithFilters(EINSATZ_ID, {});

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^InfrastructureError:ListEigenschutzVorfaelle:/);
    // Trim auf 200 Zeichen (+ Ellipsis): Sentinel-Präfix + max 201 Zeichen Body
    const body = result.error!.slice('InfrastructureError:ListEigenschutzVorfaelle:'.length);
    expect(body.length).toBeLessThanOrEqual(201);
    expect(errorLogger.error).toHaveBeenCalled();
  });
});
