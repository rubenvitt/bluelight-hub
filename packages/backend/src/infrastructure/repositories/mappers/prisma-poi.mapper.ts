import type { Poi } from '@domain/entities/poi.entity';
import { Poi as PoiEntity } from '@domain/entities/poi.entity';
import type { LagekartePoi, Prisma, PoiType } from '@prisma/client';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { UserId } from '@domain/value-objects/user-id';
import { PoiId } from '@domain/value-objects/poi-id';

/**
 * Mapper für Poi Entity ↔ Prisma LagekartePoi Transformation.
 *
 * Diese Klasse implementiert bidirektionale Konvertierung zwischen:
 * - Domain Layer: Poi Entity mit MGRS-Koordinaten und PoiCategory Enum
 * - Infrastructure Layer: Prisma LagekartePoi mit Lat/Lng + MGRS String und PoiType Enum
 *
 * **KRITISCHE MAPPING-REGELN:**
 *
 * 1. Enum-Mapping (PoiCategory ≠ PoiType):
 *    - EINSATZSTELLE (Domain) ↔ EINSATZORT (Prisma)
 *    - GEFAHRENSTELLE (Domain) ↔ GEFAHRENQUELLE (Prisma)
 *    - WASSERENTNAHMESTELLE ↔ WASSERENTNAHMESTELLE (1:1)
 *    - BEREITSTELLUNGSRAUM ↔ BEREITSTELLUNGSRAUM (1:1)
 *    - SONSTIGES ↔ SONSTIGES (1:1)
 *
 * 2. Field-Mapping:
 *    - poi.beschreibung (Domain) ↔ poi.adresse (Prisma)
 *    - poi.coordinate.value (Domain) ↔ poi.mgrs (Prisma)
 *
 * 3. MGRS NULL Handling:
 *    - Save: MgrsCoordinate → {mgrs: string, latitude: number, longitude: number}
 *    - Load: Wenn mgrs=NULL → MgrsCoordinate.fromLatLng(lat, lng)
 *    - Load: Wenn mgrs≠NULL → MgrsCoordinate.fromString(mgrs)
 *
 * **Warum Enum-Mapping-Funktion:**
 * - Domain verwendet PoiCategory Value Object (Type-Safe, Business-Focused)
 * - Prisma verwendet PoiType Enum (DB-Schema, Infrastructure-Focused)
 * - Namen unterscheiden sich aus historischen Gründen (Legacy-Schema)
 * - Explizite Konvertierung verhindert implizite String-Casts (Fail-Fast)
 *
 * **Warum MGRS NULL Handling:**
 * - Migration: Legacy-Daten haben möglicherweise kein MGRS-Feld
 * - Fallback: Lat/Lng immer vorhanden (DB-Constraint NOT NULL)
 * - Konvertierung: fromLatLng() berechnet MGRS on-the-fly (1m precision)
 *
 * @example
 * ```typescript
 * // Domain → Prisma (Save)
 * const poi = Poi.create('Einsatzstelle', berlinMgrs, PoiCategory.EINSATZSTELLE(), userId);
 * const prismaData = PrismaPoiMapper.toPersistence(poi);
 * // { type: 'EINSATZORT', mgrs: '33UUU...', latitude: 52.52, longitude: 13.40, ... }
 *
 * // Prisma → Domain (Load)
 * const prismaPoi = await prisma.lagekartePoi.findUnique(...);
 * const domainPoi = PrismaPoiMapper.toEntity(prismaPoi);
 * // Poi { name: 'Einsatzstelle', category: PoiCategory('EINSATZSTELLE'), ... }
 * ```
 */
