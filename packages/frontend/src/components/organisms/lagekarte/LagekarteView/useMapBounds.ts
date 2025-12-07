import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { PoiDto } from '@bluelight-hub/shared/client';

/**
 * Default-Zentrum für Deutschland
 * Wird verwendet wenn keine POIs vorhanden sind
 */
const GERMANY_CENTER: [number, number] = [51.1657, 10.4515];
const GERMANY_ZOOM = 6;

/**
 * Custom Hook zum automatischen Zoomen der Karte auf alle POIs
 *
 * @param pois - Array von POIs die auf der Karte dargestellt werden sollen
 *
 * @remarks
 * - Berechnet Bounding-Box aus allen POI-Koordinaten
 * - Zoomt Karte automatisch um alle POIs anzuzeigen
 * - Fallback auf Deutschland-Zentrum wenn keine POIs vorhanden
 * - Wird nur einmal beim initialen Laden ausgeführt (nicht bei jedem Update)
 * - Überspringt POIs mit ungültigen Koordinaten
 *
 * @example
 * ```tsx
 * const MapBoundsController: React.FC<{ pois: PoiDto[] }> = ({ pois }) => {
 *   useMapBounds(pois);
 *   return null;
 * };
 *
 * // In LagekarteView:
 * <MapContainer>
 *   <MapBoundsController pois={pois} />
 * </MapContainer>
 * ```
 */
export const useMapBounds = (pois: PoiDto[] | undefined): void => {
  const map = useMap();

  useEffect(() => {
    // Keine POIs vorhanden - Fallback zu Deutschland-Zentrum
    if (!pois || pois.length === 0) {
      map.setView(GERMANY_CENTER, GERMANY_ZOOM);
      return;
    }

    // Filtere POIs mit gültigen Koordinaten
    const validPois = pois.filter(
      (poi) => poi.coordinate && typeof poi.coordinate.lat === 'number' && typeof poi.coordinate.lng === 'number' && !Number.isNaN(poi.coordinate.lat) && !Number.isNaN(poi.coordinate.lng),
    );

    // Keine gültigen POIs - Fallback zu Deutschland-Zentrum
    if (validPois.length === 0) {
      map.setView(GERMANY_CENTER, GERMANY_ZOOM);
      return;
    }

    // Berechne Bounding-Box aus allen POI-Koordinaten
    const bounds = L.latLngBounds(validPois.map((poi) => [poi.coordinate.lat, poi.coordinate.lng]));

    // Zoome Karte auf Bounding-Box mit Padding
    map.fitBounds(bounds, {
      padding: [50, 50], // 50px Padding auf allen Seiten
      maxZoom: 15, // Maximaler Zoom-Level (verhindert zu starkes Zoomen bei wenigen POIs)
    });
  }, [pois, map]); // Re-run wenn POIs sich ändern oder Map-Instanz wechselt
};
