# Lagekarte Hook Analyse - "Hook Hell" Problem

## Problem: 10+ spezialisierte Hooks mit impliziten Dependencies

### Aktueller Zustand (DrawingLayer.tsx)

```typescript
// 10+ Hook Imports
import { useLeafletPMControls } from '@/hooks/lagekarte/useLeafletPMControls';
import { useShapeLoading } from '@/hooks/lagekarte/useShapeLoading';
import { useDrawingToolSelection } from '@/hooks/lagekarte/useDrawingToolSelection';
import { useShapeSelection } from '@/hooks/lagekarte/useShapeSelection';
import { useShapeHighlighting } from '@/hooks/lagekarte/useShapeHighlighting';
import { useToolbarPositioning } from '@/hooks/lagekarte/useToolbarPositioning';
import { useKeyboardShortcuts } from '@/hooks/lagekarte/useKeyboardShortcuts';
import { useShapeEventHandlers } from '@/hooks/lagekarte/useShapeEventHandlers';
import { useTextMarkerHandling } from '@/hooks/lagekarte/useTextMarkerHandling';
import { useShapeStyleUpdates } from '@/hooks/lagekarte/useShapeStyleUpdates';

// Komponente mit Prop-Drilling und State-Fragmentierung
const [shapes, setShapes] = useState<GeoJSON.FeatureCollection>(...);
const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
const layersRef = useRef<Map<string, L.Layer>>(new Map());
const shapesRef = useRef(shapes);
const originalStylesRef = useRef<Map<string, OriginalStyle>>(new Map());
```

### Identifizierte Hook-Gruppen

#### 1. **Shape State Management** (fragmentiert über useState + Refs)
- `shapes` (State)
- `selectedShapeId` (State)
- `layersRef` (Ref)
- `shapesRef` (Ref)
- `originalStylesRef` (Ref)

**Problem:** State ist über 5 verschiedene Variablen verteilt, keine zentrale Quelle der Wahrheit

#### 2. **Selection & Highlighting** (3 Hooks)
- `useShapeSelection` - Click-Handler für Shape-Selektion
- `useShapeHighlighting` - Visuelle Highlight-Logik
- `useToolbarPositioning` - Toolbar-Position relativ zu selektiertem Shape

**Problem:** Alle 3 benötigen `selectedShapeId`, `layersRef`, `originalStylesRef` → Prop-Drilling

#### 3. **Drawing Tools & PM Controls** (2 Hooks)
- `useLeafletPMControls` - PM Toolbar Init
- `useDrawingToolSelection` - Tool-Switch Logic (Polygon/Line/Text/Edit/Delete)

**Problem:** `useDrawingToolSelection` benötigt `setSelectedShapeId` → implizite Dependency

#### 4. **Shape CRUD** (3 Hooks)
- `useShapeLoading` - Initial Load from Backend
- `useShapeEventHandlers` - pm:create, pm:edit, pm:remove Events
- `useShapeStyleUpdates` - External Shape Updates (z.B. Label-Änderung)

**Problem:** Alle 3 benötigen `shapesRef`, `setShapes`, `onShapesChange` → Redundante Prop-Übergabe

#### 5. **Keyboard & Context Menu** (2 Hooks)
- `useKeyboardShortcuts` - Delete/Backspace Handler
- Context Menu (inline in DrawingLayer)

**Problem:** Benötigen ALLE Refs/State → 8+ Props pro Hook

#### 6. **Text Marker Spezial-Logik** (1 Hook)
- `useTextMarkerHandling` - Debounced Textarea Input Handler

**Problem:** Komplexe Event-Listener-Logik mit manuellem Cleanup

## Kern-Probleme

### 1. State-Fragmentierung
- `shapes` und `shapesRef` müssen synchron gehalten werden
- `originalStylesRef` trackt Highlight-State manuell
- `layersRef` trackt Layer-Instanzen manuell
- Kein zentraler State Container

### 2. Prop-Drilling
Jeder Hook benötigt durchschnittlich 6-8 Props:
```typescript
useShapeEventHandlers({
  map,
  layersRef,
  shapesRef,
  setShapes,
  onShapesChange,
  onShapeLimitReached,
  onShapeCreated,
  onLayerClick,
  onLayerContextMenu,
});
```

### 3. Implizite Dependencies
- `useDrawingToolSelection` ruft `setSelectedShapeId(null)` auf (Side Effect!)
- `useShapeSelection` benötigt `onShapeSelected` Callback → Parent-Notification
- `useShapeEventHandlers` benötigt `onLayerClick` → Circular Dependency mit `useShapeSelection`

