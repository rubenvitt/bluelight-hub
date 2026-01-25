import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import type { ILogger } from '@domain/ports/i-logger.port';
import { LOGGER } from '@infrastructure/di-tokens';
import type { PrismaService } from '@infrastructure/database/prisma.service';

import type { AktiveTeilnehmerResponseDto } from '../../dto/aktive-teilnehmer-response.dto';
import type { GetEinsatzTeilnehmerQuery } from './get-einsatz-teilnehmer.query';

/**
 * Handler zum Abrufen aller aktiven Teilnehmer eines Einsatzes.
 *
 * **Story 3.3 AC1:**
 * "sehe ich alle aktiven Einsatz-Teilnehmer als Auswahl"
 *
 * **CQRS Query-Side Pattern:**
 * - Read-Only: Aendert niemals Domain State
 * - Result<T>: Kein Exception-Throwing fuer vorhersagbare Fehler
 * - Direct Prisma Access: Keine Repository-Abstraktion noetig fuer einfache Reads
 *
 * **Filter:**
 * - Nur Teilnehmer mit leftAt === null (noch aktiv im Einsatz)
 * - Sortiert nach joinedAt ASC (aelteste zuerst = laenger dabei)
 */
@Injectable()
export class GetEinsatzTeilnehmerHandler {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(LOGGER)
    private readonly logger: ILogger,
  ) {}

  /**
   * Fuehrt die Query aus und gibt alle aktiven Teilnehmer zurueck.
   *
   * **Ablauf:**
   * 1. Einsatz-Existenz pruefen
   * 2. Aktive Teilnehmer laden (leftAt === null)
   * 3. User-Daten joinen fuer username
   * 4. Zu DTOs mappen
   *
   * @param query - Validierte Query mit einsatzId
   * @returns Result mit Liste von AktiveTeilnehmerResponseDto
   */
  async execute(query: GetEinsatzTeilnehmerQuery): Promise<Result<AktiveTeilnehmerResponseDto[]>> {
    try {
      // 1. Einsatz-Existenz pruefen
      const einsatzExists = await this.prisma.einsatz.findUnique({
        where: { id: query.einsatzId },
        select: { id: true },
      });

      if (!einsatzExists) {
        return Result.fail<AktiveTeilnehmerResponseDto[]>(`Einsatz mit ID ${query.einsatzId} nicht gefunden`);
      }

      // 2. Aktive Teilnehmer laden mit User-Join
      const teilnehmer = await this.prisma.einsatzTeilnehmer.findMany({
        where: {
          einsatzId: query.einsatzId,
          leftAt: null, // Nur aktive Teilnehmer
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
        orderBy: {
          joinedAt: 'asc', // Aelteste zuerst
        },
      });

      // 3. Zu DTOs mappen
      const dtos: AktiveTeilnehmerResponseDto[] = teilnehmer.map((t) => ({
        userId: t.user.id,
        username: t.user.username,
        funkrufname: t.funkrufname,
        joinedAt: t.joinedAt.toISOString(),
      }));

      this.logger.log(`Teilnehmer abgerufen (einsatz: ${query.einsatzId}, count: ${dtos.length})`, 'GetEinsatzTeilnehmerHandler');

      return Result.ok<AktiveTeilnehmerResponseDto[]>(dtos);
    } catch (error) {
      this.logger.error(`[GetEinsatzTeilnehmerHandler] Fehler beim Laden der Teilnehmer fuer Einsatz ${query.einsatzId}: ${error instanceof Error ? error.stack : String(error)}`);

      const errorMessage = error instanceof Error ? error.message : 'Unerwarteter Fehler beim Laden der Teilnehmer';
      return Result.fail<AktiveTeilnehmerResponseDto[]>(errorMessage);
    }
  }
}