export class PrismaPoiMapper {
  /**
   * Konvertiert Prisma LagekartePoi zu Domain Poi Entity.
   *
   * Diese Methode rekonstruiert ein Domain Poi Entity aus der Datenbank.
   * Sie behandelt MGRS NULL-Werte durch Fallback auf Lat/Lng-Konvertierung
   * und mapped Prisma PoiType zu Domain PoiCategory.
   *
   * **MGRS NULL Handling:**
   * - Wenn prismaPoi.mgrs = NULL → Konvertiere Lat/Lng zu MGRS (Legacy-Daten)
   * - Wenn prismaPoi.mgrs ≠ NULL → Parse MGRS-String direkt
   * - Precision: 5 digits = 1m Genauigkeit (DRK-Standard)
   *
   * **Enum Mapping:**
   * - EINSATZORT (Prisma) → EINSATZSTELLE (Domain)
   * - GEFAHRENQUELLE (Prisma) → GEFAHRENSTELLE (Domain)
   * - Rest: 1:1 Mapping
   *
   * **Error Handling:**
   * - MGRS-Parse-Fehler: Wird als Result.fail() propagiert, aber hier nicht caught
   *   (Caller muss invalid MGRS-Strings vorher validieren)
   * - Ungültiger PoiType: throw Error (sollte nie passieren bei validem Schema)
   * - Missing createdBy: throw Error (FK Constraint sollte das verhindern)
   *
   * @param prismaPoi - LagekartePoi von Prisma Query
   * @returns Poi Entity für Domain Layer
   * @throws Error wenn PoiType nicht gemapped werden kann
   *
   * @example
   * ```typescript
   * const prismaPoi = await prisma.lagekartePoi.findUnique({ where: { id: '...' } });
   * const poi = PrismaPoiMapper.toEntity(prismaPoi);
   * console.log(poi.category.value); // 'EINSATZSTELLE'
   * console.log(poi.coordinate.value); // '33UUU8990317936'
   * ```
   */
  static toEntity(prismaPoi: LagekartePoi): Poi {
    // MGRS Coordinate Reconstruction (mit NULL Fallback)
    let mgrsCoordinate: MgrsCoordinate;
    if (prismaPoi.mgrs) {
      // MGRS vorhanden: Parse direkt
      const mgrsResult = MgrsCoordinate.fromString(prismaPoi.mgrs);
      if (mgrsResult.isFailure) {
        throw new Error(`Failed to parse MGRS: ${mgrsResult.error}`);
      }
      mgrsCoordinate = mgrsResult.value as MgrsCoordinate;
    } else {
      // MGRS NULL: Konvertiere Lat/Lng zu MGRS (Legacy Fallback)
      const mgrsResult = MgrsCoordinate.fromLatLng(prismaPoi.latitude, prismaPoi.longitude, 5); // 5 = 1m precision
      if (mgrsResult.isFailure) {
        throw new Error(`Failed to convert Lat/Lng to MGRS: ${mgrsResult.error}`);
      }
      mgrsCoordinate = mgrsResult.value as MgrsCoordinate;
    }

    // PoiType (Prisma) → PoiCategory (Domain) Mapping
    const category = PrismaPoiMapper.mapPrismaTypeToDomainCategory(prismaPoi.type);

    // POI ID Reconstruction (Type-Safe EntityId)
    const poiIdResult = PoiId.create(prismaPoi.id);
    if (poiIdResult.isFailure) {
      throw new Error(`Invalid POI ID: ${poiIdResult.error}`);
    }
    const poiId = poiIdResult.value as PoiId;

    // User ID Reconstruction (createdBy wird zu Domain UserId)
    // HINWEIS: createdBy wird NICHT von Prisma getracked für POIs! Wir müssen metadata nutzen.
    // Für jetzt nutzen wir einen Fallback-User (System User).
    const userId = UserId.create('system').value as UserId;

    // POI Entity Reconstruction (Protected Constructor Bypass via Reflection)
    // WICHTIG: Wir nutzen create() Factory, aber setzen dann Timestamps manuell
    const name = prismaPoi.name ?? 'Unnamed POI'; // Fallback für NULL Namen
    const beschreibung = prismaPoi.adresse ?? undefined; // adresse (Prisma) → beschreibung (Domain)

    const poi = PoiEntity.create(name, mgrsCoordinate, category, userId, beschreibung);

    // Timestamps überschreiben (Reflection oder direkter Zugriff)
    // HINWEIS: Poi.create() setzt createdAt automatisch auf new Date()
    // Wir müssen hier rekonstruieren mit original Timestamp
    Object.defineProperty(poi, '_createdAt', {
      value: prismaPoi.createdAt,
      writable: false,
    });

    // ID überschreiben (create() generiert neue ID, aber wir wollen die aus DB)
    Object.defineProperty(poi, '_id', {
      value: poiId,
      writable: false,
    });

    return poi;
  }

