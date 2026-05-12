import { Sicherungsposten } from '@domain/eigenschutz/aggregates/sicherungsposten.aggregate';
import { Standort } from '@domain/eigenschutz/value-objects/standort.vo';
import type { ILogger } from '@domain/ports/i-logger.port';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PrismaSicherungspostenRepository } from '../prisma-sicherungsposten.repository';

interface PrismaTxLike {
  sicherungsposten: {
    create: jest.Mock;
    updateMany: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
  sicherungspostenVersion: { create: jest.Mock; updateMany: jest.Mock };
}

function makeTx(): PrismaTxLike {
  return {
    sicherungsposten: {
      create: jest.fn().mockResolvedValue(undefined),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn(),
    },
    sicherungspostenVersion: {
      create: jest.fn().mockResolvedValue(undefined),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

const noopLogger: ILogger = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

function buildAggregate(overrides: { version?: number; resolved?: boolean } = {}): Sicherungsposten {
  const standort = Standort.create({ kind: 'address', text: 'Hauptbahnhof' }).value!;
  const aggregate = Sicherungsposten.create({
    einsatzId: 'clw3h8x9y0000qwertyui04001',
    bezeichnung: 'Posten Nord',
    standort,
    personal: [{ kind: 'einsatzPerson', einsatzPersonId: 'clw3h8x9y0000qwertyui04003' }],
    createdBy: 'clw3h8x9y0000qwertyui04003',
  }).value!;
  if (overrides.version) {
    // Force update path by simulating prior persisted state via update().
    while (aggregate.version < overrides.version) {
      aggregate.update({ bezeichnung: `${aggregate.bezeichnung}-x${aggregate.version}` }, aggregate.version, 'clw3h8x9y0000qwertyui04003');
    }
  }
  if (overrides.resolved) {
    aggregate.aufloesen('clw3h8x9y0000qwertyui04003', 'Auflösung', aggregate.version);
  }
  return aggregate;
}

describe('PrismaSicherungspostenRepository (Story 4.1)', () => {
  it('(1) save() Insert: schreibt Aggregate-Row + Version-Snapshot in derselben TX', async () => {
    const tx = makeTx();
    const repo = new PrismaSicherungspostenRepository({} as unknown as PrismaService, noopLogger);
    const aggregate = buildAggregate();
    const result = await repo.save(aggregate, 'clw3h8x9y0000qwertyui04003', tx as never);
    expect(result.isSuccess).toBe(true);
    expect(tx.sicherungsposten.create).toHaveBeenCalledTimes(1);
    expect(tx.sicherungsposten.updateMany).not.toHaveBeenCalled();
    expect(tx.sicherungspostenVersion.create).toHaveBeenCalledTimes(1);
    const versionCreate = tx.sicherungspostenVersion.create.mock.calls[0][0];
    expect(versionCreate.data.postenId).toBe(aggregate.id.value);
    expect(versionCreate.data.version).toBe(1);
    expect(versionCreate.data.payload.bezeichnung).toBe('Posten Nord');
  });

  it('(2) save() Insert: serialisiert Standort als JSON 1:1', async () => {
    const tx = makeTx();
    const repo = new PrismaSicherungspostenRepository({} as unknown as PrismaService, noopLogger);
    const aggregate = buildAggregate();
    await repo.save(aggregate, 'clw3h8x9y0000qwertyui04003', tx as never);
    const createCall = tx.sicherungsposten.create.mock.calls[0][0];
    expect(createCall.data.standort).toEqual({ kind: 'address', text: 'Hauptbahnhof' });
  });

  it('(3) save() Update: ruft updateMany mit alter Version-WHERE-Bedingung', async () => {
    const tx = makeTx();
    const repo = new PrismaSicherungspostenRepository({} as unknown as PrismaService, noopLogger);
    const aggregate = buildAggregate({ version: 3 });
    expect(aggregate.version).toBe(3);
    const result = await repo.save(aggregate, 'clw3h8x9y0000qwertyui04003', tx as never);
    expect(result.isSuccess).toBe(true);
    expect(tx.sicherungsposten.create).not.toHaveBeenCalled();
    expect(tx.sicherungsposten.updateMany).toHaveBeenCalledTimes(1);
    const updateCall = tx.sicherungsposten.updateMany.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: aggregate.id.value, version: 2 });
    expect(updateCall.data.version).toBe(3);
  });

  it('(4) save() Update: count=0 → SICHERUNGSPOSTEN_CONFLICT_DETECTED', async () => {
    const tx = makeTx();
    tx.sicherungsposten.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const repo = new PrismaSicherungspostenRepository({} as unknown as PrismaService, noopLogger);
    const aggregate = buildAggregate({ version: 2 });
    const result = await repo.save(aggregate, 'clw3h8x9y0000qwertyui04003', tx as never);
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('ConflictDetected:Sicherungsposten');
    expect(tx.sicherungspostenVersion.create).not.toHaveBeenCalled();
  });

  it('(5) save() Aufloesen-Flow: Versions-Snapshot enthält aufgeloestAm + begruendung', async () => {
    const tx = makeTx();
    const repo = new PrismaSicherungspostenRepository({} as unknown as PrismaService, noopLogger);
    const aggregate = buildAggregate({ resolved: true });
    expect(aggregate.isAufgeloest).toBe(true);
    await repo.save(aggregate, 'clw3h8x9y0000qwertyui04003', tx as never);
    const versionCreate = tx.sicherungspostenVersion.create.mock.calls[0][0];
    expect(versionCreate.data.payload.aufgeloestAm).not.toBeNull();
    expect(versionCreate.data.payload.aufloeseBegruendung).toBe('Auflösung');
  });

  it('(6) findActiveByEinsatzId() filtert auf aufgeloestAm: null und sortiert nach aktualisiertAm DESC', async () => {
    const prisma = {
      sicherungsposten: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
    } as unknown as PrismaService;
    const repo = new PrismaSicherungspostenRepository(prisma, noopLogger);
    await repo.findActiveByEinsatzId('clw3h8x9y0000qwertyui04001');
    const findManyMock = (prisma as unknown as { sicherungsposten: { findMany: jest.Mock } }).sicherungsposten.findMany;
    expect(findManyMock).toHaveBeenCalledTimes(1);
    const args = findManyMock.mock.calls[0][0];
    expect(args.where).toEqual({ einsatzId: 'clw3h8x9y0000qwertyui04001', aufgeloestAm: null });
    expect(args.orderBy[0]).toEqual({ aktualisiertAm: 'desc' });
  });

  it('(7) findResolvedByEinsatzId() filtert auf aufgeloestAm: { not: null } und sortiert DESC', async () => {
    const prisma = {
      sicherungsposten: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const repo = new PrismaSicherungspostenRepository(prisma, noopLogger);
    await repo.findResolvedByEinsatzId('clw3h8x9y0000qwertyui04001');
    const findManyMock = (prisma as unknown as { sicherungsposten: { findMany: jest.Mock } }).sicherungsposten.findMany;
    const args = findManyMock.mock.calls[0][0];
    expect(args.where).toEqual({ einsatzId: 'clw3h8x9y0000qwertyui04001', aufgeloestAm: { not: null } });
    expect(args.orderBy[0]).toEqual({ aufgeloestAm: 'desc' });
  });

  it('(8) findById() liefert Result.ok(null) wenn keine Row existiert', async () => {
    const prisma = {
      sicherungsposten: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const repo = new PrismaSicherungspostenRepository(prisma, noopLogger);
    const result = await repo.findById('clw3h8x9y0000qwertyui04999');
    expect(result.isSuccess).toBe(true);
    expect(result.value).toBeNull();
  });

  it('(9) existsInEinsatz() nutzt einsatzId+id im WHERE', async () => {
    const prisma = {
      sicherungsposten: { count: jest.fn().mockResolvedValue(1) },
    } as unknown as PrismaService;
    const repo = new PrismaSicherungspostenRepository(prisma, noopLogger);
    const result = await repo.existsInEinsatz('clw3h8x9y0000qwertyui04001', 'clw3h8x9y0000qwertyui04999');
    expect(result.isSuccess).toBe(true);
    expect(result.value).toBe(true);
    const countMock = (prisma as unknown as { sicherungsposten: { count: jest.Mock } }).sicherungsposten.count;
    expect(countMock.mock.calls[0][0]).toEqual({ where: { id: 'clw3h8x9y0000qwertyui04999', einsatzId: 'clw3h8x9y0000qwertyui04001' } });
  });

  it('(10b) save() Update: schließt offene Vorgänger-Version (gueltigBis ← gueltigVon) vor neuer Insert-Zeile', async () => {
    const tx = makeTx();
    const repo = new PrismaSicherungspostenRepository({} as unknown as PrismaService, noopLogger);
    const aggregate = buildAggregate({ version: 2 });
    await repo.save(aggregate, 'clw3h8x9y0000qwertyui04003', tx as never);
    expect(tx.sicherungspostenVersion.updateMany).toHaveBeenCalledTimes(1);
    const closeCall = tx.sicherungspostenVersion.updateMany.mock.calls[0][0];
    expect(closeCall.where).toEqual({ postenId: aggregate.id.value, gueltigBis: null });
    expect(closeCall.data.gueltigBis).toBeInstanceOf(Date);
  });

  it('(10c) save() Insert: kein Chain-Closing (kein updateMany auf sicherungspostenVersion)', async () => {
    const tx = makeTx();
    const repo = new PrismaSicherungspostenRepository({} as unknown as PrismaService, noopLogger);
    await repo.save(buildAggregate(), 'clw3h8x9y0000qwertyui04003', tx as never);
    expect(tx.sicherungspostenVersion.updateMany).not.toHaveBeenCalled();
  });

  it('(10) save() propagiert Prisma-Exception als Result.fail mit Error-Message', async () => {
    const tx = makeTx();
    tx.sicherungsposten.create = jest.fn().mockRejectedValue(new Error('Custom-DB-Error'));
    const repo = new PrismaSicherungspostenRepository({} as unknown as PrismaService, noopLogger);
    const result = await repo.save(buildAggregate(), 'clw3h8x9y0000qwertyui04003', tx as never);
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('Custom-DB-Error');
  });
});
