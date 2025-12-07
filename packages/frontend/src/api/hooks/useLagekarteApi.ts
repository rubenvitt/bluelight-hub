import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import type { AddPoiDto, CreateLagekarteDto, LagekarteControllerGetLagekarteVAlpha200Response, LagekarteDto, PoiDto, SaveLagekarteStateDto, UpdatePoiPositionDto } from '@bluelight-hub/shared/client';
import { api } from '../api';
import type * as GeoJSON from 'geojson';
import { LAGEKARTE_QUERY_KEYS } from '../../queryKeys';
import { z } from 'zod';

/**
 * Zod-Schema für GeoJSON FeatureCollection Validierung
 *
 * @remarks
 * Validiert die Grundstruktur einer GeoJSON FeatureCollection für Lagekarte-State.
 * Tiefe Validierung der Features wird nicht durchgeführt, da das Format variabel ist.
 */
const geoJsonFeatureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(
    z.object({
      type: z.literal('Feature'),
      geometry: z.object({
        type: z.string(),
        coordinates: z.unknown(),
      }),
      properties: z.record(z.unknown()).nullable(),
    }),
  ),
});

/**
 * TanStack Query Hook zum Abrufen aller POIs einer Lagekarte
 *
 * @param lagekarteId - Die ID der Lagekarte
 * @returns Query result mit POI-Daten, Loading- und Error-State
 *
 * @remarks
 * - Verwendet TanStack Query für automatisches Caching und Refetching
 * - Query Key: `LAGEKARTE_QUERY_KEYS.pois(lagekarteId)`
 * - Nutzt die neue LagekarteCQRS API für POI-Operationen
 *
 * @example
 * ```tsx
 * const { data: pois, isLoading, error } = usePois('lagekarte-123');
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <ErrorMessage />;
 *
 * return pois?.map(poi => <PoiMarker key={poi.id} poi={poi} />);
 * ```
 */
export const usePois = (lagekarteId: string | undefined): UseQueryResult<PoiDto[], Error> => {
  return useQuery({
    queryKey: LAGEKARTE_QUERY_KEYS.pois(lagekarteId ?? ''),
    queryFn: async () => {
      if (!lagekarteId) return [];
      return await api.lagekarteCqrs().lagekarteCqrsControllerGetPoisVAlpha({ lagekarteId });
    },
    enabled: !!lagekarteId, // Nur fetchen wenn lagekarteId vorhanden
  });
};

/**
 * TanStack Query Hook zum Abrufen der Lagekarte eines Einsatzes
 *
 * @param einsatzId - Die ID des Einsatzes
 * @returns Query result mit Lagekarten-Daten, Loading- und Error-State
 *
 * @remarks
 * - Verwendet TanStack Query für automatisches Caching und Refetching
 * - Query Key: `LAGEKARTE_QUERY_KEYS.lagekarte(einsatzId)`
 * - 404 Handling: Gibt `undefined` zurück wenn Lagekarte nicht existiert (kein Error-Toast)
 * - Backend: Wirft NotFoundException wenn Lagekarte nicht gefunden
 *
 * @example
 * ```tsx
 * const { data: lagekarte, isLoading } = useLagekarte('einsatz-123');
 * // data ist undefined wenn Lagekarte noch nicht erstellt wurde
 * ```
 */
export const useLagekarte = (einsatzId: string): UseQueryResult<LagekarteControllerGetLagekarteVAlpha200Response | undefined, Error> => {
  return useQuery({
    queryKey: LAGEKARTE_QUERY_KEYS.lagekarte(einsatzId),
    queryFn: async () => {
      try {
        return await api.lagekarte().lagekarteControllerGetLagekarteVAlpha({ einsatzId });
      } catch (error) {
        // 404 ist kein Fehler - Lagekarte existiert einfach noch nicht
        // Kein Toast, kein Error - return undefined
        const statusCode = (error as { status?: number })?.status || (error as { response?: { status?: number } })?.response?.status;

        if (statusCode === 404) {
          return undefined;
        }

        throw error;
      }
    },
    enabled: !!einsatzId, // Nur fetchen wenn einsatzId vorhanden
    retry: (failureCount, error) => {
      // Kein Retry bei 404
      const statusCode = (error as { status?: number })?.status || (error as { response?: { status?: number } })?.response?.status;
      if (statusCode === 404) return false;
      return failureCount < 3;
    },
    networkMode: 'offlineFirst', // Enable offline-first mode (AC: IV2)
  });
};

