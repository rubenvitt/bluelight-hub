import { useCreatePoi, useGeocodeAddress } from '@/api/hooks/useLagekarteApi';
import type { PoiType } from '@/utils/poi-icons';
import { getApiErrorMessage } from '@/utils/apiErrorHandler';
import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { toast } from 'sonner';
import { z } from 'zod';
import { asyncDebounce } from '@tanstack/pacer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatMgrs, isValidMgrs, latLngToMgrs, mgrsToLatLng } from '@/utils/lagekarte/mgrs';
import { COORDINATE_ERROR_MESSAGES, COORDINATE_LIMITS } from '@/utils/lagekarte/coordinate-limits';

/**
 * Zod-Validierungsschema für POI-Erstellung
 *
 * @remarks
 * - name: Mindestens 3 Zeichen (required)
 * - adresse: Optional, für Geocoding
 * - latitude/longitude: Erforderlich als Fallback wenn kein Geocoding
 * - mgrs: Optional, für MGRS-Koordinaten
 * - type: POI-Typ aus Enum
 * - icon: Optional, wird vom Backend basierend auf type gesetzt
 *
 * CUX-007: Koordinaten-Validierung
 * - latitude: -90 bis 90 (geografische Grenzen)
 * - longitude: -180 bis 180 (geografische Grenzen)
 * - mgrs: Validierung erfolgt durch isValidMgrs() Funktion
 */
const poiFormSchema = z.object({
  name: z.string().min(3, 'Name muss mindestens 3 Zeichen lang sein'),
  adresse: z.string().optional(),
  latitude: z
    .number({ required_error: COORDINATE_ERROR_MESSAGES.LATITUDE.REQUIRED })
    .min(COORDINATE_LIMITS.LATITUDE.MIN, COORDINATE_ERROR_MESSAGES.LATITUDE.OUT_OF_RANGE)
    .max(COORDINATE_LIMITS.LATITUDE.MAX, COORDINATE_ERROR_MESSAGES.LATITUDE.OUT_OF_RANGE),
  longitude: z
    .number({ required_error: COORDINATE_ERROR_MESSAGES.LONGITUDE.REQUIRED })
    .min(COORDINATE_LIMITS.LONGITUDE.MIN, COORDINATE_ERROR_MESSAGES.LONGITUDE.OUT_OF_RANGE)
    .max(COORDINATE_LIMITS.LONGITUDE.MAX, COORDINATE_ERROR_MESSAGES.LONGITUDE.OUT_OF_RANGE),
  mgrs: z.string().optional(),
  type: z.string(), // PoiType as string (validated by backend)
  icon: z.string().optional(),
});

/**
 * Form Values Type (infered from Zod schema)
 */
export type PoiFormValues = z.infer<typeof poiFormSchema>;

/**
 * usePoiForm Hook Props
 */
export interface UsePoiFormProps {
  /**
   * EinsatzId für POI-Erstellung (für TanStack Query Invalidation)
   */
  einsatzId: string;

  /**
   * LagekarteId für POI-Erstellung (wird an Backend gesendet)
   */
  lagekarteId: string;

  /**
   * Initialer POI-Typ (vorausgewählt aus Toolbar)
   */
  initialType: PoiType;

  /**
   * Initiale Koordinaten (von Karten-Klick)
   */
  initialCoordinates: {
    lat: number;
    lon: number;
  };

  /**
   * Callback nach erfolgreicher POI-Erstellung
   */
  onSuccess?: () => void;

  /**
   * Callback bei Fehler
   */
  onError?: (error: Error) => void;
}

/**
 * Hook zum Verwalten des POI-Erstellungs-Formulars
 *
 * Verwendet TanStack Form mit Zod-Validation für typsichere Formular-Verwaltung.
 *
 * @param props - Hook configuration
 * @returns TanStack Form instance
 *
 * @remarks
 * Features:
 * - Zod-Validation für alle Felder
 * - TanStack Query Mutation für POI-Erstellung
 * - Geocoding-Integration mit Debouncing (1s delay)
 * - Automatische Koordinaten-Updates bei Adressänderung
 * - Bi-direktionale MGRS ↔ Lat/Lng Synchronisation
 * - Koordinaten-Modus-Umschaltung (MGRS oder Lat/Lng)
 * - Automatische Query-Invalidation nach Erfolg
 *
 * @example
 * ```tsx
 * const {
 *   form,
 *   coordMode,
 *   setCoordMode,
 *   mgrsInput,
 *   handleMgrsChange,
 *   isMgrsValid
 * } = usePoiForm({
 *   einsatzId: 'einsatz-123',
 *   lagekarteId: 'lagekarte-456',
 *   initialType: 'FAHRZEUG',
 *   initialCoordinates: { lat: 51.1, lon: 10.1 },
 *   onSuccess: () => closeModal(),
 * });
 *
 * // In Form-Component:
 * <form.Field name="name">
 *   {(field) => <Input {...field} />}
 * </form.Field>
 * ```
 */
