/**
 * Unit Tests für OutboxEventPublisher (Infrastructure Layer).
 *
 * Diese Tests validieren den Polling Worker für das Transactional Outbox Pattern:
 * - Polling läuft alle 5 Sekunden (Cron)
 * - Concurrent Prevention via isRunning Flag
 * - Event Deserialization und Publishing
 * - Retry-Logik mit maxRetries
 * - FAILED Status nach maxRetries
 * - Graceful Shutdown bei Module-Destroy
 *
 * Epic 4 Story 4.4 | AC 4.1-4.7, 5.1-5.6
 */

import { Test, type TestingModule } from '@nestjs/testing';
import { OutboxEventPublisher, DEFAULT_OUTBOX_PUBLISHER_CONFIG, type OutboxPublisherConfig } from '../outbox-event-publisher.service';
import { PrismaOutboxRepository, type OutboxEventDto } from '../prisma-outbox.repository';
import { EventDeserializer } from '../event-deserializer';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import type { SerializedEvent } from '../event-serializer';
import type { DomainEvent } from '@domain/common/domain-event';
import type { IAlertService } from '@domain/services/ports/i-alert.service';
import { Result } from '@domain/common/result';

// Mock Domain Event
class MockDomainEvent implements DomainEvent {
  readonly eventId = 'event-123';
  readonly occurredAt = new Date();
  readonly aggregateId = 'agg-123';

  static eventName(): string {
    return 'mock.event';
  }
  static eventVersion(): number {
    return 1;
  }
}