### 4. Keine klare Verantwortlichkeit
- `useShapeSelection` UND `useShapeHighlighting` manipulieren beide Layers
- `useShapeLoading` UND `useShapeEventHandlers` beide adden Layers zur Map
- `useKeyboardShortcuts` UND `useShapeEventHandlers` beide können Shapes löschen

## Lösungsansatz: Feature-based Architecture

### Zentral: TanStack Store (`lagekarte-state.store.ts`)
```typescript
interface LagekarteState {
  // Shape Data
  shapes: GeoJSON.FeatureCollection;

  // Selection State
  selectedShapeIds: Set<string>;
  highlightedShapeIds: Set<string>;

  // Drawing State
  activeDrawingTool: DrawingTool | null;
  isPmInitialized: boolean;

  // UI State
  toolbarVisible: boolean;
  toolbarPosition: { x: number; y: number } | null;

  // Context Menu State
  contextMenu: {
    isOpen: boolean;
    position: { x: number; y: number };
    shapeId: string;
  } | null;

  // Internal Tracking (Refs ersetzt durch Store)
  layers: Map<string, L.Layer>;
  originalStyles: Map<string, OriginalStyle>;
}
```

### Konsolidierte Hooks (3 statt 10+)

#### 1. `use-lagekarte-state.ts` - State Container Hook
- Zentrale Schnittstelle zum Store
- Selektoren für effizienten Re-Render
- Keine Business Logic

#### 2. `use-shape-actions.ts` - Shape Operations
- **Konsolidiert:**
  - `useShapeSelection` → `selectShape()`
  - `useShapeHighlighting` → `highlightShape()`
  - `useShapeEventHandlers` → `createShape()`, `updateShape()`, `deleteShape()`
  - `useKeyboardShortcuts` → `deleteSelectedShape()`
  - `useTextMarkerHandling` → `updateTextMarker()`
  - `useShapeStyleUpdates` → `updateShapeStyle()`

#### 3. `use-drawing-tools.ts` - Drawing Tool Management
- **Konsolidiert:**
  - `useLeafletPMControls` → `initializePm()`
  - `useDrawingToolSelection` → `activateTool()`
  - `useToolbarPositioning` → `updateToolbarPosition()`

### API Separation

#### `api/use-lagekarte.ts` - Read Operations
```typescript
export const useLagekarte = (einsatzId: string) => {
  return useQuery({
    queryKey: QUERY_KEYS.lagekarte.byEinsatz(einsatzId),
    queryFn: () => api.lagekarte.findByEinsatzId(einsatzId),
  });
};
```

#### `api/use-shapes.ts` - Write Operations
```typescript
export const useSaveShapes = (einsatzId: string) => {
  return useMutation({
    mutationFn: (shapes: GeoJSON.FeatureCollection) =>
      api.lagekarte.updateShapes(einsatzId, shapes),
    onSuccess: () => {
      queryClient.invalidateQueries(QUERY_KEYS.lagekarte.byEinsatz(einsatzId));
    },
  });
};
```

## Vorher/Nachher Vergleich

### Vorher (DrawingLayer.tsx)
- 10+ Hook Imports
- 5 State/Ref Variablen
- 50+ Lines Setup Code
- 8+ Props pro Hook
- Implizite Dependencies

### Nachher (DrawingLayer.tsx)
```typescript
import { useLagekarteState } from '@/features/lagekarte/hooks';
import { useShapeActions } from '@/features/lagekarte/hooks';
import { useDrawingTools } from '@/features/lagekarte/hooks';

const DrawingLayer = ({ einsatzId, selectedTool }) => {
  const map = useMap();
  const state = useLagekarteState();
  const shapeActions = useShapeActions(map);
  const drawingTools = useDrawingTools(map, selectedTool);

  // Setup in ~10 Lines statt 50+
  useEffect(() => {
    drawingTools.initialize();
  }, []);

  // ...
};
```

## Migration Benefits

1. **Reduzierte Komplexität:** 3 Hooks statt 10+
2. **Zentrale State-Verwaltung:** TanStack Store als Single Source of Truth
3. **Klare Verantwortlichkeit:** Jeder Hook hat eine definierte Aufgabe
4. **Bessere Testbarkeit:** Store-Actions können isoliert getestet werden
5. **Weniger Prop-Drilling:** Store ist global zugreifbar
6. **Performance:** Store Selektoren verhindern unnötige Re-Renders
