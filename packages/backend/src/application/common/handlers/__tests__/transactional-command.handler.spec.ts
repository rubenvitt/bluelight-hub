import { Test, type TestingModule } from '@nestjs/testing';
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import { DomainEvent } from '@domain/common/domain-event';
import { TransactionalCommandHandler } from '../transactional-command.handler';
import type { TransactionContext } from '@domain/common';
import { OUTBOX_REPOSITORY } from '@infrastructure/di-tokens';

/**
 * Mock Domain Event für Testing.
 */
class TestEvent extends DomainEvent {
  constructor(public readonly data: string) {
    super('aggregate-id');
  }

  static eventName(): string {
    return 'TestEvent';
  }
}

/**
 * Mock Command DTO.
 */
interface TestCommand {
  value: string;
}

/**
 * Mock Result Type.
 */
interface TestResult {
  id: string;
  processed: boolean;
}

/**
 * Concrete Test Implementation of TransactionalCommandHandler.
 */
@Injectable()
class TestCommandHandler extends TransactionalCommandHandler<TestCommand, TestResult> {
  // Expose for testing
  public shouldThrowError = false;
  public eventsToReturn: DomainEvent[] = [];

  constructor(prisma: PrismaService, @Inject(OUTBOX_REPOSITORY) outboxRepository: IOutboxRepository) {
    super(prisma, outboxRepository);
  }

  protected async executeInTransaction(command: TestCommand, _tx: TransactionContext): Promise<{ result: TestResult; events: DomainEvent[] }> {
    if (this.shouldThrowError) {
      throw new Error('Business logic error');
    }

    const result: TestResult = {
      id: `result-${command.value}`,
      processed: true,
    };

    return {
      result,
      events: this.eventsToReturn,
    };
  }
}

