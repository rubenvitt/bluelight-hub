import { useCallback, useEffect, useRef } from 'react';
import type * as L from 'leaflet';
import type * as GeoJSON from 'geojson';
import type { LayerWithShapeId, LayerWithTextContent } from '@/utils/lagekarte/types';

interface UseTextMarkerHandlingProps {
  map: L.Map;
  shapesRef: React.MutableRefObject<GeoJSON.FeatureCollection>;
  setShapes: (shapes: GeoJSON.FeatureCollection) => void;
  onShapesChange: (shapes: GeoJSON.FeatureCollection) => void;
}

const isTextMarkerLayer = (layer: L.Layer): layer is LayerWithShapeId & LayerWithTextContent => {
  return 'getElement' in layer && typeof (layer as LayerWithTextContent).getElement === 'function';
};

/**
 * Event Handler: Text content changes (input/change on Leaflet.PM textarea)
 * Leaflet.PM text markers use a textarea element for editing,
 * and don't trigger pm:edit for text changes.
 * We use a debounced input handler to save changes.
 */
export const useTextMarkerHandling = ({ map, shapesRef, setShapes, onShapesChange }: UseTextMarkerHandlingProps) => {
  // Use refs for unstable dependencies to prevent handler recreation
  const setShapesRef = useRef(setShapes);
  const onShapesChangeRef = useRef(onShapesChange);
  const timeoutIdRef = useRef<NodeJS.Timeout>();

  // Update refs on each render (but don't trigger re-renders)
  useEffect(() => {
    setShapesRef.current = setShapes;
    onShapesChangeRef.current = onShapesChange;
  });

  // Stable handler with useCallback - only recreated when map changes
  const handleTextChange = useCallback(
    (event: Event) => {
      const target = event.target as HTMLTextAreaElement;

      // Check if this is a Leaflet.PM text marker textarea
      if (!target.matches('textarea.pm-textarea')) {
        return;
      }

      const newText = target.value || '';

      // Find the parent marker element
      const markerIcon = target.closest('.leaflet-marker-icon.pm-text-marker');
      if (!markerIcon) {
        return;
      }

      // Find the layer associated with this marker
      let shapeId: string | null = null;

      map.eachLayer((layer) => {
        if (isTextMarkerLayer(layer) && layer.getElement?.() === markerIcon) {
          // Get shape ID directly from layer (stored during initialization or creation)
          shapeId = layer._shapeId ?? null;
        }
      });

      if (!shapeId) {
        return;
      }

      // Debounce: Wait 500ms after last input before saving
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      timeoutIdRef.current = setTimeout(() => {
        // Update shape in collection (use shapesRef to avoid stale closure)
        const updatedShapes: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: shapesRef.current.features.map((feature) => {
            if (feature.properties?.id === shapeId) {
              return {
                ...feature,
                properties: {
                  ...feature.properties,
                  text: newText,
                },
              };
            }
            return feature;
          }),
        };

        setShapesRef.current(updatedShapes);
        onShapesChangeRef.current(updatedShapes);
      }, 500);
    },
    [map, shapesRef],
  );

  // Register event listeners with stable handler
  useEffect(() => {
    const mapContainer = map.getContainer();

    // Add event listeners with capturing phase
    // IMPORTANT: Must use same options in removeEventListener
    const listenerOptions = { capture: true };
    mapContainer.addEventListener('input', handleTextChange, listenerOptions);
    mapContainer.addEventListener('change', handleTextChange, listenerOptions);

    return () => {
      // Clear timeout on cleanup
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      // CRITICAL: Now using stable handleTextChange reference - no more "wrong listener type" errors!
      mapContainer.removeEventListener('input', handleTextChange, listenerOptions);
      mapContainer.removeEventListener('change', handleTextChange, listenerOptions);
    };
  }, [map, handleTextChange]);
};
