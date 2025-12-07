import { Injectable, Inject } from '@nestjs/common';
import type { ILagekarteRepository } from '@domain/repositories';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { Result } from '@domain/common/result';
import type { GetLagekarteExistsQuery } from './get-lagekarte-exists.query';
import { LAGEKARTE_REPOSITORY } from '@infrastructure/di-tokens';

/**
 * Handler für GetLagekarteExistsQuery.
 *
 * Orchestriert die Prüfung ob eine Lagekarte existiert über das Repository.
 *
 * **CQRS Query-Side Pattern:**
 * - Read-Only: Ändert niemals Domain State
 * - Result<boolean> Wrapper: Konsistent mit allen anderen Query Handlers
 * - Fehlerbehandlung: Validierungsfehler werden als Result.fail() zurückgegeben
 * - Performance: Nutzt optimierte exists() Repository-Method
 *
 * **Result Pattern (AC4):**
 * - Gibt Result<boolean> zurück für erwartete Fehler (Validierung)
 * - Exceptions nur für unerwartete Fehler (DB-Fehler, Programming Errors)
 * - Konsistente API mit anderen Query Handlers
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
    @Inject(LAGEKARTE_REPOSITORY)
    private readonly lagekarteRepository: ILagekarteRepository,
  ) {}

  /**
   * Führt die Query aus und prüft, ob eine Lagekarte existiert.
   *
   * **Result Pattern (AC4):**
   * - Gibt Result<boolean> zurück für erwartete Fehler (Validierung)
   * - Exceptions nur für unerwartete Fehler (DB-Fehler, Programming Errors)
   *
   * **Orchestration Flow:**
   * 1. Validiere EinsatzId via Value Object
   * 2. Bei Validierungsfehler → Result.fail()
   * 3. Rufe repository.exists() auf
   * 4. Return Result.ok(boolean)
   * 5. Repository-Fehler → Exception (unerwarteter Fehler)
   *
   * **Fehlerbehandlung:**
   * - Invalid EinsatzId → Result.fail() (erwarteter Fehler)
   * - Repository-Error → Exception (unerwarteter Fehler, propagiert)
   * - Nicht-existierend → Result.ok(false) (valide Response)
   * - Existierend → Result.ok(true) (valide Response)
   *
   * @param query - Die Query mit der EinsatzId
   * @returns Result<boolean> - Success mit true/false oder Failure mit Error Message
   *
   * @example
   * ```typescript
   * const query = new GetLagekarteExistsQuery('einsatz-123');
   * const result = await handler.execute(query);
   *
   * if (result.isFailure) {
   *   throw new BadRequestException(result.error);
   * }
   *
   * if (result.value) {
   *   throw new AlreadyExistsError('Lagekarte existiert bereits');
   * }
   * ```
   */
  async execute(query: GetLagekarteExistsQuery): Promise<Result<boolean>> {
    // Step 1: Validate EinsatzId via Value Object
    const einsatzIdResult = EinsatzId.create(query.einsatzId);
    if (einsatzIdResult.isFailure) {
      return Result.fail(einsatzIdResult.error ?? 'Invalid Einsatz ID');
    }

    const einsatzId = einsatzIdResult.value;
    if (!einsatzId) {
      return Result.fail('Invalid Einsatz ID result');
    }

    // Step 2: Call repository.exists() and return Result.ok(boolean)
    // Repository-Fehler propagieren als Exception (unerwarteter Fehler)
    const exists = await this.lagekarteRepository.exists(einsatzId);
    return Result.ok(exists);
  }
}