describe('TransactionalCommandHandler', () => {
  let handler: TestCommandHandler;
  let prismaService: PrismaService;
  let outboxRepository: IOutboxRepository;

  /**
   * Mock Transaction Function für PrismaService.$transaction()
   */
  let mockTransactionFn: jest.Mock;

  beforeEach(async () => {
    // Mock PrismaService mit $transaction
    mockTransactionFn = jest.fn(async (callback: (tx: PrismaTransaction) => Promise<unknown>) => {
      // Simulate transaction by calling callback with mock tx
      const mockTx = {} as PrismaTransaction;
      return callback(mockTx);
    });

    const mockPrismaService = {
      $transaction: mockTransactionFn,
    } as unknown as PrismaService;

    // Mock IOutboxRepository
    const mockOutboxRepository: IOutboxRepository = {
      save: jest.fn().mockResolvedValue(undefined),
      findPendingEvents: jest.fn(),
      markAsPublished: jest.fn(),
      markAsFailed: jest.fn(),
      getRetryCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestCommandHandler,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: 'IOutboxRepository',
          useValue: mockOutboxRepository,
        },
      ],
    }).compile();

    handler = module.get<TestCommandHandler>(TestCommandHandler);
    prismaService = module.get<PrismaService>(PrismaService);
    outboxRepository = module.get<IOutboxRepository>('IOutboxRepository');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute()', () => {
    it('should successfully execute command and commit transaction with events', async () => {
      // Given: Command with events
      const command: TestCommand = { value: 'test-1' };
      const testEvent = new TestEvent('test-data');
      handler.eventsToReturn = [testEvent];

      // When: Execute command
      const result = await handler.execute(command);

      // Then: Transaction was started
      expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaService.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        maxWait: 5000,
        timeout: 10000,
      });

      // Then: Business logic executed successfully
      expect(result).toEqual({
        id: 'result-test-1',
        processed: true,
      });

      // Then: Events saved to outbox
      expect(outboxRepository.save).toHaveBeenCalledTimes(1);
      expect(outboxRepository.save).toHaveBeenCalledWith(
        [testEvent],
        expect.anything(), // tx parameter
      );
    });

    it('should execute command without saving events when no events returned', async () => {
      // Given: Command without events
      const command: TestCommand = { value: 'test-2' };
      handler.eventsToReturn = [];

      // When: Execute command
      const result = await handler.execute(command);

      // Then: Business logic executed
      expect(result).toEqual({
        id: 'result-test-2',
        processed: true,
      });

      // Then: Outbox save NOT called (no events)
      expect(outboxRepository.save).not.toHaveBeenCalled();
    });

    it('should rollback transaction on business logic error', async () => {
      // Given: Business logic will throw error
      const command: TestCommand = { value: 'error-test' };
      handler.shouldThrowError = true;
      handler.eventsToReturn = [new TestEvent('should-not-be-saved')];

      // When/Then: Execute throws error
      await expect(handler.execute(command)).rejects.toThrow('Business logic error');

      // Then: Transaction was started but rolled back
      expect(prismaService.$transaction).toHaveBeenCalledTimes(1);

      // Then: Outbox save NOT called (transaction rolled back)
      expect(outboxRepository.save).not.toHaveBeenCalled();
    });

    it('should rollback transaction on outbox save error', async () => {
      // Given: Outbox save will fail
      const command: TestCommand = { value: 'outbox-error-test' };
      const testEvent = new TestEvent('test-data');
      handler.eventsToReturn = [testEvent];

      // Mock outbox save to throw error
      (outboxRepository.save as jest.Mock).mockRejectedValueOnce(new Error('Outbox save failed'));

      // When/Then: Execute throws error
      await expect(handler.execute(command)).rejects.toThrow('Outbox save failed');

      // Then: Transaction was started
      expect(prismaService.$transaction).toHaveBeenCalledTimes(1);

      // Then: Outbox save was attempted
      expect(outboxRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple events atomically', async () => {
      // Given: Command with multiple events
      const command: TestCommand = { value: 'multi-event-test' };
      const events = [new TestEvent('event-1'), new TestEvent('event-2'), new TestEvent('event-3')];
      handler.eventsToReturn = events;

      // When: Execute command
      const result = await handler.execute(command);

      // Then: All events saved in single call
      expect(outboxRepository.save).toHaveBeenCalledTimes(1);
      expect(outboxRepository.save).toHaveBeenCalledWith(events, expect.anything());

      // Then: Result returned
      expect(result.processed).toBe(true);
    });

    it('should use configured transaction options', async () => {
      // Given: Any command
      const command: TestCommand = { value: 'config-test' };
      handler.eventsToReturn = [];

      // When: Execute command
      await handler.execute(command);

      // Then: Transaction called with correct config
      expect(prismaService.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        maxWait: 5000, // AC 2.2
        timeout: 10000, // AC 2.2
      });
    });
  });

  describe('Transaction Isolation', () => {
    it('should pass transaction context to executeInTransaction and outbox save', async () => {
      // Given: Command with events
      const command: TestCommand = { value: 'tx-isolation-test' };
      const testEvent = new TestEvent('test-data');
      handler.eventsToReturn = [testEvent];

      // Spy on executeInTransaction
      // biome-ignore lint/suspicious/noExplicitAny: Need to spy on protected method for testing
      const executeInTransactionSpy = jest.spyOn(handler as any, 'executeInTransaction');

      // When: Execute command
      await handler.execute(command);

      // Then: executeInTransaction received tx parameter
      expect(executeInTransactionSpy).toHaveBeenCalledWith(
        command,
        expect.anything(), // tx
      );

      // Then: outbox.save received same tx parameter
      expect(outboxRepository.save).toHaveBeenCalledWith(
        [testEvent],
        expect.anything(), // same tx
      );
    });
  });

  describe('Event Lifecycle', () => {
    it('should extract events BEFORE transaction and save them atomically', async () => {
      // Given: Command that produces events
      const command: TestCommand = { value: 'lifecycle-test' };
      const testEvent = new TestEvent('lifecycle-data');
      handler.eventsToReturn = [testEvent];

      // Track call order
      const callOrder: string[] = [];

      // Spy on executeInTransaction
      // biome-ignore lint/suspicious/noExplicitAny: Need to spy on protected method for testing
      jest.spyOn(handler as any, 'executeInTransaction').mockImplementation(async () => {
        callOrder.push('executeInTransaction');
        return {
          result: { id: 'test-id', processed: true },
          events: [testEvent],
        };
      });

      // Spy on outbox save
      (outboxRepository.save as jest.Mock).mockImplementation(async () => {
        callOrder.push('outbox.save');
      });

      // When: Execute command
      await handler.execute(command);

      // Then: Correct call order (extract before save)
      expect(callOrder).toEqual(['executeInTransaction', 'outbox.save']);
    });
  });

  describe('Error Scenarios', () => {
    it('should propagate business logic errors without saving events', async () => {
      // Given: Business logic throws domain error
      const command: TestCommand = { value: 'domain-error' };
      handler.shouldThrowError = true;
      handler.eventsToReturn = [new TestEvent('should-not-persist')];

      // When/Then: Error propagated
      await expect(handler.execute(command)).rejects.toThrow('Business logic error');

      // Then: Events NOT saved (transaction rolled back)
      expect(outboxRepository.save).not.toHaveBeenCalled();
    });

    it('should rollback both aggregate and events on transaction error', async () => {
      // Given: Simulate transaction-level error (e.g. deadlock)
      const command: TestCommand = { value: 'tx-error' };
      handler.eventsToReturn = [new TestEvent('test-event')];

      // Mock transaction to throw error
      mockTransactionFn.mockRejectedValueOnce(new Error('Transaction deadlock'));

      // When/Then: Error propagated
      await expect(handler.execute(command)).rejects.toThrow('Transaction deadlock');

      // Then: Neither business logic nor outbox save completed
      // (transaction was aborted before callback)
    });
  });
});