export const usePoiForm = ({ einsatzId, lagekarteId, initialType, initialCoordinates, onSuccess, onError }: UsePoiFormProps) => {
  const createPoiMutation = useCreatePoi(einsatzId);
  const geocodeMutation = useGeocodeAddress(einsatzId);

  // MGRS State Management
  const [coordMode, setCoordMode] = useState<'latLng' | 'mgrs'>('latLng');
  const [mgrsInput, setMgrsInput] = useState<string>('');

  const form = useForm({
    defaultValues: {
      name: '',
      adresse: '',
      latitude: initialCoordinates.lat,
      longitude: initialCoordinates.lon,
      mgrs: '',
      type: initialType as string,
      icon: undefined,
    },
    onSubmit: async ({ value }) => {
      try {
        // Zod-Validation
        const validated = poiFormSchema.parse(value);

        // API-Call via TanStack Query Mutation
        await createPoiMutation.mutateAsync({
          lagekarteId,
          type: validated.type, // Backend validates POI type via DTO
          name: validated.name,
          adresse: validated.adresse,
          // MGRS hat Priorität, wenn gesetzt und gültig
          // mgrs: coordMode === 'mgrs' && validated.mgrs ? validated.mgrs : undefined,
          // Lat/Lng als Fallback oder wenn MGRS nicht unterstützt wird
          latitude: validated.latitude,
          longitude: validated.longitude,
          icon: validated.icon,
        });

        // Toast-Notification für Erfolg
        toast.success('POI erstellt', {
          description: `"${validated.name}" wurde erfolgreich zur Karte hinzugefügt.`,
        });

        // Success callback
        onSuccess?.();
      } catch (error) {
        // Error handling
        console.error('POI-Erstellung fehlgeschlagen:', error);

        // Toast-Notification für Fehler
        const message = await getApiErrorMessage(error, 'Der POI konnte nicht erstellt werden.');
        toast.error('Fehler beim Erstellen', {
          description: message,
        });

        onError?.(error instanceof Error ? error : new Error('Unbekannter Fehler'));
      }
    },
    validatorAdapter: zodValidator(),
  });

  /**
   * Geocoding Handler
   *
   * @remarks
   * - Nur geocoden wenn Adresse mind. 5 Zeichen hat
   * - Bei Erfolg: Koordinaten werden automatisch aktualisiert
   * - Bei Fehler: Koordinaten bleiben unverändert (User kann manuell editieren)
   */
  const handleGeocode = useCallback(
    async (address: string) => {
      // Nur geocoden wenn Adresse mind. 5 Zeichen hat
      if (!address || address.trim().length < 5) {
        return;
      }

      geocodeMutation.mutate(address.trim(), {
        onSuccess: (coords) => {
          if (coords) {
            // Update Koordinaten-Felder automatisch
            form.setFieldValue('latitude', coords.lat);
            form.setFieldValue('longitude', coords.lon);
          }
          // Bei null: Adresse nicht gefunden, Koordinaten bleiben unverändert
        },
        onError: (error) => {
          console.warn('Geocoding fehlgeschlagen:', error);
          // Koordinaten bleiben bei Fehler unverändert
          // User-Feedback via Toast
          toast.error('Geocoding fehlgeschlagen', {
            description: 'Die Adresse konnte nicht gefunden werden. Bitte Koordinaten manuell eingeben.',
          });
        },
      });
    },
    [geocodeMutation, form],
  );

  /**
   * Debounced Geocoding Handler
   *
   * @remarks
   * - Wartet 1s nach letzter Eingabe bevor Geocoding-API aufgerufen wird
   * - Rate-Limit Compliance: Backend erlaubt 10 req/min, Service 1 req/s
   * - Nutzt TanStack Pacer asyncDebounce für Debouncing
   */
  const debouncedGeocode = useMemo(
    () => asyncDebounce(handleGeocode, { interval: 1000 }), // 1s Debounce Delay
    [handleGeocode],
  );

  /**
   * Bi-direktionale Synchronisation: Lat/Lng → MGRS
   *
   * @remarks
   * - Wird getriggert wenn latitude oder longitude sich ändert (via form.subscribe)
   * - Konvertiert Lat/Lng zu MGRS und aktualisiert mgrsInput State
   * - Formatiert MGRS für bessere Lesbarkeit (mit Leerzeichen)
   * - Bei Konvertierungs-Fehler bleibt mgrsInput unverändert
   * - Nutzt TanStack Form's subscribe API für reaktive Updates
   */
  const lastSyncedMgrsRef = useRef<{
    lat: number;
    lon: number;
    mgrs: string;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = form.store.subscribe(() => {
      const state = form.store.state;
      const latitude = state.values.latitude;
      const longitude = state.values.longitude;

      if (latitude === undefined || longitude === undefined || Number.isNaN(latitude) || Number.isNaN(longitude)) {
        return;
      }

      const mgrs = latLngToMgrs(latitude, longitude, 5);
      if (!mgrs) {
        return;
      }

      const formatted = formatMgrs(mgrs);
      const last = lastSyncedMgrsRef.current;
      const alreadySynced = last && last.lat === latitude && last.lon === longitude && last.mgrs === formatted;

      if (!alreadySynced) {
        lastSyncedMgrsRef.current = { lat: latitude, lon: longitude, mgrs: formatted };

        setMgrsInput((prev) => (prev === formatted ? prev : formatted));

        if (state.values.mgrs !== formatted) {
          form.setFieldValue('mgrs', formatted);
        }
      }
    });

    return () => unsubscribe();
  }, [form]);

  /**
   * MGRS Input Handler
   *
   * @remarks
   * - Wird vom Modal aufgerufen wenn User MGRS-Koordinaten eingibt
   * - Validiert MGRS-Format mit isValidMgrs()
   * - Bei gültigem MGRS: Konvertiert zu Lat/Lng und aktualisiert Form
   * - Bei ungültigem MGRS: Nur mgrsInput State wird aktualisiert (keine Lat/Lng-Änderung)
   * - Verhindert Endlos-Loop durch gezielte State-Updates
   */
  const handleMgrsChange = useCallback(
    (mgrsValue: string) => {
      setMgrsInput(mgrsValue);

      if (isValidMgrs(mgrsValue)) {
        const coords = mgrsToLatLng(mgrsValue);
        if (coords) {
          // Update Form Values (triggert useEffect, aber Loop wird verhindert)
          form.setFieldValue('latitude', coords.lat);
          form.setFieldValue('longitude', coords.lng);
          form.setFieldValue('mgrs', mgrsValue);
        }
      } else {
        // Ungültiges MGRS: Form MGRS-Feld leeren
        form.setFieldValue('mgrs', '');
      }
    },
    [form],
  );

  /**
   * Initial MGRS Berechnung
   *
   * @remarks
   * - Wird nur beim ersten Render ausgeführt
   * - Konvertiert initialCoordinates zu MGRS
   * - Setzt mgrsInput State für initiale Anzeige
   */
  useEffect(() => {
    const initialMgrs = latLngToMgrs(initialCoordinates.lat, initialCoordinates.lon, 5);
    if (initialMgrs) {
      const formatted = formatMgrs(initialMgrs);
      setMgrsInput(formatted);
      form.setFieldValue('mgrs', formatted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.setFieldValue, initialCoordinates.lat, initialCoordinates.lon]); // Nur beim initialen Mount

  return {
    form,
    isLoading: createPoiMutation.isPending,
    isError: createPoiMutation.isError,
    error: createPoiMutation.error,
    isGeocoding: geocodeMutation.isPending,
    debouncedGeocode,
    // MGRS Support
    coordMode,
    setCoordMode,
    mgrsInput,
    handleMgrsChange,
    isMgrsValid: isValidMgrs(mgrsInput),
  };
};
