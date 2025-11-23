import { Injectable, Inject } from '@nestjs/common';
import type { IEtbRepository } from '@domain/repositories/i-etb.repository';
import { EtbId } from '@domain/value-objects/etb-id';
import { Result } from '@domain/common/result';
import { EtbQueryMapper, type EtbSnapshotDto } from '@application/etb/mappers';
import type { GetEtbHistoryQuery } from './get-etb-history.query';

/**
 * Handler fuer GetEtbHistoryQuery.
 *
 * Orchestriert das Laden der Versions-Historie eines ETBs ueber das Repository
 * und konvertiert die Domain-Snapshots zu DTOs fuer die API-Response.
 *
 * **CQRS Query-Side Pattern:**
 * - Read-Only: Aendert niemals Domain State
 * - Result<T>: Kein Exception-Throwing fuer vorhersagbare Fehler
 * - Leeres Array ist valide: Neues ETB hat noch keine Historie
 * - Mapper: Domain → DTO Transformation
 *
 * **Unterschied zu Command Handlers:**
 * - Commands: Validierung + Business Logic + State Mutation
 * - Queries: Nur Orchestration + Mapping (NO Business Logic)
 *
 * **Fehlerbehandlung:**
 * - [] = Keine Snapshots vorhanden (valide Response fuer neues ETB!)
 * - Repository Error → Result.fail('Fehler beim Laden der ETB-Historie')
 * - Invalid EtbId → Result.fail('Ungueltige ETB-ID')
 *
 * @example
 * ```typescript
 * const query = new GetEtbHistoryQuery('cuid2-etb-id');
 * const result = await handler.execute(query);
 *
 * if (result.isSuccess) {
 *   console.log('Snapshots:', result.value); // EtbSnapshotDto[]
 *   if (result.value.length === 0) {
 *     console.log('Keine Historie vorhanden (neues ETB)');
 *   }
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
@Injectable()
export class GetEtbHistoryQueryHandler {
  constructor(
    @Inject('IEtbRepository')
    private readonly etbRepository: IEtbRepository,
  ) {}

  /**
   * Fuehrt die Query aus und laedt die Versions-Historie eines ETBs.
   *
   * Diese Methode gibt ein leeres Array zurueck, wenn keine Snapshots existieren,
   * anstatt einen Fehler zu werfen. Das ist eine valide Response fuer ein
   * neu erstelltes ETB, das noch keine Mutationen hatte.
   *
   * **Orchestration Flow:**
   * 1. Validiere EtbId via Value Object
   * 2. Lade Snapshots via Repository (getHistory)
   * 3. Wenn leer → return Result.ok([]) (NICHT Fehler!)
   * 4. Sortiere Snapshots nach versionNumber ascending (aelteste zuerst)
   * 5. Map zu DTOs → return Result.ok(dtos)
   * 6. Bei Repository-Error → return Result.fail()
   *
   * **Sortierung:**
   * Die Snapshots werden nach versionNumber aufsteigend sortiert,
   * sodass die aelteste Version zuerst kommt. Das entspricht dem
   * natuerlichen Lesefluss fuer Audit-Trail Ansichten.
   *
   * **DTO Mapping:**
   * EtbQueryMapper.toSnapshotDto() konvertiert Domain-Snapshots
   * zu serialisierbaren DTOs mit primitiven Typen.
   *
   * @param query - Die Query mit der EtbId
   * @returns EtbSnapshotDto[] - Array von Snapshots (aelteste zuerst), oder Fehler
   */
  async execute(query: GetEtbHistoryQuery): Promise<Result<EtbSnapshotDto[]>> {
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

      // Step 2: Load Snapshots from Repository
      const snapshots = await this.etbRepository.getHistory(etbId);

      // Step 3: Handle empty case (no history - NOT an error!)
      if (!snapshots || snapshots.length === 0) {
        return Result.ok([]);
      }

      // Step 4: Sort by version number ascending (oldest first)
      const sortedSnapshots = [...snapshots].sort((a, b) => a.versionNumber - b.versionNumber);

      // Step 5: Map Snapshots to DTOs
      const dtos = sortedSnapshots.map((snapshot) => EtbQueryMapper.toSnapshotDto(snapshot));

      return Result.ok(dtos);
    } catch (_error) {
      // Step 6: Catch unexpected errors (e.g., database connection failure)
      return Result.fail('Fehler beim Laden der ETB-Historie');
    }
  }
}
