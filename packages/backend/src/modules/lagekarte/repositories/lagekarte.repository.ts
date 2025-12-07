import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { Lagekarte } from '@prisma/client';

/**
 * Lagekarte Repository
 *
 * Data Access Layer für Lagekarte-Entitäten.
 * Kapselt alle Datenbankzugriffe für Lagekarten.
 */
@Injectable()
export class LagekarteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Findet eine Lagekarte anhand der Einsatz-ID
   *
   * @param einsatzId - Eindeutige ID des Einsatzes
   * @returns Lagekarte oder null, wenn keine existiert
   */
  async findByEinsatzId(einsatzId: string): Promise<Lagekarte | null> {
    return this.prisma.lagekarte.findUnique({
      where: { einsatzId },
      include: {
        pois: true, // Include POIs for complete Lagekarte response
      },
    });
  }

  /**
   * Erstellt eine neue leere Lagekarte für einen Einsatz
   *
   * @param einsatzId - Eindeutige ID des Einsatzes
   * @returns Neu erstellte Lagekarte
   *
   * @example
   * ```typescript
   * const lagekarte = await repository.create("clw3h8x9y0000qwerty");
   * console.log(lagekarte.state); // {}
   * ```
   */
  async create(einsatzId: string): Promise<Lagekarte> {
    return this.prisma.lagekarte.create({
      data: {
        einsatzId,
        state: {}, // Empty GeoJSON FeatureCollection
      },
      include: {
        pois: true,
      },
    });
  }

  /**
   * Aktualisiert den State (GeoJSON) einer Lagekarte
   *
   * @param id - Eindeutige ID der Lagekarte
   * @param state - GeoJSON FeatureCollection mit Zeichnungen
   * @returns Aktualisierte Lagekarte
   *
   * @example
   * ```typescript
   * const updated = await repository.update("clw3h8x9y", {
   *   type: "FeatureCollection",
   *   features: [{ type: "Feature", geometry: {...} }]
   * });
   * ```
   */
  async update(id: string, state: object): Promise<Lagekarte> {
    return this.prisma.lagekarte.update({
      where: { id },
      data: { state },
      include: {
        pois: true,
      },
    });
  }

  /**
   * Löscht eine Lagekarte
   *
   * **Cascade Delete:** POIs werden automatisch mitgelöscht
   *
   * @param id - Eindeutige ID der Lagekarte
   */
  async delete(id: string): Promise<void> {
    await this.prisma.lagekarte.delete({
      where: { id },
    });
  }
}
