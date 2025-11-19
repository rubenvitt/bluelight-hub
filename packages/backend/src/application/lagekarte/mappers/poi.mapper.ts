import type { Poi } from '@domain/entities/poi.entity';
import type { PoiDto } from '../dtos/poi.dto';

/**
 * Mapper für Poi Entity → PoiDto Transformation.
 *
 * Diese Klasse trennt die Domain-Schicht (Poi Entity mit MGRS-Koordinaten)
 * von der API-Schicht (PoiDto mit MGRS + Lat/Lng). Die Konvertierung
 * erfolgt rein funktional ohne Dependencies.
 *
 * **Warum beide Koordinatenformate im DTO:**
 * - MGRS ist primär im Domain Model (DRK-Standard, kompakt, metrik)
 * - Lat/Lng wird für Frontend-Maps benötigt (Leaflet, Mapbox)
 * - Konvertierung im Mapper spart Client-Rechenzeit und vermeidet Fehler
 * - Event-Handler können direkt Lat/Lng nutzen ohne Domain-Abhängigkeit
 *
 * **Pattern:**
 * - Pure Function: Kein State, keine Side Effects, keine Dependencies
 * - Immutable Input: Poi wird nicht modifiziert
 * - On-Demand Conversion: MGRS → Lat/Lng via toLatLng() bei jedem Call
 */
export class PoiMapper {
  /**
   * Konvertiert ein Poi-Entity zu einem PoiDto.
   *
   * Diese Methode konvertiert MGRS-Koordinaten zusätzlich zu Lat/Lng,
   * damit das Frontend beide Formate nutzen kann (MGRS für Anzeige,
   * Lat/Lng für Leaflet-Karte).
   *
   * Die Konvertierung erfolgt on-demand via poi.coordinate.toLatLng(),
   * das ein GeoCoordinate Value Object mit latitude/longitude Properties
   * zurückgibt. Die MGRS-Koordinate wird via toString() serialisiert.
   *
   * @param poi - Das zu konvertierende Poi-Entity (aus Domain Layer)
   * @returns PoiDto mit MGRS + Lat/Lng Koordinaten für API-Response
   *
   * @example
   * ```typescript
   * const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.40, 5).getValue();
   * const category = PoiCategory.EINSATZSTELLE();
   * const userId = UserId.create().getValue();
   * const poi = Poi.create('Brandenburger Tor', berlinMgrs, category, userId, 'Haupteinsatzort');
   *
   * const dto = PoiMapper.toDto(poi);
   * // {
   * //   id: 'clw3h8x9y...',
   * //   name: 'Brandenburger Tor',
   * //   coordinate: {
   * //     mgrs: '33UUU8990317936',
   * //     lat: 52.5200,
   * //     lng: 13.4050
   * //   },
   * //   category: 'EINSATZSTELLE',
   * //   beschreibung: 'Haupteinsatzort'
   * // }
   * ```
   */
  static toDto(poi: Poi): PoiDto {
    // MGRS → Lat/Lng Konvertierung (GeoCoordinate VO)
    const latLng = poi.coordinate.toLatLng();

    return {
      id: poi.id.value,
      name: poi.name,
      coordinate: {
        mgrs: poi.coordinate.value, // MGRS-String (z.B. "33UUU8990317936")
        lat: latLng.latitude, // WGS84 Latitude
        lng: latLng.longitude, // WGS84 Longitude
      },
      category: poi.category.value,
      beschreibung: poi.beschreibung ?? undefined, // null → undefined für TS strict mode
    };
  }
}
