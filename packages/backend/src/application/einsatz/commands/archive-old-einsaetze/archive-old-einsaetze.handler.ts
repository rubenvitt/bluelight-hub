import { Injectable, Logger, Inject } from '@nestjs/common';
import { Result } from '@domain/common/result';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import { UserId } from '@domain/value-objects/user-id';
import { EINSATZ_REPOSITORY } from '@infrastructure/di-tokens';
import type { ArchiveOldEinsaetzeCommand } from './archive-old-einsaetze.command';
import type { BulkArchiveResult } from './bulk-archive-result';
import type { Einsatz } from '@domain/aggregates/einsatz.aggregate';

/**
 * Handler für Bulk-Archivierung alter Einsätze (DRK 10-Jahres-Policy).
 *
 * Dieser Handler implementiert:
 * - Dry-Run Modus für sichere Vorschau
 * - Batch Processing (100 pro Transaktion) für Performance
 * - Failure Isolation (einzelne Fehler blockieren nicht den Batch)
 * - Outbox Pattern für atomare Event-Persistierung
 *
 * HINWEIS: Verwendet NICHT TransactionalCommandHandler da Bulk-Operation
 * eigenes Batch-basiertes Transaction Management benötigt.
 */
@Injectable()
export class ArchiveOldEinsaetzeHandler {
  private readonly logger = new Logger(ArchiveOldEinsaetzeHandler.name);
  private readonly BATCH_SIZE = 100;

  constructor(
    @Inject(EINSATZ_REPOSITORY)
    private readonly einsatzRepository: IEinsatzRepository,
  ) {}

  /**
   * Führt Bulk-Archivierung aus.
   *
   * Ablauf:
   * 1. Finde eligible Einsätze (ABGESCHLOSSEN + älter als Threshold)
   * 2. Bei dryRun: Return count ohne Änderungen
   * 3. Bei !dryRun: Archiviere in Batches, speichere Events atomar
   *
   * @param command - Archivierungs-Command mit archivedBy, dryRun, olderThan
   * @returns BulkArchiveResult mit Statistiken
   */
  async execute(command: ArchiveOldEinsaetzeCommand): Promise<Result<BulkArchiveResult>> {
    const startTime = Date.now();
    this.logger.log(`Starting bulk archive: dryRun=${command.dryRun}, olderThan=${command.olderThan.toISOString()}`);

    // 1. Find eligible Einsätze
    const eligibleResult = await this.einsatzRepository.findEligibleForArchival(command.olderThan);
    if (eligibleResult.isFailure) {
      this.logger.error(`Failed to find eligible Einsätze: ${eligibleResult.error}`);
      return Result.fail(eligibleResult.error ?? 'Failed to find eligible Einsätze');
    }

    // Value is guaranteed to exist after isFailure check
    const einsaetze = eligibleResult.value as Einsatz[];
    const result: BulkArchiveResult = {
      eligible: einsaetze.length,
      archived: 0,
      failed: [],
      dryRun: command.dryRun,
    };

    this.logger.log(`Found ${result.eligible} Einsätze eligible for archival`);

    // 2. Dry-run: Return count without changes
    if (command.dryRun) {
      this.logger.log(`DRY RUN: Would archive ${result.eligible} Einsätze`);
      return Result.ok(result);
    }

    // 3. Create UserId for archiving
    const userIdResult = UserId.create(command.archivedBy);
    if (userIdResult.isFailure) {
      return Result.fail(`Invalid archivedBy user ID: ${userIdResult.error}`);
    }
    // Value is guaranteed to exist after isFailure check
    const userId = userIdResult.value as UserId;

    // 4. Batch processing
    const batches = this.chunk(einsaetze, this.BATCH_SIZE);
    this.logger.log(`Processing ${batches.length} batches of max ${this.BATCH_SIZE} Einsätze`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      if (!batch) continue; // TypeScript guard (should never happen)

      this.logger.debug(`Processing batch ${batchIndex + 1}/${batches.length}`);

      for (const einsatz of batch) {
        await this.archiveEinsatz(einsatz, userId, result);
      }
    }

    const duration = Date.now() - startTime;
    this.logger.log(`Bulk archive completed: ${result.archived}/${result.eligible} archived, ` + `${result.failed.length} failed (${duration}ms)`);

    return Result.ok(result);
  }

  /**
   * Archiviert einzelnen Einsatz mit Error Isolation.
   *
   * Bei Fehler wird Einsatz zu failed Array hinzugefügt,
   * Verarbeitung anderer Einsätze wird fortgesetzt.
   */
  private async archiveEinsatz(einsatz: Einsatz, userId: UserId, result: BulkArchiveResult): Promise<void> {
    try {
      // 1. Archive aggregate (adds EinsatzArchivedEvent)
      const archiveResult = einsatz.archive(userId);
      if (archiveResult.isFailure) {
        result.failed.push({
          id: einsatz.id.value,
          error: archiveResult.error ?? 'Archive failed',
        });
        return;
      }

      // 2. Save aggregate (with events via outbox)
      const saveResult = await this.einsatzRepository.save(einsatz);
      if (saveResult.isFailure) {
        result.failed.push({
          id: einsatz.id.value,
          error: saveResult.error ?? 'Save failed',
        });
        return;
      }

      result.archived++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to archive Einsatz ${einsatz.id.value}: ${message}`);
      result.failed.push({ id: einsatz.id.value, error: message });
    }
  }

  /**
   * Teilt Array in Chunks der angegebenen Größe.
   */
  private chunk<T>(array: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, i) => array.slice(i * size, i * size + size));
  }
}
