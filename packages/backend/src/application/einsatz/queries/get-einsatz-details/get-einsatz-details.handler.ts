import type { IQueryHandler } from '@nestjs/cqrs';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Result } from '@domain/common/result';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import type { IEtbRepository } from '@domain/repositories/i-etb.repository';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EinsatzQueryMapper } from '@application/einsatz/mappers/einsatz-query.mapper';
import { EtbQueryMapper } from '@application/etb/mappers/etb-query.mapper';
import { LagekarteMapper } from '@application/lagekarte/mappers/lagekarte.mapper';
import type { EinsatzDetailsDto } from '@application/einsatz/dto/einsatz-details.dto';
import type { GetEinsatzDetailsQuery } from './get-einsatz-details.query';

/**
 * Query Handler für GetEinsatzDetailsQuery.
 *
 * Lädt einen Einsatz mit allen zugehörigen Aggregaten (ETB + Lagekarte)
 * und kombiniert sie zu einem EinsatzDetailsDto für effiziente Frontend-Kommunikation.
 *
 * **Business Rules:**
 * - Validiert einsatzId via EinsatzId.create() Value Object
 * - Einsatz MUSS existieren (sonst Result.ok(null) → Controller gibt 404)
 * - ETB und Lagekarte sind optional (können null sein)
 * - Alle 3 Repository-Calls werden sequenziell ausgeführt (keine Parallelisierung nötig)
 * - Repository Errors werden via Result.fail() behandelt
 *
 * **Warum null statt Error bei "not found":**
 * - "Einsatz nicht gefunden" ist kein technischer Fehler, sondern valides Business-Resultat
 * - Controller kann explizit prüfen: if (result.value === null) → return 404
 * - Echte Errors (z.B. DB Connection Failed) werden via Result.fail() zurückgegeben
 *
 * **Repository Interface Unterschiede (WICHTIG!):**
 * - IEinsatzRepository.findById() → Returns `Promise<Result<Einsatz | null>>` (Result Pattern!)
 * - IEtbRepository.findByEinsatzId() → Returns `Promise<EinsatztagebuchAggregate | null>` (KEIN Result!)
 * - ILagekarteRepository.findByEinsatzId() → Returns `Promise<LagekarteAggregate | null>` (KEIN Result!)
 *
 * **CQRS Read Side:**
 * - Query Handler ändert KEINEN State (Read-Only)
 * - Keine Events werden publiziert
 * - Reine Projektion: Domain Aggregates → DTOs
 * - Optimiert für Frontend-Use-Case: "Zeige Einsatz-Detail-View"
 *
 * **Fehlerbehandlung:**
 * - Repository Errors vom Einsatz-Repository → Result.fail() (z.B. DB Connection Failed)
 * - Repository Exceptions von ETB/Lagekarte → try-catch → Result.fail()
 * - Validation Errors von Value Objects → Result.fail() (z.B. ungültige ID)
 * - Not Found (Einsatz) → Result.ok(null)
 * - Not Found (ETB/Lagekarte) → etb/lagekarte = null im DTO
 *
 * @example
 * ```typescript
 * // Usage in Controller
 * const query = new GetEinsatzDetailsQuery(id);
 * const result = await handler.execute(query);
 *
 * if (result.isFailure) {
 *   throw new InternalServerErrorException(result.error);
 * }
 *
 * if (result.value === null) {
 *   throw new NotFoundException('Einsatz not found');
 * }
 *
 * // result.value.einsatz → EinsatzDto (IMMER vorhanden)
 * // result.value.etb → EtbDto | null
 * // result.value.lagekarte → LagekarteDto | null
 * return result.value;
 * ```
 */
@Injectable()
export class GetEinsatzDetailsQueryHandler implements IQueryHandler<GetEinsatzDetailsQuery, Result<EinsatzDetailsDto | null>> {
  private readonly logger = new Logger(GetEinsatzDetailsQueryHandler.name);

