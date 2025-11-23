/**
 * Unit Tests für EventEmitterPublisher (Infrastructure Layer).
 *
 * Diese Tests validieren den EventEmitter2 Adapter für das IEventPublisher Port:
 * - publish() delegiert korrekt an emitAsync() mit eventName
 * - publishAll() behält FIFO-Reihenfolge bei
 * - Debug Logging für jedes publizierte Event
 * - Handler-Fehler werden geloggt aber nicht propagiert (Fire-and-Forget)
 *
 * Epic 2 Story 2.7 | Task 3
 */

import { Logger } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { DomainEvent } from '@domain/common/domain-event';
import { EventEmitterPublisher } from '../event-emitter-publisher';

describe('EventEmitterPublisher', () => {
  let publisher: EventEmitterPublisher;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;
  let loggerDebugSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;

  // Mock DomainEvent factory
  const createMockEvent = (eventName: string, eventId: string, aggregateId?: string): DomainEvent => {
    return {
      eventId,
      aggregateId,
      occurredAt: new Date(),
      constructor: {
        eventName: () => eventName,
      },
    } as unknown as DomainEvent;
  };

  beforeEach(() => {
    // Create mock EventEmitter2
    mockEventEmitter = {
      emitAsync: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<EventEmitter2>;

    // Create publisher instance
    publisher = new EventEmitterPublisher(mockEventEmitter);

    // Spy on Logger methods
    loggerDebugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('publish()', () => {
    it('should call emitAsync with correct eventName', async () => {
      // Given: A mock domain event
      const mockEvent = createMockEvent('test.event', 'event-123', 'aggregate-456');

      // When: publish is called
      await publisher.publish(mockEvent);

      // Then: emitAsync is called with event name and event
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledTimes(1);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith('test.event', mockEvent);
    });

    it('should log debug message on successful publish', async () => {
      // Given: A mock domain event
      const mockEvent = createMockEvent('lagekarte.created', 'evt-abc', 'agg-xyz');

      // When: publish is called
      await publisher.publish(mockEvent);

      // Then: Debug log is written with event details
      expect(loggerDebugSpy).toHaveBeenCalledTimes(1);
      expect(loggerDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining("Event 'lagekarte.created' published"),
        expect.objectContaining({
          eventId: 'evt-abc',
          aggregateId: 'agg-xyz',
        }),
      );
    });

    it('should catch and log handler errors without propagating', async () => {
      // Given: EventEmitter that throws an error
      const handlerError = new Error('Handler failed');
      mockEventEmitter.emitAsync.mockRejectedValueOnce(handlerError);

      const mockEvent = createMockEvent('test.failing', 'fail-event-id', 'fail-aggregate');

      // When: publish is called
      // Then: Should NOT throw
      await expect(publisher.publish(mockEvent)).resolves.not.toThrow();

      // And: Warning is logged
      expect(loggerWarnSpy).toHaveBeenCalledTimes(1);
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Event handler error for 'test.failing'"),
        expect.objectContaining({
          eventId: 'fail-event-id',
          error: 'Handler failed',
        }),
      );
    });

    it('should handle non-Error handler failures', async () => {
      // Given: EventEmitter that throws a string
      mockEventEmitter.emitAsync.mockRejectedValueOnce('String error');

      const mockEvent = createMockEvent('test.string-error', 'str-evt-id');

      // When: publish is called
      await publisher.publish(mockEvent);

      // Then: Warning is logged with string error
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Event handler error for 'test.string-error'"),
        expect.objectContaining({
          error: 'String error',
        }),
      );
    });

    it('should handle event without aggregateId', async () => {
      // Given: Event without aggregateId
      const mockEvent = createMockEvent('test.no-aggregate', 'evt-no-agg');

      // When: publish is called
      await publisher.publish(mockEvent);

      // Then: emitAsync is still called
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith('test.no-aggregate', mockEvent);

      // And: Debug log handles undefined aggregateId
      expect(loggerDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining("Event 'test.no-aggregate' published"),
        expect.objectContaining({
          eventId: 'evt-no-agg',
          aggregateId: undefined,
        }),
      );
    });
  });

  describe('publishAll()', () => {
    it('should publish events in FIFO order', async () => {
      // Given: Multiple events
      const event1 = createMockEvent('first.event', 'evt-1', 'agg-1');
      const event2 = createMockEvent('second.event', 'evt-2', 'agg-2');
      const event3 = createMockEvent('third.event', 'evt-3', 'agg-3');

      // Track call order
      const callOrder: string[] = [];
      mockEventEmitter.emitAsync.mockImplementation(async (eventName: string) => {
        callOrder.push(eventName);
        return [];
      });

      // When: publishAll is called
      await publisher.publishAll([event1, event2, event3]);

      // Then: Events are published in order (FIFO)
      expect(callOrder).toEqual(['first.event', 'second.event', 'third.event']);
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledTimes(3);
    });

    it('should continue publishing after handler error', async () => {
      // Given: Second event handler fails
      const event1 = createMockEvent('event.one', 'evt-1');
      const event2 = createMockEvent('event.two', 'evt-2');
      const event3 = createMockEvent('event.three', 'evt-3');

      mockEventEmitter.emitAsync
        .mockResolvedValueOnce([]) // event1 succeeds
        .mockRejectedValueOnce(new Error('Handler 2 failed')) // event2 fails
        .mockResolvedValueOnce([]); // event3 succeeds

      // When: publishAll is called
      await publisher.publishAll([event1, event2, event3]);

      // Then: All events are still published (fire-and-forget)
      expect(mockEventEmitter.emitAsync).toHaveBeenCalledTimes(3);

      // And: Warn logged for failed handler
      expect(loggerWarnSpy).toHaveBeenCalledTimes(1);
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Event handler error for 'event.two'"), expect.anything());
    });

    it('should handle empty events array', async () => {
      // When: publishAll is called with empty array
      await publisher.publishAll([]);

      // Then: emitAsync is never called
      expect(mockEventEmitter.emitAsync).not.toHaveBeenCalled();
    });

    it('should log debug for each published event', async () => {
      // Given: Two events
      const event1 = createMockEvent('debug.one', 'd-1');
      const event2 = createMockEvent('debug.two', 'd-2');

      // When: publishAll is called
      await publisher.publishAll([event1, event2]);

      // Then: Debug logged for each event
      expect(loggerDebugSpy).toHaveBeenCalledTimes(2);
    });
  });
});
