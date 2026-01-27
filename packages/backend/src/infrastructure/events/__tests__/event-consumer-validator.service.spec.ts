/**
 * Unit Tests für EventConsumerValidatorService.
 *
 * Testet die Validierung, dass alle registrierten Events
 * mindestens einen @OnEvent Handler haben.
 */
import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventConsumerValidatorService } from '../event-consumer-validator.service';
import { EventDeserializer } from '@infrastructure/outbox/event-deserializer';
import { LOGGER } from '@infrastructure/di-tokens';
import type { ILogger } from '@domain/ports/i-logger.port';

describe('EventConsumerValidatorService', () => {
  let service: EventConsumerValidatorService;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;
  let mockEventDeserializer: jest.Mocked<EventDeserializer>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(async () => {
    // Mock Logger
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<ILogger>;

    // Mock EventEmitter2
    mockEventEmitter = {
      listenerCount: jest.fn(),
    } as unknown as jest.Mocked<EventEmitter2>;

    // Mock EventDeserializer
    mockEventDeserializer = {
      getSupportedEventTypes: jest.fn(),
    } as unknown as jest.Mocked<EventDeserializer>;

    const module = await Test.createTestingModule({
      providers: [
        EventConsumerValidatorService,
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: EventDeserializer, useValue: mockEventDeserializer },
        { provide: LOGGER, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<EventConsumerValidatorService>(EventConsumerValidatorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onApplicationBootstrap', () => {
    // Helper um auf setImmediate zu warten
    const flushSetImmediate = () => new Promise((resolve) => setImmediate(resolve));

    it('should log info when all events have consumers', async () => {
      // Given: Alle Events haben Handler
      mockEventDeserializer.getSupportedEventTypes.mockReturnValue(['einsatz.created', 'einsatz.updated']);
      mockEventEmitter.listenerCount.mockReturnValue(1);

      // When
      service.onApplicationBootstrap();
      await flushSetImmediate();

      // Then
      expect(mockLogger.log).toHaveBeenCalledWith('Alle registrierten Events haben mindestens einen Consumer.');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should log warning when events without consumers are found', async () => {
      // Given: Ein Event hat keinen Handler
      mockEventDeserializer.getSupportedEventTypes.mockReturnValue(['einsatz.created', 'my.new.event']);
      mockEventEmitter.listenerCount.mockImplementation((eventName) => {
        if (eventName === 'einsatz.created') return 1;
        return 0; // my.new.event hat keinen Handler
      });

      // When
      service.onApplicationBootstrap();
      await flushSetImmediate();

      // Then
      expect(mockLogger.warn).toHaveBeenCalled();
      const warnCall = mockLogger.warn.mock.calls[0]?.[0];
      expect(warnCall).toContain('my.new.event');
      expect(warnCall).toContain('kein @OnEvent Handler registriert');
    });

    it('should skip whitelisted events', async () => {
      // Given: Ein Whitelist-Event hat keinen Handler
      mockEventDeserializer.getSupportedEventTypes.mockReturnValue(['user.created', 'einsatz.created']);
      mockEventEmitter.listenerCount.mockImplementation((eventName) => {
        if (eventName === 'einsatz.created') return 1;
        return 0; // user.created hat keinen Handler, ist aber whitelisted
      });

      // When
      service.onApplicationBootstrap();
      await flushSetImmediate();

      // Then: Kein Warning, da user.created whitelisted ist
      expect(mockLogger.log).toHaveBeenCalledWith('Alle registrierten Events haben mindestens einen Consumer.');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should catch and log errors without crashing', async () => {
      // Given: EventDeserializer wirft einen Fehler
      mockEventDeserializer.getSupportedEventTypes.mockImplementation(() => {
        throw new Error('Deserializer initialization failed');
      });

      // When
      service.onApplicationBootstrap();
      await flushSetImmediate();

      // Then: Fehler wird geloggt, App crasht nicht
      expect(mockLogger.error).toHaveBeenCalledWith('Event Consumer Validierung fehlgeschlagen - App startet trotzdem', 'Deserializer initialization failed');
      expect(mockLogger.log).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('getEventsWithoutConsumer', () => {
    it('should return empty array when all events have consumers', () => {
      // Given
      mockEventDeserializer.getSupportedEventTypes.mockReturnValue(['einsatz.created']);
      mockEventEmitter.listenerCount.mockReturnValue(1);

      // When
      const result = service.getEventsWithoutConsumer();

      // Then
      expect(result).toEqual([]);
    });

    it('should return events without consumers', () => {
      // Given
      mockEventDeserializer.getSupportedEventTypes.mockReturnValue(['einsatz.created', 'orphan.event']);
      mockEventEmitter.listenerCount.mockImplementation((eventName) => {
        return eventName === 'einsatz.created' ? 1 : 0;
      });

      // When
      const result = service.getEventsWithoutConsumer();

      // Then
      expect(result).toEqual(['orphan.event']);
    });

    it('should exclude whitelisted events from results', () => {
      // Given: user.created ist whitelisted
      mockEventDeserializer.getSupportedEventTypes.mockReturnValue(['user.created', 'orphan.event']);
      mockEventEmitter.listenerCount.mockReturnValue(0);

      // When
      const result = service.getEventsWithoutConsumer();

      // Then: Nur orphan.event, nicht user.created
      expect(result).toEqual(['orphan.event']);
    });
  });

  describe('getRegisteredEvents', () => {
    it('should return all registered events from deserializer', () => {
      // Given
      const events = ['einsatz.created', 'etb.created', 'lagekarte.created'];
      mockEventDeserializer.getSupportedEventTypes.mockReturnValue(events);

      // When
      const result = service.getRegisteredEvents();

      // Then
      expect(result).toEqual(events);
    });
  });

  describe('getWhitelistedEvents', () => {
    it('should return the whitelist set', () => {
      // When
      const whitelist = service.getWhitelistedEvents();

      // Then
      expect(whitelist).toBeInstanceOf(Set);
      expect(whitelist.has('user.created')).toBe(true);
      expect(whitelist.has('etb.created')).toBe(true);
      expect(whitelist.has('einsatz.created')).toBe(false); // Nicht whitelisted
    });
  });
});
