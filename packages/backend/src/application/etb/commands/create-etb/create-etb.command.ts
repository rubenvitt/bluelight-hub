import { Result } from '@domain/common/result';

/**
 * Command zum Erstellen eines neuen Einsatztagebuchs für einen Einsatz.
 *
 * Diese Command initialisiert ein neues ETB mit:
 * - Auto-generierter EtbId
 * - Status = DRAFT
 * - Version = 1
 * - Leerer Einträge-Liste
 *
 * Warum Command Pattern: Entkoppelt Controller von Domain-Logic,
 * ermöglicht spätere Event-Sourcing-Migration ohne Controller-Änderungen.
 *
 * @example
 * ```typescript
 * const commandResult = CreateEtbCommand.create('clx1234567890abcdefghijk');
 * if (commandResult.isSuccess) {
 *   const etbId = await commandBus.execute(commandResult.value);
 * }
 * ```
 */
export class CreateEtbCommand {
  /**
   * Privater Konstruktor - erzwingt Verwendung der Factory-Methode.
   *
   * @param einsatzId - Eindeutige ID des Einsatzes (CUID2-Format)
   */
  private constructor(public readonly einsatzId: string) {}

  /**
   * Factory-Methode für CreateEtbCommand mit Validierung.
   *
   * Warum hier: Result<T>-Pattern für konsistente Fehlerbehandlung im gesamten
   * CQRS-Flow (Command → Handler → Controller). Validierung bei Command-Erstellung
   * verhindert ungültige Commands im System (Fail-Fast-Prinzip).
   *
   * @param einsatzId - ID des Einsatzes, für den das ETB erstellt wird
   * @returns Result mit validiertem Command oder Fehlermeldung
   */
  public static create(einsatzId: string): Result<CreateEtbCommand> {
    // Validation: einsatzId required
    if (!einsatzId || einsatzId.trim().length === 0) {
      return Result.fail('einsatzId is required');
    }

    return Result.ok(new CreateEtbCommand(einsatzId));
  }
}
