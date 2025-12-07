import type { IEinsatzRepository } from '@domain/repositories';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { CommandHandler } from '@nestjs/cqrs';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DeleteEinsatzCommand } from './delete-einsatz.command';
import { Result } from '@domain/common/result';
import { EINSATZ_REPOSITORY } from '@infrastructure/di-tokens';

/**
 * Handler für DeleteEinsatzCommand.
 *
 * WICHTIG: Dieser Handler gibt IMMER einen Fehler zurück.
 * Einsätze können gemäß DRK-Compliance (10-Jahre-Aufbewahrungspflicht)
 * NIEMALS physisch gelöscht werden. Verwende stattdessen ArchiveEinsatzCommand.
 *
 * **NO-DELETE Policy Begründung:**
 * - Gesetzliche Aufbewahrungspflicht: DRK muss Einsätze 10 Jahre archivieren
 * - Forensische Analyse: Gelöschte Einsätze können nicht mehr untersucht werden
 * - Audit Trail: Compliance-Anforderungen verlangen lückenlose Historie
 * - Statistische Auswertungen: Gelöschte Daten verfälschen Langzeit-Statistiken
 * - Rechtliche Absicherung: Bei Klagen/Untersuchungen müssen Einsätze nachweisbar sein
 *
 * **Alternative zu Deletion:**
 * - Nutze `archive()` um Einsätze aus aktiver Liste zu entfernen
 * - Archivierte Einsätze bleiben in DB aber sind immutable
 *
 * @see ArchiveEinsatzCommand (Story 4-2) für Status-Transition zu ARCHIVIERT
 */
@CommandHandler(DeleteEinsatzCommand)
@Injectable()
export class DeleteEinsatzHandler {
  private readonly logger = new Logger(DeleteEinsatzHandler.name);

  constructor(
    @Inject(EINSATZ_REPOSITORY)
    private readonly einsatzRepository: IEinsatzRepository,
  ) {}

  /**
   * Führt den DeleteEinsatzCommand aus.
   *
   * HINWEIS: Gibt IMMER Result.fail() zurück (NO-DELETE Policy).
   *
   * **Result Pattern (AC4):**
   * - Gibt Result<void> zurück (immer Failure für NO-DELETE Policy)
   * - Exceptions nur für unerwartete Fehler (DB-Fehler, Programming Errors)
   *
   * @param command - Validierter DeleteEinsatzCommand
   * @returns Result<void> - Immer Failure mit NO-DELETE Policy Meldung
   */
  async execute(command: DeleteEinsatzCommand): Promise<Result<void>> {
    // Step 1: Validate EinsatzId format
    const einsatzIdResult = EinsatzId.create(command.einsatzId);
    if (einsatzIdResult.isFailure) {
      return Result.fail(einsatzIdResult.error ?? 'Ungültige Einsatz-ID'); // ✅ Result Pattern
    }
    const einsatzId = einsatzIdResult.value;
    if (!einsatzId) {
      this.logger.error('Unexpected null EinsatzId after successful validation');
      return Result.fail('Ungültige Einsatz-ID'); // ✅ Result Pattern
    }

    // Step 2: Load Aggregate to verify it exists
    const findResult = await this.einsatzRepository.findById(einsatzId);
    if (findResult.isFailure) {
      this.logger.error('Failed to load Einsatz for deletion check', {
        operation: 'deleteEinsatz',
        phase: 'load',
        error: findResult.error,
        einsatzId: command.einsatzId,
      });
      return Result.fail(findResult.error ?? 'Einsatz konnte nicht geladen werden'); // ✅ Result Pattern
    }

    const einsatz = findResult.value;
    if (!einsatz) {
      this.logger.warn('Einsatz not found for deletion', {
        operation: 'deleteEinsatz',
        phase: 'load',
        einsatzId: command.einsatzId,
      });
      return Result.fail('Einsatz nicht gefunden'); // ✅ Result Pattern
    }

    // Step 3: Check canBeDeleted() - ALWAYS returns false (NO-DELETE Policy)
    const canDelete = einsatz.canBeDeleted();
    if (!canDelete) {
      // Log the deletion attempt for audit purposes
      this.logger.warn('Delete attempt rejected (NO-DELETE Policy)', {
        operation: 'deleteEinsatz',
        phase: 'businessRule',
        einsatzId: command.einsatzId,
        nummer: einsatz.nummer,
        status: einsatz.status.value,
      });

      // Return failure for NO-DELETE Policy
      return Result.fail('Einsätze können nicht gelöscht werden. Verwende Archivieren stattdessen.'); // ✅ Result Pattern
    }

    // Step 4: This code is UNREACHABLE due to NO-DELETE Policy
    // canBeDeleted() ALWAYS returns false, so we never get here.
    // This is intentional - we keep the code structure for consistency
    // and future-proofing in case policy changes.

    this.logger.error('UNEXPECTED: canBeDeleted() returned true - this should never happen', {
      operation: 'deleteEinsatz',
      phase: 'businessRule',
      einsatzId: command.einsatzId,
    });
    return Result.fail('Unerwarteter Fehler bei der Löschung'); // ✅ Result Pattern
  }
}
