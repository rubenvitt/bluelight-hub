import type { IQueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import { Result } from '@domain/common/result';
import type { StatusCountsResponseDto } from '@application/einsatz/dto/status-counts.dto';
import type { GetStatusCountsQuery } from './get-status-counts.query';

/**
 * Handler fuer GetStatusCountsQuery.
 *
 * Ruft die Anzahl der Einsaetze pro Status aus dem Repository ab
 * und gibt die Statistiken als DTO fuer die API-Response zurueck.
 *
 * **Verhalten:**
 * - Ruft repository.countByStatus() auf (parallel COUNT queries)
 * - Berechnet Gesamtanzahl (sum aller Status)
 * - Optional: Inkludiert archivierte Einsaetze (via Query Parameter)
 * - Mappt Repository-Result zu StatusCountsResponseDto
 * - Bei Repository-Fehler wird Result.fail() zurueckgegeben
 *
 * **Warum separate Query (nicht in findAll()):**
 * - Performance: COUNT() schneller als SELECT * + Array.length
 * - Separation of Concerns: Statistik != Datenabruf
 * - Use Case: Dashboard braucht nur Counts, nicht alle Einsaetze
 * - API Design: Dedicated Endpoint /einsatz/stats/status-counts
 *
 * **HINWEIS - Repository Implementation:**
 * Diese Implementation setzt voraus dass IEinsatzRepository.countByStatus() existiert.
 * Falls die Methode fehlt, muss sie dem Interface hinzugefuegt werden:
 *
 * ```typescript
 * // In IEinsatzRepository:
 * countByStatus(includeArchived: boolean): Promise<Result<{
 *   angelegt: number;
 *   inBearbeitung: number;
 *   abgeschlossen: number;
 *   archiviert: number;
 * }>>;
 * ```
 *
 * **Query Pattern (CQRS Read Side):**
 * - Read-Only Operation (keine Aggregate-Aenderung)
 * - Keine Events werden emittiert
 * - Direkter Repository-Zugriff (kein Command Bus)
 * - DTO-Transformation entkoppelt Domain von API
 *
 * @example
 * ```typescript
 * // Handler ausfuehren (ohne archivierte)
 * const handler = new GetStatusCountsQueryHandler(repository);
 * const query = new GetStatusCountsQuery();
 * const result = await handler.execute(query);
 *
 * if (result.isSuccess) {
 *   const stats = result.value!;
 *   console.log(`Total: ${stats.total}`);
 *   console.log(`Angelegt: ${stats.counts.angelegt}`);
 *   console.log(`Archiviert: ${stats.counts.archiviert}`); // 0
 * } else {
 *   console.error(result.error); // "Database connection failed"
 * }
 *
 * // Mit archivierten Einsaetzen
 * const queryWithArchived = new GetStatusCountsQuery(true);
 * const resultWithArchived = await handler.execute(queryWithArchived);
 * // resultWithArchived.value.counts.archiviert > 0
 * ```
 */
@Injectable()
export class GetStatusCountsQueryHandler implements IQueryHandler<GetStatusCountsQuery, Result<StatusCountsResponseDto>> {
  private readonly logger = new Logger(GetStatusCountsQueryHandler.name);

  constructor(
    @Inject('IEinsatzRepository')
    private readonly repository: IEinsatzRepository,
  ) {}

  /**
   * Fuehrt die Query aus und gibt die Status-Statistiken als DTO zurueck.
   *
   * **Ablauf:**
   * 1. Repository.countByStatus(includeArchived) aufrufen
   * 2. Result pruefen (bei Fehler sofort Result.fail() returnen)
   * 3. Gesamtanzahl berechnen (sum aller Status-Counts)
   * 4. StatusCountsResponseDto konstruieren
   * 5. Result.ok(dto) zurueckgeben
   *
   * **Fehlerbehandlung:**
   * - Repository-Fehler (DB Connection Failed) → Result.fail()
   * - Unerwartete Fehler (try-catch) → Result.fail()
   * - Zero-Counts sind valide (kein Fehler)
   *
   * **includeArchived Parameter:**
   * - false (default): counts.archiviert = 0, total = active einsaetze
   * - true: counts.archiviert > 0, total = alle einsaetze
   *
   * @param query - GetStatusCountsQuery mit includeArchived Flag
   * @returns Result<StatusCountsResponseDto> - Success mit Statistiken oder Failure mit Error Message
   */
  async execute(query: GetStatusCountsQuery): Promise<Result<StatusCountsResponseDto>> {
    try {
      // WICHTIG: countByStatus() muss im IEinsatzRepository Interface existieren!
      // Falls nicht vorhanden → Interface erweitern (siehe Handler JSDoc)
      const countsResult = await this.repository.countByStatus(query.includeArchived);

      // Pruefe Repository Result
      if (countsResult.isFailure) {
        return Result.fail<StatusCountsResponseDto>(countsResult.error ?? 'Failed to fetch status counts from repository');
      }

      // Type Narrowing: value ist garantiert vorhanden wenn isFailure === false
      const counts = countsResult.value;
      if (!counts) {
        // Fallback: Leere Counts (sollte nicht passieren aber Type-Safe)
        return Result.ok<StatusCountsResponseDto>({
          total: 0,
          counts: {
            angelegt: 0,
            inBearbeitung: 0,
            abgeschlossen: 0,
            archiviert: 0,
          },
        });
      }

      // Berechne Gesamtanzahl (sum aller Status)
      const total = counts.angelegt + counts.inBearbeitung + counts.abgeschlossen + counts.archiviert;

      // Konstruiere Response DTO
      const responseDto: StatusCountsResponseDto = {
        total,
        counts,
      };

      this.logger.log(`Status counts: Total ${total} (Angelegt: ${counts.angelegt}, InBearbeitung: ${counts.inBearbeitung}, Abgeschlossen: ${counts.abgeschlossen}, Archiviert: ${counts.archiviert})`);

      // Return Success mit DTO
      return Result.ok<StatusCountsResponseDto>(responseDto);
    } catch (error) {
      // Structured Logging fuer Produktions-Debugging
      this.logger.error('Unexpected error fetching status counts', error instanceof Error ? error.stack : String(error));
      const errorMessage = error instanceof Error ? error.message : 'Unexpected error while fetching status counts';
      return Result.fail<StatusCountsResponseDto>(errorMessage);
    }
  }
}