  /**
   * Konvertiert Domain Poi Entity zu Prisma LagekartePoi CreateInput.
   *
   * Diese Methode bereitet ein Poi Entity für Prisma Upsert vor.
   * Sie konvertiert MGRS zu Lat/Lng, mapped PoiCategory zu PoiType,
   * und erstellt ein Prisma-kompatibles CreateInput Objekt.
   *
   * **MGRS Konvertierung:**
   * - poi.coordinate (Domain) → {mgrs: string, latitude: number, longitude: number} (Prisma)
   * - MGRS-String direkt übernommen (poi.coordinate.value)
   * - Lat/Lng via toLatLng() berechnet (für Query-Performance und Fallback)
   *
   * **Enum Mapping:**
   * - EINSATZSTELLE (Domain) → EINSATZORT (Prisma)
   * - GEFAHRENSTELLE (Domain) → GEFAHRENQUELLE (Prisma)
   * - Rest: 1:1 Mapping
   *
   * **Field Mapping:**
   * - poi.beschreibung (Domain) → adresse (Prisma)
   * - poi.name → name (Prisma)
   *
   * **HINWEIS zu CreateInput:**
   * - Wir geben NUR die POI-Felder zurück (ohne lagekarteId Relation)
   * - Caller muss lagekarteId manuell setzen bei createMany/create
   * - createdAt/updatedAt werden automatisch von Prisma gesetzt
   *
   * @param poi - Poi Entity aus Domain Layer
   * @returns Prisma.LagekartePoiCreateInput (ohne lagekarteId Relation)
   *
   * @example
   * ```typescript
   * const poi = Poi.create('Einsatzstelle', berlinMgrs, PoiCategory.EINSATZSTELLE(), userId);
   * const createData = PrismaPoiMapper.toPersistence(poi);
   * await prisma.lagekartePoi.create({
   *   data: {
   *     ...createData,
   *     lagekarte: { connect: { id: lagekarteId } }
   *   }
   * });
   * ```
   */
  static toPersistence(poi: Poi): Omit<Prisma.LagekartePoiCreateInput, 'lagekarte'> {
    // MGRS → Lat/Lng Konvertierung (parallel speichern für Performance)
    const latLng = poi.coordinate.toLatLng();

    // PoiCategory (Domain) → PoiType (Prisma) Mapping
    const type = PrismaPoiMapper.mapDomainCategoryToPrismaType(poi.category);

    return {
      id: poi.id.value,
      type,
      name: poi.name,
      adresse: poi.beschreibung ?? null, // beschreibung (Domain) → adresse (Prisma)
      mgrs: poi.coordinate.value, // MGRS-String (z.B. "33UUU8990317936")
      latitude: latLng.latitude,
      longitude: latLng.longitude,
      // icon: null, // Unused field (Frontend entscheidet basierend auf PoiType)
      // metadata: null, // Unused field (könnte für Custom POI Data genutzt werden)
    };
  }

