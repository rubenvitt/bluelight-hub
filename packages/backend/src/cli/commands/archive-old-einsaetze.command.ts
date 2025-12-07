import { Injectable, Logger } from '@nestjs/common';
// biome-ignore lint/style/useImportType: ArchiveOldEinsaetzeHandler needed for DI at runtime
import { ArchiveOldEinsaetzeHandler } from '@application/einsatz/commands/archive-old-einsaetze';
import { ArchiveOldEinsaetzeCommand as ArchiveCommand } from '@application/einsatz/commands/archive-old-einsaetze';

/**
 * CLI Command für Bulk-Archivierung alter Einsätze.
 *
 * Dieser Command ermöglicht die Archivierung von Einsätzen gemäß
 * DRK 10-Jahres-Aufbewahrungspflicht über die Kommandozeile.
 *
 * **Features:**
 * - Dry-Run Modus (default: aktiviert)
 * - Batch Processing (100 Einsätze pro Batch)
 * - Detailliertes Reporting
 * - Safety-First Ansatz
 *
 * **Verwendung:**
 * ```bash
 * # Dry-run (Preview ohne Archivierung)
 * pnpm cli:archive --user admin-id
 *
 * # Actual archival
 * pnpm cli:archive --user admin-id --execute
 *
 * # Mit custom Threshold
 * pnpm cli:archive --user admin-id --execute --years 5
 * ```
 */
@Injectable()
export class ArchiveOldEinsaetzeCliCommand {
  private readonly logger = new Logger(ArchiveOldEinsaetzeCliCommand.name);

  constructor(private readonly handler: ArchiveOldEinsaetzeHandler) {}

  /**
   * Führt Bulk-Archivierung basierend auf CLI-Argumenten aus.
   *
   * **Argument-Parsing:**
   * - `--user <id>`: User ID für Audit Trail (Required)
   * - `--execute`: Führt Archivierung tatsächlich aus (default: dry-run)
   * - `--years <n>`: Alter in Jahren (default: 10)
   *
   * @param args - CLI-Argumente
   */
  async run(args: string[]): Promise<void> {
    const options = this.parseArgs(args);

    if (!options.user) {
      throw new Error('Fehlendes Required Argument: --user <id>');
    }

    this.logger.log('Starting bulk archive operation...');
    this.logger.log(`Mode: ${options.dryRun ? 'DRY-RUN' : 'LIVE EXECUTION'}`);
    this.logger.log(`Years Threshold: ${options.years}`);
    this.logger.log(`Archived By: ${options.user}`);

    // Create command
    const commandResult = ArchiveCommand.create({
      archivedBy: options.user,
      dryRun: options.dryRun,
      olderThanYears: options.years,
    });

    if (commandResult.isFailure) {
      this.logger.error(`Invalid command: ${commandResult.error}`);
      throw new Error(`Command Validierung fehlgeschlagen: ${commandResult.error}`);
    }

    // Execute handler - value is guaranteed after isFailure check above
    const command = commandResult.value;
    if (!command) {
      throw new Error('Command Validierung fehlgeschlagen: Unerwarteter null-Wert');
    }
    const result = await this.handler.execute(command);

    if (result.isFailure) {
      this.logger.error(`Archive failed: ${result.error}`);
      throw new Error(`Archivierung fehlgeschlagen: ${result.error}`);
    }

    const resultValue = result.value;
    if (!resultValue) {
      throw new Error('Archivierung fehlgeschlagen: Unerwarteter null-Wert');
    }
    const { eligible, archived, failed, dryRun } = resultValue;

    // Print results
    this.printResults(eligible, archived, failed, dryRun);
  }

  /**
   * Parst CLI-Argumente in Options-Objekt.
   *
   * **Warum manuelles Parsing:**
   * Da das Projekt kein nest-commander verwendet, parsen wir
   * die Argumente manuell im einfachen Key-Value-Format.
   */
  private parseArgs(args: string[]): { user?: string; dryRun: boolean; years: number } {
    const options = { user: undefined as string | undefined, dryRun: true, years: 10 };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--user' && nextArg) {
        options.user = nextArg;
        i++; // Skip next arg
      } else if (arg === '--execute') {
        options.dryRun = false;
      } else if (arg === '--years' && nextArg) {
        const parsed = parseInt(nextArg, 10);
        if (!Number.isNaN(parsed)) {
          options.years = parsed;
        }
        i++; // Skip next arg
      }
    }

    return options;
  }

  /**
   * Gibt formatierte Ergebnisse in Konsole aus.
   *
   * **Warum deutsche Ausgabe:**
   * Die CLI wird von DRK-Administratoren verwendet (deutsche Benutzer).
   */
  private printResults(eligible: number, archived: number, failed: Array<{ id: string; error: string }>, dryRun: boolean): void {
    console.log('\n========================================');
    console.log('BULK ARCHIVE RESULT');
    console.log('========================================');
    console.log(`Mode:        ${dryRun ? 'DRY-RUN (keine Änderungen)' : 'LIVE'}`);
    console.log(`Eligible:    ${eligible} Einsätze`);
    console.log(`Archived:    ${archived} Einsätze`);
    console.log(`Failed:      ${failed.length} Einsätze`);

    if (failed.length > 0) {
      console.log('\nFailed Details:');
      for (const f of failed) {
        console.log(`  - ${f.id}: ${f.error}`);
      }
    }

    if (dryRun && eligible > 0) {
      console.log('\n⚠️  DRY-RUN Mode: Keine Änderungen wurden vorgenommen.');
      console.log('    Führen Sie den Befehl mit --execute aus um zu archivieren.');
    } else if (!dryRun && archived > 0) {
      console.log(`\n✅ ${archived} Einsätze erfolgreich archiviert.`);
    }

    console.log('========================================\n');
  }
}
