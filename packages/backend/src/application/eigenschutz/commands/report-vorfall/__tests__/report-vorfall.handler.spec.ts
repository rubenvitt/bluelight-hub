import { Result } from '@domain/common/result';
import type { IEigenschutzVorfallRepository } from '@domain/eigenschutz/repositories';
import type { ILogger } from '@domain/ports/i-logger.port';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ReportVorfallCommand } from '../report-vorfall.command';
import { ReportVorfallHandler } from '../report-vorfall.handler';
import { VorfallGemeldetEvent } from '@domain/eigenschutz/events/vorfall-gemeldet.event';
import type { KontextSnapshotBuilder } from '../../../services/kontext-snapshot-builder';
import type { EigenschutzKontextSnapshotV1Type } from '@domain/eigenschutz/schemas/eigenschutz-snapshot.schema';

const noopLogger: ILogger = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

const EINSATZ_ID = 'clw3h8x9y0000qwertyui05001';
const EINHEIT_ID = 'clw3h8x9y0000qwertyui05002';
const USER_ID = 'clw3h8x9y0000qwertyui05003';
const VERSION_ID = 'clw3h8x9y0000qwertyui05gv1';
const NOW = new Date('2026-05-06T10:00:00.000Z');

function makeSnapshot(overrides: Partial<EigenschutzKontextSnapshotV1Type> = {}): EigenschutzKontextSnapshotV1Type {
  return {
    schemaVersion: 1,
    snapshotAt: NOW.toISOString(),
    einsatzId: EINSATZ_ID,
    einheitId: EINHEIT_ID,
    gefaehrdungsbeurteilung: null,
    aktivePsaProfile: [],
    sicherheitsregeln: [],
    ...overrides,
  };
}

function buildHandler(repoOverrides: Partial<IEigenschutzVorfallRepository> = {}, builderResult: Result<EigenschutzKontextSnapshotV1Type> = Result.ok(makeSnapshot())) {
  const repo: IEigenschutzVorfallRepository = {
    save: jest.fn().mockResolvedValue(Result.ok(undefined)),
    findById: jest.fn().mockResolvedValue(Result.ok(null)),
    existsInEinsatz: jest.fn().mockResolvedValue(Result.ok(false)),
    ...repoOverrides,
  };
  const outboxSaveMock = jest.fn().mockResolvedValue(undefined);
  const prisma = {
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => {
      const tx = { __tx: true };
      return cb(tx);
    }),
  } as unknown as PrismaService;
  const outbox = { save: outboxSaveMock } as never;
  const builderMock = { build: jest.fn().mockResolvedValue(builderResult) } as unknown as KontextSnapshotBuilder;
  const handler = new ReportVorfallHandler(prisma, outbox, repo, builderMock, noopLogger);
  return { handler, repo, prisma, outbox, outboxSaveMock, builderMock };
}

function buildCommand(overrides: Partial<ConstructorParameters<typeof ReportVorfallCommand>> = []): ReportVorfallCommand {
  return new ReportVorfallCommand(EINSATZ_ID, EINHEIT_ID, 'Sturz beim Aufbau', NOW, NOW, null, [], 'Erstversorgung', false, USER_ID, ...(overrides as never[]));
}

