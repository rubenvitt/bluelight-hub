import type { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import type { LagekarteDto } from '../dtos/lagekarte.dto';
import { PoiMapper } from './poi.mapper';

/**
 * Mapper für LagekarteAggregate → LagekarteDto Transformation.
 *
 * Diese Klasse trennt die Domain-Schicht (LagekarteAggregate mit Business Logic)
 * von der API-Schicht (LagekarteDto als reines Daten-Objekt). Die Transformation
 * erfolgt rein funktional ohne Dependencies.
 *
 * **Warum separater Mapper statt direkter Serialisierung:**
 * - Versionierung: API-Struktur kann unabhängig von Domain evolvieren
 * - Projektion: Nur API-relevante Felder werden exportiert (keine Domain Events)
 * - Security: Interne Domain-Details bleiben verborgen (z.B. User IDs)
 * - Testbarkeit: Mapper können isoliert ohne Domain-Logik getestet werden
 *
 * **Pattern:**
 * - Pure Function: Kein State, keine Side Effects, keine Dependencies
 * - Immutable Input: Aggregate wird nicht modifiziert
 * - Delegiert POI-Mapping: Nutzt PoiMapper für Child-Entities
 */
export class LagekarteMapper {
  /**
   * Konvertiert ein LagekarteAggregate zu einem LagekarteDto.
   *
   * Diese Transformation trennt die Domain-Schicht von der API-Schicht,
   * damit interne Änderungen am Aggregate die API-Struktur nicht brechen.
   *
   * Die POI-Collection wird via PoiMapper.toDto() transformiert, sodass
   * jeder POI sowohl MGRS- als auch Lat/Lng-Koordinaten im Response hat.
   * Domain Events und interne Aggregate-Metadaten werden NICHT exportiert.
   *
   * @param aggregate - Das zu konvertierende LagekarteAggregate (aus Domain Layer)
   * @returns LagekarteDto für API-Response
   *
   * @example
   * ```typescript
   * const einsatzId = EinsatzId.create().getValue();
   * const lagekarte = LagekarteAggregate.create(einsatzId).getValue();
   *
   * // POI hinzufügen
   * const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.40, 5).getValue();
   * const category = PoiCategory.EINSATZSTELLE();
   * const userId = UserId.create().getValue();
   * lagekarte.addPoi('Brandenburger Tor', berlinMgrs, category, userId);
   *
   * const dto = LagekarteMapper.toDto(lagekarte);
   * // {
   * //   id: 'clw3h8x9y...',
   * //   einsatzId: 'clw3h8x9y...',
   * //   pois: [
   * //     {
   * //       id: 'clw3h8x9y...',
   * //       name: 'Brandenburger Tor',
   * //       coordinate: { mgrs: '33UUU...', lat: 52.52, lng: 13.40 },
   * //       category: 'EINSATZSTELLE',
   * //       beschreibung: undefined
   * //     }
   * //   ],
   * //   createdAt: 2024-01-15T12:00:00.000Z
   * // }
   * ```
   */
  static toDto(aggregate: LagekarteAggregate): LagekarteDto {
    return {
      id: aggregate.id.value,
      einsatzId: aggregate.einsatzId.value,
      pois: aggregate.pois.map(PoiMapper.toDto),
      createdAt: aggregate.createdAt,
    };
  }
}