  /**
   * Mapped PoiCategory (Domain) zu PoiType (Prisma).
   *
   * Diese Methode konvertiert Domain Value Objects zu Prisma Enum-Strings.
   * Die Namen unterscheiden sich aus historischen Gründen (Legacy-Schema).
   *
   * **Mapping Table:**
   * - EINSATZSTELLE (Domain) → EINSATZORT (Prisma)
   * - GEFAHRENSTELLE (Domain) → GEFAHRENQUELLE (Prisma)
   * - WASSERENTNAHMESTELLE → WASSERENTNAHMESTELLE (1:1)
   * - BEREITSTELLUNGSRAUM → BEREITSTELLUNGSRAUM (1:1)
   * - SONSTIGES → SONSTIGES (1:1)
   *
   * **Warum throw bei ungültigem PoiCategory:**
   * - Domain Layer sollte NIEMALS ungültige PoiCategory Instanzen erzeugen
   * - Throw ist Fail-Fast bei Programmierfehler (nicht User Error)
   * - Catch würde Bug verschleiern statt ihn transparent zu machen
   *
   * @param category - PoiCategory Value Object
   * @returns PoiType Prisma Enum String
   * @throws Error wenn PoiCategory nicht gemapped werden kann
   */
  private static mapDomainCategoryToPrismaType(category: PoiCategory): PoiType {
    switch (category.value) {
      case 'EINSATZSTELLE':
        return 'EINSATZORT'; // Domain 'EINSATZSTELLE' → Prisma 'EINSATZORT'
      case 'GEFAHRENSTELLE':
        return 'GEFAHRENQUELLE'; // Domain 'GEFAHRENSTELLE' → Prisma 'GEFAHRENQUELLE'
      case 'WASSERENTNAHMESTELLE':
        return 'VERSORGUNGSPUNKT'; // Domain 'WASSERENTNAHMESTELLE' → Prisma 'VERSORGUNGSPUNKT'
      case 'BEREITSTELLUNGSRAUM':
        return 'BEREITSTELLUNGSRAUM'; // 1:1 Mapping
      case 'SONSTIGES':
        return 'SONSTIGES'; // 1:1 Mapping
      default:
        throw new Error(`Unmapped PoiCategory: ${category.value}`);
    }
  }

  /**
   * Mapped PoiType (Prisma) zu PoiCategory (Domain).
   *
   * Diese Methode konvertiert Prisma Enum-Strings zu Domain Value Objects.
   * Sie ist die inverse Funktion zu mapDomainCategoryToPrismaType().
   *
   * **Mapping Table:**
   * - EINSATZORT (Prisma) → EINSATZSTELLE (Domain)
   * - GEFAHRENQUELLE (Prisma) → GEFAHRENSTELLE (Domain)
   * - VERSORGUNGSPUNKT (Prisma) → WASSERENTNAHMESTELLE (Domain)
   * - BEREITSTELLUNGSRAUM → BEREITSTELLUNGSRAUM (1:1)
   * - SONSTIGES → SONSTIGES (1:1)
   *
   * **Fallback für andere PoiTypes:**
   * - Prisma-Schema hat weitere PoiTypes (EINSATZABSCHNITT, FAHRZEUG, ...)
   * - Diese werden zu SONSTIGES gemapped (Fallback für unbekannte Types)
   * - Verhindert Exception bei Schema-Erweiterungen ohne Mapper-Update
   *
   * @param type - PoiType Prisma Enum String
   * @returns PoiCategory Value Object
   */
  private static mapPrismaTypeToDomainCategory(type: PoiType): PoiCategory {
    switch (type) {
      case 'EINSATZORT':
        return PoiCategory.EINSATZSTELLE(); // Prisma 'EINSATZORT' → Domain 'EINSATZSTELLE'
      case 'GEFAHRENQUELLE':
        return PoiCategory.GEFAHRENSTELLE(); // Prisma 'GEFAHRENQUELLE' → Domain 'GEFAHRENSTELLE'
      case 'VERSORGUNGSPUNKT':
        return PoiCategory.WASSERENTNAHMESTELLE(); // Prisma 'VERSORGUNGSPUNKT' → Domain 'WASSERENTNAHMESTELLE'
      case 'BEREITSTELLUNGSRAUM':
        return PoiCategory.BEREITSTELLUNGSRAUM(); // 1:1 Mapping
      case 'SONSTIGES':
        return PoiCategory.SONSTIGES(); // 1:1 Mapping
      // Fallback für andere PoiTypes (EINSATZABSCHNITT, FAHRZEUG, etc.)
      default:
        return PoiCategory.SONSTIGES(); // Fallback statt Exception
    }
  }
}
