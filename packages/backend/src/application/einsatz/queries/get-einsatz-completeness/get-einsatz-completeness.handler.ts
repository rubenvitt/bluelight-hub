import type { IQueryHandler } from '@nestjs/cqrs';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Result } from '@domain/common/result';
// biome-ignore lint/correctness/noUnusedImports: Required for DI at runtime
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { CompletenessResponseDto } from '@/application/einsatz/dto/completeness-response.dto';
import { EinsatzCompletenessCalculator } from '@/einsatz/utils/completeness.util';
import type { GetEinsatzCompletenessQuery } from './get-einsatz-completeness.query';

/**
 * Query Handler fuer GetEinsatzCompletenessQuery.
 *
 * Berechnet die Vollständigkeit eines Einsatzes basierend auf definierten
 * Feldern und deren Gewichtung.
 *
 * **Business Rules:**
 * - Validiert einsatzId via EinsatzId.create() Value Object
 * - Return Result.ok(null) wenn Einsatz nicht gefunden (kein Error!)
 * - Berechnet Vollständigkeits-Score mit EinsatzCompletenessCalculator
 * - Listet fehlende Felder mit Priorität und Handlungsempfehlungen
 * - MVP: Ohne Caching (kann später hinzugefügt werden)
 *
 * **Warum null statt Error bei "not found":**
 * - "Not found" ist kein technischer Fehler, sondern valides Business-Resultat
 * - Controller kann explizit pruefen: if (result.value === null) → return 404
 * - Echte Errors (z.B. DB Connection Failed) werden via Result.fail() zurueckgegeben
 *
 * **CQRS Read Side:**
 * - Query Handler aendert KEINEN State (Read-Only)
 * - Keine Events werden publiziert
 * - Reine Projektion: Domain Aggregate → CompletenessResponseDto
 *
 * **Vollständigkeits-Berechnung:**
 * - Jedes Feld hat eine Gewichtung (z.B. alarmstichwort: 30, alarmierungszeit: 25)
 * - Score = (erreichte Gewichtung / totale Gewichtung) * 100
 * - isComplete = true wenn Score === 100
 * - missingFields enthält Felder mit priority ('critical' | 'important' | 'optional')
 *
 * @example
 * ```typescript
 * // Usage in Controller
 * const query = new GetEinsatzCompletenessQuery(id, refresh);
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
 * return result.value; // CompletenessResponseDto
 * ```
 */
@Injectable()
export class GetEinsatzCompletenessQueryHandler implements IQueryHandler<GetEinsatzCompletenessQuery, Result<CompletenessResponseDto | null>> {
  private readonly logger = new Logger(GetEinsatzCompletenessQueryHandler.name);

  constructor(
    @Inject('IEinsatzRepository')
    private readonly repository: IEinsatzRepository,
  ) {}

  /**
   * Fuehrt die Query aus und gibt Vollständigkeitsinformationen oder null zurueck.
   *
   * **Flow:**
   * 1. Validiere einsatzId via EinsatzId.create() Value Object
   * 2. Rufe repository.findById(einsatzId) auf
   * 3. Return Result.ok(null) wenn nicht gefunden
   * 4. Berechne Vollständigkeit via EinsatzCompletenessCalculator.calculate()
   * 5. Transformiere zu CompletenessResponseDto
   * 6. Behandle unerwartete Fehler via try-catch → Result.fail()
   *
   * **Hinweis zu refresh Parameter:**
   * - MVP Implementation ignoriert refresh Parameter
   * - Caching kann in späterer Iteration hinzugefügt werden
   * - Service-Layer (einsatz.service.ts) hat bereits Caching-Implementierung als Referenz
   *
   * @param query - GetEinsatzCompletenessQuery mit validierter einsatzId und refresh flag
   * @returns Result<CompletenessResponseDto | null> - Success mit DTO oder null, Failure bei technischem Fehler
   */
  async execute(query: GetEinsatzCompletenessQuery): Promise<Result<CompletenessResponseDto | null>> {
    try {
      // Validiere einsatzId via Value Object
      const einsatzIdResult = EinsatzId.create(query.einsatzId);
      if (einsatzIdResult.isFailure) {
        return Result.fail(einsatzIdResult.error ?? 'Ungueltige einsatzId');
      }
      // Type Narrowing: value ist garantiert vorhanden nach isFailure Check
      const einsatzId = einsatzIdResult.value;
      if (!einsatzId) {
        return Result.fail('Ungueltige einsatzId');
      }

      // Repository Call
      const repoResult = await this.repository.findById(einsatzId);
      if (repoResult.isFailure) {
        return Result.fail(repoResult.error ?? 'Repository-Fehler');
      }

      // Not found → Return null (kein Error!)
      if (repoResult.value === null || repoResult.value === undefined) {
        return Result.ok<CompletenessResponseDto | null>(null);
      }

      // Berechne Vollständigkeit
      const aggregate = repoResult.value;

      // Convert Aggregate to Prisma-like object for Calculator
      // TODO: Calculator sollte direkt mit Aggregate arbeiten (Refactoring-Kandidat)
      // HINWEIS: Das Aggregate hat aktuell nur 'alarmstichwort', andere Felder fehlen noch
      const einsatzData = {
        alarmstichwort: aggregate.alarmstichwort,
        // alarmierungszeit ist im Aggregate noch nicht vorhanden (wird in späterer Epic hinzugefügt)
      };

      const completeness = EinsatzCompletenessCalculator.calculate(einsatzData);

      // Ensure all fields have suggestedAction (required by CompletenessResponseDto)
      const responseDto: CompletenessResponseDto = {
        score: completeness.score,
        isComplete: completeness.isComplete,
        missingFields: completeness.missingFields.map((field: import('@/application/einsatz/dto/einsatz-response.dto').MissingField) => ({
          field: field.field,
          fieldPath: field.fieldPath,
          priority: field.priority,
          message: field.message,
          suggestedAction: field.suggestedAction || field.message,
        })),
      };

      this.logger.debug(`Vollständigkeit berechnet für Einsatz ${query.einsatzId}: ${completeness.score}%`);

      return Result.ok<CompletenessResponseDto | null>(responseDto);
    } catch (error) {
      // Structured Logging fuer Produktions-Debugging
      this.logger.error(`Unexpected error calculating completeness for einsatz ${query.einsatzId}`, error instanceof Error ? error.stack : String(error));
      return Result.fail(`Unerwarteter Fehler beim Berechnen der Vollständigkeit: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
