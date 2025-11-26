import { api } from '@/api';
import { useLagekarte, usePois } from '@/api/hooks/useLagekarteApi';
import { Button } from '@/components/atoms/button.atom';
import { Spinner } from '@/components/atoms/spinner.atom';
import { type Layer, LayerToggle } from '@/components/molecules/lagekarte/LayerToggle/LayerToggle';
import { useColorMode } from '@/hooks/use-color-mode';
import { useCreateEtb, useEtb } from '@/hooks/useEtb';
import { captureMapScreenshot } from '@/utils/captureMapScreenshot';
import { cn } from '@/utils/cn';
import type { ShapeType } from '@/utils/drawing-styles';
import { logger } from '@/utils/logger';
import type { PoiType } from '@/utils/poi-icons';
import type * as GeoJSON from 'geojson';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { PiWarning } from 'react-icons/pi';
import { MapContainer, useMap, useMapEvents } from 'react-leaflet';
import { toast } from 'sonner';
import { MapToolbarToggle } from '../controls/MapToolbarToggle';
import { PoiPlacementControl } from '../controls/PoiPlacementControl';
import { FullscreenCloseButton } from '../FullscreenCloseButton/FullscreenCloseButton';
import { ClusteredPoiLayer } from '../layers/ClusteredPoiLayer';
import { DrawingLayer } from '../layers/DrawingLayer';
import { LayerErrorBoundary } from '../layers/LayerErrorBoundary';
import { OfflineTileLayer } from '../layers/OfflineTileLayer';
import { OfflineRegionModal } from '../modals/OfflineRegionModal';
import { PoiPlacementModal } from '../modals/PoiPlacementModal';
import { ShapeLabelModal } from '../modals/ShapeLabelModal';
import { PropertyPanel, type ShapeProperties } from '../PropertyPanel';
import { type DrawingTool, DrawingToolbar } from '../toolbar/DrawingToolbar';
import { LagekarteToolbar } from '../toolbar/LagekarteToolbar';
import { useLagekarteAutoSave } from './useLagekarteAutoSave';
import { useMapBounds } from './useMapBounds';
import { usePlacementMode } from './usePlacementMode';
import './lagekarte-view.css';

/**
 * Layout-Modi für die Lagekarte
 * @typedef LagekarteMode
 * @property {'standard'} standard - Standard-Modus mit allen UI-Elementen
 * @property {'fullscreen'} fullscreen - Fullscreen-Modus mit Close-Button
 * @property {'presentation'} presentation - Präsentations-Modus ohne Navigation
 */
export type LagekarteMode = 'standard' | 'fullscreen' | 'presentation';

/**
 * Search-Parameter für die Lagekarte-Route
 */
export type LagekarteSearchParams = {
  mode?: LagekarteMode;
};

/**
 * Props für die LagekarteView-Komponente
 */
interface LagekarteViewProps {
  /**
   * ID des Einsatzes für den die Lagekarte angezeigt wird
   * @remarks Aktuell nicht verwendet, reserviert für zukünftige Features (z.B. Einsatzort-Marker)
   */
  einsatzId: string;
  /**
   * Layout-Modus für die Lagekarte
   * @default 'standard'
   */
  mode?: LagekarteMode;
}

/**
 * Error-Handler-Komponente für Tile-Load-Failures
 * Lauscht auf 'tileerror' Events vom Leaflet Map
 */
const TileErrorHandler: React.FC<{ onError: () => void }> = ({ onError }) => {
  useMapEvents({
    tileerror: () => {
      onError();
    },
  });
  return null;
};

/**
 * Map-Click-Handler für POI-Platzierung
 * Öffnet Modal mit Koordinaten wenn Platzierungs-Modus aktiv
 */
