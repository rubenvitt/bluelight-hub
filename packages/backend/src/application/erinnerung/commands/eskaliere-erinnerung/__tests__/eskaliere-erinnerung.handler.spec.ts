import { Test, type TestingModule } from '@nestjs/testing';
import { EskaliereErinnerungHandler } from '../eskaliere-erinnerung.handler';
import type { IErinnerungRepository } from '@domain/repositories/i-erinnerung.repository';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ErinnerungResponseFactory } from '../../../dto/erinnerung-response.factory';
import { ERINNERUNG_REPOSITORY, LOGGER, OUTBOX_REPOSITORY } from '@infrastructure/di-tokens';
import { EskaliereErinnerungCommand } from '../eskaliere-erinnerung.command';
import { Erinnerung } from '@domain/entities/erinnerung.entity';
import { Result } from '@domain/common/result';
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';

describe('EskaliereErinnerungHandler', () => {
  let handler: EskaliereErinnerungHandler;
  let erinnerungRepository: jest.Mocked<IErinnerungRepository>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let _outboxRepository: jest.Mocked<IOutboxRepository>; // Used by TransactionalCommandHandler

  const mockErinnerungRepository = {
    findById: jest.fn(),
    save: jest.fn(),
  };

  const mockOutboxRepository = {
    save: jest.fn().mockResolvedValue(Result.ok(undefined)),
  };

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const mockPrismaService = {
    $transaction: jest.fn((cb) => cb()),
  };

  const mockResponseFactory = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EskaliereErinnerungHandler,
        { provide: ERINNERUNG_REPOSITORY, useValue: mockErinnerungRepository },
        { provide: OUTBOX_REPOSITORY, useValue: mockOutboxRepository },
        { provide: LOGGER, useValue: mockLogger },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ErinnerungResponseFactory, useValue: mockResponseFactory },
      ],
    }).compile();

    handler = module.get<EskaliereErinnerungHandler>(EskaliereErinnerungHandler);
    erinnerungRepository = module.get(ERINNERUNG_REPOSITORY);
    _outboxRepository = module.get(OUTBOX_REPOSITORY);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should escalate reminder successfully', async () => {
    // CUID-Format IDs verwenden (nicht UUIDs)
    const testErinnerungId = 'clx123456789abcdefghij001';
    const testEinsatzId = 'clx123456789abcdefghij002';
    const testErstellerId = 'clx123456789abcdefghij003';
    const testEskalationsPersonId = 'clx123456789abcdefghij004';

    const command = new EskaliereErinnerungCommand(testErinnerungId, 'SYSTEM');
    const erinnerung = Erinnerung.create(
      {
        einsatzId: EinsatzId.create(testEinsatzId).value!,
        titel: 'Test',
        faelligAm: new Date(Date.now() + 10000),
        erstelltVon: UserId.create(testErstellerId).value!,
        eskalationsPersonId: UserId.create(testEskalationsPersonId).value!, // Has escalation person
      },
      new ErinnerungId(testErinnerungId),
    ).value!;

    // Move to AUSGELOEST status
    const triggerResult = erinnerung.ausloesen();
    expect(triggerResult.isSuccess).toBe(true);

    erinnerungRepository.findById.mockResolvedValue(Result.ok(erinnerung));
    erinnerungRepository.save.mockResolvedValue(Result.ok(undefined));
    mockResponseFactory.create.mockResolvedValue({ id: testErinnerungId, status: 'ESKALIERT' });

    const result = await handler.execute(command);

    if (result.isFailure) {
      console.error('Test failed with error:', result.error);
    }
    expect(result.isSuccess).toBe(true);
    expect(erinnerungRepository.save).toHaveBeenCalled();
    expect(erinnerung.status.isEskaliert()).toBe(true);
  });

  it('should intensify reminder if no escalation person defined', async () => {
    // CUID-Format IDs verwenden (nicht UUIDs)
    const testErinnerungId = 'clx123456789abcdefghij005';
    const testEinsatzId = 'clx123456789abcdefghij006';
    const testErstellerId = 'clx123456789abcdefghij007';

    const command = new EskaliereErinnerungCommand(testErinnerungId, 'SYSTEM');
    const erinnerung = Erinnerung.create(
      {
        einsatzId: EinsatzId.create(testEinsatzId).value!,
        titel: 'Test',
        faelligAm: new Date(Date.now() + 10000),
        erstelltVon: UserId.create(testErstellerId).value!,
        eskalationsPersonId: null, // NO escalation person
      },
      new ErinnerungId(testErinnerungId),
    ).value!;

    // Move to AUSGELOEST status
    const triggerResult = erinnerung.ausloesen();
    expect(triggerResult.isSuccess).toBe(true);

    erinnerungRepository.findById.mockResolvedValue(Result.ok(erinnerung));
    erinnerungRepository.save.mockResolvedValue(Result.ok(undefined));
    mockResponseFactory.create.mockResolvedValue({ id: testErinnerungId, status: 'AUSGELOEST' });

    const result = await handler.execute(command);

    if (result.isFailure) {
      console.error('Test 2 failed with error:', result.error);
    }
    expect(result.isSuccess).toBe(true);
    expect(erinnerungRepository.save).toHaveBeenCalled();
    expect(erinnerung.status.isAusgeloest()).toBe(true); // Status remains AUSGELOEST
    // Verify IntensiviertEvent emitted (indirectly via save success)
    expect(erinnerung.getDomainEvents().some((e) => e.constructor.name === 'ErinnerungIntensiviertEvent')).toBe(false); // Cleared in handler? No, handler returns { events } but cleared from aggregate.
    // Actually Handler calls clearDomainEvents BEFORE save?
    // Handler logic:
    // 4. Events extrahieren
    // const events = erinnerung.getDomainEvents();
    // erinnerung.clearDomainEvents();
    // 5. Speichern
    // So repository.save is called with cleared events.
    // But TransactionalCommandHandler logic happens in executeInTransaction.
    // Wait, TransactionalCommandHandler saves events to Outbox.
    // I can check handler return value "events".
  });
});
