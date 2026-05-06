import { MAP_DEFAULTS, getDwdWmsTileUrl } from '@/features/lagekarte/utils/map-config';
import { useMapLayer } from '@/features/lagekarte/hooks/use-map-layer';
import { useMapDetail } from '@/features/lagekarte/hooks/use-map-detail';
import { useNinaMapData } from '@/features/lagekarte/api/use-nina-map-data';
import { useLagekarte } from '@/features/lagekarte/api/use-lagekarte';
import { useLagekarteWebSocketStatus } from '@/features/lagekarte/api/use-lagekarte-websocket';
import { useDrawControl } from '@/features/lagekarte/hooks/use-draw-control';
import { useLagekarteSync, type UseLagekarteSyncReturn } from '@/features/lagekarte/hooks/use-lagekarte-sync';
import { useFeatureMeasurement } from '@/features/lagekarte/hooks/use-feature-measurement';
import { useLagekartePermissions } from '@/features/lagekarte/hooks/use-lagekarte-permissions';
import { useOsmMarkierung } from '@/features/lagekarte/hooks/use-osm-markierung';
import { useGamsZonen } from '@/features/lagekarte/hooks/use-gams-zonen';
import { useSnapControl } from '@/features/lagekarte/hooks/use-snap-control';
import { useSymbolMarker } from '@/features/lagekarte/hooks/use-symbol-marker';
import { drawStore, toggleSnapEnabled, toggleSymbolPanel, toggleTemplatePanel, clearPendingZeichenPlacement, openZeichenDetail, closeZeichenDetail } from '@/features/lagekarte/stores/draw.store';
import { DEFAULT_DRAWING_STYLE } from '@/features/lagekarte/drawing/types';
import type { DrawingStyle, HatchConfig } from '@/features/lagekarte/drawing/types';
import type { ShapeTemplate } from '@/features/lagekarte/drawing/templates/template-registry';
import { DEFAULT_HATCH } from '@/features/lagekarte/drawing/types';
import { ensureHatchImage, migrateLegacyFillPattern, reregisterHatchImages } from '@/features/lagekarte/drawing/hatch-patterns';
import { EMPTY_PATTERN_IMAGE } from '@/features/lagekarte/drawing/draw-styles';
import { ConnectionStatusBadge } from '../../atoms/ConnectionStatusBadge.atom';
import { Spinner } from '@/shared/ui/atoms/spinner.atom';
import { cn } from '@/shared/ui/cn';
import { bbox } from '@turf/turf';
import type * as GeoJSON from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import type * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Map, NavigationControl, Popup, Source } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre';
import { useStore } from '@tanstack/react-store';
import { MapLayerSwitcher } from '../../molecules/MapLayerSwitcher.molecule';
import { MapDetailPopup } from '../../molecules/MapDetailPopup.molecule';
import { MapDetailPanel } from '../../molecules/MapDetailPanel.molecule';
import { DrawToolbar } from '../../molecules/DrawToolbar.molecule';
import { DrawShortcutBar } from '../../molecules/DrawShortcutBar.molecule';
import { DrawStylePanel } from '../../molecules/DrawStylePanel.molecule';
import { ShapeTemplatePanel } from '../../molecules/ShapeTemplatePanel.molecule';
import { SymbolLibraryPanel } from '../../molecules/SymbolLibraryPanel.molecule';
import { OsmMarkierungPopup } from '../../molecules/OsmMarkierungPopup.molecule';
import { GamsZonenPanel } from '../../molecules/GamsZonenPanel.molecule';
import { FullscreenCloseButton } from '../FullscreenCloseButton/FullscreenCloseButton';
import { NinaGeoJsonLayer } from '../../molecules/NinaGeoJsonLayer.molecule';
import { TaktischeZeichenLayer } from '../../molecules/TaktischeZeichenLayer.molecule';
import { SecurityPostMapMarker } from '@/features/eigenschutz';
import { GhostZeichenMarker } from '../../molecules/GhostZeichenMarker.molecule';
import { KartenZeichenSidebar } from '../../molecules/KartenZeichenSidebar.molecule';
import { GefahrenToolsSidebar } from '../../molecules/GefahrenToolsSidebar.molecule';
import { ZeichenDetailPanel } from '../../molecules/ZeichenDetailPanel.molecule';
import { useEinsatzZeichen, useCreateZeichen, usePlaceZeichen } from '@/features/taktische-zeichen';
import { GefahrenzoneHost } from '@/features/gefahrenzone';
import { useZeichenDrag } from '@/features/lagekarte/hooks/use-zeichen-drag';
import { toast } from 'sonner';
import '@/features/lagekarte/detail-providers';
import './lagekarte-view.css';