const MapClickHandler: React.FC<{
  isPlacementActive: boolean;
  selectedType: PoiType | null;
  onMapClick: (lat: number, lon: number) => void;
}> = ({ isPlacementActive, selectedType, onMapClick }) => {
  const map = useMap();

  useEffect(() => {
    if (!isPlacementActive || !selectedType) {
      return;
    }

    const handleClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      console.log('[MapClickHandler] Map clicked in placement mode:', { lat, lng, selectedType });
      onMapClick(lat, lng);
    };

    // Add click listener with high priority
    map.on('click', handleClick);

    console.log('[MapClickHandler] Click listener registered for placement mode');

    return () => {
      map.off('click', handleClick);
      console.log('[MapClickHandler] Click listener removed');
    };
  }, [map, isPlacementActive, selectedType, onMapClick]);

  return null;
};

/**
 * Map-Bounds-Controller-Komponente
 * Verwendet useMapBounds Hook um Karte automatisch auf POIs zu zoomen
 */
const MapBoundsController: React.FC<{ einsatzId: string }> = ({ einsatzId }) => {
  const { data: pois } = usePois(einsatzId);
  useMapBounds(pois);
  return null;
};

/**
 * Map-Bounds-Tracker-Komponente
 * Holt aktuelle Map-Bounds und Map-Instanz für Offline-Download
 */
const MapBoundsTracker: React.FC<{
  onBoundsReady: (bounds: L.LatLngBounds) => void;
  onMapReady?: (map: L.Map) => void;
}> = ({ onBoundsReady, onMapReady }) => {
  const map = useMap();

  React.useEffect(() => {
    if (map) {
      const bounds = map.getBounds();
      onBoundsReady(bounds);
      onMapReady?.(map);
    }
  }, [map, onBoundsReady, onMapReady]);

  return null;
};

/**
 * Lagekarte-Komponente zur Darstellung einer interaktiven Karte mit OpenStreetMap-Tiles.
 *
 * Features:
 * - Dark-Mode Support (automatischer Wechsel zwischen OSM und CartoDB Dark Matter)
 * - Mobile-responsive Layout
 * - Deutschland-Zentrum als Default-Position
 * - Error Handling für fehlgeschlagene Tile-Loads
 * - Layout-Modi: Standard, Fullscreen, Präsentation
 *
 * @component
 * @example
 * ```tsx
 * <LagekarteView einsatzId="einsatz-123" />
 * <LagekarteView einsatzId="einsatz-123" mode="fullscreen" />
 * ```
 */
