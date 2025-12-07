import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { LagekartePoi, Prisma } from '@prisma/client';

/**
 * POI Repository
 *
 * Data Access Layer für POI-Entitäten (Points of Interest).
 * Kapselt alle Datenbankzugriffe für Lagekarten-POIs.
 */
@Injectable()
export class PoiRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Findet alle POIs einer Lagekarte
   *
   * @param lagekarteId - Eindeutige ID der Lagekarte
   * @returns Liste aller POIs der Lagekarte (sortiert nach Erstellungsdatum)
   */
  async findByLagekarteId(lagekarteId: string): Promise<LagekartePoi[]> {
    return this.prisma.lagekartePoi.findMany({
      where: { lagekarteId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Findet einen POI anhand seiner ID
   *
   * @param id - Eindeutige ID des POI
   * @returns POI oder null, wenn nicht gefunden
   */
  async findById(id: string): Promise<LagekartePoi | null> {
    return this.prisma.lagekartePoi.findUnique({
      where: { id },
    });
  }

  /**
   * Erstellt einen neuen POI
   *
   * @param data - POI-Daten (Prisma Create Input)
   * @returns Neu erstellter POI
   *
   * @example
   * ```typescript
   * const poi = await repository.create({
   *   lagekarteId: "clw3h8x9y",
   *   type: "EINSATZORT",
   *   name: "Haupteinsatzstelle",
   *   latitude: 52.52,
   *   longitude: 13.405
   * });
   * ```
   */
  async create(data: Prisma.LagekartePoiCreateInput): Promise<LagekartePoi> {
    return this.prisma.lagekartePoi.create({
      data,
    });
  }

  /**
   * Aktualisiert einen POI
   *
   * @param id - Eindeutige ID des POI
   * @param data - Zu aktualisierende Felder
   * @returns Aktualisierter POI
   */
  async update(id: string, data: Prisma.LagekartePoiUpdateInput): Promise<LagekartePoi> {
    return this.prisma.lagekartePoi.update({
      where: { id },
      data,
    });
  }

  /**
   * Löscht einen POI
   *
   * @param id - Eindeutige ID des POI
   */
  async delete(id: string): Promise<void> {
    await this.prisma.lagekartePoi.delete({
      where: { id },
    });
  }

  /**
   * Löscht alle POIs einer Lagekarte
   *
   * Nützlich für Cleanup-Operationen (z.B. vor Lagekarte-Löschung)
   *
   * @param lagekarteId - Eindeutige ID der Lagekarte
   * @returns Anzahl der gelöschten POIs
   */
  async deleteByLagekarteId(lagekarteId: string): Promise<number> {
    const result = await this.prisma.lagekartePoi.deleteMany({
      where: { lagekarteId },
    });
    return result.count;
  }
}