  constructor(
    @Inject('IEinsatzRepository')
    private readonly einsatzRepository: IEinsatzRepository,
    @Inject('IEtbRepository')
    private readonly etbRepository: IEtbRepository,
    @Inject('ILagekarteRepository')
    private readonly lagekarteRepository: ILagekarteRepository,
  ) {}

  /**
   * Führt die Query aus und gibt EinsatzDetailsDto oder null zurück.
   *
   * **Flow:**
   * 1. Validiere einsatzId via EinsatzId.create() Value Object
   * 2. Lade Einsatz via einsatzRepository.findById() (Result<T> Pattern!)
   * 3. Return Result.ok(null) wenn Einsatz nicht gefunden
   * 4. Lade ETB via etbRepository.findByEinsatzId() (Promise<T|null> Pattern - KEIN Result!)
   * 5. Lade Lagekarte via lagekarteRepository.findByEinsatzId() (Promise<T|null> Pattern - KEIN Result!)
   * 6. Mappe alle Aggregates zu DTOs
   * 7. Kombiniere zu EinsatzDetailsDto
   * 8. Behandle unerwartete Fehler via try-catch → Result.fail()
   *
   * **Wichtig:** Repository-Calls sind NICHT parallelisiert. Sequenzielle Ausführung
   * ist ausreichend, da die Query primär für initial page load verwendet wird (nicht
   * für Polling). Bei Bedarf könnte Promise.all() verwendet werden, aber das erhöht
   * die Komplexität (Error Handling) ohne signifikanten Performance-Gewinn.
   *
   * @param query - GetEinsatzDetailsQuery mit validierter einsatzId
   * @returns Result<EinsatzDetailsDto | null> - Success mit DTO oder null, Failure bei technischem Fehler
   */
  async execute(query: GetEinsatzDetailsQuery): Promise<Result<EinsatzDetailsDto | null>> {
    try {
      // 1. Validiere einsatzId via Value Object
      const einsatzIdResult = EinsatzId.create(query.einsatzId);
      if (einsatzIdResult.isFailure) {
        return Result.fail(einsatzIdResult.error ?? 'Ungültige Einsatz-ID');
      }

      // Type Narrowing: value ist garantiert vorhanden nach isFailure Check
      const einsatzId = einsatzIdResult.value;
      if (!einsatzId) {
        return Result.fail('Ungültige Einsatz-ID');
      }

      // 2. Lade Einsatz (Result<T> Pattern!)
      const einsatzResult = await this.einsatzRepository.findById(einsatzId);
      if (einsatzResult.isFailure) {
        return Result.fail(einsatzResult.error ?? 'Fehler beim Laden des Einsatzes');
      }

      const einsatz = einsatzResult.value;
      if (!einsatz) {
        // Not found → null, NOT error
        return Result.ok<EinsatzDetailsDto | null>(null);
      }

      // 3. Lade ETB (Promise<T|null> Pattern - KEIN Result!)
      const etbAggregate = await this.etbRepository.findByEinsatzId(einsatzId);
      const etbDto = etbAggregate ? EtbQueryMapper.toEtbDto(etbAggregate) : null;

      // 4. Lade Lagekarte (Promise<T|null> Pattern - KEIN Result!)
      const lagekarteAggregate = await this.lagekarteRepository.findByEinsatzId(einsatzId);
      const lagekarteDto = lagekarteAggregate ? LagekarteMapper.toDto(lagekarteAggregate) : null;

      // 5. Kombiniere zu EinsatzDetailsDto
      const dto: EinsatzDetailsDto = {
        einsatz: EinsatzQueryMapper.toEinsatzDto(einsatz),
        etb: etbDto,
        lagekarte: lagekarteDto,
      };

      return Result.ok<EinsatzDetailsDto | null>(dto);
    } catch (error) {
      // Structured Logging für Produktions-Debugging
      this.logger.error(`Unerwarteter Fehler beim Laden der Einsatz-Details: ${query.einsatzId}`, error instanceof Error ? error.stack : String(error));
      return Result.fail(`Unerwarteter Fehler beim Laden der Einsatz-Details: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
