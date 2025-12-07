import { Store } from '@tanstack/react-store';
import type * as L from 'leaflet';
import type * as GeoJSON from 'geojson';
import type { DrawingTool } from '@/components/organisms/lagekarte/toolbar/DrawingToolbar';
import type { OriginalStyle } from '@/utils/lagekarte/types';

/**
 * Zentrale State-Definition für Lagekarte Feature
 *
 * Konsolidiert alle State-Variablen und Refs aus DrawingLayer.tsx:
 * - shapes (State) → shapes
 * - selectedShapeId (State) → selectedShapeIds
 * - layersRef (Ref) → layers
 * - shapesRef (Ref) → ENTFERNT (redundant, shapes ist bereits State)
 * - originalStylesRef (Ref) → originalStyles
 *
 * Zusätzlich: UI State für Toolbar, Context Menu, PM Initialization
 */
export interface LagekarteState {
  // ===== Shape Data =====
  /**
   * GeoJSON FeatureCollection mit allen Shapes auf der Lagekarte
   */
  shapes: GeoJSON.FeatureCollection;

  // ===== Selection & Highlighting =====
  /**
   * IDs der aktuell selektierten Shapes
   * (Multi-Selection möglich, aktuell aber nur Single-Selection verwendet)
   */
  selectedShapeIds: Set<string>;

  /**
   * IDs der aktuell gehighlighteten Shapes
   * (separate Tracking für visuelles Highlighting unabhängig von Selection)
   */
  highlightedShapeIds: Set<string>;

  // ===== Drawing State =====
  /**
   * Aktuell aktives Drawing Tool (polygon, polyline, text, edit, delete, select)
   * null = kein Tool aktiv
   */
  activeDrawingTool: DrawingTool | null;

  /**
   * Flag ob Leaflet.PM initialisiert wurde
   * Verhindert doppelte Initialisierung
   */
  isPmInitialized: boolean;

  // ===== UI State =====
  /**
   * Sichtbarkeit der SelectedShapeToolbar
   */
  toolbarVisible: boolean;

  /**
   * Position der SelectedShapeToolbar (relativ zu selektiertem Shape)
   * null = Toolbar ausgeblendet
   */
  toolbarPosition: { x: number; y: number } | null;

  /**
   * Context Menu State (Right-Click auf Shape)
   */
  contextMenu: {
    isOpen: boolean;
    position: { x: number; y: number };
    shapeId: string;
  } | null;

  // ===== Internal Layer Tracking =====
  /**
   * Map von Shape-IDs zu Leaflet Layer-Instanzen
   * Ersetzt layersRef aus DrawingLayer.tsx
   *
   * @remarks
   * WICHTIG: Leaflet Layers sind mutable Objects!
   * Store sollte nur Map-Referenzen ändern, nicht die Layer selbst.
   * Layer-Mutations (setStyle, etc.) werden direkt auf Layer-Instanzen durchgeführt.
   */
  layers: Map<string, L.Layer>;

  /**
   * Original Styles für Highlight-Restore
   * Ersetzt originalStylesRef aus DrawingLayer.tsx
   *
   * Speichert Original-Style bevor Highlight angewendet wird,
   * damit bei Deselect der Original-Style wiederhergestellt werden kann.
   */
  originalStyles: Map<string, OriginalStyle>;

  // ===== Performance Limits =====
  /**
   * Maximum Anzahl Shapes pro Lagekarte
   * (aktuell 100, hardcoded in useShapeEventHandlers)
   */
  maxShapes: number;
}

/**
 * Initial State für Lagekarte Store
 */
const initialState: LagekarteState = {
  shapes: {
    type: 'FeatureCollection',
    features: [],
  },
  selectedShapeIds: new Set<string>(),
  highlightedShapeIds: new Set<string>(),
  activeDrawingTool: null,
  isPmInitialized: false,
  toolbarVisible: false,
  toolbarPosition: null,
  contextMenu: null,
  layers: new Map<string, L.Layer>(),
  originalStyles: new Map<string, OriginalStyle>(),
  maxShapes: 100,
};

