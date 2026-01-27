import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression, type SchedulerRegistry } from '@nestjs/schedule';
import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { IErinnerungRepository } from '@domain/repositories/i-erinnerung.repository';
import type { ILogger } from '@domain/ports/i-logger.port';
import { ERINNERUNG_REPOSITORY, LOGGER } from '@infrastructure/di-tokens';
import { GetErinnerungKonfigurationQuery } from '@application/erinnerung-konfiguration/queries/get-erinnerung-konfiguration.query';
import { EskaliereErinnerungCommand } from '@application/erinnerung/commands/eskaliere-erinnerung/eskaliere-erinnerung.command';

/**
 * Scheduler, der regelmäßig nach überfälligen Erinnerungen sucht und diese eskaliert.
 *
 * **Logic:**
 * 1. Cron läuft alle 10 Sekunden
 * 2. Lädt aktuelle Konfiguration (Timeout)
 * 3. Berechnet Threshold (Now - Timeout)
 * 4. Lädt alle Erinnerungen mit Status AUSGELOEST, deren Auslösezeit <= Threshold ist
 * 5. Dispatcht für jede gefundene Erinnerung einen `EskaliereErinnerungCommand`
 *
 * **Robustness:**
 * - Fehler bei einzelnen Commands stoppen nicht den gesamten Prozess (Promise.allSettled)
 *
 * @see Story 4.4
 */
@Injectable()
export class ErinnerungEskalationsScheduler {
  private readonly instanceId = Math.random().toString(36).substring(7);

  constructor(
    @Inject(ERINNERUNG_REPOSITORY)
    private readonly repository: IErinnerungRepository,
    @Inject(LOGGER)
    private readonly logger: ILogger,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onApplicationBootstrap() {
    try {
      const jobs = this.schedulerRegistry.getCronJobs();
      this.logger.log(`[${this.instanceId}] Registered CronJobs: ${[...jobs.keys()].join(', ')}`, ErinnerungEskalationsScheduler.name);
    } catch (e) {
      this.logger.error(`Failed to list CronJobs: ${e}`, ErinnerungEskalationsScheduler.name);
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS, { name: 'erinnerung-eskalation-check' })
  async handleCron() {
    try {
      // 1. Konfiguration laden (Story 4.3)
      const config = await this.queryBus.execute(new GetErinnerungKonfigurationQuery());
      const timeoutSeconds = config.eskalationsTimeoutSeconds || 300; // Default: 300s (5min) if 0 or undefined

      // 2. Threshold berechnen
      const now = new Date();
      const threshold = new Date(now.getTime() - timeoutSeconds * 1000);

      // Safety Check: Avoid "Invalid Date" errors
      if (Number.isNaN(threshold.getTime())) {
        this.logger.error(`Invalid threshold date calculated. Timeout: ${timeoutSeconds}`, ErinnerungEskalationsScheduler.name);
        return;
      }

      // 3. Überfällige finden
      const result = await this.repository.findOverdue(threshold);
      if (result.isFailure || !result.value) {
        if (result.isFailure) {
          this.logger.error(`Failed to find overdue reminders: ${result.error}`, ErinnerungEskalationsScheduler.name);
        }
        return;
      }

      const overdueReminders = result.value;
      if (overdueReminders.length === 0) {
        return;
      }

      this.logger.log(`Found ${overdueReminders.length} overdue reminders to process.`, ErinnerungEskalationsScheduler.name);

      // 4. Commands dispatchen (Sequentiell um DB Connection Pool Exhaustion zu vermeiden)
      let successCount = 0;
      let failureCount = 0;

      for (const erinnerung of overdueReminders) {
        const hasEskalationsPerson = !!erinnerung.eskalationsPersonId;
        const actionType = hasEskalationsPerson ? 'escalate' : 'intensify';

        try {
          this.logger.debug(`Processing reminder ${erinnerung.id} (action: ${actionType}, intensivierungsCount: ${erinnerung.intensivierungsCount})`, ErinnerungEskalationsScheduler.name);
          await this.commandBus.execute(new EskaliereErinnerungCommand(erinnerung.id.toString(), 'SYSTEM'));
          successCount++;
        } catch (err) {
          failureCount++;
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Processing failed for ${erinnerung.id} (${actionType}): ${msg}`, ErinnerungEskalationsScheduler.name);
        }
      }

      if (successCount > 0 || failureCount > 0) {
        this.logger.log(`Escalation batch complete: ${successCount} processed, ${failureCount} failed.`, ErinnerungEskalationsScheduler.name);
      }
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Error in escalation scheduler: ${error.message}`, ErinnerungEskalationsScheduler.name);
      } else {
        this.logger.error(`Error in escalation scheduler: ${String(error)}`, ErinnerungEskalationsScheduler.name);
      }
    }
  }
}