describe('OutboxEventPublisher', () => {
  let publisher: OutboxEventPublisher;
  let outboxRepository: jest.Mocked<PrismaOutboxRepository>;
  let eventDeserializer: jest.Mocked<EventDeserializer>;
  let eventPublisher: jest.Mocked<IEventPublisher>;
  let alertService: jest.Mocked<IAlertService>;

  // Mock Outbox Event
  const mockSerializedEvent: SerializedEvent = {
    eventId: 'event-123',
    eventName: 'einsatz.created',
    eventVersion: 1,
    occurredAt: '2024-11-26T10:00:00.000Z',
    aggregateId: 'agg-123',
    payload: { einsatzId: 'eid-123' },
  };

  const mockOutboxEvent: OutboxEventDto = {
    id: 'event-123',
    eventName: 'einsatz.created',
    eventVersion: 1,
    aggregateId: 'agg-123',
    payload: mockSerializedEvent,
    status: 'PENDING',
    retryCount: 0,
    lastFailureReason: null,
    createdAt: new Date(),
    occurredAt: new Date(),
    publishedAt: null,
  };

  beforeEach(async () => {
    const mockOutboxRepository = {
      findPendingEvents: jest.fn().mockResolvedValue([]),
      markAsPublished: jest.fn().mockResolvedValue(undefined),
      markAsFailed: jest.fn().mockResolvedValue(undefined),
      markAsPermanentlyFailed: jest.fn().mockResolvedValue(undefined),
    };

    const mockEventDeserializer = {
      deserialize: jest.fn().mockReturnValue(Result.ok(new MockDomainEvent())),
    };

    const mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const mockAlertService = {
      notifyOutboxFailure: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxEventPublisher,
        { provide: PrismaOutboxRepository, useValue: mockOutboxRepository },
        { provide: EventDeserializer, useValue: mockEventDeserializer },
        { provide: 'IEventPublisher', useValue: mockEventPublisher },
        { provide: 'IAlertService', useValue: mockAlertService },
      ],
    }).compile();

    publisher = module.get<OutboxEventPublisher>(OutboxEventPublisher);
    outboxRepository = module.get(PrismaOutboxRepository);
    eventDeserializer = module.get(EventDeserializer);
    eventPublisher = module.get('IEventPublisher');
    alertService = module.get('IAlertService');
  });

  // ===== POLLING BEHAVIOR =====

  describe('publishPendingEvents()', () => {
    it('should do nothing when no pending events', async () => {
      outboxRepository.findPendingEvents.mockResolvedValue([]);

      await publisher.publishPendingEvents();

      expect(outboxRepository.findPendingEvents).toHaveBeenCalledWith(DEFAULT_OUTBOX_PUBLISHER_CONFIG.batchSize);
      expect(eventDeserializer.deserialize).not.toHaveBeenCalled();
      expect(eventPublisher.publish).not.toHaveBeenCalled();
    });

    it('should process pending events when available', async () => {
      outboxRepository.findPendingEvents.mockResolvedValue([mockOutboxEvent]);

      await publisher.publishPendingEvents();

      expect(eventDeserializer.deserialize).toHaveBeenCalledWith(mockOutboxEvent.payload);
      expect(eventPublisher.publish).toHaveBeenCalled();
      expect(outboxRepository.markAsPublished).toHaveBeenCalledWith('event-123');
    });

    it('should process multiple events in batch', async () => {
      const event1 = { ...mockOutboxEvent, id: 'event-1' };
      const event2 = { ...mockOutboxEvent, id: 'event-2' };
      const event3 = { ...mockOutboxEvent, id: 'event-3' };
      outboxRepository.findPendingEvents.mockResolvedValue([event1, event2, event3]);

      await publisher.publishPendingEvents();

      expect(eventDeserializer.deserialize).toHaveBeenCalledTimes(3);
      expect(eventPublisher.publish).toHaveBeenCalledTimes(3);
      expect(outboxRepository.markAsPublished).toHaveBeenCalledTimes(3);
    });
  });

  // ===== CONCURRENT PREVENTION =====

  describe('Concurrent Prevention', () => {
    it('should skip execution if already running', async () => {
      // First call takes time
      outboxRepository.findPendingEvents.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve([mockOutboxEvent]), 100);
          }),
      );

      // Start first call
      const firstCall = publisher.publishPendingEvents();

      // Second call should be skipped (isRunning = true)
      await publisher.publishPendingEvents();

      // Wait for first call to complete
      await firstCall;

      // findPendingEvents should only be called once (second call was skipped)
      expect(outboxRepository.findPendingEvents).toHaveBeenCalledTimes(1);
    });

    it('should reset isRunning flag after completion', async () => {
      outboxRepository.findPendingEvents.mockResolvedValue([mockOutboxEvent]);

      await publisher.publishPendingEvents();
      await publisher.publishPendingEvents();

      // Both calls should succeed (isRunning reset after first)
      expect(outboxRepository.findPendingEvents).toHaveBeenCalledTimes(2);
    });

    it('should reset isRunning flag even on error', async () => {
      outboxRepository.findPendingEvents.mockRejectedValueOnce(new Error('DB Error'));

      await expect(publisher.publishPendingEvents()).rejects.toThrow('DB Error');

      // Should be able to run again after error
      outboxRepository.findPendingEvents.mockResolvedValue([]);
      await publisher.publishPendingEvents();

      expect(outboxRepository.findPendingEvents).toHaveBeenCalledTimes(2);
    });
  });

  // ===== SUCCESS PATH =====

  describe('Success Path', () => {
    it('should deserialize and publish event', async () => {
      const domainEvent = new MockDomainEvent();
      outboxRepository.findPendingEvents.mockResolvedValue([mockOutboxEvent]);
      eventDeserializer.deserialize.mockReturnValue(Result.ok(domainEvent));

      await publisher.publishPendingEvents();

      expect(eventDeserializer.deserialize).toHaveBeenCalledWith(mockOutboxEvent.payload);
      expect(eventPublisher.publish).toHaveBeenCalledWith(domainEvent);
      expect(outboxRepository.markAsPublished).toHaveBeenCalledWith('event-123');
    });
  });

  // ===== DESERIALIZATION ERROR =====

  describe('Deserialization Error', () => {
    it('should mark event as FAILED immediately on deserialization error', async () => {
      outboxRepository.findPendingEvents.mockResolvedValue([mockOutboxEvent]);
      eventDeserializer.deserialize.mockReturnValue(Result.fail('Invalid event data'));

      await publisher.publishPendingEvents();

      expect(eventPublisher.publish).not.toHaveBeenCalled();
      expect(outboxRepository.markAsFailed).toHaveBeenCalledWith('event-123', 'Invalid event data');
      expect(outboxRepository.markAsPermanentlyFailed).toHaveBeenCalledWith('event-123');
    });

    it('should not retry deserialization errors', async () => {
      outboxRepository.findPendingEvents.mockResolvedValue([mockOutboxEvent]);
      eventDeserializer.deserialize.mockReturnValue(Result.fail('Corrupt JSON'));

      await publisher.publishPendingEvents();

      // FAILED immediately, no retry increment logic
      expect(outboxRepository.markAsPermanentlyFailed).toHaveBeenCalledWith('event-123');
    });
  });

  // ===== HANDLER ERROR & RETRY =====

  describe('Handler Error & Retry', () => {
    it('should mark as failed on handler error (retryable)', async () => {
      outboxRepository.findPendingEvents.mockResolvedValue([mockOutboxEvent]);
      eventPublisher.publish.mockRejectedValue(new Error('Handler crashed'));

      await publisher.publishPendingEvents();

      expect(outboxRepository.markAsFailed).toHaveBeenCalledWith('event-123', 'Handler crashed');
      expect(outboxRepository.markAsPublished).not.toHaveBeenCalled();
    });

    it('should not mark as permanently failed if retryCount < maxRetries', async () => {
      const eventWithRetries = { ...mockOutboxEvent, retryCount: 1 };
      outboxRepository.findPendingEvents.mockResolvedValue([eventWithRetries]);
      eventPublisher.publish.mockRejectedValue(new Error('Temporary error'));

      await publisher.publishPendingEvents();

      expect(outboxRepository.markAsFailed).toHaveBeenCalled();
      expect(outboxRepository.markAsPermanentlyFailed).not.toHaveBeenCalled();
    });

    it('should mark as permanently failed after maxRetries reached', async () => {
      const eventAtMaxRetries = { ...mockOutboxEvent, retryCount: 2 }; // Next retry = 3 = maxRetries
      outboxRepository.findPendingEvents.mockResolvedValue([eventAtMaxRetries]);
      eventPublisher.publish.mockRejectedValue(new Error('Persistent error'));

      await publisher.publishPendingEvents();

      expect(outboxRepository.markAsFailed).toHaveBeenCalledWith('event-123', 'Persistent error');
      expect(outboxRepository.markAsPermanentlyFailed).toHaveBeenCalledWith('event-123');
    });
  });

  // ===== GRACEFUL SHUTDOWN =====

  describe('Graceful Shutdown', () => {
    it('should stop processing after onModuleDestroy', async () => {
      outboxRepository.findPendingEvents.mockResolvedValue([mockOutboxEvent]);

      publisher.onModuleDestroy();
      await publisher.publishPendingEvents();

      expect(outboxRepository.findPendingEvents).not.toHaveBeenCalled();
    });
  });

  // ===== LIFECYCLE HOOKS =====

  describe('Lifecycle Hooks', () => {
    it('should log on module init', () => {
      // Just verify it doesn't throw
      expect(() => publisher.onModuleInit()).not.toThrow();
    });

    it('should set isEnabled to false on module destroy', () => {
      publisher.onModuleDestroy();
      // Verified by subsequent publishPendingEvents() not running
    });
  });

  // ===== MANUAL TRIGGER =====

  describe('triggerManually()', () => {
    it('should process events immediately', async () => {
      outboxRepository.findPendingEvents.mockResolvedValue([mockOutboxEvent]);

      await publisher.triggerManually();

      expect(outboxRepository.findPendingEvents).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('should throw if already running', async () => {
      outboxRepository.findPendingEvents.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve([]), 100);
          }),
      );

      const firstCall = publisher.publishPendingEvents();

      await expect(publisher.triggerManually()).rejects.toThrow('Publisher already running');

      await firstCall;
    });
  });

  // ===== CONFIGURATION =====

  describe('Configuration', () => {
    it('should use default config when none provided', async () => {
      outboxRepository.findPendingEvents.mockResolvedValue([]);

      await publisher.publishPendingEvents();

      expect(outboxRepository.findPendingEvents).toHaveBeenCalledWith(100);
    });

    it('should use custom config when provided', async () => {
      const customConfig: OutboxPublisherConfig = {
        maxRetries: 5,
        batchSize: 50,
      };

      const customPublisher = new OutboxEventPublisher(
        outboxRepository as unknown as PrismaOutboxRepository,
        eventDeserializer as unknown as EventDeserializer,
        eventPublisher as unknown as IEventPublisher,
        alertService as unknown as IAlertService,
        customConfig,
      );

      outboxRepository.findPendingEvents.mockResolvedValue([]);
      await customPublisher.publishPendingEvents();

      expect(outboxRepository.findPendingEvents).toHaveBeenCalledWith(50);
    });

    it('should respect custom maxRetries', async () => {
      const customConfig: OutboxPublisherConfig = {
        maxRetries: 5,
        batchSize: 100,
      };

      const customPublisher = new OutboxEventPublisher(
        outboxRepository as unknown as PrismaOutboxRepository,
        eventDeserializer as unknown as EventDeserializer,
        eventPublisher as unknown as IEventPublisher,
        alertService as unknown as IAlertService,
        customConfig,
      );

      // retryCount = 4, next = 5 = maxRetries → should mark as permanently failed
      const eventAtMaxRetries = { ...mockOutboxEvent, retryCount: 4 };
      outboxRepository.findPendingEvents.mockResolvedValue([eventAtMaxRetries]);
      eventPublisher.publish.mockRejectedValue(new Error('Error'));

      await customPublisher.publishPendingEvents();

      expect(outboxRepository.markAsPermanentlyFailed).toHaveBeenCalled();
    });
  });

  // ===== ALERT SERVICE INTEGRATION =====

  describe('Alert Service Integration', () => {
    it('should call alertService.notifyOutboxFailure on permanent failure', async () => {
      const eventAtMaxRetries = { ...mockOutboxEvent, retryCount: 2 };
      outboxRepository.findPendingEvents.mockResolvedValue([eventAtMaxRetries]);
      eventPublisher.publish.mockRejectedValue(new Error('Persistent error'));

      await publisher.publishPendingEvents();

      expect(alertService.notifyOutboxFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'event-123',
          eventName: 'einsatz.created',
          aggregateId: 'agg-123',
          lastError: 'Persistent error',
          retryCount: 2,
        }),
      );
    });

    it('should call alertService on deserialization failure', async () => {
      outboxRepository.findPendingEvents.mockResolvedValue([mockOutboxEvent]);
      eventDeserializer.deserialize.mockReturnValue(Result.fail('Invalid event data'));

      await publisher.publishPendingEvents();

      expect(alertService.notifyOutboxFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'event-123',
          lastError: 'Invalid event data',
        }),
      );
    });

    it('should not throw if alertService fails', async () => {
      const eventAtMaxRetries = { ...mockOutboxEvent, retryCount: 2 };
      outboxRepository.findPendingEvents.mockResolvedValue([eventAtMaxRetries]);
      eventPublisher.publish.mockRejectedValue(new Error('Error'));
      alertService.notifyOutboxFailure.mockRejectedValue(new Error('Alert failed'));

      // Should not throw
      await expect(publisher.publishPendingEvents()).resolves.not.toThrow();
    });

    it('should work without alertService (graceful degradation)', async () => {
      // Create publisher without AlertService
      const publisherWithoutAlert = new OutboxEventPublisher(
        outboxRepository as unknown as PrismaOutboxRepository,
        eventDeserializer as unknown as EventDeserializer,
        eventPublisher as unknown as IEventPublisher,
        undefined, // No AlertService
        DEFAULT_OUTBOX_PUBLISHER_CONFIG,
      );

      const eventAtMaxRetries = { ...mockOutboxEvent, retryCount: 2 };
      outboxRepository.findPendingEvents.mockResolvedValue([eventAtMaxRetries]);
      eventPublisher.publish.mockRejectedValue(new Error('Error'));

      // Should not throw even without AlertService
      await expect(publisherWithoutAlert.publishPendingEvents()).resolves.not.toThrow();
      expect(outboxRepository.markAsPermanentlyFailed).toHaveBeenCalled();
    });
  });
});
