import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { CommandHandler } from '@nestjs/cqrs';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DeleteEinsatzCommand } from './delete-einsatz.command';
import { EinsatzNotFoundException, EinsatzValidationException, EinsatzBusinessRuleException, EinsatzPersistenceException } from '@domain/common/exceptions';

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
    @Inject('IEinsatzRepository')
    private readonly einsatzRepository: IEinsatzRepository,
  ) {}

  /**
   * Führt den DeleteEinsatzCommand aus.
   *
   * HINWEIS: Wirft IMMER EinsatzBusinessRuleException (NO-DELETE Policy).
   *
   * @param command - Validierter DeleteEinsatzCommand
   * @throws {EinsatzValidationException} Bei ungültiger Einsatz-ID
   * @throws {EinsatzNotFoundException} Wenn Einsatz nicht gefunden
   * @throws {EinsatzPersistenceException} Bei Datenbankfehlern
   * @throws {EinsatzBusinessRuleException} IMMER - NO-DELETE Policy
   */
  async execute(command: DeleteEinsatzCommand): Promise<void> {
    // Step 1: Validate EinsatzId format
    const einsatzIdResult = EinsatzId.create(command.einsatzId);
    if (einsatzIdResult.isFailure) {
      throw new EinsatzValidationException(einsatzIdResult.error ?? 'Ungültige Einsatz-ID', 'einsatzId', command.einsatzId);
    }
    const einsatzId = einsatzIdResult.value;
    if (!einsatzId) {
      this.logger.error('Unexpected null EinsatzId after successful validation');
      throw new EinsatzValidationException('Ungültige Einsatz-ID', 'einsatzId', command.einsatzId);
    }

    // Step 2: Load Aggregate to verify it exists
    const findResult = await this.einsatzRepository.findById(einsatzId);
    if (findResult.isFailure) {
      this.logger.error('Failed to load Einsatz for deletion check', {
        operation: 'deleteEinsatz',
        phase: 'load',
        errorType: 'EinsatzPersistenceException',
        error: findResult.error,
        einsatzId: command.einsatzId,
      });
      throw new EinsatzPersistenceException(findResult.error ?? 'Einsatz konnte nicht geladen werden', command.einsatzId);
    }

    const einsatz = findResult.value;
    if (!einsatz) {
      this.logger.warn('Einsatz not found for deletion', {
        operation: 'deleteEinsatz',
        phase: 'load',
        errorType: 'EinsatzNotFoundException',
        einsatzId: command.einsatzId,
      });
      throw new EinsatzNotFoundException(command.einsatzId);
    }

    // Step 3: Check canBeDeleted() - ALWAYS returns false (NO-DELETE Policy)
    const canDelete = einsatz.canBeDeleted();
    if (!canDelete) {
      // Log the deletion attempt for audit purposes
      this.logger.warn('Delete attempt rejected (NO-DELETE Policy)', {
        operation: 'deleteEinsatz',
        phase: 'businessRule',
        errorType: 'EinsatzBusinessRuleException',
        einsatzId: command.einsatzId,
        nummer: einsatz.nummer,
        status: einsatz.status.value,
      });

      // Throw explicit exception for NO-DELETE Policy
      throw new EinsatzBusinessRuleException('Einsätze können nicht gelöscht werden. Verwende Archivieren stattdessen.', command.einsatzId, 'noDeletePolicy');
    }

    // Step 4: This code is UNREACHABLE due to NO-DELETE Policy
    // canBeDeleted() ALWAYS returns false, so we never get here.
    // This is intentional - we keep the code structure for consistency
    // and future-proofing in case policy changes.

    this.logger.error('UNEXPECTED: canBeDeleted() returned true - this should never happen', {
      operation: 'deleteEinsatz',
      phase: 'businessRule',
      errorType: 'EinsatzBusinessRuleException',
      einsatzId: command.einsatzId,
    });
    throw new EinsatzBusinessRuleException('Unerwarteter Fehler bei der Löschung', command.einsatzId, 'noDeletePolicy');
  }
}
