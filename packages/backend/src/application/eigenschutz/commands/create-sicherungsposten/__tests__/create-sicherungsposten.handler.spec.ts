import { Result } from '@domain/common/result';
import type { ISicherungspostenRepository } from '@domain/eigenschutz/repositories';
import type { ILogger } from '@domain/ports/i-logger.port';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CreateSicherungspostenCommand } from '../create-sicherungsposten.command';
import { CreateSicherungspostenHandler } from '../create-sicherungsposten.handler';

const noopLogger: ILogger = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

function buildHandler(repoOverrides: Partial<ISicherungspostenRepository> = {}) {
  const repo: ISicherungspostenRepository = {
    save: jest.fn().mockResolvedValue(Result.ok(undefined)),
    findById: jest.fn().mockResolvedValue(Result.ok(null)),
    findReadModelById: jest.fn().mockResolvedValue(Result.ok(null)),
    findActiveByEinsatzId: jest.fn().mockResolvedValue(Result.ok([])),
    findResolvedByEinsatzId: jest.fn().mockResolvedValue(Result.ok([])),
    existsInEinsatz: jest.fn().mockResolvedValue(Result.ok(false)),
    ...repoOverrides,
  };
  const prisma = {
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => {
      const tx = { __tx: true };
      const result = await cb(tx);
      return result;
    }),
  } as unknown as PrismaService;
  const outbox = { save: jest.fn().mockResolvedValue(undefined) } as never;
  const handler = new CreateSicherungspostenHandler(prisma, outbox, repo, noopLogger);
  return { handler, repo, prisma, outbox };
}

describe('CreateSicherungspostenHandler (Story 4.1)', () => {
  const EINSATZ_ID = 'clw3h8x9y0000qwertyui04001';
  const USER_ID = 'clw3h8x9y0000qwertyui04003';

  it('(1) Erfolg: speichert Aggregate, persistiert Events, gibt id zurück', async () => {
    const { handler, repo, outbox } = buildHandler();
    const result = await handler.execute(
      new CreateSicherungspostenCommand(EINSATZ_ID, USER_ID, 'Posten Nord', { kind: 'address', text: 'Hauptbahnhof' }, [{ kind: 'einsatzPerson', einsatzPersonId: USER_ID }]),
    );
    expect(result.isSuccess).toBe(true);
    expect(typeof result.value).toBe('string');
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect((outbox as unknown as { save: jest.Mock }).save).toHaveBeenCalledTimes(1);
  });

  it('(2) Lehnt ungültigen Standort als ValidationFailed:Standort ab', async () => {
    const { handler } = buildHandler();
    const result = await handler.execute(new CreateSicherungspostenCommand(EINSATZ_ID, USER_ID, 'Posten Nord', { kind: 'coordinate', longitude: 999, latitude: 0 }, []));
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^ValidationFailed:Standort/);
  });

  it('(3) Lehnt leere Bezeichnung mit ValidationFailed-Präfix ab', async () => {
    const { handler } = buildHandler();
    const result = await handler.execute(new CreateSicherungspostenCommand(EINSATZ_ID, USER_ID, '   ', { kind: 'address', text: 'Hauptbahnhof' }, []));
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^ValidationFailed/);
  });

  it('(4) Repository-Failure wird durchgereicht', async () => {
    const { handler } = buildHandler({ save: jest.fn().mockResolvedValue(Result.fail<void>('InfrastructureError:DB-Down')) });
    const result = await handler.execute(new CreateSicherungspostenCommand(EINSATZ_ID, USER_ID, 'Posten Nord', { kind: 'address', text: 'Hauptbahnhof' }, []));
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('InfrastructureError:DB-Down');
  });
});
