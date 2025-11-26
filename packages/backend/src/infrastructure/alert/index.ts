/**
 * Alert Infrastructure Module Exports.
 *
 * Dieses Modul stellt die Alert-Infrastruktur für kritische Fehler bereit:
 * - LoggingAlertService: Entwicklungs-Implementation (Logger.error)
 * - AlertModule: NestJS Module für Dependency Injection
 *
 * @example
 * ```typescript
 * import { AlertModule, LoggingAlertService } from '@infrastructure/alert';
 * ```
 */

export { LoggingAlertService } from './logging-alert.service';
export { AlertModule } from './alert.module';