/**
 * TanStack Mutation Hook zum Erstellen einer Lagekarte
 *
 * @param einsatzId - Die ID des Einsatzes (für Query Invalidation)
 * @returns Mutation result mit mutate-Funktion, Loading- und Error-State
 *
 * @remarks
 * - Verwendet TanStack Query Mutation für Lagekarte-Erstellung
 * - Nach erfolgreicher Erstellung wird die Lagekarte-Query invalidiert (automatischer Refetch)
 * - OnSuccess: Invalidiert `LAGEKARTE_QUERY_KEYS.lagekarte(einsatzId)` Query
 *
 * @example
 * ```tsx
 * const createLagekarteMutation = useCreateLagekarte('einsatz-123');
 *
 * createLagekarteMutation.mutate({
 *   einsatzId: 'einsatz-123',
 * });
 * ```
 */
export const useCreateLagekarte = (einsatzId: string): UseMutationResult<LagekarteDto, Error, CreateLagekarteDto> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateLagekarteDto) => {
      return await api.lagekarteCqrs().lagekarteCqrsControllerCreateLagekarteVAlpha({ createLagekarteDto: data });
    },
    onSuccess: () => {
      // Invalidate Lagekarte-Query um Neuabfrage zu triggern
      queryClient.invalidateQueries({ queryKey: LAGEKARTE_QUERY_KEYS.lagekarte(einsatzId) });
    },
  });
};

/**
 * TanStack Mutation Hook zum Erstellen eines POI
 *
 * @param lagekarteId - Die ID der Lagekarte (für Query Invalidation)
 * @returns Mutation result mit mutate-Funktion, Loading- und Error-State
 *
 * @remarks
 * - Verwendet TanStack Query Mutation für optimistic updates
 * - Nach erfolgreicher Erstellung wird die POI-Liste neu gefetcht (invalidateQueries)
 * - Mutation Key: keine (einmaliger API-Call)
 * - OnSuccess: Invalidiert `LAGEKARTE_QUERY_KEYS.pois(lagekarteId)` Query
 *
 * @example
 * ```tsx
 * const createPoiMutation = useCreatePoi('lagekarte-456');
 *
 * createPoiMutation.mutate({
 *   name: 'Einsatzstelle',
 *   coordinate: { lat: 51.1, lng: 10.1 },
 *   category: 'EINSATZSTELLE',
 * });
 * ```
 */
export const useCreatePoi = (lagekarteId: string): UseMutationResult<PoiDto, Error, AddPoiDto> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddPoiDto) => {
      return await api.lagekarteCqrs().lagekarteCqrsControllerAddPoiVAlpha({ lagekarteId, addPoiDto: data });
    },
    onSuccess: () => {
      // Invalidate POI-Liste um Neuabfrage zu triggern
      queryClient.invalidateQueries({ queryKey: LAGEKARTE_QUERY_KEYS.pois(lagekarteId) });
    },
  });
};

/**
 * TanStack Mutation Hook zum Aktualisieren der Position eines POI
 *
 * @returns Mutation result mit mutate-Funktion, Loading- und Error-State
 *
 * @remarks
 * - Mutation-Data enthält `{ poiId: string, lagekarteId: string, data: UpdatePoiPositionDto }`
 * - Nach Update wird die POI-Liste invalidiert (automatischer Refetch)
 * - OnSuccess: Invalidiert `LAGEKARTE_QUERY_KEYS.pois(lagekarteId)` Query
 *
 * @example
 * ```tsx
 * const updatePoiMutation = useUpdatePoi();
 *
 * updatePoiMutation.mutate({
 *   poiId: 'poi-123',
 *   lagekarteId: 'lagekarte-456',
 *   data: { coordinate: { lat: 51.2, lng: 10.2 } },
 * });
 * ```
 */
export const useUpdatePoi = (): UseMutationResult<PoiDto, Error, { poiId: string; lagekarteId: string; data: UpdatePoiPositionDto }> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ poiId, lagekarteId, data }) => {
      return await api.lagekarteCqrs().lagekarteCqrsControllerUpdatePoiPositionVAlpha({ lagekarteId, poiId, updatePoiPositionDto: data });
    },
    onSuccess: (_data, variables) => {
      // Invalidate POI-Liste um Neuabfrage zu triggern
      queryClient.invalidateQueries({ queryKey: LAGEKARTE_QUERY_KEYS.pois(variables.lagekarteId) });
    },
  });
};

/**
 * TanStack Mutation Hook zum Löschen eines POI
 *
 * @returns Mutation result mit mutate-Funktion, Loading- und Error-State
 *
 * @remarks
 * - Mutation-Data enthält `{ poiId: string, lagekarteId: string }`
 * - Nach Löschen wird die POI-Liste invalidiert (automatischer Refetch)
 * - OnSuccess: Invalidiert `LAGEKARTE_QUERY_KEYS.pois(lagekarteId)` Query
 *
 * @example
 * ```tsx
 * const deletePoiMutation = useDeletePoi();
 *
 * deletePoiMutation.mutate({
 *   poiId: 'poi-123',
 *   lagekarteId: 'lagekarte-456',
 * });
 * ```
 */
