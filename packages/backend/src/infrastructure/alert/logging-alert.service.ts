import { Injectable, Logger } from '@nestjs/common';
import type { IAlertService, OutboxFailureAlertPayload } from '@domain/services/ports/i-alert.service';

/**
 * Logging-basierte Alert Service Implementation.
 *
 * Diese einfache Implementation loggt Alert-Nachrichten für fehlgeschlagene
 * Outbox Events. In Produktions-Umgebungen sollte diese durch eine
 * E-Mail-basierte Implementation (EmailAlertService) ersetzt werden.
 *
 * **Warum Logging statt E-Mail initial?**
 * - Keine externe Abhängigkeit (SMTP Server) für Entwicklung nötig
 * - Einfaches Testen und Debugging
 * - E-Mail-Integration kann später via ConfigService gesteuert werden
 *
 * **Fire-and-Forget:**
 * - Fehler werden geloggt aber nicht propagiert
 * - Promise resolved immer (keine Exceptions)
 *
 * @example
 * ```typescript
 * // Module Registration:
 * {
 *   provide: 'IAlertService',
 *   useClass: LoggingAlertService,
 * }
 * ```
 */
@Injectable()
export class LoggingAlertService implements IAlertService {
  private readonly logger = new Logger(LoggingAlertService.name);

  /**
   * Loggt einen Alert für ein fehlgeschlagenes Outbox Event.
   *
   * Nutzt Logger.error() für Visibility in Monitoring-Systemen.
   * In Produktions-Umgebungen können Log-Aggregation-Tools (z.B. Datadog,
   * CloudWatch) diese Logs automatisch zu Alerts konvertieren.
   *
   * @param payload - Details zum fehlgeschlagenen Event
   */
  async notifyOutboxFailure(payload: OutboxFailureAlertPayload): Promise<void> {
    try {
      this.logger.error(`🚨 CRITICAL: Outbox Event permanently failed after ${payload.retryCount} retries`, {
        eventId: payload.eventId,
        eventName: payload.eventName,
        aggregateId: payload.aggregateId,
        lastError: payload.lastError,
        retryCount: payload.retryCount,
        occurredAt: payload.occurredAt.toISOString(),
        failedAt: payload.failedAt.toISOString(),
        action: 'MANUAL_INTERVENTION_REQUIRED',
      });

      // Log structured data for parsing by log aggregation tools
      this.logger.error(
        JSON.stringify({
          alert_type: 'OUTBOX_FAILURE',
          severity: 'CRITICAL',
          ...payload,
          occurredAt: payload.occurredAt.toISOString(),
          failedAt: payload.failedAt.toISOString(),
        }),
      );
    } catch (error) {
      // Fire-and-Forget: Log aber nicht propagieren
      this.logger.warn('Failed to log alert', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
