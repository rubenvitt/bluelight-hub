import { Injectable, Inject } from '@nestjs/common';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { GetLagekarteExistsQuery } from './get-lagekarte-exists.query';

/**
 * Handler für GetLagekarteExistsQuery.
 *
 * Orchestriert die Prüfung ob eine Lagekarte existiert über das Repository.
 * Dies ist die einfachste aller Queries - nur ein boolean Return-Wert.
 *
 * **CQRS Query-Side Pattern:**
 * - Read-Only: Ändert niemals Domain State
 * - KEIN Result<T> Wrapper: Gibt boolean direkt zurück
 * - Exception-Throwing: Repository-Fehler werden propagiert
 * - Performance: Nutzt optimierte exists() Repository-Method
 *
 * **Unterschied zu anderen Query Handlers:**
 * - GetLagekarteQueryHandler: Result<LagekarteDto | null> (null ist valide)
 * - GetPoisQueryHandler: Result<PoiDto[]> (empty array ist valide)
 * - GetLagekarteExistsQueryHandler: boolean (keine Fehlerbehandlung)
 *
 * **Warum kein Result<boolean> Wrapper:**
 * - Existenz-Check ist binär: true oder false
 * - Keine komplexen Fehler-States wie bei Aggregate-Loading
 * - Repository-Fehler sind unexpected (Infrastruktur-Problem) → Exception
 * - Einfachere API für Caller (kein Result unwrapping)
 *
 * **Performance Optimization:**
 * exists() ist schneller als findByEinsatzId():
 * - SQL: EXISTS/COUNT statt SELECT *
 * - Keine Row-Materialization
 * - Bessere Query-Plans bei vielen Lagekartenabfragen
 *
 * @example
 * ```typescript
 * // Lazy Creation Pattern
 * const query = new GetLagekarteExistsQuery('einsatz-123');
 * const exists = await handler.execute(query);
 *
 * if (exists) {
 *   throw new AlreadyExistsError('Lagekarte existiert bereits');
 * }
 *
 * const lagekarte = LagekarteAggregate.create(...);
 * await repository.save(lagekarte);
 * ```
 */
@Injectable()
export class GetLagekarteExistsQueryHandler {
  constructor(
    @Inject('ILagekarteRepository')
    private readonly lagekarteRepository: ILagekarteRepository,
  ) {}

  /**
   * Führt die Query aus und prüft, ob eine Lagekarte existiert.
   *
   * Diese Methode gibt ein einfaches boolean zurück (kein Result<T>),
   * da "existiert/existiert nicht" keine Fehlerbehandlung benötigt.
   * Repository-Fehler werden weitergegeben (als Exception).
   *
   * **Orchestration Flow:**
   * 1. Validiere EinsatzId via Value Object (throws bei Invalid)
   * 2. Rufe repository.exists() auf
   * 3. Return boolean direkt (kein Result Wrapper)
   * 4. Repository-Fehler → Exception (nicht gefangen)
   *
   * **Fehlerbehandlung:**
   * - Invalid EinsatzId → Wirft Error (fail-fast)
   * - Repository-Error → Wirft Error (nicht gefangen, propagiert)
   * - Nicht-existierend → false (KEIN Fehler, valide Response)
   * - Existierend → true (valide Response)
   *
   * **Keine try-catch:**
   * Im Gegensatz zu anderen Query Handlers fängt diese Methode
   * KEINE Errors. Repository-Fehler sollen als Exception propagiert
   * werden, da sie unexpected sind (Infrastruktur-Problem).
   *
   * @param query - Die Query mit der EinsatzId
   * @returns true wenn Lagekarte existiert, false sonst
   * @throws Error wenn EinsatzId ungültig ist
   * @throws Error wenn Repository-Zugriff fehlschlägt
   *
   * @example
   * ```typescript
   * const query = new GetLagekarteExistsQuery('einsatz-123');
   * const exists = await handler.execute(query);
   * // exists === true | false
   *
   * // Guard Clause Usage
   * if (await handler.execute(query)) {
   *   throw new AlreadyExistsError('Lagekarte existiert bereits');
   * }
   * ```
   */
  async execute(query: GetLagekarteExistsQuery): Promise<boolean> {
    // Step 1: Validate EinsatzId via Value Object
    const einsatzIdResult = EinsatzId.create(query.einsatzId);
    if (einsatzIdResult.isFailure) {
      throw new Error(einsatzIdResult.error!);
    }

    const einsatzId = einsatzIdResult.value;
    if (!einsatzId) {
      throw new Error('Invalid Einsatz ID result');
    }

    // Step 2: Call repository.exists() and return boolean directly
    return await this.lagekarteRepository.exists(einsatzId);
  }
}
