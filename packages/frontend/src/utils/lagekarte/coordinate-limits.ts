/**
 * Geografische Koordinaten-Limits
 *
 * Definiert die gültigen Wertebereiche für Latitude und Longitude
 * basierend auf dem WGS84-Koordinatensystem.
 *
 * @remarks
 * - Latitude: -90° (Südpol) bis +90° (Nordpol)
 * - Longitude: -180° (Westen) bis +180° (Osten)
 *
 * Diese Konstanten werden für Zod-Validierung, Form-Inputs und
 * defensive Programming bei Koordinaten-Verarbeitung verwendet.
 */
export const COORDINATE_LIMITS = {
  /**
   * Latitude (Breitengrad) Limits
   */
  LATITUDE: {
    MIN: -90,
    MAX: 90,
  },
  /**
   * Longitude (Längengrad) Limits
   */
  LONGITUDE: {
    MIN: -180,
    MAX: 180,
  },
} as const;

/**
 * Fehlermeldungen für Koordinaten-Validierung (Deutsch)
 */
export const COORDINATE_ERROR_MESSAGES = {
  LATITUDE: {
    REQUIRED: 'Breitengrad ist erforderlich',
    OUT_OF_RANGE: `Breitengrad muss zwischen ${COORDINATE_LIMITS.LATITUDE.MIN} und ${COORDINATE_LIMITS.LATITUDE.MAX} liegen`,
  },
  LONGITUDE: {
    REQUIRED: 'Längengrad ist erforderlich',
    OUT_OF_RANGE: `Längengrad muss zwischen ${COORDINATE_LIMITS.LONGITUDE.MIN} und ${COORDINATE_LIMITS.LONGITUDE.MAX} liegen`,
  },
} as const;

/**
 * Prüft ob eine Latitude im gültigen Bereich liegt
 */
export const isValidLatitude = (lat: number): boolean => {
  return lat >= COORDINATE_LIMITS.LATITUDE.MIN && lat <= COORDINATE_LIMITS.LATITUDE.MAX;
};

/**
 * Prüft ob eine Longitude im gültigen Bereich liegt
 */
export const isValidLongitude = (lng: number): boolean => {
  return lng >= COORDINATE_LIMITS.LONGITUDE.MIN && lng <= COORDINATE_LIMITS.LONGITUDE.MAX;
};

/**
 * Prüft ob beide Koordinaten gültig sind
 */
export const isValidCoordinate = (lat: number, lng: number): boolean => {
  return isValidLatitude(lat) && isValidLongitude(lng);
};
