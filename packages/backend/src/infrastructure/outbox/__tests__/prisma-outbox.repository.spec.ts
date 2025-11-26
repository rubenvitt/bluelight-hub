/**
 * Unit Tests für PrismaOutboxRepository (Infrastructure Layer).
 *
 * Diese Tests validieren die Outbox-Repository-Implementierung:
 * - save() persistiert Events korrekt in der Outbox-Tabelle
 * - findPendingEvents() lädt PENDING Events sortiert nach createdAt ASC
 * - markAsPublished() setzt status = PUBLISHED und publishedAt
 * - markAsFailed() incrementiert retryCount und setzt lastFailureReason
 * - markAsPermanentlyFailed() setzt status = FAILED
 * - Transaction-Support für atomare Operationen
 *
 * Epic 4 Story 4.4 | AC 2.1-2.6
 */

import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaOutboxRepository, type PrismaTransaction } from '../prisma-outbox.repository';
import { EventSerializer, type SerializedEvent } from '../event-serializer';
import { PrismaService } from '@/prisma/prisma.service';
import type { DomainEvent } from '@domain/common/domain-event';
import type { OutboxEventStatus } from '@prisma/client';

// Mock EinsatzCreatedEvent for testing
class MockEinsatzCreatedEvent implements DomainEvent {
  readonly eventId = 'event-123';
  readonly occurredAt = new Date('2024-11-26T10:00:00.000Z');
  readonly aggregateId = 'agg-123';

  static eventName(): string {
    return 'einsatz.created';
  }
  static eventVersion(): number {
    return 1;
  }
}

// Mock EtbCreatedEvent for testing
class MockEtbCreatedEvent implements DomainEvent {
  readonly eventId = 'event-456';
  readonly occurredAt = new Date('2024-11-26T10:01:00.000Z');
  readonly aggregateId = 'agg-456';

  static eventName(): string {
    return 'etb.created';
  }
  static eventVersion(): number {
    return 1;
  }
}