/** Stabile Referenz für DWD WMS-Tile-URL (verhindert unnötige Source-Neuregistrierungen) */
const DWD_TILE_URL = [getDwdWmsTileUrl()];

export type LagekarteMode = 'standard' | 'fullscreen' | 'presentation';

export type LagekarteSearchParams = {
  mode?: LagekarteMode;
};

interface LagekarteViewProps {
  einsatzId: string;
  mode?: LagekarteMode;
  /**
   * Deep-Link-Fokus (Issue #627, G3). Aktuell unterstützt: `zone:{zoneId}` —
   * öffnet das `GefahrenzoneDetailPanel` für die angegebene Zone, sobald die
   * Query-Daten geladen sind.
   */
  focus?: string;
}

export const LagekarteView: React.FC<LagekarteViewProps> = ({ einsatzId, mode = 'standard', focus }) => {
  const { resolvedStyle, selectedBaseLayer, dwdOverlayEnabled, availableLayers, ninaOverlays } = useMapLayer(einsatzId);
  const { data: ninaGeoJson } = useNinaMapData();
  const [isLoading, setIsLoading] = useState(true);
  const mapRef = useRef<MapRef | null>(null);
  const { results, coordinate, panelIndex, isPanelOpen, isLoading: isDetailLoading, handleMapClick, openPanel, navigatePanel, closePanel, clearSelection } = useMapDetail(mapRef);

  // Berechtigungen
  const { canDraw: canDrawPermission } = useLagekartePermissions();
  // Im Präsentationsmodus darf nicht gezeichnet werden
  const canDraw = mode !== 'presentation' && canDrawPermission;

  // WebSocket-Verbindungsstatus (global, ohne eigene Verbindung)
  const wsIsConnected = useLagekarteWebSocketStatus();

  // Polling-Fallback: 5s Polling wenn WebSocket nicht verbunden ist
  const { data: lagekarteData } = useLagekarte(einsatzId, { refetchInterval: wsIsConnected ? false : 5000 });

  // Taktische Zeichen des Einsatzes (Polling-Fallback wenn kein WebSocket)
  const { data: einsatzZeichen = [] } = useEinsatzZeichen(einsatzId, {
    refetchInterval: wsIsConnected ? false : 10_000,
  });

  // Draw-Store State (vor useZeichenDrag, damit canDraw verfügbar)
  const drawMode = useStore(drawStore, (s) => s.drawMode);
  const selectedFeatureIds = useStore(drawStore, (s) => s.selectedFeatureIds);
  const isDirectSelect = useStore(drawStore, (s) => s.isDirectSelect);
  const snapEnabled = useStore(drawStore, (s) => s.snapEnabled);
  const isSymbolPanelVisible = useStore(drawStore, (s) => s.isSymbolPanelVisible);
  const isTemplatePanelVisible = useStore(drawStore, (s) => s.isTemplatePanelVisible);
  const isLocked = useStore(drawStore, (s) => s.isLocked);
  const isZeichenSidebarVisible = useStore(drawStore, (s) => s.isZeichenSidebarVisible);
  const isGefahrenSidebarVisible = useStore(drawStore, (s) => s.isGefahrenSidebarVisible);
  const pendingZeichenPlacement = useStore(drawStore, (s) => s.pendingZeichenPlacement);
  const selectedZeichenId = useStore(drawStore, (s) => s.selectedZeichenId);

  // Map-Ladezustand
  const isMapLoaded = !isLoading;

  // Zeichen für Detail-Panel aus Cache ableiten
  const selectedZeichen = selectedZeichenId ? einsatzZeichen.find((z) => z.id === selectedZeichenId) : undefined;

  // Erstellung + Platzierung von taktischen Zeichen per Karten-Klick
  const { mutate: createZeichen } = useCreateZeichen(einsatzId);
  const { mutate: placeZeichen } = usePlaceZeichen(einsatzId);

  // Zeichen-Selektion → Detail-Panel steuern
  const handleZeichenSelect = useCallback((zeichenId: string | null) => {
    if (zeichenId) {
      openZeichenDetail(zeichenId);
    } else {
      closeZeichenDetail();
    }
  }, []);

  // Drag & Drop für taktische Zeichen (nur wenn Zeichnen erlaubt und nicht gesperrt)
  const { deselectZeichen } = useZeichenDrag({
    mapRef,
    isMapLoaded,
    zeichen: einsatzZeichen,
    einsatzId,
    canDrag: canDraw && !isLocked,
    onSelect: handleZeichenSelect,
  });

  // Style-Panel State (vor useDrawControl, damit activeStyleRef verfügbar ist)
  const [activeStyle, setActiveStyle] = useState<DrawingStyle>(DEFAULT_DRAWING_STYLE);
  const activeStyleRef = useRef<DrawingStyle>(DEFAULT_DRAWING_STYLE);
  useEffect(() => {
    activeStyleRef.current = activeStyle;
  }, [activeStyle]);

  // Remote-Apply-Flag für WebSocket-Sync (verhindert Loop in Draw-Event-Handlern)
  const isRemoteApplyRef = useRef(false);

  // Pending-Symbol-Ref für den Symbol-Modus (damit handleCreate die Symbol-Properties setzen kann)
  const pendingSymbolRef = useRef<{ id: string; category: string } | null>(null);

  // Stabiler sendDelta-Ref: Wird von useDrawControl via Ref gelesen, von useLagekarteSync befüllt.
  // Löst die zirkuläre Abhängigkeit (drawRef → sync → sendDelta → drawControl).
  const sendDeltaRef = useRef<UseLagekarteSyncReturn['sendDelta'] | undefined>(undefined);

  // Draw-Control (Kern-Hook) - liest sendDelta nur via Ref in Event-Handlern
  const { undo, redo, canUndo, canRedo, deleteSelected, setMode, drawRef, scheduleAutoSave } = useDrawControl({
    mapRef,
    einsatzId,
    canDraw,
    isMapLoaded,
    activeStyleRef,
    isRemoteApplyRef,
    sendDelta: (...args) => sendDeltaRef.current?.(...args),
    pendingSymbolRef,
    isLocked,
  });

  // WebSocket-Sync (koordiniert WS mit Draw-Control, braucht drawRef von oben)
  const { wsStatus, sendDelta } = useLagekarteSync({ einsatzId, drawRef, isRemoteApplyRef, enabled: mode !== 'presentation' });

  // sendDelta-Ref aktualisieren sobald verfügbar
  useEffect(() => {
    sendDeltaRef.current = sendDelta;
  }, [sendDelta]);

  // OSM-Markierung (nur bei Vektor-Basislayer)
  const isVectorBaseLayer = selectedBaseLayer === 'osm';
  const { handleOsmClick, pendingOsmMark, confirmOsmMark, cancelOsmMark } = useOsmMarkierung({ mapRef, drawRef, isVectorBaseLayer });

  // GAMS-Zonen (konzentrische Gefahrenzonen)
  const { pendingGamsCenter, confirmiereGamsZonen, abbrechenGamsZonen } = useGamsZonen({ mapRef, drawRef, isMapLoaded, scheduleAutoSave });

  // Node-Snapping
  useSnapControl({ mapRef, drawRef, isMapLoaded });

  // Feature-Messungen (Fläche, Länge, Koordinaten)
  const { selectedMeasurement, liveMeasurement } = useFeatureMeasurement({ mapRef, drawRef, isMapLoaded });

  // Symbolbibliothek
  const { pendingSymbol, selectSymbol, cancelSymbol } = useSymbolMarker({ mapRef, drawRef, isMapLoaded });

  // I4: Stil des selektierten Features in das StylePanel laden
  useEffect(() => {
    if (selectedFeatureIds.length === 0) return;
    const draw = drawRef.current;
    if (!draw) return;
    const feature = draw.get(selectedFeatureIds[0]);
    if (!feature?.properties) return;
    const props = feature.properties;

    // Hatch-Config wiederherstellen (neues Format oder Legacy-Migration)
    let hatch: HatchConfig = { ...DEFAULT_HATCH };
    if (props.hatch) {
      try {
        hatch = typeof props.hatch === 'string' ? JSON.parse(props.hatch) : props.hatch;
      } catch {
        // Ungültiges JSON — Default beibehalten
      }
    } else if (props.fillPattern) {
      const migrated = migrateLegacyFillPattern(props.fillPattern);
      if (migrated) hatch = migrated;
    }

    setActiveStyle((prev) => ({
      ...prev,
      ...(props.color && { color: props.color }),
      ...(props.fillColor && { fillColor: props.fillColor }),
      ...(props.strokeWidth != null && { strokeWidth: props.strokeWidth }),
      ...(props.fillEnabled != null && { fillEnabled: props.fillEnabled }),
      ...(props.fillOpacity != null && { fillOpacity: props.fillOpacity }),
      ...(props.strokeDasharray && { strokeDasharray: props.strokeDasharray }),
      hatch,
    }));
  }, [selectedFeatureIds, drawRef]);

  // Permanentes Fallback-Image + Schraffurmuster bei Style-Wechsel registrieren.
  // fill-pattern Expressions nutzen `coalesce` mit EMPTY_PATTERN_IMAGE als Fallback,
  // damit die Expression nie `null` zurückgibt (was MapLibre's Fill-Renderer crasht).
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || isLoading) return;

    /** Registriert das permanente 1×1 transparente Fallback-Image */
    const ensureEmptyPattern = () => {
      if (!map.hasImage(EMPTY_PATTERN_IMAGE)) {
        map.addImage(EMPTY_PATTERN_IMAGE, { width: 1, height: 1, data: new Uint8Array(4) });
      }
    };

    // Sofort registrieren + bei jedem Style-Wechsel erneut (style.load entfernt alle Images)
    ensureEmptyPattern();

    const handleStyleLoad = () => {
      ensureEmptyPattern();
      reregisterHatchImages(map);
    };
    map.on('style.load', handleStyleLoad);

    const handleMissingImage = (e: { id: string }) => {
      if (!map.hasImage(e.id)) {
        map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
      }
    };
    map.on('styleimagemissing', handleMissingImage);

    return () => {
      map.off('style.load', handleStyleLoad);
      map.off('styleimagemissing', handleMissingImage);
    };
  }, [isLoading]);

  // Präsentationsmodus: fitBounds auf alle Features nach Map-Load
  useEffect(() => {
    if (mode !== 'presentation' || isLoading || !mapRef.current) return;
    const features = lagekarteData?.state;
    if (!features?.features?.length) return;

    try {
      const [minLng, minLat, maxLng, maxLat] = bbox(features);
      mapRef.current.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 60, duration: 1000 },
      );
    } catch {
      // Ungültige Features — fitBounds überspringen
    }
  }, [mode, isLoading, lagekarteData?.state]);

  // Label des selektierten Features (lokaler State für sofortige Input-Reaktion)
  const [selectedFeatureLabel, setSelectedFeatureLabel] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (selectedFeatureIds.length === 0 || !drawRef.current) {
      setSelectedFeatureLabel(undefined);
      return;
    }
    const feature = drawRef.current.get(selectedFeatureIds[0]);
    setSelectedFeatureLabel(feature?.properties?.label as string | undefined);
  }, [selectedFeatureIds, drawRef]);

  const selectedFeatureGeometryType = useMemo(() => {
    if (selectedFeatureIds.length === 0 || !drawRef.current) return undefined;
    const feature = drawRef.current.get(selectedFeatureIds[0]);
    return feature?.geometry?.type as string | undefined;
  }, [selectedFeatureIds, drawRef]);

  /** Stil ändern und auf selektierte Features anwenden */
  const handleStyleChange = useCallback(
    (partial: Partial<DrawingStyle>) => {
      const next = { ...activeStyle, ...partial };
      setActiveStyle(next);
      const draw = drawRef.current;
      if (!draw) return;
      const map = mapRef.current?.getMap();

      const updatedFeatures: GeoJSON.Feature[] = [];

      for (const id of selectedFeatureIds) {
        for (const [key, value] of Object.entries(partial)) {
          if (key === 'hatch') continue;
          draw.setFeatureProperty(id, key, value);
        }

        if (partial.hatch !== undefined) {
          const hatch = next.hatch;
          draw.setFeatureProperty(id, 'hatch', JSON.stringify(hatch));
          const imageName = ensureHatchImage(map, hatch, next.color);
          draw.setFeatureProperty(id, 'fillPattern', imageName);
        }

        if (partial.color !== undefined && next.hatch.type !== 'none' && next.hatch.color === '') {
          const imageName = ensureHatchImage(map, next.hatch, next.color);
          draw.setFeatureProperty(id, 'fillPattern', imageName);
        }

        const updated = draw.get(id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (updated) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          draw.add(updated as any);
          updatedFeatures.push(updated as GeoJSON.Feature);
        }
      }

      // Style-Änderungen an andere Clients senden
      if (updatedFeatures.length > 0) {
        sendDelta('update', { features: updatedFeatures });
      }

      scheduleAutoSave();
    },
    [activeStyle, selectedFeatureIds, drawRef, mapRef, scheduleAutoSave, sendDelta],
  );

  /** Label ändern und auf selektierte Features anwenden */
  const handleLabelChange = useCallback(
    (label: string) => {
      setSelectedFeatureLabel(label);
      const draw = drawRef.current;
      if (!draw) return;
      const updatedFeatures: GeoJSON.Feature[] = [];
      for (const id of selectedFeatureIds) {
        draw.setFeatureProperty(id, 'label', label);
        const updated = draw.get(id);
        if (updated) updatedFeatures.push(updated as GeoJSON.Feature);
      }
      if (updatedFeatures.length > 0) {
        sendDelta('update', { features: updatedFeatures });
      }
      scheduleAutoSave();
    },
    [selectedFeatureIds, drawRef, scheduleAutoSave, sendDelta],
  );

  /** Template anwenden: Stil setzen + Modus wechseln */
  const handleApplyTemplate = useCallback(
    (template: ShapeTemplate) => {
      setActiveStyle((prev) => ({ ...prev, ...template.style }));
      setMode(template.drawMode);
      toggleTemplatePanel();
    },
    [setMode],
  );

  /** Symbol aus Bibliothek für Platzierung auswählen */
  const handleSelectSymbol = useCallback(
    (symbol: import('@/features/lagekarte/drawing/symbols/symbol-registry').SymbolDefinition) => {
      selectSymbol(symbol);
      pendingSymbolRef.current = { id: symbol.id, category: symbol.category };
      setMode('draw_symbol');
      toggleSymbolPanel();
    },
    [selectSymbol, setMode],
  );

  /**
   * Kombinierter Klick-Handler: Entscheidet je nach Zeichenmodus,
   * ob Draw, OSM-Markierung oder Detail-Provider den Klick verarbeitet.
   */
  const handleCombinedClick = useCallback(
    (event: MapLayerMouseEvent) => {
      // 0. Taktisches Zeichen platzieren (Klick nach Sidebar-Auswahl)
      if (pendingZeichenPlacement && !lagekarteData?.id) {
        toast.error('Lagekarte noch nicht geladen — bitte einen Moment warten');
        return;
      }
      if (pendingZeichenPlacement && lagekarteData?.id) {
        const { lng, lat } = event.lngLat;

        if (pendingZeichenPlacement.existingZeichenId) {
          // Bestehendes unplatziertes Zeichen platzieren
          placeZeichen(
            {
              zeichenId: pendingZeichenPlacement.existingZeichenId,
              dto: { lagekarteId: lagekarteData.id, lat, lng },
            },
            {
              onSuccess: () => {
                clearPendingZeichenPlacement();
                toast.success('Zeichen platziert');
              },
              onError: () => {
                toast.error('Fehler beim Platzieren des Zeichens');
              },
            },
          );
        } else {
          // Neues Zeichen erstellen + direkt platzieren (atomar)
          const def = pendingZeichenPlacement.definition;
          createZeichen(
            {
              zeichenDefinition: {
                grundzeichen: def.grundzeichen,
                organisation: def.organisation,
                fachaufgabe: def.fachaufgabe,
                einheit: def.einheit,
                verwaltungsstufe: def.verwaltungsstufe,
              },
              label: pendingZeichenPlacement.label,
              lagekarteId: lagekarteData.id,
              lat,
              lng,
            },
            {
              onSuccess: () => {
                clearPendingZeichenPlacement();
                toast.success('Zeichen platziert');
              },
              onError: () => {
                toast.error('Fehler beim Platzieren des Zeichens');
              },
            },
          );
        }
        return;
      }

      // 1. Im Zeichenmodus: Draw hat Vorrang (MapboxDraw verarbeitet den Klick)
      if (drawMode !== 'idle' && drawMode !== 'select' && drawMode !== 'osm_mark') {
        return;
      }

      // 2. OSM-Markierungsmodus: OSM-Feature-Klick verarbeiten
      if (drawMode === 'osm_mark') {
        handleOsmClick(event);
        return;
      }

      // 3. Idle/Select: Bestehender Detail-Provider-Flow
      handleMapClick(event);
    },
    [drawMode, handleOsmClick, handleMapClick, pendingZeichenPlacement, lagekarteData?.id, createZeichen, placeZeichen],
  );

  /** Cursor je nach Modus bestimmen */
  const getCursor = () => {
    if (isDetailLoading) return 'wait';
    if (pendingZeichenPlacement) return 'crosshair';
    if (drawMode === 'osm_mark') return 'crosshair';
    if (drawMode !== 'idle' && drawMode !== 'select') return 'crosshair';
    return undefined;
  };

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-lg',
        mode === 'standard' && 'h-full',
        (mode === 'fullscreen' || mode === 'presentation') && 'h-screen',
        (isPanelOpen || selectedZeichenId || isZeichenSidebarVisible) && 'has-right-panel',
      )}
    >
      {mode !== 'standard' && <FullscreenCloseButton />}

      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-surface-panel/80">
          <Spinner type="ring" size="lg" />
        </div>
      )}

      {/* WebSocket-Verbindungsstatus (im Präsentationsmodus nicht anzeigen) */}
      {mode !== 'presentation' && <ConnectionStatusBadge status={wsStatus} className="absolute right-3 bottom-10 z-20" />}

      {/* Loading-Indikator für Feature-Abfrage */}
      {isDetailLoading && (
        <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-panel px-3 py-1.5 text-sm text-text-muted shadow-lg">
            <Spinner type="ring" size="sm" />
            Informationen werden abgefragt…
          </div>
        </div>
      )}

      {/* Präsentationsmodus-Label */}
      {mode === 'presentation' && (
        <div className="absolute bottom-4 left-4 z-20 rounded-lg border border-border-subtle bg-surface-panel/90 px-3 py-1.5 text-xs text-text-muted shadow-sm backdrop-blur-sm">
          Präsentationsmodus
        </div>
      )}

      <Map
        ref={mapRef}
        initialViewState={{
          longitude: MAP_DEFAULTS.longitude,
          latitude: MAP_DEFAULTS.latitude,
          zoom: MAP_DEFAULTS.zoom,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={resolvedStyle}
        onClick={handleCombinedClick}
        cursor={getCursor()}
        onLoad={() => setIsLoading(false)}
        onError={(e) => {
          // MapLibre feuert Error-Events für fehlende Sprite-Images im Base-Style
          // (z.B. "circle-11" in OpenFreeMap liberty). Das ist ein MapLibre/Style-Bug,
          // keine Applikationsfehler. Nur unbekannte Fehler im Debug-Modus loggen.
          if (import.meta.env.DEV) {
            const msg = (e as unknown as { error?: Error }).error?.message ?? '';
            if (msg.includes("reading '0'") || msg.includes("reading '1'") || msg.includes('t[n][0]') || msg.includes('t[n][1]')) return;
            console.debug('[MAP-ERROR]', msg);
          }
        }}
        aria-label="Lagekarte"
      >
        <NavigationControl position="top-right" />

        {dwdOverlayEnabled && (
          <Source id="dwd-warnungen" type="raster" tiles={DWD_TILE_URL} tileSize={256}>
            <Layer id="dwd-warnungen-layer" type="raster" paint={{ 'raster-opacity': 0.6 }} />
          </Source>
        )}

        {/* NINA Warnungen GeoJSON Layer */}
        {ninaGeoJson && <NinaGeoJsonLayer data={ninaGeoJson} ninaOverlays={ninaOverlays} />}

        {/* Taktische Zeichen Layer (DV 102) */}
        <TaktischeZeichenLayer mapRef={mapRef} isMapLoaded={isMapLoaded} zeichen={einsatzZeichen} />

        {/* Sicherungsposten-Marker (Story 4.3, FR28) */}
        {einsatzId && <SecurityPostMapMarker einsatzId={einsatzId} mapRef={mapRef} isMapLoaded={isMapLoaded} />}

        {/* Gefahrenzonen-Layer + Inline-Popover (Issue #627, G2) + Deep-Link-Panel (G3) */}
        {isMapLoaded && einsatzId && <GefahrenzoneHost einsatzId={einsatzId} mapRef={mapRef} focus={focus} />}

        {/* Ghost-Marker: Halbtransparente Vorschau beim Platzieren */}
        {pendingZeichenPlacement && <GhostZeichenMarker mapRef={mapRef} isMapLoaded={isMapLoaded} definition={pendingZeichenPlacement.definition} />}

        {/* Detail-Popup am Klick-Punkt */}
        {results.length > 0 && coordinate && !isPanelOpen && <MapDetailPopup results={results} coordinate={coordinate} onShowDetails={openPanel} onClose={clearSelection} />}

        {/* OSM-Markierungs-Popup */}
        {pendingOsmMark && (
          <Popup longitude={pendingOsmMark.coordinate.lng} latitude={pendingOsmMark.coordinate.lat} onClose={cancelOsmMark} closeOnClick={false} anchor="bottom">
            <OsmMarkierungPopup pendingMark={pendingOsmMark} onConfirm={confirmOsmMark} onCancel={cancelOsmMark} />
          </Popup>
        )}

        {/* GAMS-Zonen-Konfiguration */}
        {pendingGamsCenter && (
          <Popup longitude={pendingGamsCenter[0]} latitude={pendingGamsCenter[1]} onClose={abbrechenGamsZonen} closeOnClick={false} anchor="bottom">
            <GamsZonenPanel onConfirm={confirmiereGamsZonen} onCancel={abbrechenGamsZonen} />
          </Popup>
        )}
      </Map>

      {/* Draw-Toolbar (immer sichtbar für Lock-Button, ShortcutBar nur wenn nicht gesperrt) */}
      {canDraw && (
        <>
          <DrawToolbar activeMode={drawMode} onModeChange={setMode} unplatzierteZeichenCount={einsatzZeichen.filter((z) => !z.istPlatziert).length} />
          {!isLocked && (
            <DrawShortcutBar
              activeMode={drawMode}
              hasSelection={selectedFeatureIds.length > 0}
              canUndo={canUndo}
              canRedo={canRedo}
              isDirectSelect={isDirectSelect}
              onUndo={undo}
              onRedo={redo}
              onDeleteSelected={deleteSelected}
              liveMeasurement={liveMeasurement}
              snapEnabled={snapEnabled}
              onToggleSnap={toggleSnapEnabled}
            />
          )}
        </>
      )}

      {/* Style-Panel für selektierte Features */}
      <DrawStylePanel
        style={activeStyle}
        onStyleChange={handleStyleChange}
        isVisible={selectedFeatureIds.length > 0 && canDraw}
        label={selectedFeatureLabel}
        onLabelChange={handleLabelChange}
        geometryType={selectedFeatureGeometryType}
        measurement={selectedMeasurement}
        readOnly={isLocked}
      />

      {/* Shape-Template-Panel */}
      {canDraw && <ShapeTemplatePanel isVisible={isTemplatePanelVisible} onApplyTemplate={handleApplyTemplate} activeMode={drawMode} />}

      {/* Symbolbibliothek-Panel */}
      {canDraw && <SymbolLibraryPanel isVisible={isSymbolPanelVisible} onSelectSymbol={handleSelectSymbol} onClose={toggleSymbolPanel} />}

      {mode !== 'presentation' && <MapLayerSwitcher availableLayers={availableLayers} selectedBaseLayer={selectedBaseLayer} dwdOverlayEnabled={dwdOverlayEnabled} ninaOverlays={ninaOverlays} />}

      {/* Detail-Panel (Slide-In von rechts) */}
      <MapDetailPanel results={results} panelIndex={panelIndex} isOpen={isPanelOpen} onClose={closePanel} onNavigate={navigatePanel} />

      {/* Zeichen-Detail-Panel (Slide-In von rechts) */}
      <ZeichenDetailPanel
        zeichen={selectedZeichen}
        einsatzId={einsatzId}
        isOpen={selectedZeichenId !== null}
        onClose={() => {
          closeZeichenDetail();
          deselectZeichen();
        }}
      />

      {/* Karten-Zeichen-Sidebar (nur im Nicht-Präsentationsmodus) */}
      {mode !== 'presentation' && <KartenZeichenSidebar einsatzId={einsatzId} isVisible={isZeichenSidebarVisible} />}

      {/* Gefahren-Tools-Sidebar (nur wenn gezeichnet werden darf) */}
      {canDraw && <GefahrenToolsSidebar isVisible={isGefahrenSidebarVisible} onSelectSymbol={handleSelectSymbol} />}
    </div>
  );
};
