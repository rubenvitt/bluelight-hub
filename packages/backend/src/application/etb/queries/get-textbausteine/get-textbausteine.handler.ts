import { Injectable } from '@nestjs/common';
// biome-ignore lint/style/useImportType: PrismaService needed for DI at runtime
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { Result } from '@domain/common/result';
import type { TextbausteinDto } from '@application/etb/dto';
import type { GetTextbausteineQuery } from './get-textbausteine.query';
// biome-ignore lint/style/noRestrictedImports: Prisma types needed for query filters (CQRS Read-Side Pattern)
import type { Prisma } from '@prisma/client';

/**
 * Handler fuer GetTextbausteineQuery.
 *
 * Laedt Textbausteine direkt aus der Datenbank. Da Textbausteine
 * Stammdaten sind (kein Teil des ETB-Aggregates), wird hier
 * direkt Prisma verwendet statt ueber ein Domain-Repository.
 *
 * **Architektur-Entscheidung:**
 * - Textbausteine sind Read-Only Referenzdaten
 * - Keine Domain-Logik oder Invarianten erforderlich
 * - Kein Aggregate-Lifecycle zu beachten
 * - Direkter Datenbankzugriff ist hier angemessen
 *
 * **CQRS Query-Side Pattern:**
 * - Read-Only: Aendert niemals State
 * - Result<T>: Konsistente Fehlerbehandlung
 * - Filter-Support: Kategorie und Active-Status
 */
@Injectable()
export class GetTextbausteineHandler {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fuehrt die Query aus und laedt Textbausteine.
   *
   * **Filter-Logik:**
   * - kategorie: Filtert nach spezifischer Kategorie
   * - onlyActive: Nur aktive Textbausteine (Standard: true)
   *
   * **Sortierung:**
   * - Primaer: sortOrder (aufsteigend)
   * - Sekundaer: kurztext (alphabetisch)
   *
   * @param query - Die Query mit optionalen Filtern
   * @returns TextbausteinDto[] oder Fehler
   */
  async execute(query: GetTextbausteineQuery): Promise<Result<TextbausteinDto[]>> {
    try {
      const where: Prisma.EtbTextbausteinWhereInput = {};

      if (query.kategorie) {
        where.kategorie = query.kategorie;
      }

      if (query.onlyActive) {
        where.isActive = true;
      }

      const textbausteine = await this.prisma.etbTextbaustein.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { kurztext: 'asc' }],
      });

      const dtos: TextbausteinDto[] = textbausteine.map((tb) => ({
        id: tb.id,
        kategorie: tb.kategorie,
        kurztext: tb.kurztext,
        volltext: tb.volltext,
        isActive: tb.isActive,
        sortOrder: tb.sortOrder,
        verwendungen: tb.verwendungen,
        letztGenutzt: tb.letztGenutzt,
      }));

      return Result.ok(dtos);
    } catch (_error) {
      return Result.fail('Fehler beim Laden der Textbausteine');
    }
  }
}