describe('PrismaOutboxRepository', () => {
  let repository: PrismaOutboxRepository;
  let prismaService: jest.Mocked<PrismaService>;
  let eventSerializer: jest.Mocked<EventSerializer>;

  // Mock data
  const mockSerializedEvent: SerializedEvent = {
    eventId: 'event-123',
    eventName: 'einsatz.created',
    eventVersion: 1,
    occurredAt: '2024-11-26T10:00:00.000Z',
    aggregateId: 'agg-123',
    payload: { einsatzId: 'eid-123', createdBy: 'uid-123' },
  };

  const mockOutboxEvent = {
    id: 'event-123',
    eventName: 'einsatz.created',
    eventVersion: 1,
    aggregateId: 'agg-123',
    payload: mockSerializedEvent,
    status: 'PENDING' as OutboxEventStatus,
    retryCount: 0,
    lastFailureReason: null,
    createdAt: new Date('2024-11-26T10:00:00.000Z'),
    occurredAt: new Date('2024-11-26T10:00:00.000Z'),
    publishedAt: null,
  };

  beforeEach(async () => {
    // Create mocks
    const mockPrismaService = {
      outboxEvent: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([mockOutboxEvent]),
        findUnique: jest.fn().mockResolvedValue(mockOutboxEvent),
        update: jest.fn().mockResolvedValue(mockOutboxEvent),
      },
    };

    const mockEventSerializer = {
      serialize: jest.fn().mockReturnValue(mockSerializedEvent),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaOutboxRepository, { provide: PrismaService, useValue: mockPrismaService }, { provide: EventSerializer, useValue: mockEventSerializer }],
    }).compile();

    repository = module.get<PrismaOutboxRepository>(PrismaOutboxRepository);
    prismaService = module.get(PrismaService);
    eventSerializer = module.get(EventSerializer);
  });

  // ===== SAVE TESTS =====

  describe('save()', () => {
    it('should do nothing when events array is empty', async () => {
      await repository.save([]);

      expect(prismaService.outboxEvent.createMany).not.toHaveBeenCalled();
      expect(eventSerializer.serialize).not.toHaveBeenCalled();
    });

    it('should serialize and persist a single event', async () => {
      const event = new MockEinsatzCreatedEvent();

      await repository.save([event]);

      expect(eventSerializer.serialize).toHaveBeenCalledWith(event);
      expect(prismaService.outboxEvent.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            id: 'event-123',
            eventName: 'einsatz.created',
            eventVersion: 1,
            aggregateId: 'agg-123',
            payload: mockSerializedEvent,
            occurredAt: new Date('2024-11-26T10:00:00.000Z'),
          }),
        ],
      });
    });

    it('should serialize and persist multiple events in batch', async () => {
      const event1 = new MockEinsatzCreatedEvent();
      const event2 = new MockEtbCreatedEvent();

      const serializedEvent2: SerializedEvent = {
        eventId: 'event-456',
        eventName: 'etb.created',
        eventVersion: 1,
        occurredAt: '2024-11-26T10:01:00.000Z',
        aggregateId: 'agg-456',
        payload: { etbId: 'etb-123', einsatzId: 'eid-123' },
      };

      eventSerializer.serialize.mockReturnValueOnce(mockSerializedEvent).mockReturnValueOnce(serializedEvent2);

      await repository.save([event1, event2]);

      expect(eventSerializer.serialize).toHaveBeenCalledTimes(2);
      expect(prismaService.outboxEvent.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([expect.objectContaining({ id: 'event-123' }), expect.objectContaining({ id: 'event-456' })]),
      });
    });

    it('should use provided transaction when available', async () => {
      const event = new MockEinsatzCreatedEvent();
      const mockTransaction = {
        outboxEvent: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      } as unknown as PrismaTransaction;

      await repository.save([event], mockTransaction);

      expect(mockTransaction.outboxEvent.createMany).toHaveBeenCalled();
      expect(prismaService.outboxEvent.createMany).not.toHaveBeenCalled();
    });

    it('should use empty string for aggregateId when undefined', async () => {
      const serializedWithoutAggId: SerializedEvent = {
        ...mockSerializedEvent,
        aggregateId: undefined,
      };
      eventSerializer.serialize.mockReturnValue(serializedWithoutAggId);
      const event = new MockEinsatzCreatedEvent();

      await repository.save([event]);

      expect(prismaService.outboxEvent.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ aggregateId: '' })],
      });
    });
  });

  // ===== FIND PENDING EVENTS TESTS =====

  describe('findPendingEvents()', () => {
    it('should return PENDING events sorted by createdAt ASC', async () => {
      const events = await repository.findPendingEvents();

      expect(prismaService.outboxEvent.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('event-123');
      expect(events[0].status).toBe('PENDING');
    });

    it('should respect custom limit parameter', async () => {
      await repository.findPendingEvents(50);

      expect(prismaService.outboxEvent.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
    });

    it('should return empty array when no pending events', async () => {
      (prismaService.outboxEvent.findMany as jest.Mock).mockResolvedValue([]);

      const events = await repository.findPendingEvents();

      expect(events).toEqual([]);
    });

    it('should map Prisma OutboxEvent to OutboxEventDto correctly', async () => {
      const events = await repository.findPendingEvents();

      expect(events[0]).toEqual({
        id: 'event-123',
        eventName: 'einsatz.created',
        eventVersion: 1,
        aggregateId: 'agg-123',
        payload: mockSerializedEvent,
        status: 'PENDING',
        retryCount: 0,
        lastFailureReason: null,
        createdAt: new Date('2024-11-26T10:00:00.000Z'),
        occurredAt: new Date('2024-11-26T10:00:00.000Z'),
        publishedAt: null,
      });
    });
  });

  // ===== MARK AS PUBLISHED TESTS =====

  describe('markAsPublished()', () => {
    it('should update status to PUBLISHED and set publishedAt', async () => {
      const beforeCall = Date.now();

      await repository.markAsPublished('event-123');

      const afterCall = Date.now();

      expect(prismaService.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-123' },
        data: {
          status: 'PUBLISHED',
          publishedAt: expect.any(Date),
        },
      });

      // Verify publishedAt is within test execution window
      const callArgs = (prismaService.outboxEvent.update as jest.Mock).mock.calls[0][0];
      const publishedAt = callArgs.data.publishedAt.getTime();
      expect(publishedAt).toBeGreaterThanOrEqual(beforeCall);
      expect(publishedAt).toBeLessThanOrEqual(afterCall);
    });
  });

  // ===== MARK AS FAILED TESTS =====

  describe('markAsFailed()', () => {
    it('should increment retryCount and set lastFailureReason', async () => {
      await repository.markAsFailed('event-123', 'Connection timeout');

      expect(prismaService.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-123' },
        data: {
          retryCount: { increment: 1 },
          lastFailureReason: 'Connection timeout',
        },
      });
    });

    it('should truncate lastFailureReason to 1000 characters', async () => {
      const longError = 'x'.repeat(2000);

      await repository.markAsFailed('event-123', longError);

      expect(prismaService.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-123' },
        data: {
          retryCount: { increment: 1 },
          lastFailureReason: 'x'.repeat(1000),
        },
      });
    });
  });

  // ===== MARK AS PERMANENTLY FAILED TESTS =====

  describe('markAsPermanentlyFailed()', () => {
    it('should set status to FAILED', async () => {
      await repository.markAsPermanentlyFailed('event-123');

      expect(prismaService.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-123' },
        data: { status: 'FAILED' },
      });
    });
  });

  // ===== GET RETRY COUNT TESTS =====

  describe('getRetryCount()', () => {
    it('should return current retryCount for existing event', async () => {
      (prismaService.outboxEvent.findUnique as jest.Mock).mockResolvedValue({
        retryCount: 3,
      });

      const count = await repository.getRetryCount('event-123');

      expect(prismaService.outboxEvent.findUnique).toHaveBeenCalledWith({
        where: { id: 'event-123' },
        select: { retryCount: true },
      });
      expect(count).toBe(3);
    });

    it('should return 0 for non-existent event', async () => {
      (prismaService.outboxEvent.findUnique as jest.Mock).mockResolvedValue(null);

      const count = await repository.getRetryCount('non-existent');

      expect(count).toBe(0);
    });
  });

  // ===== FIND BY ID TESTS =====

  describe('findById()', () => {
    it('should return OutboxEventDto when event exists', async () => {
      const event = await repository.findById('event-123');

      expect(prismaService.outboxEvent.findUnique).toHaveBeenCalledWith({
        where: { id: 'event-123' },
      });
      expect(event).not.toBeNull();
      expect(event?.id).toBe('event-123');
    });

    it('should return null when event does not exist', async () => {
      (prismaService.outboxEvent.findUnique as jest.Mock).mockResolvedValue(null);

      const event = await repository.findById('non-existent');

      expect(event).toBeNull();
    });
  });

  // ===== TRANSACTION SUPPORT TESTS =====

  describe('Transaction Support', () => {
    it('should use PrismaService when no transaction provided', async () => {
      const event = new MockEinsatzCreatedEvent();

      await repository.save([event]);

      expect(prismaService.outboxEvent.createMany).toHaveBeenCalled();
    });

    it('should use provided transaction client for atomic operations', async () => {
      const event = new MockEinsatzCreatedEvent();
      const txCreateMany = jest.fn().mockResolvedValue({ count: 1 });
      const mockTx = {
        outboxEvent: { createMany: txCreateMany },
      } as unknown as PrismaTransaction;

      await repository.save([event], mockTx);

      expect(txCreateMany).toHaveBeenCalled();
      expect(prismaService.outboxEvent.createMany).not.toHaveBeenCalled();
    });
  });
});