export const LagekarteView: React.FC<LagekarteViewProps> = ({ einsatzId, mode = 'standard' }) => {
  const { resolvedColorMode } = useColorMode();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Fullscreen-Indikator State (CUX-009)
  const [showFullscreenBadge, setShowFullscreenBadge] = useState(mode === 'fullscreen');

  // POI-Placement State
  const { selectedType, isPlacementActive, activatePlacementMode, deactivatePlacementMode } = usePlacementMode();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clickedCoordinates, setClickedCoordinates] = useState<{ lat: number; lon: number } | null>(null);

  // Drawing State - Default tool is 'select' (Selection Mode)
  const [selectedDrawingTool, setSelectedDrawingTool] = useState<DrawingTool>('select');
  const [isShapeLabelModalOpen, setIsShapeLabelModalOpen] = useState(false);
  const [currentShape, setCurrentShape] = useState<GeoJSON.Feature | null>(null);
  const [shapeToUpdate, setShapeToUpdate] = useState<GeoJSON.Feature | null>(null);

  // Property Panel State
  const [selectedShape, setSelectedShape] = useState<GeoJSON.Feature | null>(null);
  const [showPropertyPanel, setShowPropertyPanel] = useState(false);

  // Layer-Visibility State
  const [layers, setLayers] = useState<Layer[]>([
    { name: 'poi', label: 'POI-Marker', visible: true },
    { name: 'drawing', label: 'Zeichnungen', visible: true },
  ]);

  // Tools-Visibility State (für MapToolbarToggle)
  const [isToolsOpen, setIsToolsOpen] = useState(false);

  // Offline-Download State
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);
  const [currentMapBounds, setCurrentMapBounds] = useState<L.LatLngBounds | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  // ETB-Export State
  const [isExportingToEtb, setIsExportingToEtb] = useState(false);

  // Lagekarte-Daten (für lagekarteId + State)
  const { data: lagekarteData } = useLagekarte(einsatzId);

  // ETB-Daten (für etbId beim Export)
  const { data: etbData, refetch: refetchEtb } = useEtb(einsatzId);

  // ETB-Erstellung falls nicht vorhanden
  const createEtb = useCreateEtb();

  // Auto-Save Hook (debounced 2s)
  const { triggerAutoSave } = useLagekarteAutoSave(einsatzId);

  // Fullscreen-Badge Auto-Hide Timer (CUX-009: Fade-Out nach 3 Sekunden)
  React.useEffect(() => {
    if (mode === 'fullscreen' && showFullscreenBadge) {
      const timer = setTimeout(() => {
        setShowFullscreenBadge(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [mode, showFullscreenBadge]);

  // Tile-URL basierend auf Theme
  const tileUrl = resolvedColorMode === 'dark' ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const attribution =
    resolvedColorMode === 'dark'
      ? '&copy; <a href="https://carto.com/attributions">CARTO</a> | &copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
      : '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors';

  // Deutschland-Zentrum als Default-Position
  const defaultCenter: [number, number] = [51.1657, 10.4515];
  const defaultZoom = 6;

  /**
   * Handler für Tile-Load-Fehler
   * Setzt Error-State wenn Tiles nicht geladen werden können
   */
  const handleTileError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  /**
   * Reset Error-State und versuche erneut zu laden
   */
  const handleRetry = () => {
    setHasError(false);
    setIsLoading(true);
    // Map wird durch React re-render neu initialisiert
  };

  /**
   * Handler wenn POI-Typ aus Toolbar ausgewählt wird
   */
  const handlePoiTypeSelect = (type: PoiType) => {
    activatePlacementMode(type);
  };

  /**
   * Handler wenn User auf Karte klickt (im Platzierungs-Modus)
   */
  const handleMapClick = (lat: number, lon: number) => {
    setClickedCoordinates({ lat, lon });
    setIsModalOpen(true);
  };

  /**
   * Handler wenn Modal geschlossen wird
   */
  const handleModalClose = () => {
    setIsModalOpen(false);
    setClickedCoordinates(null);
    deactivatePlacementMode();
  };

  /**
   * Handler wenn Drawing-Tool aus Toolbar ausgewählt wird
   */
  const handleDrawingToolSelect = useCallback((tool: DrawingTool) => {
    setSelectedDrawingTool(tool);
  }, []);

  /**
   * Handler wenn Shapes sich ändern (für Backend-Persistierung)
   * Debounced Auto-Save: Speichert nach 2s Inaktivität
   */
  const handleShapesChange = useCallback(
    (shapes: GeoJSON.FeatureCollection) => {
      // Trigger debounced auto-save (2s delay)
      triggerAutoSave(shapes);
    },
    [triggerAutoSave],
  );

  /**
   * Handler wenn neuer Shape erstellt wurde (öffnet Label-Modal)
   * WICHTIG: Text-Marker werden ausgeschlossen - sie haben ihr eigenes Edit-Interface
   */
  const handleShapeCreated = useCallback((shape: GeoJSON.Feature) => {
    // Text-Marker sind Points - aber wir müssen sie von normalen Shapes unterscheiden
    // Normale Shapes (Polygon, LineString) öffnen das Modal
    // Points können Text-Marker ODER Shapes sein, also prüfen wir die Geometry
    const isTextMarker = shape.geometry.type === 'Point';

    if (!isTextMarker) {
      setCurrentShape(shape);
      setIsShapeLabelModalOpen(true);
    }
  }, []);

  /**
   * Handler wenn Shape-Limit erreicht wird
   */
  const handleShapeLimitReached = useCallback(() => {
    toast.error('Maximale Anzahl erreicht', {
      description: 'Es können maximal 100 Zeichnungen pro Lagekarte erstellt werden.',
    });
  }, []);

  /**
   * Handler wenn Shape-Label gespeichert wird
   */
  const handleShapeLabelSave = useCallback(
    (label: string, type: ShapeType) => {
      if (!currentShape) return;

      // Update shape properties with label and type
      const updatedShape: GeoJSON.Feature = {
        ...currentShape,
        properties: {
          ...currentShape.properties,
          label,
          type,
        },
      };

      // Trigger shape update in DrawingLayer
      setShapeToUpdate(updatedShape);

      // Close modal
      setIsShapeLabelModalOpen(false);
      setCurrentShape(null);
    },
    [currentShape],
  );

  /**
   * Handler wenn Shape-Update abgeschlossen ist
   */
  const handleShapeUpdateComplete = useCallback(() => {
    setShapeToUpdate(null);
  }, []);

  /**
   * Handler für Property-Änderungen aus PropertyPanel
   * Aktualisiert Shape-Style und triggert Backend-Update
   */
  const handlePropertiesChange = useCallback(
    (shapeId: string, properties: Partial<ShapeProperties>) => {
      if (!lagekarteData?.data?.state) return;

      // Find shape in current state
      const currentState = lagekarteData.data.state as GeoJSON.FeatureCollection;
      const shapeIndex = currentState.features.findIndex((f) => f.properties?.id === shapeId);

      if (shapeIndex === -1) return;

      // Update shape properties
      const updatedShape: GeoJSON.Feature = {
        ...currentState.features[shapeIndex],
        properties: {
          ...currentState.features[shapeIndex].properties,
          ...properties,
        },
      };

      // Trigger shape update in DrawingLayer
      setShapeToUpdate(updatedShape);

      // Also update selectedShape to reflect changes in PropertyPanel
      setSelectedShape(updatedShape);
    },
    [lagekarteData],
  );

  /**
   * Handler wenn Shape selektiert wird (öffnet Property Panel)
   */
  const handleShapeSelected = useCallback((shape: GeoJSON.Feature | null) => {
    setSelectedShape(shape);
    setShowPropertyPanel(!!shape); // Open panel if shape is selected, close if null
  }, []);

  /**
   * Handler für Layer-Toggle
   */
  const handleLayerToggle = useCallback((layerName: string) => {
    setLayers((prevLayers) => prevLayers.map((layer) => (layer.name === layerName ? { ...layer, visible: !layer.visible } : layer)));
  }, []);

  /**
   * Handler für Offline-Download-Button
   */
  const handleOfflineDownloadClick = useCallback(() => {
    setIsOfflineModalOpen(true);
  }, []);

  /**
   * Handler wenn Map-Bounds bereit sind (für Offline-Modal)
   */
  const handleBoundsReady = useCallback((bounds: L.LatLngBounds) => {
    setCurrentMapBounds(bounds);
  }, []);

  /**
   * Handler für ETB-Export-Button
   *
   * **Flow:**
   * 1. Capture screenshot from map
   * 2. Upload screenshot to backend
   * 3. Create ETB entry with screenshot metadata
   * 4. Show success toast
   *
   * **Error Handling:**
   * - Upload failure → Show error toast with retry option
   * - ETB creation failure → Delete uploaded screenshot (cleanup)
   */
  const handleExportToEtb = useCallback(async () => {
    console.log('[ETB Export] Handler aufgerufen', { mapInstance: !!mapInstance, etbData, etbId: etbData?.id });

    if (!mapInstance) {
      console.log('[ETB Export] Validation failed', { hasMapInstance: false });
      toast.error('Fehler beim Export', {
        description: 'Karte noch nicht geladen',
      });
      return;
    }

    setIsExportingToEtb(true);

    console.log('[ETB Export] Handler aufgerufen', { etbData });

    // Bei fehlendem ETB: Automatisch erstellen (für bestehende Einsätze ohne ETB)
    let targetEtbId = etbData?.id;
    if (!targetEtbId) {
      console.log('[ETB Export] Kein ETB vorhanden, erstelle neues ETB für Einsatz', einsatzId);
      try {
        const newEtb = await createEtb.mutateAsync({ einsatzId });
        targetEtbId = newEtb.id;
        console.log('[ETB Export] ETB erstellt:', targetEtbId);
        // ETB-Daten aktualisieren für zukünftige Exports
        await refetchEtb();
      } catch (error: unknown) {
        // 409 Conflict = ETB existiert bereits, Daten neu laden
        const isConflict = error instanceof Error && 'response' in error && (error as { response?: { status?: number } }).response?.status === 409;
        if (isConflict) {
          console.log('[ETB Export] ETB existiert bereits (409), lade Daten neu');
          const refetchResult = await refetchEtb();
          targetEtbId = refetchResult.data?.id;
          if (!targetEtbId) {
            console.error('[ETB Export] ETB existiert laut 409, aber konnte nicht geladen werden');
            setIsExportingToEtb(false);
            toast.error('Fehler beim Export', {
              description: 'ETB existiert, konnte aber nicht geladen werden.',
            });
            return;
          }
          console.log('[ETB Export] ETB nach Refetch gefunden:', targetEtbId);
        } else {
          console.error('[ETB Export] ETB-Erstellung fehlgeschlagen:', error);
          setIsExportingToEtb(false);
          toast.error('Fehler beim Export', {
            description: 'ETB konnte nicht erstellt werden. Bitte versuche es erneut.',
          });
          return;
        }
      }
    }

    console.log('[ETB Export] Starting export for ETB', targetEtbId);
    let uploadedScreenshotUrl: string | null = null;

    try {
      // Step 1: Capture screenshot
      const mapContainer = mapInstance.getContainer();
      const screenshotBlob = await captureMapScreenshot(mapContainer);

      // Extract actual dimensions from blob
      const screenshotUrl = URL.createObjectURL(screenshotBlob);
      const img = new Image();
      img.src = screenshotUrl;

      // Wait for image to load to get dimensions
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load screenshot image'));
      });

      const screenshotWidth = img.naturalWidth;
      const screenshotHeight = img.naturalHeight;

      // Cleanup object URL
      URL.revokeObjectURL(screenshotUrl);

      // Step 2: Upload screenshot
      // API-Client erstellt automatisch FormData für multipart/form-data
      const uploadResponse = await api.lagekarte().lagekarteControllerUploadScreenshotVAlpha({
        einsatzId,
        file: screenshotBlob,
      });

      uploadedScreenshotUrl = uploadResponse.data.url as string;

      // Step 3: Create ETB entry with actual screenshot dimensions
      try {
        await api.etb().etbControllerCreateEintragVAlpha({
          id: targetEtbId,
          createEtbEintragDto: {
            kategorie: 'DOKUMENTATION',
            text: 'Lagekarten-Screenshot',
            metadata: {
              screenshot: {
                url: uploadedScreenshotUrl,
                width: screenshotWidth,
                height: screenshotHeight,
                timestamp: new Date().toISOString(),
              },
            },
          },
        });
      } catch (etbError) {
        // Log the actual error for debugging
        logger.error('ETB entry creation failed', etbError);

        // Cleanup: Delete uploaded screenshot if ETB creation fails
        if (uploadedScreenshotUrl) {
          try {
            // Extract filename from URL using URL API (robust against encoded characters)
            const url = new URL(uploadedScreenshotUrl, window.location.origin);
            const filename = url.pathname.split('/').pop();
            if (filename) {
              await api.lagekarte().lagekarteControllerDeleteScreenshotVAlpha({
                einsatzId,
                filename,
              });
            }
          } catch (cleanupError) {
            logger.error('Failed to cleanup screenshot after ETB error', cleanupError);
          }
        }
        // Re-throw the original error for better error messages
        throw etbError;
      }

      // Success!
      toast.success('Screenshot erfolgreich ins ETB exportiert', {
        description: 'Der Screenshot wurde als ETB-Eintrag gespeichert',
      });
    } catch (error) {
      logger.error('ETB export failed', error);

      // Show error toast with retry option
      toast.error('Fehler beim ETB-Export', {
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
        action: {
          label: 'Retry',
          onClick: () => handleExportToEtb(),
        },
      });
    } finally {
      setIsExportingToEtb(false);
    }
  }, [mapInstance, etbData, einsatzId, createEtb, refetchEtb]);

  // Error-State anzeigen
  if (hasError) {
    return (
      <div
        className={cn(
          'w-full overflow-hidden rounded-lg',
          'flex flex-col items-center justify-center',
          'bg-gray-50 dark:bg-gray-800',
          'border-2 border-gray-300 border-dashed dark:border-gray-600',
          // Mode-specific heights
          mode === 'standard' && 'h-[600px] md:h-[calc(100vh-120px)]',
          (mode === 'fullscreen' || mode === 'presentation') && 'h-screen',
        )}
        role="alert"
        aria-live="assertive"
      >
        <PiWarning className="mb-4 h-12 w-12 text-orange-500" />
        <h3 className="mb-2 font-semibold text-gray-900 text-lg dark:text-gray-100">Karte konnte nicht geladen werden</h3>
        <p className="mb-4 text-center text-gray-600 text-sm dark:text-gray-400">
          Die Karten-Tiles konnten nicht vom Server geladen werden.
          <br />
          Bitte überprüfen Sie Ihre Internetverbindung.
        </p>
        <Button intent="primary" appearance="filled" size="md" onClick={handleRetry}>
          Erneut versuchen
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Fullscreen-Close-Button (nur im Fullscreen-Modus) */}
      {mode === 'fullscreen' && <FullscreenCloseButton />}

      {/* Fullscreen-Indikator Badge (CUX-009) */}
      {mode === 'fullscreen' && showFullscreenBadge && (
        <output
          className={cn(
            'fixed top-4 left-4 z-[9999]',
            'flex items-center gap-2 rounded-lg px-4 py-2',
            'border border-blue-300 bg-blue-50/90 backdrop-blur-lg',
            'dark:border-blue-800 dark:bg-blue-950/50',
            'shadow-lg',
            'transition-opacity duration-500',
            showFullscreenBadge ? 'opacity-100' : 'opacity-0',
          )}
          aria-label="Vollbildmodus aktiv"
        >
          <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400" />
          <span className="font-medium text-blue-900 text-sm dark:text-blue-100">Vollbildmodus</span>
        </output>
      )}

      {/* POI-Platzierungs-Modal */}
      {isModalOpen && selectedType && clickedCoordinates && lagekarteData?.data && (
        <PoiPlacementModal isOpen={isModalOpen} onClose={handleModalClose} poiType={selectedType} coordinates={clickedCoordinates} einsatzId={einsatzId} lagekarteId={lagekarteData?.data?.id} />
      )}

      {/* Shape-Label-Modal */}
      {isShapeLabelModalOpen && currentShape && <ShapeLabelModal isOpen={isShapeLabelModalOpen} onClose={() => setIsShapeLabelModalOpen(false)} shape={currentShape} onSave={handleShapeLabelSave} />}

      {/* Offline-Region-Modal */}
      {isOfflineModalOpen && (
        <OfflineRegionModal isOpen={isOfflineModalOpen} onClose={() => setIsOfflineModalOpen(false)} currentMapBounds={currentMapBounds || undefined} map={mapInstance || undefined} />
      )}

      {/* Property Panel */}
      {showPropertyPanel && (
        <PropertyPanel
          selectedShape={selectedShape}
          onPropertiesChange={handlePropertiesChange}
          onClose={() => {
            setShowPropertyPanel(false);
            setSelectedShape(null);
          }}
        />
      )}

      {/* Karten-Container */}
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-lg',
          // Mode-specific heights
          mode === 'standard' && 'h-[600px] md:h-[calc(100vh-180px)]',
          (mode === 'fullscreen' || mode === 'presentation') && 'h-screen',
        )}
      >
        {/* Werkzeuge-Container (Flexbox für automatisches Layout) - nur im Standard-Modus */}
        {mode === 'standard' && (
          <div className="absolute top-40 left-2.5 z-[10] hidden flex-col gap-2 md:flex">
            {/* Map-Werkzeuge Toggle-Button */}
            <MapToolbarToggle isOpen={isToolsOpen} onToggle={setIsToolsOpen} />

            {/* POI-Platzierungs-Control (nur sichtbar wenn Tools geöffnet) */}
            {isToolsOpen && (
              <PoiPlacementControl
                onPoiTypeSelect={handlePoiTypeSelect}
                onCancel={deactivatePlacementMode}
                selectedType={selectedType}
                isPlacementActive={isPlacementActive}
                isModalOpen={isModalOpen}
              />
            )}

            {/* Drawing-Toolbar (nur sichtbar wenn Tools geöffnet) */}
            {isToolsOpen && <DrawingToolbar onToolSelect={handleDrawingToolSelect} selectedTool={selectedDrawingTool} />}
          </div>
        )}

        {/* Lagekarte-Toolbar (Top-Right) - nur im Standard-Modus */}
        {mode === 'standard' && (
          <div className="absolute top-2.5 right-2.5 z-[10]">
            <LagekarteToolbar onOfflineDownloadClick={handleOfflineDownloadClick} onEtbExportClick={handleExportToEtb} isExportingToEtb={isExportingToEtb} />
          </div>
        )}

        {/* Layer-Toggle - nur im Standard-Modus */}
        {mode === 'standard' && <LayerToggle layers={layers} onToggle={handleLayerToggle} />}

        {isLoading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/80 dark:bg-gray-900/80">
            <Spinner type="ring" size="lg" />
          </div>
        )}
        <MapContainer
          center={defaultCenter}
          zoom={defaultZoom}
          preferCanvas={true}
          className={cn('h-full w-full', isPlacementActive && 'placement-active')}
          scrollWheelZoom={true}
          whenReady={() => setIsLoading(false)}
          aria-label="Lagekarte"
        >
          <OfflineTileLayer url={tileUrl} attribution={attribution} />
          <TileErrorHandler onError={handleTileError} />
          <MapClickHandler isPlacementActive={isPlacementActive} selectedType={selectedType} onMapClick={handleMapClick} />

          {/* POI-Layer (conditionally rendered based on layer visibility) */}
          {layers.find((l) => l.name === 'poi')?.visible && (
            <LayerErrorBoundary layerName="POI-Layer">
              <ClusteredPoiLayer einsatzId={einsatzId} />
            </LayerErrorBoundary>
          )}

          {/* Drawing-Layer (conditionally rendered based on layer visibility) */}
          {(() => {
            const shouldRender = layers.find((l) => l.name === 'drawing')?.visible && lagekarteData?.data;
            console.log('[LagekarteView] DrawingLayer render check:', {
              shouldRender,
              isPlacementActive,
              hasDrawingLayer: !!layers.find((l) => l.name === 'drawing')?.visible,
              hasData: !!lagekarteData?.data,
            });
            return shouldRender;
          })() && (
            <DrawingLayer
              einsatzId={einsatzId}
              selectedTool={selectedDrawingTool}
              initialState={lagekarteData.data.state as GeoJSON.FeatureCollection | undefined}
              shapeToUpdate={shapeToUpdate}
              onShapesChange={handleShapesChange}
              onShapeCreated={handleShapeCreated}
              onShapeLimitReached={handleShapeLimitReached}
              onShapeUpdateComplete={handleShapeUpdateComplete}
              onShapeSelected={handleShapeSelected}
              isPlacementModeActive={isPlacementActive}
            />
          )}

          <MapBoundsController einsatzId={einsatzId} />
          <MapBoundsTracker onBoundsReady={handleBoundsReady} onMapReady={setMapInstance} />
        </MapContainer>
      </div>
    </>
  );
};
