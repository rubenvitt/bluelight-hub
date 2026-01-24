import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import type { ILogger } from '@domain/ports/i-logger.port';
import type { IErinnerungRepository } from '@domain/repositories/i-erinnerung.repository';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { ERINNERUNG_REPOSITORY, LOGGER } from '@infrastructure/di-tokens';
import type { ErinnerungResponseDto } from '../../dto/erinnerung-response.dto';
import { ERINNERUNG_ERROR_CODES } from '../../errors/erinnerung-error.codes';
import type { GetErinnerungenByEinsatzQuery } from './get-erinnerungen-by-einsatz.query';

/**
 * Handler zum Abrufen aller Erinnerungen eines Einsatzes.
 *
 * **CQRS Query-Side Pattern:**
 * - Read-Only: Ändert niemals Domain State
 * - Result<T>: Kein Exception-Throwing für vorhersagbare Fehler
 * - DTO Mapping: Erinnerung Entity → ErinnerungResponseDto
 *
 * **Story 1.1 AC2:**
 * "die Erinnerung erscheint in meiner Liste"
 */
@Injectable()
export class GetErinnerungenByEinsatzHandler {
  constructor(
    @Inject(ERINNERUNG_REPOSITORY)
    private readonly erinnerungRepository: IErinnerungRepository,
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {}

  /**
   * Führt die Query aus und gibt alle Erinnerungen eines Einsatzes zurück.
   *
   * **Ablauf:**
   * 1. EinsatzId Value Object erstellen (erwarteter Business-Fehler -> Result.fail)
   * 2. Erinnerungen aus Repository laden (unerwartete DB-Fehler -> Exception hochblubbern)
   * 3. Domain Entities zu DTOs mappen
   * 4. Result mit DTO-Liste zurückgeben
   *
   * **AC4 Compliance:**
   * - Erwartete Business-Fehler: Result.fail() (z.B. ungültige EinsatzId)
   * - Unerwartete Fehler: Exception hochblubbern (NestJS Exception Filter behandelt)
   *
   * @param query - Validierte Query mit einsatzId
   * @returns Result mit Liste von ErinnerungResponseDto
   */
  async execute(query: GetErinnerungenByEinsatzQuery): Promise<Result<ErinnerungResponseDto[]>> {
    // ════════════════════════════════════════════════════════════════════════
    // 1. EinsatzId Value Object erstellen (erwarteter Business-Fehler)
    // ════════════════════════════════════════════════════════════════════════
    const einsatzIdResult = EinsatzId.create(query.einsatzId);
    if (einsatzIdResult.isFailure || !einsatzIdResult.value) {
      return Result.fail<ErinnerungResponseDto[]>(einsatzIdResult.error ?? ERINNERUNG_ERROR_CODES.EINSATZ_ID_INVALID);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. Erinnerungen aus Repository laden
    // Unerwartete DB-Fehler blubbern hoch (NestJS Exception Filter behandelt)
    // ════════════════════════════════════════════════════════════════════════
    const erinnerungenResult = await this.erinnerungRepository.findByEinsatzId(einsatzIdResult.value);

    if (erinnerungenResult.isFailure) {
      this.logger.error(`Failed to load Erinnerungen for Einsatz ${query.einsatzId}: ${erinnerungenResult.error}`, 'GetErinnerungenByEinsatzHandler');
      return Result.fail<ErinnerungResponseDto[]>(erinnerungenResult.error ?? ERINNERUNG_ERROR_CODES.QUERY_FAILED);
    }

    const erinnerungen = erinnerungenResult.value ?? [];

    // ════════════════════════════════════════════════════════════════════════
    // 3. Domain Entities zu DTOs mappen
    // ════════════════════════════════════════════════════════════════════════
    const dtos: ErinnerungResponseDto[] = erinnerungen.map((erinnerung) => ({
      id: erinnerung.id.toString(),
      einsatzId: erinnerung.einsatzId.toString(),
      titel: erinnerung.titel.value,
      beschreibung: erinnerung.beschreibung ?? null,
      faelligAm: erinnerung.faelligAm.toISOString(),
      status: erinnerung.status.value,
      erstelltVon: erinnerung.erstelltVon.toString(),
      createdAt: erinnerung.createdAt.toISOString(),
      updatedAt: erinnerung.updatedAt.toISOString(),
      snoozeCount: erinnerung.snoozeCount,
      requiresNote: erinnerung.requiresNote,
      assignedToId: erinnerung.assignedToId?.toString() ?? null,
      // TODO(Story 3.3): assignedToName via User-Repository auflösen oder via JOIN in Repository laden
      assignedToName: null,
    }));

    // ════════════════════════════════════════════════════════════════════════
    // 4. Audit-Trail loggen
    // ════════════════════════════════════════════════════════════════════════
    this.logger.log(`Erinnerungen abgerufen (einsatz: ${query.einsatzId}, count: ${dtos.length})`, 'GetErinnerungenByEinsatzHandler');

    // ════════════════════════════════════════════════════════════════════════
    // 5. Result zurückgeben
    // ════════════════════════════════════════════════════════════════════════
    return Result.ok<ErinnerungResponseDto[]>(dtos);
  }
}
