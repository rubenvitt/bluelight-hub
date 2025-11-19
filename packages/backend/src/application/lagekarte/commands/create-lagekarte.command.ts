import { Result } from '@domain/common/result';

/**
 * Command zum Erstellen einer neuen Lagekarte für einen Einsatz.
 *
 * Diese Command unterstützt optionales initialPoi, um Lagekarte + ersten POI
 * atomar zu erstellen (verhindert leere Lagekarten in der DB).
 *
 * Warum Command Pattern: Entkoppelt Controller von Domain-Logic,
 * ermöglicht spätere Event-Sourcing-Migration ohne Controller-Änderungen.
 */
export class CreateLagekarteCommand {
  /**
   * Privater Konstruktor - erzwingt Verwendung der Factory-Methode.
   *
   * @param einsatzId - Eindeutige ID des Einsatzes (Nanoid, 21 Zeichen)
   * @param initialPoi - Optionaler erster POI für atomare Lagekarte-Erstellung.
   *                     Ermöglicht Single-Request-Erstellung mit initialer Position.
   */
  private constructor(
    public readonly einsatzId: string,
    public readonly initialPoi?: {
      name: string;
      coordinate: { lat: number; lng: number } | { mgrs: string };
      category: string;
    },
  ) {}

  /**
   * Factory-Methode für CreateLagekarteCommand mit Validierung.
   *
   * Warum hier: Result<T>-Pattern für konsistente Fehlerbehandlung im gesamten
   * CQRS-Flow (Command → Handler → Controller). Validierung bei Command-Erstellung
   * verhindert ungültige Commands im System (Fail-Fast-Prinzip).
   *
   * @param einsatzId - ID des Einsatzes, für den die Lagekarte erstellt wird
   * @param initialPoi - Optionaler initialer POI für atomare Erstellung
   * @returns Result mit validiertem Command oder Fehlermeldung
   */
  public static create(
    einsatzId: string,
    initialPoi?: {
      name: string;
      coordinate: { lat: number; lng: number } | { mgrs: string };
      category: string;
    },
  ): Result<CreateLagekarteCommand> {
    // Validation: einsatzId required
    if (!einsatzId || einsatzId.trim().length === 0) {
      return Result.fail('einsatzId is required');
    }

    // Validation: initialPoi fields if provided
    if (initialPoi) {
      if (!initialPoi.name || initialPoi.name.trim().length === 0) {
        return Result.fail('initialPoi.name is required when initialPoi is provided');
      }
      if (!initialPoi.coordinate) {
        return Result.fail('initialPoi.coordinate is required');
      }
      if (!initialPoi.category || initialPoi.category.trim().length === 0) {
        return Result.fail('initialPoi.category is required when initialPoi is provided');
      }
    }

    return Result.ok(new CreateLagekarteCommand(einsatzId, initialPoi));
  }
}