/**
 * TanStack Store für Lagekarte State
 *
 * @remarks
 * Store ist NICHT per Einsatz isoliert (Single Global Store).
 * State wird bei Einsatz-Wechsel über resetState() zurückgesetzt.
 *
 * Alternative für Multi-Einsatz Support:
 * - Store Factory Pattern (createLagekarteStore(einsatzId))
 * - Context Provider pro Einsatz
 *
 * Aktuell: Einfache Global Store Lösung ausreichend.
 */
export const lagekarteStore = new Store<LagekarteState>(initialState);

// ===== Store Actions =====

/**
 * Setzt den kompletten Store-State zurück
 * Wird beim Einsatz-Wechsel oder Komponenten-Unmount aufgerufen
 */
export const resetState = () => {
  lagekarteStore.setState(() => ({
    ...initialState,
    // WICHTIG: Neue Map-Instanzen erstellen!
    selectedShapeIds: new Set<string>(),
    highlightedShapeIds: new Set<string>(),
    layers: new Map<string, L.Layer>(),
    originalStyles: new Map<string, OriginalStyle>(),
  }));
};

/**
 * Setzt die Shapes (komplette FeatureCollection)
 *
 * @param shapes - GeoJSON FeatureCollection
 */
export const setShapes = (shapes: GeoJSON.FeatureCollection) => {
  lagekarteStore.setState((state) => ({
    ...state,
    shapes,
  }));
};

/**
 * Fügt ein neues Shape hinzu
 *
 * @param shape - GeoJSON Feature
 */
export const addShape = (shape: GeoJSON.Feature) => {
  lagekarteStore.setState((state) => ({
    ...state,
    shapes: {
      type: 'FeatureCollection',
      features: [...state.shapes.features, shape],
    },
  }));
};

/**
 * Aktualisiert ein existierendes Shape
 *
 * @param shapeId - Shape ID
 * @param updater - Update Function (Feature => Feature)
 */
export const updateShape = (shapeId: string, updater: (feature: GeoJSON.Feature) => GeoJSON.Feature) => {
  lagekarteStore.setState((state) => ({
    ...state,
    shapes: {
      type: 'FeatureCollection',
      features: state.shapes.features.map((feature) => (feature.properties?.id === shapeId ? updater(feature) : feature)),
    },
  }));
};

/**
 * Entfernt ein Shape
 *
 * @param shapeId - Shape ID
 */
export const removeShape = (shapeId: string) => {
  lagekarteStore.setState((state) => {
    // Cleanup: Entferne aus allen Tracking-Maps
    const newLayers = new Map(state.layers);
    newLayers.delete(shapeId);

    const newOriginalStyles = new Map(state.originalStyles);
    newOriginalStyles.delete(shapeId);

    const newSelectedShapeIds = new Set(state.selectedShapeIds);
    newSelectedShapeIds.delete(shapeId);

    const newHighlightedShapeIds = new Set(state.highlightedShapeIds);
    newHighlightedShapeIds.delete(shapeId);

    return {
      ...state,
      shapes: {
        type: 'FeatureCollection',
        features: state.shapes.features.filter((f) => f.properties?.id !== shapeId),
      },
      layers: newLayers,
      originalStyles: newOriginalStyles,
      selectedShapeIds: newSelectedShapeIds,
      highlightedShapeIds: newHighlightedShapeIds,
    };
  });
};

/**
 * Selektiert ein Shape (Single Selection)
 *
 * @param shapeId - Shape ID, oder null zum Deselektieren
 */
export const selectShape = (shapeId: string | null) => {
  lagekarteStore.setState((state) => ({
    ...state,
    selectedShapeIds: shapeId ? new Set([shapeId]) : new Set<string>(),
  }));
};

