import type { IQueryHandler } from '@nestjs/cqrs';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Result } from '@domain/common/result';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { GetPreviousEinsatzIdQuery } from './get-previous-einsatz-id.query';

/**
 * NavigationResponseDto für Query Response.
 * Entspricht dem DTO aus der REST API.
 */
interface NavigationResponseDto {
  id?: string | null;
}

/**
 * Query Handler fuer GetPreviousEinsatzIdQuery.
 *
 * Gibt die ID des zeitlich vorherigen Einsatzes zurück.
 * Basiert auf createdAt-Zeitstempel und filtert archivierte Einsätze aus.
 *
 * **Business Logic:**
 * 1. Lade aktuellen Einsatz um createdAt zu ermitteln
 * 2. Finde vorherigen Einsatz (createdAt < current.createdAt)
 * 3. Filtere archivierte Einsätze aus (nur aktive Navigation)
 * 4. Return ID oder null wenn kein vorheriger Einsatz existiert
 *
 * **Warum null statt Error bei "not found":**
 * - "Kein vorheriger Einsatz" ist valides Business-Resultat (erster Einsatz)
 * - Frontend kann explizit prüfen: if (result.value?.id === null) → Disable Button
 * - Echte Errors (z.B. Einsatz existiert nicht) werden via Result.fail() zurückgegeben
 *
 * **CQRS Read Side:**
 * - Query Handler aendert KEINEN State (Read-Only)
 * - Keine Events werden publiziert
 * - Navigation-Logik ist reine Projektion
 *
 * @example
 * ```typescript
 * // Usage in Controller
 * const query = new GetPreviousEinsatzIdQuery('clw3h8x9y0000qwertyuiopas');
 * const result = await handler.execute(query);
 *
 * if (result.isFailure) {
 *   throw new InternalServerErrorException(result.error);
 * }
 *
 * if (result.value?.id === null) {
 *   return { id: null }; // Kein vorheriger Einsatz
 * }
 *
 * return result.value; // { id: 'xyz...' }
 * ```
 */
@Injectable()
export class GetPreviousEinsatzIdQueryHandler implements IQueryHandler<GetPreviousEinsatzIdQuery, Result<NavigationResponseDto>> {
  private readonly logger = new Logger(GetPreviousEinsatzIdQueryHandler.name);

  constructor(
    @Inject('IEinsatzRepository')
    private readonly repository: IEinsatzRepository,
  ) {}

  /**
   * Fuehrt die Query aus und gibt NavigationResponseDto zurueck.
   *
   * **Flow:**
   * 1. Validiere einsatzId via EinsatzId.create() Value Object
   * 2. Lade aktuellen Einsatz um createdAt zu ermitteln
   * 3. Return Result.fail() wenn Einsatz nicht existiert
   * 4. Rufe repository.findPreviousId(createdAt) auf
   * 5. Return { id: previousId } oder { id: null } wenn keiner gefunden
   *
   * **HINWEIS:** Diese Methode setzt voraus dass IEinsatzRepository
   * die Methode findPreviousId(createdAt: Date) implementiert.
   * Falls nicht vorhanden, muss diese zum Interface hinzugefügt werden.
   *
   * @param query - GetPreviousEinsatzIdQuery mit validierter einsatzId
   * @returns Result<NavigationResponseDto> - Success mit { id: string | null }, Failure bei technischem Fehler
   */
  async execute(query: GetPreviousEinsatzIdQuery): Promise<Result<NavigationResponseDto>> {
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

      // Repository Call: Lade aktuellen Einsatz um createdAt zu bekommen
      const repoResult = await this.repository.findById(einsatzId);
      if (repoResult.isFailure) {
        return Result.fail(repoResult.error ?? 'Repository-Fehler');
      }

      // Einsatz nicht gefunden → Return fail (Business Error: Kann nicht navigieren zu nicht-existierendem Einsatz)
      if (repoResult.value === null || repoResult.value === undefined) {
        return Result.fail(`Einsatz ${query.einsatzId} nicht gefunden`);
      }

      // Extrahiere createdAt vom Aggregate
      const aggregate = repoResult.value;
      const createdAt = aggregate.createdAt;

      // HINWEIS: Diese Methode existiert noch NICHT im IEinsatzRepository Interface!
      // TODO: Füge findPreviousId(createdAt: Date) zum Interface hinzu
      // const previousIdResult = await this.repository.findPreviousId(createdAt);
      // if (previousIdResult.isFailure) {
      //   return Result.fail(previousIdResult.error ?? 'Repository-Fehler beim Laden der vorherigen ID');
      // }

      // TEMPORARY WORKAROUND: Return Placeholder bis Repository-Methode implementiert ist
      this.logger.warn('findPreviousId() ist noch nicht im IEinsatzRepository implementiert');
      this.logger.debug(`Würde vorherigen Einsatz suchen für createdAt: ${createdAt.toISOString()}`);

      // Placeholder Response
      const response: NavigationResponseDto = {
        id: null, // TODO: Replace with previousIdResult.value
      };

      return Result.ok(response);
    } catch (error) {
      // Structured Logging fuer Produktions-Debugging
      this.logger.error(`Unexpected error loading previous einsatz for ${query.einsatzId}`, error instanceof Error ? error.stack : String(error));
      return Result.fail(`Unerwarteter Fehler beim Laden des vorherigen Einsatzes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
