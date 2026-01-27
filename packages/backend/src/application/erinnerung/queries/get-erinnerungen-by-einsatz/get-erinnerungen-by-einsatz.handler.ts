import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import type { ILogger } from '@domain/ports/i-logger.port';
import type { IErinnerungRepository } from '@domain/repositories/i-erinnerung.repository';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { ERINNERUNG_REPOSITORY, LOGGER, USER_REPOSITORY } from '@infrastructure/di-tokens';
import type { IUserRepository } from '@domain/repositories/i-user.repository';
import { UserId } from '@domain/value-objects/user-id';
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
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
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
    // 3. User-Namen effizient laden (vermeidet N+1 Problem)
    // ════════════════════════════════════════════════════════════════════════
    const userIdsToLoad = new Set<string>();

    for (const erinnerung of erinnerungen) {
      userIdsToLoad.add(erinnerung.erstelltVon.value);
      if (erinnerung.assignedToId) userIdsToLoad.add(erinnerung.assignedToId.value);
      if (erinnerung.eskalationsPersonId) userIdsToLoad.add(erinnerung.eskalationsPersonId.value);
      // Story 4.5: previousAssigneeId für Eskalations-Anzeige
      if (erinnerung.previousAssigneeId) userIdsToLoad.add(erinnerung.previousAssigneeId.value);
    }

    const uniqueUserIds = Array.from(userIdsToLoad);
    const userMap = new Map<string, string>(); // Id -> Name

    if (uniqueUserIds.length > 0) {
      // Parallelisiertes Laden der User (Batching wäre besser im Repo, aber hier okay für kleine N)
      await Promise.all(
        uniqueUserIds.map(async (idStr) => {
          const userIdResult = UserId.create(idStr);
          if (userIdResult.isSuccess && userIdResult.value) {
            const userResult = await this.userRepository.findById(userIdResult.value);
            if (userResult.isSuccess && userResult.value) {
              userMap.set(idStr, userResult.value.username.value); // oder fullName wenn vorhanden
            }
          }
        }),
      );
    }

    // ════════════════════════════════════════════════════════════════════════
    // 4. Domain Entities zu DTOs mappen
    // ════════════════════════════════════════════════════════════════════════
    const dtos: ErinnerungResponseDto[] = erinnerungen.map((erinnerung) => ({
      id: erinnerung.id.toString(),
      einsatzId: erinnerung.einsatzId.toString(),
      titel: erinnerung.titel.value,
      beschreibung: erinnerung.beschreibung ?? null,
      faelligAm: erinnerung.faelligAm.toISOString(),
      status: erinnerung.status.value,
      // Story 4.1: Zeitpunkt der Auslösung/Intensivierung
      ausgeloestAm: erinnerung.ausgeloestAm?.toISOString() ?? null,
      erstelltVon: erinnerung.erstelltVon.toString(),
      erstellerName: userMap.get(erinnerung.erstelltVon.toString()) ?? null,
      createdAt: erinnerung.createdAt.toISOString(),
      updatedAt: erinnerung.updatedAt.toISOString(),
      snoozeCount: erinnerung.snoozeCount,
      requiresNote: erinnerung.requiresNote,
      assignedToId: erinnerung.assignedToId?.toString() ?? null,
      assignedToName: erinnerung.assignedToId ? (userMap.get(erinnerung.assignedToId.toString()) ?? null) : null,
      eskalationsPersonId: erinnerung.eskalationsPersonId?.toString() ?? null,
      eskalationsPersonName: erinnerung.eskalationsPersonId ? (userMap.get(erinnerung.eskalationsPersonId.toString()) ?? null) : null,
      // Story 4.5: Eskalations-Tracking Felder
      escalatedAt: erinnerung.escalatedAt?.toISOString() ?? null,
      previousAssigneeId: erinnerung.previousAssigneeId?.toString() ?? null,
      previousAssigneeName: erinnerung.previousAssigneeId ? (userMap.get(erinnerung.previousAssigneeId.toString()) ?? null) : null,
    }));

    // ════════════════════════════════════════════════════════════════════════
    // 5. Audit-Trail loggen
    // ════════════════════════════════════════════════════════════════════════
    this.logger.log(`Erinnerungen abgerufen (einsatz: ${query.einsatzId}, count: ${dtos.length})`, 'GetErinnerungenByEinsatzHandler');

    // ════════════════════════════════════════════════════════════════════════
    // 6. Result zurückgeben
    // ════════════════════════════════════════════════════════════════════════
    return Result.ok<ErinnerungResponseDto[]>(dtos);
  }
}
