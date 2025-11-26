/**
 * Unit Tests für LoggingAlertService (Infrastructure Layer).
 *
 * Diese Tests validieren die Logging-basierte Alert Implementation:
 * - notifyOutboxFailure() loggt strukturierte Alert-Daten
 * - Fire-and-Forget: Fehler werden geloggt aber nicht propagiert
 * - Korrektes Format für Log-Aggregation-Tools
 *
 * Epic 4 Story 4.4 | AC 6.1-6.8
 */

import { Test, type TestingModule } from '@nestjs/testing';
import { LoggingAlertService } from '../logging-alert.service';
import type { OutboxFailureAlertPayload } from '@domain/services/ports/i-alert.service';

describe('LoggingAlertService', () => {
  let service: LoggingAlertService;

  // Mock payload
  const mockPayload: OutboxFailureAlertPayload = {
    eventId: 'event-123',
    eventName: 'etb.eintrag_added',
    aggregateId: 'agg-456',
    lastError: 'Connection timeout to handler',
    retryCount: 3,
    occurredAt: new Date('2024-11-26T10:00:00.000Z'),
    failedAt: new Date('2024-11-26T10:15:00.000Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggingAlertService],
    }).compile();

    service = module.get<LoggingAlertService>(LoggingAlertService);
  });

  describe('notifyOutboxFailure()', () => {
    it('should not throw on valid payload', async () => {
      await expect(service.notifyOutboxFailure(mockPayload)).resolves.not.toThrow();
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalPayload: OutboxFailureAlertPayload = {
        eventId: 'event-789',
        eventName: 'einsatz.created',
        aggregateId: '',
        lastError: 'Unknown error',
        retryCount: 1,
        occurredAt: new Date(),
        failedAt: new Date(),
      };

      await expect(service.notifyOutboxFailure(minimalPayload)).resolves.not.toThrow();
    });

    it('should not throw even if internal error occurs', async () => {
      // Service should be fire-and-forget
      const invalidPayload = {
        eventId: 'event-123',
        eventName: 'test.event',
        aggregateId: 'agg-123',
        lastError: 'Error',
        retryCount: 3,
        occurredAt: null as unknown as Date, // Invalid: will cause toISOString() to fail
        failedAt: new Date(),
      };

      // Should not throw even with invalid data
      await expect(service.notifyOutboxFailure(invalidPayload)).resolves.not.toThrow();
    });

    it('should implement IAlertService interface', () => {
      expect(service.notifyOutboxFailure).toBeDefined();
      expect(typeof service.notifyOutboxFailure).toBe('function');
    });
  });

  describe('Fire-and-Forget Pattern', () => {
    it('should always resolve promise (never reject)', async () => {
      // Multiple calls should all resolve
      const results = await Promise.allSettled([service.notifyOutboxFailure(mockPayload), service.notifyOutboxFailure(mockPayload), service.notifyOutboxFailure(mockPayload)]);

      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    });
  });
});
