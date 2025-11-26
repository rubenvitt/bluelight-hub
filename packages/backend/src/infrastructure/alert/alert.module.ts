import { Module } from '@nestjs/common';
import { LoggingAlertService } from './logging-alert.service';

/**
 * Alert Infrastructure Module.
 *
 * Dieses Module stellt die IAlertService Implementation für das
 * Transactional Outbox Pattern bereit. SUPER_ADMIN User werden
 * über kritische Fehler (z.B. Events die nach MAX_RETRIES fehlschlagen)
 * benachrichtigt.
 *
 * **Aktuell:** Logging-basierte Implementation (LoggingAlertService)
 * **Zukünftig:** E-Mail-basierte Implementation (EmailAlertService) via nodemailer
 *
 * **Module Exchange:**
 * Um auf E-Mail-Alerts umzustellen, ersetze LoggingAlertService durch
 * EmailAlertService und konfiguriere SMTP in .env:
 * - SMTP_HOST
 * - SMTP_PORT
 * - SMTP_USER
 * - SMTP_PASS
 * - SMTP_FROM
 *
 * @example
 * ```typescript
 * // In AppModule:
 * @Module({
 *   imports: [AlertModule],
 * })
 * export class AppModule {}
 * ```
 */
@Module({
  providers: [
    LoggingAlertService,
    {
      provide: 'IAlertService',
      useExisting: LoggingAlertService,
    },
  ],
  exports: ['IAlertService', LoggingAlertService],
})
export class AlertModule {}