describe('ReportVorfallHandler (Story 5.1)', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  it('(1) Erfolg: Aggregate wird gespeichert, Outbox-Event persistiert, ID zurückgegeben', async () => {
    const { handler, repo, outboxSaveMock } = buildHandler();
    const result = await handler.execute(buildCommand());

    expect(result.isSuccess).toBe(true);
    expect(typeof result.value).toBe('string');
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(outboxSaveMock).toHaveBeenCalledTimes(1);
  });

  it('(2) Erfolg: VorfallGemeldetEvent wird emittiert (Outbox erhält das Event)', async () => {
    const { handler, outboxSaveMock } = buildHandler();
    await handler.execute(buildCommand());

    const calledEvents = outboxSaveMock.mock.calls[0][0] as VorfallGemeldetEvent[];
    expect(Array.isArray(calledEvents)).toBe(true);
    expect(calledEvents).toHaveLength(1);
    expect(calledEvents[0]).toBeInstanceOf(VorfallGemeldetEvent);
    expect(calledEvents[0].einsatzId).toBe(EINSATZ_ID);
    expect(calledEvents[0].einheitId).toBe(EINHEIT_ID);
  });

  it('(3) Erfolg: kontextSnapshot ist die V1-Shape vom Builder (Story 5.2)', async () => {
    const { handler, repo } = buildHandler();
    await handler.execute(buildCommand());
    const call = (repo.save as jest.Mock).mock.calls[0];
    const aggregate = call[0] as { kontextSnapshot: { schemaVersion: number } };
    expect(aggregate.kontextSnapshot.schemaVersion).toBe(1);
  });

  it('(4) Wo-Validation-Failure: ValidationFailed:Wo-Sentinel', async () => {
    const { handler } = buildHandler();
    const cmd = new ReportVorfallCommand(EINSATZ_ID, EINHEIT_ID, 'Sturz', NOW, NOW, { kind: 'coordinate', longitude: 999, latitude: 0 }, [], '', false, USER_ID);
    const result = await handler.execute(cmd);
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^ValidationFailed:Wo:/);
  });

  it('(5) Beteiligter-Validation-Failure: ValidationFailed:Beteiligter:idx=N-Sentinel', async () => {
    const { handler } = buildHandler();
    const cmd = new ReportVorfallCommand(
      EINSATZ_ID,
      EINHEIT_ID,
      'Sturz',
      NOW,
      NOW,
      null,
      [
        { kind: 'einsatzPerson', einsatzPersonId: 'INVALID-CAPS' },
        { kind: 'freitext', name: 'Max' },
      ],
      '',
      false,
      USER_ID,
    );
    const result = await handler.execute(cmd);
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^ValidationFailed:Beteiligter:idx=0/);
  });

  it('(6) Beteiligter-Validation-Failure mit korrektem Index ≠ 0', async () => {
    const { handler } = buildHandler();
    const cmd = new ReportVorfallCommand(
      EINSATZ_ID,
      EINHEIT_ID,
      'Sturz',
      NOW,
      NOW,
      null,
      [
        { kind: 'freitext', name: 'Max' },
        { kind: 'einsatzPerson', einsatzPersonId: 'INVALID-CAPS' },
      ],
      '',
      false,
      USER_ID,
    );
    const result = await handler.execute(cmd);
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^ValidationFailed:Beteiligter:idx=1/);
  });

  it('(7) Aggregate-Validation-Failure (zu lange Beschreibung): ValidationFailed:Aggregate-Sentinel', async () => {
    const { handler } = buildHandler();
    const cmd = new ReportVorfallCommand(EINSATZ_ID, EINHEIT_ID, 'a'.repeat(81), NOW, NOW, null, [], '', false, USER_ID);
    const result = await handler.execute(cmd);
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^ValidationFailed:Aggregate:/);
  });

  it('(8) Aggregate-Wallclock-Drift: BusinessRule:WallclockDriftTooLarge wird unverändert durchgereicht (KEIN ValidationFailed:Aggregate-Wrap)', async () => {
    const { handler } = buildHandler();
    const farFuture = new Date(NOW.getTime() + 6 * 60 * 1000);
    const cmd = new ReportVorfallCommand(EINSATZ_ID, EINHEIT_ID, 'Sturz', farFuture, farFuture, null, [], '', false, USER_ID);
    const result = await handler.execute(cmd);
    expect(result.isFailure).toBe(true);
    // Sentinel muss exakt sein, damit der Controller-Mapper `rule: 'WallclockDriftTooLarge'` setzen kann (AC7).
    expect(result.error).toBe('BusinessRule:WallclockDriftTooLarge');
  });

  it('(9) Repository-Failure wird durchgereicht (kein Re-Try)', async () => {
    const { handler } = buildHandler({ save: jest.fn().mockResolvedValue(Result.fail<void>('InfrastructureError:DB-Down')) });
    const result = await handler.execute(buildCommand());
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('InfrastructureError:DB-Down');
  });

  it('(10) Erfolg: Wo-Coordinate + Beteiligter-Mix wird vollständig persistiert', async () => {
    const { handler, repo } = buildHandler();
    const cmd = new ReportVorfallCommand(
      EINSATZ_ID,
      EINHEIT_ID,
      'Sturz',
      NOW,
      NOW,
      { kind: 'coordinate', longitude: 8.6821, latitude: 50.1109 },
      [
        { kind: 'einsatzPerson', einsatzPersonId: USER_ID },
        { kind: 'freitext', name: 'Max', rolle: 'Sanitäter' },
      ],
      'Erstversorgung',
      true,
      USER_ID,
    );
    const result = await handler.execute(cmd);
    expect(result.isSuccess).toBe(true);
    const aggregate = (repo.save as jest.Mock).mock.calls[0][0] as { wo: { kind: string }; beteiligte: readonly unknown[]; unfallkasseRelevant: boolean };
    expect(aggregate.wo.kind).toBe('coordinate');
    expect(aggregate.beteiligte).toHaveLength(2);
    expect(aggregate.unfallkasseRelevant).toBe(true);
  });

  // Story 5.2 — Snapshot-Bau zwischen VO-Validation und Aggregate-Create.
  it('(11) Story 5.2: Builder wird mit (einsatzId, einheitId, vorfallZeit, tx) aufgerufen', async () => {
    const { handler, builderMock } = buildHandler();
    await handler.execute(buildCommand());
    expect(builderMock.build).toHaveBeenCalledWith({
      einsatzId: EINSATZ_ID,
      einheitId: EINHEIT_ID,
      snapshotAt: NOW,
      tx: expect.objectContaining({ __tx: true }),
    });
  });

  it('(12) Story 5.2: gefBeurteilungVersionId wird vom Snapshot abgeleitet und ans Aggregate weitergereicht', async () => {
    const snapshot = makeSnapshot({
      gefaehrdungsbeurteilung: {
        versionId: VERSION_ID,
        version: 1,
        gueltigVon: NOW.toISOString(),
        items: [{ title: 'Glatteis' }],
      },
    });
    const { handler, repo } = buildHandler({}, Result.ok(snapshot));
    const result = await handler.execute(buildCommand());

    expect(result.isSuccess).toBe(true);
    const aggregate = (repo.save as jest.Mock).mock.calls[0][0] as { gefBeurteilungVersionId: string | null };
    expect(aggregate.gefBeurteilungVersionId).toBe(VERSION_ID);
  });

  it('(13) Story 5.2: Builder-Repo-Failure (InfrastructureError) wird 1:1 durchgereicht', async () => {
    const { handler } = buildHandler({}, Result.fail('InfrastructureError:KontextSnapshotBuilder:GefaehrdungsbeurteilungReadFailed:db-down'));
    const result = await handler.execute(buildCommand());

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^InfrastructureError:KontextSnapshotBuilder:/);
  });

  it('(14) Story 5.2: Builder-Drift-Failure (Invariant) wird 1:1 durchgereicht', async () => {
    const { handler } = buildHandler({}, Result.fail('Invariant:KontextSnapshotBuilder:OutputSchemaDrift:bad-shape'));
    const result = await handler.execute(buildCommand());

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('Invariant:KontextSnapshotBuilder:OutputSchemaDrift:bad-shape');
  });
});