export const useDeletePoi = (): UseMutationResult<void, Error, { poiId: string; lagekarteId: string }> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ poiId, lagekarteId }) => {
      await api.lagekarteCqrs().lagekarteCqrsControllerRemovePoiVAlpha({ lagekarteId, poiId });
    },
    onSuccess: (_data, variables) => {
      // Invalidate POI-Liste um Neuabfrage zu triggern
      queryClient.invalidateQueries({ queryKey: LAGEKARTE_QUERY_KEYS.pois(variables.lagekarteId) });
    },
  });
};

/**
 * TanStack Mutation Hook zum Speichern des Lagekarte-State (GeoJSON)
 *
 * @param einsatzId - Die ID des Einsatzes (für Query Invalidation)
 * @returns Mutation result mit mutate-Funktion, Loading- und Error-State
 *
 * @remarks
 * - Verwendet TanStack Query Mutation für State-Persistierung
 * - State enthält GeoJSON FeatureCollection mit Zeichnungen (Polygone, Linien, Rechtecke)
 * - Nach erfolgreicher Speicherung wird die Lagekarte-Query neu gefetcht (invalidateQueries)
 * - OnSuccess: Invalidiert `LAGEKARTE_QUERY_KEYS.lagekarte(einsatzId)` Query
 * - Security: Validiert GeoJSON-Struktur und Payload-Größe (max 2MB)
 *
 * @example
 * ```tsx
 * const saveLagekarteStateMutation = useSaveLagekarteState('einsatz-123');
 *
 * saveLagekarteStateMutation.mutate({
 *   type: 'FeatureCollection',
 *   features: [...shapes]
 * });
 * ```
 */
export const useSaveLagekarteState = (einsatzId: string): UseMutationResult<LagekarteControllerGetLagekarteVAlpha200Response, Error, GeoJSON.FeatureCollection> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (state: GeoJSON.FeatureCollection) => {
      // Validate GeoJSON structure with Zod schema
      const parseResult = geoJsonFeatureCollectionSchema.safeParse(state);
      if (!parseResult.success) {
        throw new Error(`Invalid GeoJSON FeatureCollection: ${parseResult.error.message}`);
      }

      // Validate payload size (max 2MB)
      const payloadSize = JSON.stringify(state).length;
      const MAX_PAYLOAD_SIZE = 2 * 1024 * 1024; // 2MB
      if (payloadSize > MAX_PAYLOAD_SIZE) {
        throw new Error(`Payload zu groß: ${Math.round(payloadSize / 1024)}KB (max 2MB)`);
      }

      // Call API - parseResult.data ist bereits validiert und typsicher
      const dto: SaveLagekarteStateDto = {
        einsatzId,
        state: parseResult.data as object, // Sicher durch Zod-Validierung
      };

      return await api.lagekarte().lagekarteControllerSaveLagekarteStateVAlpha({
        einsatzId,
        saveLagekarteStateDto: dto,
      });
    },
    onSuccess: () => {
      // Invalidate Lagekarte-Query um Neuabfrage zu triggern
      queryClient.invalidateQueries({ queryKey: LAGEKARTE_QUERY_KEYS.lagekarte(einsatzId) });
    },
    networkMode: 'offlineFirst', // Queue mutations when offline (AC: IV2)
  });
};

/**
 * TanStack Mutation Hook zum Geocoding einer Adresse
 *
 * @param einsatzId - Die ID des Einsatzes (für API-Kontext)
 * @returns Mutation result mit mutate-Funktion, Loading- und Error-State
 *
 * @remarks
 * - Konvertiert Textadresse zu geografischen Koordinaten via Nominatim API
 * - Rate-Limited (Backend: 10 req/min, Service: 1 req/s)
 * - Gibt `null` zurück bei Fehler oder wenn keine Ergebnisse gefunden
 * - Sollte mit Debouncing verwendet werden (1s delay empfohlen)
 *
 * @example
 * ```tsx
 * const geocodeMutation = useGeocodeAddress('einsatz-123');
 *
 * geocodeMutation.mutate('Hauptstraße 1, 10115 Berlin', {
 *   onSuccess: (coords) => {
 *     if (coords) {
 *       setLatitude(coords.lat);
 *       setLongitude(coords.lon);
 *     } else {
 *       showToast('Adresse nicht gefunden');
 *     }
 *   },
 * });
 * ```
 */
export const useGeocodeAddress = (einsatzId: string): UseMutationResult<{ lat: number; lon: number } | null, Error, string> => {
  return useMutation({
    mutationFn: async (address: string) => {
      const response = await api.geocoding().geocodingControllerGeocodeAddressVAlpha({
        einsatzId,
        geocodeAddressDto: { address },
      });

      // Response hat Struktur: { data: { lat, lon } | null }
      return response.data as { lat: number; lon: number } | null;
    },
  });
};
