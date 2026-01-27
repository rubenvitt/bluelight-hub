/**
 * Command zum Eskalieren einer überfälligen Erinnerung.
 *
 * **Use Case:**
 * - CronJob stellt Überfälligkeit fest und triggert Eskalation
 * - Manuelle Eskalation durch User (optional, vorerst system-only)
 */
export class EskaliereErinnerungCommand {
  constructor(
    public readonly erinnerungId: string,
    public readonly eskaliertVon?: string,
  ) {}
}
