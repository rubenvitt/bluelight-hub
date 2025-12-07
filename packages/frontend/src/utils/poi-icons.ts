import type { IconType } from 'react-icons';
import {
  PiBriefcaseFill,
  PiCarFill,
  PiCircleFill,
  PiFirstAidFill,
  PiFlagFill,
  PiHouseFill,
  PiMapPinFill,
  PiPackageFill,
  PiProhibitFill,
  PiSquaresFourFill,
  PiUsersFill,
  PiUsersThreeFill,
  PiWarningFill,
} from 'react-icons/pi';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';

/**
 * POI-Type Enum (Legacy - für Abwärtskompatibilität)
 */
export type PoiTypeLegacy =
  | 'EINSATZORT'
  | 'FAHRZEUG'
  | 'EINHEIT'
  | 'GEFAHRENQUELLE'
  | 'SPERRBEREICH'
  | 'VERSORGUNGSPUNKT'
  | 'BEREITSTELLUNGSRAUM'
  | 'BEHANDLUNGSPLATZ'
  | 'SAMMELSTELLE'
  | 'UNTERKUNFT'
  | 'EINSATZABSCHNITT'
  | 'EINSATZLEITUNG'
  | 'SONSTIGES';

/**
 * POI-Kategorie Enum (neue CQRS API - DRK-Standard)
 */
export type PoiCategory = 'EINSATZSTELLE' | 'BEREITSTELLUNGSRAUM' | 'GEFAHRENSTELLE' | 'WASSERENTNAHMESTELLE' | 'SONSTIGES';

/**
 * Kombinierter POI-Type (für Abwärtskompatibilität)
 */
export type PoiType = PoiTypeLegacy | PoiCategory;

/**
 * POI-Icon-Konfiguration
 */
export interface PoiIconConfig {
  Icon: IconType;
  color: string;
  size: number;
}

/**
 * Mapping von POI-Typen zu react-icons (Phosphor Icons)
 *
 * @remarks
 * - EINSATZORT ist größer (32px) und rot (primäres Icon)
 * - Andere POIs sind 24px mit typ-spezifischen Farben
 */
export const POI_ICON_MAP: Record<PoiType, PoiIconConfig> = {
  EINSATZORT: {
    Icon: PiMapPinFill,
    color: '#EF4444', // Tailwind red-500
    size: 32, // Größer für primären POI
  },
  EINSATZABSCHNITT: {
    Icon: PiFlagFill,
    color: '#F97316', // Tailwind orange-500
    size: 24,
  },
  EINSATZLEITUNG: {
    Icon: PiBriefcaseFill,
    color: '#3B82F6', // Tailwind blue-500
    size: 24,
  },
  FAHRZEUG: {
    Icon: PiCarFill,
    color: '#3B82F6', // Tailwind blue-500
    size: 24,
  },
  EINHEIT: {
    Icon: PiUsersFill,
    color: '#3B82F6', // Tailwind blue-500
    size: 24,
  },
  GEFAHRENQUELLE: {
    Icon: PiWarningFill,
    color: '#EF4444', // Tailwind red-500
    size: 24,
  },
  SPERRBEREICH: {
    Icon: PiProhibitFill,
    color: '#EF4444', // Tailwind red-500
    size: 24,
  },
  VERSORGUNGSPUNKT: {
    Icon: PiPackageFill,
    color: '#10B981', // Tailwind green-500
    size: 24,
  },
  BEREITSTELLUNGSRAUM: {
    Icon: PiSquaresFourFill,
    color: '#3B82F6', // Tailwind blue-500
    size: 24,
  },
  BEHANDLUNGSPLATZ: {
    Icon: PiFirstAidFill,
    color: '#EF4444', // Tailwind red-500
    size: 24,
  },
  SAMMELSTELLE: {
    Icon: PiUsersThreeFill,
    color: '#A855F7', // Tailwind purple-500
    size: 24,
  },
  UNTERKUNFT: {
    Icon: PiHouseFill,
    color: '#3B82F6', // Tailwind blue-500
    size: 24,
  },
  SONSTIGES: {
    Icon: PiCircleFill,
    color: '#6B7280', // Tailwind gray-500
    size: 24,
  },
  // Neue CQRS-Kategorien (DRK-Standard)
  EINSATZSTELLE: {
    Icon: PiMapPinFill,
    color: '#EF4444', // Tailwind red-500
    size: 32, // Größer für primären POI
  },
  GEFAHRENSTELLE: {
    Icon: PiWarningFill,
    color: '#EF4444', // Tailwind red-500
    size: 24,
  },
  WASSERENTNAHMESTELLE: {
    Icon: PiCircleFill, // TODO: besseres Icon für Wasserentnahmestelle
    color: '#0EA5E9', // Tailwind sky-500
    size: 24,
  },
};

/**
 * Generiert ein Leaflet DivIcon aus einem react-icons Icon
 *
 * @param type - POI-Typ für Icon-Auswahl
 * @returns Leaflet DivIcon mit React Icon als HTML
 *
 * @remarks
 * - Verwendet renderToStaticMarkup() um React-Komponente zu HTML zu konvertieren
 * - Icon-Anchor ist am unteren Zentrum (wie ein Pin)
 * - Popup-Anchor ist oberhalb des Icons
 *
 * @example
 * ```tsx
 * const icon = getPoiIcon('EINSATZORT');
 * <Marker position={[51.1, 10.1]} icon={icon} />
 * ```
 */
export const getPoiIcon = (type: PoiType): L.DivIcon => {
  const config = POI_ICON_MAP[type] || POI_ICON_MAP.SONSTIGES;
  const { Icon, color, size } = config;

  // React Icon zu HTML String konvertieren (createElement statt JSX)
  const iconElement = Icon({ size, color });
  const iconHtml = renderToStaticMarkup(iconElement);

  return L.divIcon({
    html: iconHtml,
    iconSize: [size, size],
    iconAnchor: [size / 2, size], // Bottom center of icon
    popupAnchor: [0, -size], // Above icon
    className: 'poi-marker', // Custom CSS class für Styling
  });
};

/**
 * Prüft, ob ein POI-Typ valide ist
 *
 * @param type - Zu prüfender POI-Typ
 * @returns true wenn POI-Typ existiert, sonst false
 */
export const isValidPoiType = (type: string): type is PoiType => {
  return type in POI_ICON_MAP;
};
