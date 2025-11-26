import { Injectable, Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { Result } from '@domain/common/result';
import type { PoiDto } from '@application/lagekarte/dtos/poi.dto';
import { PoiMapper } from '@application/lagekarte/mappers/poi.mapper';
import { GetPoisQuery } from './get-pois.query';

/**
 * Handler für GetPoisQuery.
 *
 * Orchestriert das Laden von POIs über das Repository und konvertiert
 * die Domain-Entities zu DTOs für die API-Response. Optional filtert
 * der Handler nach Kategorie (z.B. nur Einsatzstellen).
 *
 * **CQRS Query-Side Pattern:**
 * - Read-Only: Ändert niemals Domain State
 * - Result<T>: Kein Exception-Throwing für vorhersagbare Fehler
 * - Error wenn Lagekarte nicht existiert (NICHT null!)
 * - Mapper: Domain → DTO Transformation
 *
 * **Unterschied zu GetLagekarteQueryHandler:**
 * - GetLagekarteQuery: null ist valide Response (Lagekarte existiert nicht)
 * - GetPoisQuery: null ist ERROR (POIs ohne Lagekarte haben keinen Kontext)
 * - Grund: POIs sind Child-Entities der Lagekarte (Aggregate Boundary)
 *
 * **Fehlerbehandlung:**
 * - Lagekarte not found → Result.fail('Lagekarte not found') ← FEHLER!
 * - Repository Error → Result.fail('Failed to load POIs')
 * - Invalid LagekarteId → Result.fail('Invalid Lagekarte ID')
 * - Empty POI array → Result.ok([]) ← KEIN FEHLER, valide Response
 *
 * **Warum "Lagekarte not found" ein Fehler ist:**
 * POIs ohne Lagekarte haben keinen Kontext:
 * - Zu welchem Einsatz gehören sie?
 * - Welche zeitliche Gültigkeit haben sie?
 * - Wer darf sie sehen/bearbeiten?
 * → Daher MUSS die Lagekarte existieren (fail-fast)
 *
 * @example
 * ```typescript
 * // Alle POIs einer Lagekarte
 * const query1 = new GetPoisQuery('lagekarte-123');
 * const result1 = await handler.execute(query1);
 * // result1.value = [poi1, poi2, poi3] (alle POIs)
 *
 * // Nur Einsatzstellen
 * const query2 = new GetPoisQuery('lagekarte-123', 'EINSATZSTELLE');
 * const result2 = await handler.execute(query2);
 * // result2.value = [poi1, poi3] (nur EINSATZSTELLE)
 *
 * // Lagekarte existiert nicht
 * const query3 = new GetPoisQuery('nonexistent');
 * const result3 = await handler.execute(query3);
 * // result3.isFailure === true
 * // result3.error === 'Lagekarte not found'
 *
 * // Lagekarte ohne POIs
 * const query4 = new GetPoisQuery('empty-lagekarte');
 * const result4 = await handler.execute(query4);
 * // result4.isSuccess === true
 * // result4.value === [] (leeres Array, KEIN Fehler!)
 * ```
 */
@Injectable()
@QueryHandler(GetPoisQuery)
export class GetPoisQueryHandler implements IQueryHandler<GetPoisQuery, Result<PoiDto[]>> {
  constructor(
    @Inject('ILagekarteRepository')
    private readonly lagekarteRepository: ILagekarteRepository,
  ) {}

  /**
   * Führt die Query aus und lädt POIs einer Lagekarte.
   *
   * Diese Methode gibt einen Fehler zurück, wenn die Lagekarte nicht
   * existiert, im Gegensatz zur GetLagekarteQuery (wo null gültig ist).
   * Das liegt daran, dass POIs ohne Lagekarte keinen Kontext haben.
   *
   * **Orchestration Flow:**
   * 1. Validiere LagekarteId via Value Object
   * 2. Lade Aggregate via Repository
   * 3. Wenn null → return Result.fail() (FEHLER!)
   * 4. Wenn Aggregate → Hole POIs (mit optionaler Kategorie-Filterung)
   * 5. Map POIs zu DTOs → return Result.ok(dtos)
   * 6. Bei Repository-Error → return Result.fail()
   *
   * **POI-Filterung:**
   * - Keine Kategorie: Alle POIs via aggregate.pois
   * - Mit Kategorie: Gefilterte POIs via Array.filter()
   * - Leeres Array: Valide Response (KEIN Fehler)
   *
   * **DTO Mapping:**
   * PoiMapper.toDto() konvertiert MGRS-Koordinaten zusätzlich
   * zu Lat/Lng, damit das Frontend beide Formate nutzen kann.
   *
   * @param query - Die Query mit LagekarteId und optionaler Kategorie
   * @returns Array von PoiDto (leer wenn keine POIs gefunden), oder Fehler
   */
  async execute(query: GetPoisQuery): Promise<Result<PoiDto[]>> {
    try {
      // Step 1: Validate LagekarteId via Value Object
      const lagekarteIdResult = LagekarteId.create(query.lagekarteId);
      if (lagekarteIdResult.isFailure) {
        return Result.fail(lagekarteIdResult.error ?? 'Invalid Lagekarte ID');
      }

      const lagekarteId = lagekarteIdResult.value;
      if (!lagekarteId) {
        return Result.fail('Invalid Lagekarte ID result');
      }

      // Step 2: Load Aggregate from Repository
      const aggregate = await this.lagekarteRepository.findById(lagekarteId);

      // Step 3: Handle null case (Lagekarte not found - IS an error!)
      if (!aggregate) {
        return Result.fail('Lagekarte not found');
      }

      // Step 4: Get POIs (with optional category filter)
      let pois = aggregate.pois; // No copy needed - ReadonlyArray
      if (query.category !== undefined) {
        // Validate category BEFORE filtering (including empty strings)
        const categoryResult = PoiCategory.create(query.category);
        if (categoryResult.isFailure) {
          return Result.fail(`Invalid category: ${query.category}`);
        }
        pois = pois.filter((poi) => poi.category.value === categoryResult.value?.value);
      }

      // Step 5: Map POIs to DTOs
      const dtos = pois.map(PoiMapper.toDto);

      return Result.ok(dtos);
    } catch (_error) {
      // Step 6: Catch unexpected errors (e.g., database connection failure)
      return Result.fail('Failed to load POIs');
    }
  }
}
