import { Injectable, Logger } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { Result } from '@domain/common/result';
// biome-ignore lint/style/useImportType: PrismaService needed for DI at runtime
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { EinsatzListItemDto } from '../../dto/einsatz-list-item.dto';
import { GetActiveEinsaetzeWithCountsQuery } from './get-active-einsaetze-with-counts.query';

/**
 * Handler fuer GetActiveEinsaetzeWithCountsQuery.
 *
 * L�dt alle aktiven Eins�tze mit vorberechneten ETB- und POI-Counts
 * �ber direkten PrismaService-Zugriff (CQRS Read-Side Optimization).
 *
 * **CQRS Read-Side Pattern:**
 * - Nutzt direkten PrismaService statt Repository Pattern
 * - Prisma _count f�r performante Aggregation (keine N+1 Queries)
 * - Keine Domain Aggregate Hydration (nur DTOs)
 * - Read-Optimierung: Minimale Joins, maximale Performance
 *
 * **Prisma Query Details:**
 * - findMany mit WHERE status != ARCHIVIERT
 * - include einsatztagebuch._count.eintraege (nur deletedAt IS NULL)
 * - include lagekarte._count.pois
 * - orderBy createdAt DESC (neueste zuerst)
 *
 * **Soft-Delete Handling:**
 * - ETB-Eintr�ge mit deletedAt !== null werden NICHT gez�hlt
 * - Lagekarte-POIs haben kein Soft-Delete (hard delete)
 * - Eins�tze: status ARCHIVIERT = Soft-Delete (werden ausgefiltert)
 *
 * **Performance:**
 * - Single Query mit Prisma _count (kein N+1 Problem)
 * - Typischerweise < 50ms f�r 100 Eins�tze
 * - Index-optimiert: (status, createdAt)
 *
 * **Fehlerbehandlung:**
 * - Prisma Fehler � Result.fail() mit Error Message
 * - Unerwartete Fehler � Logger.error() + Result.fail()
 * - Leeres Array ist valides Resultat (keine aktiven Eins�tze)
 *
 * @example
 * ```typescript
 * // Handler ausf�hren:
 * const handler = new GetActiveEinsaetzeWithCountsQueryHandler(prisma);
 * const query = new GetActiveEinsaetzeWithCountsQuery();
 * const result = await handler.execute(query);
 *
 * if (result.isSuccess) {
 *   result.value!.forEach(dto => {
 *     console.log(`${dto.nummer}: ${dto.etbEintraegeCount} Eintr�ge, ${dto.poisCount} POIs`);
 *   });
 * }
 * ```
 */
@QueryHandler(GetActiveEinsaetzeWithCountsQuery)
@Injectable()
export class GetActiveEinsaetzeWithCountsQueryHandler implements IQueryHandler<GetActiveEinsaetzeWithCountsQuery, Result<EinsatzListItemDto[]>> {
  private readonly logger = new Logger(GetActiveEinsaetzeWithCountsQueryHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * F�hrt die Query aus und gibt aktive Eins�tze mit Counts zur�ck.
   *
   * **Ablauf:**
   * 1. Prisma Query: status != ARCHIVIERT, mit _count includes
   * 2. Mapping: Prisma Result � EinsatzListItemDto
   * 3. einsatzort String � { ort: string } Object
   * 4. alarmstichwort null � '' (API braucht string, nicht null)
   * 5. Counts mit Nullish Coalescing (0 als Fallback)
   *
   * **Warum Nullish Coalescing:**
   * - einsatztagebuch kann null sein (ETB noch nicht erstellt)
   * - lagekarte kann null sein (Lagekarte noch nicht erstellt)
   * - _count kann undefined sein (Prisma Quirk)
   * - Fallback: 0 (valider Count wenn Relation nicht existiert)
   *
   * @param _query - GetActiveEinsaetzeWithCountsQuery (parameterlos, Underscore weil unused)
   * @returns Result<EinsatzListItemDto[]> - Success mit DTOs oder Failure mit Error Message
   */
  async execute(_query: GetActiveEinsaetzeWithCountsQuery): Promise<Result<EinsatzListItemDto[]>> {
    try {
      // 1. Prisma Query mit _count Aggregation
      const einsaetze = await this.prisma.einsatz.findMany({
        where: { status: { not: 'ARCHIVIERT' } },
        include: {
          einsatztagebuch: {
            select: {
              _count: {
                select: {
                  eintraege: { where: { deletedAt: null } },
                },
              },
            },
          },
          lagekarte: {
            select: {
              _count: {
                select: { pois: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // 2. Mapping: Prisma Result � EinsatzListItemDto
      const dtos: EinsatzListItemDto[] = einsaetze.map((e) => ({
        id: e.id,
        // nummer generieren aus createdAt Jahr + ersten 8 Zeichen der ID
        // Format: "E{YEAR}-{ID-8}" (z.B. "E2024-clw3h8x9")
        nummer: `E${e.createdAt.getFullYear()}-${e.id.substring(0, 8)}`,
        alarmstichwort: e.alarmstichwort ?? '', // null � empty string f�r API
        status: e.status as EinsatzListItemDto['status'],
        einsatzort: e.einsatzort ? { ort: e.einsatzort } : undefined,
        createdAt: e.createdAt,
        etbEintraegeCount: e.einsatztagebuch?._count?.eintraege ?? 0,
        poisCount: e.lagekarte?._count?.pois ?? 0,
      }));

      return Result.ok(dtos);
    } catch (error) {
      // Structured Logging f�r Produktions-Debugging
      this.logger.error('Unerwarteter Fehler beim Laden aktiver Eins�tze mit Counts', error instanceof Error ? error.stack : String(error));
      return Result.fail('Fehler beim Laden der Eins�tze');
    }
  }
}