/**
 * Highlighted ein Shape (fügt zu highlightedShapeIds hinzu)
 *
 * @param shapeId - Shape ID
 */
export const highlightShape = (shapeId: string) => {
  lagekarteStore.setState((state) => {
    const newHighlightedShapeIds = new Set(state.highlightedShapeIds);
    newHighlightedShapeIds.add(shapeId);
    return {
      ...state,
      highlightedShapeIds: newHighlightedShapeIds,
    };
  });
};

/**
 * Entfernt Highlighting von einem Shape
 *
 * @param shapeId - Shape ID
 */
export const unhighlightShape = (shapeId: string) => {
  lagekarteStore.setState((state) => {
    const newHighlightedShapeIds = new Set(state.highlightedShapeIds);
    newHighlightedShapeIds.delete(shapeId);
    return {
      ...state,
      highlightedShapeIds: newHighlightedShapeIds,
    };
  });
};

/**
 * Setzt das aktive Drawing Tool
 *
 * @param tool - DrawingTool oder null
 */
export const setActiveDrawingTool = (tool: DrawingTool | null) => {
  lagekarteStore.setState((state) => ({
    ...state,
    activeDrawingTool: tool,
  }));
};

/**
 * Markiert PM als initialisiert
 */
export const setPmInitialized = (initialized: boolean) => {
  lagekarteStore.setState((state) => ({
    ...state,
    isPmInitialized: initialized,
  }));
};

/**
 * Setzt die Toolbar-Position
 *
 * @param position - { x, y } oder null
 */
export const setToolbarPosition = (position: { x: number; y: number } | null) => {
  lagekarteStore.setState((state) => ({
    ...state,
    toolbarPosition: position,
    toolbarVisible: position !== null,
  }));
};

/**
 * Öffnet Context Menu
 *
 * @param shapeId - Shape ID
 * @param position - { x, y } Screen-Koordinaten
 */
export const openContextMenu = (shapeId: string, position: { x: number; y: number }) => {
  lagekarteStore.setState((state) => ({
    ...state,
    contextMenu: {
      isOpen: true,
      shapeId,
      position,
    },
  }));
};

/**
 * Schließt Context Menu
 */
export const closeContextMenu = () => {
  lagekarteStore.setState((state) => ({
    ...state,
    contextMenu: null,
  }));
};

/**
 * Registriert eine Layer-Instanz für ein Shape
 *
 * @param shapeId - Shape ID
 * @param layer - Leaflet Layer Instanz
 */
export const registerLayer = (shapeId: string, layer: L.Layer) => {
  lagekarteStore.setState((state) => {
    const newLayers = new Map(state.layers);
    newLayers.set(shapeId, layer);
    return {
      ...state,
      layers: newLayers,
    };
  });
};

/**
 * Entfernt eine Layer-Registrierung
 *
 * @param shapeId - Shape ID
 */
export const unregisterLayer = (shapeId: string) => {
  lagekarteStore.setState((state) => {
    const newLayers = new Map(state.layers);
    newLayers.delete(shapeId);
    return {
      ...state,
      layers: newLayers,
    };
  });
};

/**
 * Speichert Original-Style für späteres Restore
 *
 * @param shapeId - Shape ID
 * @param style - Original PathOptions
 */
export const saveOriginalStyle = (shapeId: string, style: OriginalStyle) => {
  lagekarteStore.setState((state) => {
    const newOriginalStyles = new Map(state.originalStyles);
    newOriginalStyles.set(shapeId, style);
    return {
      ...state,
      originalStyles: newOriginalStyles,
    };
  });
};

/**
 * Entfernt gespeicherten Original-Style
 *
 * @param shapeId - Shape ID
 */
export const clearOriginalStyle = (shapeId: string) => {
  lagekarteStore.setState((state) => {
    const newOriginalStyles = new Map(state.originalStyles);
    newOriginalStyles.delete(shapeId);
    return {
      ...state,
      originalStyles: newOriginalStyles,
    };
  });
};
