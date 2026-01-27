import { Test, type TestingModule } from '@nestjs/testing';
import { EskaliereErinnerungHandler } from '../eskaliere-erinnerung.handler';
import type { IErinnerungRepository } from '@domain/repositories/i-erinnerung.repository';
import type { IUserRepository } from '@domain/repositories/i-user.repository';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ErinnerungResponseFactory } from '../../../dto/erinnerung-response.factory';
import { ERINNERUNG_REPOSITORY, LOGGER, OUTBOX_REPOSITORY, USER_REPOSITORY } from '@infrastructure/di-tokens';
import { EskaliereErinnerungCommand } from '../eskaliere-erinnerung.command';
import { Erinnerung } from '@domain/entities/erinnerung.entity';
import { Result } from '@domain/common/result';
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { ErinnerungStatus } from '@domain/value-objects/erinnerung-status';
import { ErinnerungTitel } from '@domain/value-objects/erinnerung-titel';

describe('EskaliereErinnerungHandler', () => {
  console.log('DEBUG: USER_REPOSITORY token:', USER_REPOSITORY);
  let handler: EskaliereErinnerungHandler;
  let erinnerungRepository: jest.Mocked<IErinnerungRepository>;
  let userRepository: jest.Mocked<IUserRepository>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let _outboxRepository: jest.Mocked<IOutboxRepository>;

  const mockErinnerungRepository = {
    findById: jest.fn(),
    save: jest.fn(),
  };

  const mockUserRepository = {
    findById: jest.fn(),
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
        { provide: USER_REPOSITORY, useValue: mockUserRepository },
        { provide: OUTBOX_REPOSITORY, useValue: mockOutboxRepository },
        { provide: LOGGER, useValue: mockLogger },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ErinnerungResponseFactory, useValue: mockResponseFactory },
      ],
    }).compile();

    handler = module.get<EskaliereErinnerungHandler>(EskaliereErinnerungHandler);
    erinnerungRepository = module.get(ERINNERUNG_REPOSITORY);
    userRepository = module.get(USER_REPOSITORY);
    _outboxRepository = module.get(OUTBOX_REPOSITORY);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should escalate reminder successfully (Level 1)', async () => {
    // CUID-Format IDs verwenden (nicht UUIDs)
    const testErinnerungId = 'clx123456789abcdefghij001';
    const testEinsatzId = 'clx123456789abcdefghij002';
    const testErstellerId = 'clx123456789abcdefghij003';
    const testEskalationsPersonId = 'clx123456789abcdefghij004';

    const command = new EskaliereErinnerungCommand(testErinnerungId, 'SYSTEM');
    // Using reconstruct or create, but since we mock repo, create is fine.
    // However, create() needs to be triggered to AUSGELOEST.
    const erinnerung = Erinnerung.create({
      einsatzId: EinsatzId.create(testEinsatzId).value!,
      titel: 'Test',
      faelligAm: new Date(Date.now() + 10000),
      erstelltVon: UserId.create(testErstellerId).value!,
      eskalationsPersonId: UserId.create(testEskalationsPersonId).value!,
    }).value!;

    // Hack ID
    Object.defineProperty(erinnerung, 'id', { value: ErinnerungId.create(testErinnerungId).value! });

    // Move to AUSGELOEST status
    const triggerResult = erinnerung.ausloesen();
    expect(triggerResult.isSuccess).toBe(true);

    erinnerungRepository.findById.mockResolvedValue(Result.ok(erinnerung));
    erinnerungRepository.save.mockResolvedValue(Result.ok(undefined));
    mockResponseFactory.create.mockResolvedValue({ id: testErinnerungId, status: 'ESKALIERT' } as any);

    const result = await handler.execute(command);

    if (result.isFailure) {
      console.error('Test failed with error:', result.error);
    }
    expect(result.isSuccess).toBe(true);
    expect(erinnerungRepository.save).toHaveBeenCalled();
    expect(erinnerung.status.isEskaliert()).toBe(true);
  });

  it('should intensify reminder if no escalation person defined', async () => {
    const testErinnerungId = 'clx123456789abcdefghij005';
    const testEinsatzId = 'clx123456789abcdefghij006';
    const testErstellerId = 'clx123456789abcdefghij007';

    const command = new EskaliereErinnerungCommand(testErinnerungId, 'SYSTEM');
    const erinnerung = Erinnerung.create({
      einsatzId: EinsatzId.create(testEinsatzId).value!,
      titel: 'Test',
      faelligAm: new Date(Date.now() + 10000),
      erstelltVon: UserId.create(testErstellerId).value!,
      eskalationsPersonId: null,
    }).value!;

    // Hack ID
    Object.defineProperty(erinnerung, 'id', { value: ErinnerungId.create(testErinnerungId).value! });

    // Move to AUSGELOEST status
    const triggerResult = erinnerung.ausloesen();
    expect(triggerResult.isSuccess).toBe(true);

    erinnerungRepository.findById.mockResolvedValue(Result.ok(erinnerung));
    erinnerungRepository.save.mockResolvedValue(Result.ok(undefined));
    mockResponseFactory.create.mockResolvedValue({ id: testErinnerungId, status: 'AUSGELOEST' } as any);

    const result = await handler.execute(command);

    expect(result.isSuccess).toBe(true);
    expect(erinnerungRepository.save).toHaveBeenCalled();
    expect(erinnerung.status.isAusgeloest()).toBe(true); // Status remains AUSGELOEST
  });

  it('should escalate to next level (A -> B) when assigned user has default escalation target', async () => {
    const testErinnerungId = 'clx123456789abcdefghij008';
    const testEinsatzId = 'clx123456789abcdefghij009';
    const testErstellerId = 'clx123456789abcdefghij010';
    const testAssigneeId = 'clx123456789abcdefghij011'; // User B
    const testNextTargetId = 'clx123456789abcdefghij012'; // User C

    const command = new EskaliereErinnerungCommand(testErinnerungId, 'SYSTEM');

    // Create reminder that is already escalated to B
    const erinnerung = Erinnerung.reconstruct({
      id: ErinnerungId.create(testErinnerungId).value!,
      einsatzId: EinsatzId.create(testEinsatzId).value!,
      titel: ErinnerungTitel.create('Test').value!,
      beschreibung: null,
      faelligAm: new Date(),
      status: ErinnerungStatus.ESKALIERT(),
      erstelltVon: UserId.create(testErstellerId).value!,
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedToId: UserId.create(testAssigneeId).value!,
      eskalationsPersonId: UserId.create(testAssigneeId).value!, // Old escalation target
    });

    // Mock User B with default escalation target C
    userRepository.findById.mockResolvedValue(
      Result.ok({
        id: UserId.create(testAssigneeId).value!,
        defaultEscalationTargetId: UserId.create(testNextTargetId).value!,
      } as any),
    );

    erinnerungRepository.findById.mockResolvedValue(Result.ok(erinnerung));
    erinnerungRepository.save.mockResolvedValue(Result.ok(undefined));
    mockResponseFactory.create.mockResolvedValue({ id: testErinnerungId, status: 'ESKALIERT' } as any);

    const result = await handler.execute(command);

    expect(result.isSuccess).toBe(true);
    expect(erinnerungRepository.save).toHaveBeenCalled();

    // Verify assignment changed to C
    expect(erinnerung.assignedToId?.value).toBe(testNextTargetId);
    expect(erinnerung.eskalationsPersonId?.value).toBe(testNextTargetId);
  });
});
