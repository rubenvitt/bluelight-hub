import type { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { LagekarteAggregate as LagekarteAggregateImpl } from '@domain/aggregates/lagekarte.aggregate';
import type { Lagekarte, LagekartePoi, Prisma } from '@prisma/client';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { PrismaPoiMapper } from './prisma-poi.mapper';

/**
 * Lagekarte Type mit eager-loaded POIs (für Aggregate Reconstruction).
 */
type LagekarteWithPois = Lagekarte & {
  pois: LagekartePoi[];
};

/**
 * Mapper für LagekarteAggregate ↔ Prisma Lagekarte Transformation.
 *
 * Diese Klasse implementiert bidirektionale Konvertierung zwischen:
 * - Domain Layer: LagekarteAggregate mit Poi Entities Collection
 * - Infrastructure Layer: Prisma Lagekarte mit LagekartePoi[] Relation
 *
 * **AGGREGATE PATTERN:**
 * - LagekarteAggregate ist die Transactional Boundary
 * - POIs sind Child Entities innerhalb des Aggregates
 * - Aggregate Reconstruction erfordert eager loading von POIs
 * - Save Operation erstellt/updated Lagekarte + POIs atomisch
 *
 * **POI CASCADE STRATEGY:**
 * - Einfachheit über Effizienz: DELETE all POIs + CREATE all POIs
 * - Keine Delta-Berechnung (welche POIs changed/added/removed)
 * - Aggregate ist Source of Truth (alle POIs werden re-persisted)
 * - DB Performance: Batch DELETE + Batch CREATE (nicht N einzelne Updates)
 *
 * **Warum kein Delta:**
 * - Aggregate Root kennt nur aktuellen State (keine "dirty tracking")
 * - POIs haben keine stable IDs außerhalb Aggregate (können gelöscht/neu erstellt werden)
 * - Simplicity: Weniger Code, weniger Bugs, einfacheres Testing
 * - Performance: POI-Listen sind klein (<100 POIs), CASCADE DELETE + CREATE ist schnell
 *
 * **TIMESTAMPS:**
 * - Lagekarte.updatedAt wird automatisch von Prisma gesetzt
 * - Lagekarte.createdAt wird bei CREATE gesetzt, bei UPDATE nicht geändert
 * - POI.createdAt/updatedAt werden bei CASCADE CREATE überschrieben (akzeptabel)
 *
 * @example
 * ```typescript
 * // Domain → Prisma (Save)
 * const aggregate = LagekarteAggregate.create(einsatzId);
 * aggregate.addPoi('Einsatzstelle', berlinMgrs, category, userId);
 * const prismaData = PrismaLagekarteMapper.toPersistence(aggregate);
 * // { id: '...', einsatzId: '...', pois: [{ type: 'EINSATZORT', ... }] }
 *
 * // Prisma → Domain (Load)
 * const prismaLagekarte = await prisma.lagekarte.findUnique({
 *   where: { id: '...' },
 *   include: { pois: true }
 * });
 * const aggregate = PrismaLagekarteMapper.toAggregate(prismaLagekarte);
 * // LagekarteAggregate { pois: [Poi, ...], ... }
 * ```
 */
export class PrismaLagekarteMapper {
  /**
   * Konvertiert Prisma Lagekarte (mit POIs) zu Domain LagekarteAggregate.
   *
   * Diese Methode rekonstruiert das vollständige Aggregate aus der Datenbank.
   * Sie lädt alle POIs eager und konvertiert sie zu Poi Entities.
   *
   * **Aggregate Reconstruction:**
   * - LagekarteId aus prisma.id
   * - EinsatzId aus prisma.einsatzId
   * - Pois[] via PrismaPoiMapper.toEntity() für jedes POI
   * - Timestamps aus prisma.createdAt/updatedAt
   *
   * **WICHTIG: Protected Constructor Bypass:**
   * - LagekarteAggregate.create() ist für neue Aggregates (generiert neue ID)
   * - Reconstruction benötigt existierende ID + Timestamps aus DB
   * - Wir nutzen Reflection/Object.defineProperty() um Aggregate zu rekonstruieren
   *
   * **POI Order:**
   * - Prisma POIs haben keine explizite sortOrder (DB-Reihenfolge unbestimmt)
   * - Array-Order wird beibehalten (wichtig für UI-Konsistenz)
   * - Frontend sollte POIs nach createdAt oder Name sortieren
   *
   * @param prisma - Lagekarte mit eager-loaded POIs
   * @returns LagekarteAggregate mit rekonstruierten Poi Entities
   * @throws Error wenn LagekarteId oder EinsatzId invalid
   *
   * @example
   * ```typescript
   * const prismaLagekarte = await prisma.lagekarte.findUnique({
   *   where: { id: lagekarteId },
   *   include: { pois: true } // WICHTIG: eager load
   * });
   * const aggregate = PrismaLagekarteMapper.toAggregate(prismaLagekarte);
   * console.log(aggregate.pois.length); // Anzahl POIs
   * ```
   */
  static toAggregate(prisma: LagekarteWithPois): LagekarteAggregate {
    // LagekarteId Reconstruction
    const lagekarteIdResult = LagekarteId.create(prisma.id);
    if (lagekarteIdResult.isFailure) {
      throw new Error(`Invalid LagekarteId: ${lagekarteIdResult.error}`);
    }
    const lagekarteId = lagekarteIdResult.value as LagekarteId;

    // EinsatzId Reconstruction
    const einsatzIdResult = EinsatzId.create(prisma.einsatzId);
    if (einsatzIdResult.isFailure) {
      throw new Error(`Invalid EinsatzId: ${einsatzIdResult.error}`);
    }
    const einsatzId = einsatzIdResult.value as EinsatzId;

    // POIs Reconstruction (via PrismaPoiMapper)
    const pois = prisma.pois.map((prismaPoi) => PrismaPoiMapper.toEntity(prismaPoi));

    // Aggregate Reconstruction via create() + manual property override
    // HINWEIS: create() validiert nur einsatzId, wir überschreiben dann ID + Timestamps
    const aggregate = LagekarteAggregateImpl.create(einsatzId);
    if (aggregate.isFailure) {
      throw new Error(`Failed to create aggregate: ${aggregate.error}`);
    }

    const reconstructed = aggregate.value as LagekarteAggregate;

    // Override ID (create() generiert neue ID, wir wollen die aus DB)
    Object.defineProperty(reconstructed, '_id', {
      value: lagekarteId,
      writable: false,
      configurable: true,
    });

    // Override POIs (create() hat leeres Array, wir wollen die aus DB)
    Object.defineProperty(reconstructed, '_pois', {
      value: pois,
      writable: true, // POIs können via addPoi/removePoi geändert werden
      configurable: true,
    });

    // Override Timestamps (create() setzt new Date(), wir wollen die aus DB)
    Object.defineProperty(reconstructed, '_createdAt', {
      value: prisma.createdAt,
      writable: false,
      configurable: true,
    });

    Object.defineProperty(reconstructed, '_updatedAt', {
      value: prisma.updatedAt,
      writable: false,
      configurable: true,
    });

    // Clear Domain Events (Reconstruction sollte keine Events emittieren)
    reconstructed.clearDomainEvents();

    return reconstructed;
  }

  /**
   * Konvertiert Domain LagekarteAggregate zu Prisma CreateInput.
   *
   * Diese Methode bereitet das Aggregate für Prisma Upsert vor.
   * Sie extrahiert Lagekarte-Felder und POI-Collection.
   *
   * **POI CASCADE STRATEGY:**
   * - ALLE POIs werden als CreateInput zurückgegeben
   * - Caller muss existierende POIs löschen bevor Create (DELETE + CREATE Pattern)
   * - Keine Delta-Berechnung (Simplicity über Effizienz)
   *
   * **HINWEIS zu CreateInput:**
   * - Wir geben NUR Lagekarte-Felder zurück (ohne einsatz Relation)
   * - POIs werden als nested create data returned
   * - Caller muss einsatz relation manuell setzen bei create
   *
   * **STATE FIELD:**
   * - Lagekarte.state ist ein JSON-Feld für GeoJSON Zeichnungen
   * - Aktuell nicht im Domain Model (future feature)
   * - Default: {} (leeres Objekt)
   *
   * @param aggregate - LagekarteAggregate aus Domain Layer
   * @returns Prisma.LagekarteCreateInput mit POI CreateInput array
   *
   * @example
   * ```typescript
   * const aggregate = LagekarteAggregate.create(einsatzId);
   * aggregate.addPoi('Einsatzstelle', berlinMgrs, category, userId);
   *
   * const createData = PrismaLagekarteMapper.toPersistence(aggregate);
   * // {
   * //   id: '...',
   * //   state: {},
   * //   pois: [{ type: 'EINSATZORT', name: 'Einsatzstelle', ... }]
   * // }
   *
   * // Usage in Repository:
   * await prisma.lagekartePoi.deleteMany({ where: { lagekarteId } }); // DELETE old POIs
   * await prisma.lagekarte.upsert({
   *   where: { id: aggregate.getId().value },
   *   create: {
   *     ...createData,
   *     einsatz: { connect: { id: aggregate.einsatzId.value } }
   *   },
   *   update: { state: createData.state }
   * });
   * await prisma.lagekartePoi.createMany({ data: createData.pois }); // CREATE new POIs
   * ```
   */
  static toPersistence(aggregate: LagekarteAggregate): Omit<Prisma.LagekarteCreateInput, 'einsatz'> & {
    pois: Omit<Prisma.LagekartePoiCreateInput, 'lagekarte'>[];
  } {
    // POIs Conversion (via PrismaPoiMapper)
    const poisData = aggregate.pois.map((poi) => PrismaPoiMapper.toPersistence(poi));

    return {
      id: aggregate.id.value, // Fix: use aggregate.id instead of getId()
      state: {}, // GeoJSON Zeichnungen (future feature, aktuell leer)
      pois: poisData,
    };
  }
}
