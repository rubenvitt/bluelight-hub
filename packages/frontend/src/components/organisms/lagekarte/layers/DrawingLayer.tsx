import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import type { DrawingTool } from '../toolbar/DrawingToolbar';
import { ShapeContextMenu } from '@/components/molecules/lagekarte/ShapeContextMenu';
import { SelectedShapeToolbar } from '@/components/molecules/lagekarte/SelectedShapeToolbar';
import type React from 'react';
import { memo, useCallback, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import * as L from 'leaflet';
import type * as GeoJSON from 'geojson';
import { toast } from 'sonner';
import { getShapeIdFromLayer } from '@/utils/lagekarte/layer-utils';

// Custom Hooks
import { useLeafletPMControls } from '@/hooks/lagekarte/useLeafletPMControls';
import { useShapeLoading } from '@/hooks/lagekarte/useShapeLoading';
import { useDrawingToolSelection } from '@/hooks/lagekarte/useDrawingToolSelection';
import { useShapeSelection } from '@/hooks/lagekarte/useShapeSelection';
import { useShapeHighlighting } from '@/hooks/lagekarte/useShapeHighlighting';
import { useToolbarPositioning } from '@/hooks/lagekarte/useToolbarPositioning';
import { useKeyboardShortcuts } from '@/hooks/lagekarte/useKeyboardShortcuts';
import { useShapeEventHandlers } from '@/hooks/lagekarte/useShapeEventHandlers';
import type { LayerWithGeoJSON, LayerWithPM, OriginalStyle } from '@/utils/lagekarte/types';
import { useTextMarkerHandling } from '@/hooks/lagekarte/useTextMarkerHandling';
import { useShapeStyleUpdates } from '@/hooks/lagekarte/useShapeStyleUpdates';

const isPmLayer = (layer: L.Layer): layer is LayerWithPM => {
  return 'pm' in layer && typeof (layer as LayerWithPM).pm?.enable === 'function';
};

const isGeoJsonLayer = (layer: L.Layer): layer is LayerWithGeoJSON => {
  return 'toGeoJSON' in layer && typeof (layer as LayerWithGeoJSON).toGeoJSON === 'function';
};

interface DrawingLayerProps {
  /**
   * ID des Einsatzes
   */
  einsatzId: string;
  /**
   * Aktuell ausgewähltes Drawing-Tool
   */
  selectedTool: DrawingTool;
  /**
   * Initial State (GeoJSON FeatureCollection) aus Backend
   */
  initialState?: GeoJSON.FeatureCollection;
  /**
   * Shape das updated werden soll (z.B. nach Label-Änderung)
   */
  shapeToUpdate?: GeoJSON.Feature | null;
  /**
   * Callback wenn Shapes sich ändern (für Backend-Persistierung)
   */
  onShapesChange: (shapes: GeoJSON.FeatureCollection) => void;
  /**
   * Callback wenn Shape-Limit erreicht wird
   */
  onShapeLimitReached?: () => void;
  /**
   * Callback wenn neuer Shape erstellt wurde (öffnet Label-Modal)
   */
  onShapeCreated?: (shape: GeoJSON.Feature) => void;
  /**
   * Callback wenn Shape-Update abgeschlossen ist
   */
  onShapeUpdateComplete?: () => void;
  /**
   * Callback wenn Shape selektiert wird (für Property Panel)
   */
  onShapeSelected?: (shape: GeoJSON.Feature | null) => void;
  /**
   * Ob POI-Platzierungs-Modus aktiv ist
   * Wenn true, werden alle Drawing-Interaktionen deaktiviert
   */
  isPlacementModeActive?: boolean;
}

/**
 * DrawingLayer-Komponente für Lagekarte
 *
 * Integriert Leaflet.PM (Geoman) zum Zeichnen von Polygonen, Linien und Rechtecken
 * auf der Karte. Shapes werden als GeoJSON FeatureCollection gespeichert.
 *
 * @remarks
 * - Verwendet Leaflet.PM (NOT leaflet-draw - veraltet!)
 * - Shape-Limit: Max 100 Shapes per Lagekarte
 * - Event-Handler: pm:create, pm:edit, pm:remove
 * - Shapes haben Default-Style bis Typ-Auswahl im Label-Modal
 * - Refactored: Logic aufgeteilt in Custom Hooks für bessere Wartbarkeit
 *
 * @example
 * ```tsx
 * <DrawingLayer
 *   einsatzId="einsatz-123"
 *   selectedTool={selectedTool}
 *   onShapesChange={(shapes) => saveMutation.mutate(shapes)}
 *   onShapeLimitReached={() => toast.error('Max 100 Shapes')}
 *   onShapeCreated={(shape) => setShapeLabelModalOpen(true)}
 * />
 * ```
 */
const DrawingLayerComponent: React.FC<DrawingLayerProps> = ({
  einsatzId: _einsatzId,
  selectedTool,
  initialState,
  shapeToUpdate,
  onShapesChange,
  onShapeLimitReached,
  onShapeCreated,
  onShapeUpdateComplete,
  onShapeSelected,
  isPlacementModeActive = false,
}) => {
  const map = useMap();

  // State
  const [shapes, setShapes] = useState<GeoJSON.FeatureCollection>(
    initialState && initialState.type === 'FeatureCollection' && Array.isArray(initialState.features)
      ? initialState
      : {
          type: 'FeatureCollection',
          features: [],
        },
  );
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    shapeId: string;
  } | null>(null);

  // Refs
  const layersRef = useRef<Map<string, L.Layer>>(new Map());
  const shapesRef = useRef(shapes);
  const originalStylesRef = useRef<Map<string, OriginalStyle>>(new Map());

  // Update shapesRef bei shapes-Änderung
  shapesRef.current = shapes;

  // Event handlers for layers
  const handleLayerClick = useCallback(
    (e: L.LeafletMouseEvent) => {
      // Deaktiviere Layer-Interaktionen während POI-Platzierung
      if (isPlacementModeActive) return;

      L.DomEvent.stopPropagation(e);
      const clickedLayer = e.target;
      const clickedShapeId = getShapeIdFromLayer(clickedLayer);
      if (clickedShapeId) {
        setSelectedShapeId(clickedShapeId);
      }
    },
    [isPlacementModeActive],
  );

  const handleLayerContextMenu = useCallback(
    (e: L.LeafletMouseEvent) => {
      // Deaktiviere Layer-Interaktionen während POI-Platzierung
      if (isPlacementModeActive) return;

      L.DomEvent.preventDefault(e);
      L.DomEvent.stopPropagation(e);
      const clickedLayer = e.target;
      const clickedShapeId = getShapeIdFromLayer(clickedLayer);
      if (clickedShapeId) {
        setContextMenu({
          isOpen: true,
          position: { x: e.originalEvent.clientX, y: e.originalEvent.clientY },
          shapeId: clickedShapeId,
        });
      }
    },
    [isPlacementModeActive],
  );

  // Initialize Leaflet.PM Controls
  useLeafletPMControls(map, layersRef);

  // Load initial shapes from backend
  useShapeLoading({
    map,
    initialState,
    layersRef,
    onLayerClick: handleLayerClick,
    onLayerContextMenu: handleLayerContextMenu,
  });

  // Handle Drawing-Tool selection (deaktiviert während POI-Platzierung)
  useDrawingToolSelection({
    map,
    selectedTool: isPlacementModeActive ? null : selectedTool,
    setSelectedShapeId,
  });

  // Handle Shape Selection
  useShapeSelection({
    map,
    selectedShapeId,
    setSelectedShapeId,
    layersRef,
    shapesRef,
    originalStylesRef,
    onShapeSelected,
  });

  // Handle Shape Highlighting
  useShapeHighlighting({
    selectedShapeId,
    layersRef,
    originalStylesRef,
  });

  // Calculate Toolbar Position
  const { toolbarPosition } = useToolbarPositioning({
    map,
    selectedShapeId,
    layersRef,
  });

  // Keyboard Shortcuts (Delete/Backspace)
  useKeyboardShortcuts({
    map,
    selectedShapeId,
    setSelectedShapeId,
    layersRef,
    shapesRef,
    originalStylesRef,
    setShapes,
    onShapesChange,
  });

  // Shape Event Handlers (pm:create, pm:edit, pm:remove)
  useShapeEventHandlers({
    map,
    layersRef,
    shapesRef,
    setShapes,
    onShapesChange,
    onShapeLimitReached,
    onShapeCreated,
    onLayerClick: handleLayerClick,
    onLayerContextMenu: handleLayerContextMenu,
  });

  // Text Marker Handling
  useTextMarkerHandling({
    map,
    shapesRef,
    setShapes,
    onShapesChange,
  });

  // Shape Style Updates (from PropertyPanel, ShapeLabelModal, etc.)
  useShapeStyleUpdates({
    shapeToUpdate,
    layersRef,
    shapesRef,
    originalStylesRef,
    setShapes,
    onShapesChange,
    onShapeUpdateComplete,
  });

  // Context Menu Handlers
  const handleContextMenuEdit = useCallback(() => {
    if (!contextMenu) return;
    const layer = layersRef.current.get(contextMenu.shapeId);
    // Defensive check: Verify pm.enable method exists before calling
    if (layer && isPmLayer(layer)) {
      layer.pm.enable();
      toast.info('Bearbeitungsmodus aktiviert');
    }
    setContextMenu(null);
  }, [contextMenu]);

  const handleContextMenuDelete = useCallback(() => {
    if (!contextMenu) return;
    const layer = layersRef.current.get(contextMenu.shapeId);
    if (layer && isGeoJsonLayer(layer)) {
      const geoJson = layer.toGeoJSON() as GeoJSON.Feature;
      const shapeId = geoJson.properties?.id;

      if (shapeId) {
        // Remove from tracking
        layersRef.current.delete(shapeId);
        originalStylesRef.current.delete(shapeId);

        // Remove from map
        map.removeLayer(layer);

        // Remove from shapes collection
        const updatedShapes: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: shapesRef.current.features.filter((feature) => feature.properties?.id !== shapeId),
        };
        setShapes(updatedShapes);
        onShapesChange(updatedShapes);

        toast.success('Shape gelöscht');
      }
    }
    setContextMenu(null);
  }, [contextMenu, map, onShapesChange]);

  const handleContextMenuChangeStyle = useCallback(() => {
    if (!contextMenu) return;
    // TODO: Open style editor dialog
    toast.info('Stil-Editor kommt bald');
    setContextMenu(null);
  }, [contextMenu]);

  // Toolbar Callbacks
  const handleToolbarEdit = useCallback(() => {
    if (!selectedShapeId) return;

    const layer = layersRef.current.get(selectedShapeId);
    // Defensive check: Verify pm.enable method exists before calling
    if (layer && isPmLayer(layer)) {
      layer.pm.enable();
      toast.info('Bearbeitungsmodus aktiviert');
    }
  }, [selectedShapeId]);

  const handleToolbarDelete = useCallback(() => {
    if (!selectedShapeId) return;

    const layer = layersRef.current.get(selectedShapeId);
    if (!layer) {
      toast.error('Shape konnte nicht gelöscht werden');
      return;
    }

    try {
      // Remove from map
      map.removeLayer(layer);

      // Remove from state
      const updatedShapes: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: shapesRef.current.features.filter((f) => f.properties?.id !== selectedShapeId),
      };

      setShapes(updatedShapes);
      onShapesChange(updatedShapes);

      // Cleanup references
      layersRef.current.delete(selectedShapeId);
      originalStylesRef.current.delete(selectedShapeId);
      setSelectedShapeId(null);

      toast.success('Shape gelöscht');
    } catch (error) {
      console.error('[DrawingLayer] Error deleting shape:', error);
      toast.error('Fehler beim Löschen des Shapes');
    }
  }, [map, selectedShapeId, onShapesChange]);

  const handleToolbarChangeStyle = useCallback(() => {
    if (!selectedShapeId) return;
    // TODO: Open style editor dialog
    toast.info('Stil-Editor kommt bald');
  }, [selectedShapeId]);

  return (
    <>
      <ShapeContextMenu
        isOpen={contextMenu?.isOpen ?? false}
        position={contextMenu?.position ?? null}
        onClose={() => setContextMenu(null)}
        onEdit={handleContextMenuEdit}
        onDelete={handleContextMenuDelete}
        onChangeStyle={handleContextMenuChangeStyle}
      />

      {/* Floating Toolbar für selektierte Shapes */}
      {selectedShapeId && toolbarPosition && (
        <SelectedShapeToolbar shapeId={selectedShapeId} position={toolbarPosition} onEdit={handleToolbarEdit} onDelete={handleToolbarDelete} onChangeStyle={handleToolbarChangeStyle} />
      )}
    </>
  );
};

/**
 * Performance-optimized DrawingLayer with React.memo()
 * Prevents unnecessary re-renders when parent components update
 */
export const DrawingLayer = memo(DrawingLayerComponent);
