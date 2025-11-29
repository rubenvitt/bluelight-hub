import { Injectable, Inject } from '@nestjs/common';
// biome-ignore lint/correctness/noUnusedImports: Required for DI at runtime
import type { IEtbRepository } from '@domain/repositories/i-etb.repository';
import { EtbId } from '@domain/value-objects/etb-id';
import { Result } from '@domain/common/result';
import { EtbQueryMapper } from '@application/etb/mappers/etb-query.mapper';
import type { EintragDto } from '@application/etb/mappers/etb-query.mapper';
import type { GetEintraegeQuery } from './get-eintraege.query';

/**
 * Handler fuer GetEintraegeQuery.
 *
 * Orchestriert das Laden von ETB-Eintraegen ueber das Repository und konvertiert
 * die Domain-Entities zu DTOs fuer die API-Response. Unterstuetzt optionale
 * Filterung von soft-deleted Eintraegen.
 *
 * **CQRS Query-Side Pattern:**
 * - Read-Only: Aendert niemals Domain State
 * - Result<T>: Kein Exception-Throwing fuer vorhersagbare Fehler
 * - Result.fail() wenn ETB nicht existiert (framework-agnostisch)
 * - Mapper: Domain -> DTO Transformation
 *
 * **Unterschied zu GetEtbQueryHandler:**
 * - GetEtbQuery: null ist valide Response (ETB existiert evtl. nicht)
 * - GetEintraegeQuery: Result.fail() (Eintraege ohne ETB haben keinen Kontext)
 * - Grund: Eintraege sind Child-Entities des ETB (Aggregate Boundary)
 *
 * **Fehlerbehandlung:**
 * - ETB not found -> Result.fail('Einsatztagebuch nicht gefunden')
 * - Repository Error -> Result.fail('Fehler beim Laden der ETB-Eintraege')
 * - Invalid EtbId -> Result.fail('Ungueltige ETB-ID')
 * - Empty entries array -> Result.ok([]) <- KEIN FEHLER, valide Response
 *
 * **Sortierung:**
 * Eintraege werden IMMER nach sequenceNumber aufsteigend sortiert,
 * da dies die chronologische Reihenfolge der Ereignisse widerspiegelt
 * (DRK-Compliance fuer Audit-Trail).
 *
 * @example
 * ```typescript
 * // Alle aktiven Eintraege eines ETB
 * const query1 = new GetEintraegeQuery('cm3abc123xyz');
 * const result1 = await handler.execute(query1);
 * // result1.value = [entry1, entry2] (nur aktive, sortiert)
 *
 * // Alle Eintraege inkl. geloeschter (Audit)
 * const query2 = new GetEintraegeQuery('cm3abc123xyz', true);
 * const result2 = await handler.execute(query2);
 * // result2.value = [entry1, deleted_entry, entry2] (alle, sortiert)
 *
 * // ETB existiert nicht
 * const query3 = new GetEintraegeQuery('nonexistent');
 * const result3 = await handler.execute(query3);
 * // result3.isFailure === true, result3.error === 'Einsatztagebuch nicht gefunden'
 *
 * // ETB ohne Eintraege
 * const query4 = new GetEintraegeQuery('empty-etb');
 * const result4 = await handler.execute(query4);
 * // result4.isSuccess === true
 * // result4.value === [] (leeres Array, KEIN Fehler!)
 * ```
 */
@Injectable()
export class GetEintraegeQueryHandler {
  constructor(
    @Inject('IEtbRepository')
    private readonly etbRepository: IEtbRepository,
  ) {}

  /**
   * Fuehrt die Query aus und laedt Eintraege eines ETB.
   *
   * Diese Methode gibt Result.fail() zurueck, wenn das ETB nicht existiert,
   * im Gegensatz zur GetEtbQuery (wo null gueltig ist). Das liegt daran,
   * dass Eintraege ohne ETB keinen Kontext haben.
   *
   * **Orchestration Flow:**
   * 1. Validiere etbId via Value Object
   * 2. Lade Aggregate via Repository
   * 3. Wenn null -> return Result.fail() (UNTERSCHIED zu GetEtb!)
   * 4. Wenn Aggregate -> Hole Eintraege (mit optionaler isDeleted-Filterung)
   * 5. Sortiere nach sequenceNumber aufsteigend (Audit-Anforderung)
   * 6. Map Eintraege zu DTOs -> return Result.ok(dtos)
   * 7. Bei Repository-Error -> return Result.fail()
   *
   * **Eintrag-Filterung:**
   * - includeDeleted=false: Nur aktive Eintraege (isDeleted === false)
   * - includeDeleted=true: Alle Eintraege (fuer Audit-Trail)
   * - Leeres Array: Valide Response (KEIN Fehler)
   *
   * **DTO Mapping:**
   * EtbQueryMapper.toEintragDto() konvertiert Domain Entity zu DTO
   * mit primitiven Typen fuer JSON-Serialisierung.
   *
   * @param query - Die Query mit EtbId und optionalem includeDeleted Flag
   * @returns Result.ok(EintragDto[]) bei Erfolg, Result.fail() wenn ETB nicht gefunden
   */
  async execute(query: GetEintraegeQuery): Promise<Result<EintragDto[]>> {
    try {
      // Step 1: Validate EtbId via Value Object
      const etbIdResult = EtbId.create(query.etbId);
      if (etbIdResult.isFailure) {
        return Result.fail(etbIdResult.error ?? 'Ungueltige ETB-ID');
      }

      const etbId = etbIdResult.value;
      if (!etbId) {
        return Result.fail('Ungueltige ETB-ID result');
      }

      // Step 2: Load Aggregate from Repository
      const aggregate = await this.etbRepository.findById(etbId);

      // Step 3: Handle null case - Return Result.fail() (framework-agnostisch)
      if (!aggregate) {
        return Result.fail('Einsatztagebuch nicht gefunden');
      }

      // Step 4: Get entries from aggregate
      let entries = aggregate.eintraege;

      // Step 5: Filter based on includeDeleted parameter
      if (!query.includeDeleted) {
        entries = entries.filter((e) => !e.isDeleted);
      }

      // Step 6: Sort by sequenceNumber ascending (audit requirement)
      entries = [...entries].sort((a, b) => a.sequenceNumber.value - b.sequenceNumber.value);

      // Step 7: Map to DTOs
      const dtos = entries.map(EtbQueryMapper.toEintragDto);

      return Result.ok(dtos);
    } catch (_error) {
      // Step 8: Catch unexpected errors (e.g., database connection failure)
      return Result.fail('Fehler beim Laden der ETB-Eintraege');
    }
  }
}
