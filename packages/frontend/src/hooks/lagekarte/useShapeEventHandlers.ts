import { useEffect } from 'react';
import type * as L from 'leaflet';
import type * as GeoJSON from 'geojson';
import { generateShapeId, extractTextContent } from '@/utils/lagekarte/shape-helpers';
import { setShapeIdOnLayer } from '@/utils/lagekarte/layer-utils';
import type { LayerWithGeoJSON } from '@/utils/lagekarte/types';

/**
 * Maximum number of shapes per Lagekarte (Performance-Limit)
 */
const MAX_SHAPES = 100;

interface UseShapeEventHandlersProps {
  map: L.Map;
  layersRef: React.MutableRefObject<Map<string, L.Layer>>;
  shapesRef: React.MutableRefObject<GeoJSON.FeatureCollection>;
  setShapes: (shapes: GeoJSON.FeatureCollection) => void;
  onShapesChange: (shapes: GeoJSON.FeatureCollection) => void;
  onShapeLimitReached?: () => void;
  onShapeCreated?: (shape: GeoJSON.Feature) => void;
  onLayerClick: (e: L.LeafletMouseEvent) => void;
  onLayerContextMenu: (e: L.LeafletMouseEvent) => void;
}

type PmEvent = L.LeafletEvent & {
  layer: L.Layer;
  shape?: string;
};

const isGeoJsonLayer = (layer: L.Layer): layer is LayerWithGeoJSON => {
  return 'toGeoJSON' in layer && typeof (layer as LayerWithGeoJSON).toGeoJSON === 'function';
};

/**
 * Event Handlers for Leaflet.PM shape creation, editing, and removal
 * Manages pm:create, pm:edit, pm:remove events
 */
export const useShapeEventHandlers = ({ map, layersRef, shapesRef, setShapes, onShapesChange, onShapeLimitReached, onShapeCreated, onLayerClick, onLayerContextMenu }: UseShapeEventHandlersProps) => {
  /**
   * Event Handler: pm:create
   * Called when user creates a new shape
   */
  useEffect(() => {
    // Defensive check: Ensure PM is available before registering event
    if (!map.pm) {
      console.warn('[useShapeEventHandlers] Leaflet.PM not available, skipping pm:create handler');
      return;
    }

    const handleCreate = (e: PmEvent) => {
      const layer = e.layer;

      if (!isGeoJsonLayer(layer)) {
        return;
      }

      // Check shape limit (use shapesRef.current for latest state)
      if (shapesRef.current.features.length >= MAX_SHAPES) {
        // Remove created layer immediately
        map.removeLayer(layer);
        onShapeLimitReached?.();
        return;
      }

      // Convert to GeoJSON
      const geoJson = layer.toGeoJSON() as GeoJSON.Feature;

      // Extract text content for Text markers
      const textContent = extractTextContent(layer, e.shape);

      // Add shape ID for tracking (using unique ID generator)
      const shapeId = generateShapeId();
      geoJson.properties = {
        ...geoJson.properties,
        id: shapeId,
        createdAt: new Date().toISOString(),
        // Add text property for Text markers
        ...(textContent && { text: textContent }),
      };

      // Track layer and store shapeId directly on the layer
      setShapeIdOnLayer(layer, shapeId);
      layersRef.current.set(shapeId, layer);

      // Add click handler to new layer for selection
      layer.on('click', onLayerClick);

      // Add context menu handler for right-click
      layer.on('contextmenu', onLayerContextMenu);

      // Add to shapes collection (use shapesRef.current)
      const updatedShapes: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [...shapesRef.current.features, geoJson],
      };
      setShapes(updatedShapes);
      onShapesChange(updatedShapes);

      // Trigger Label-Modal
      onShapeCreated?.(geoJson);
    };

    map.on('pm:create', handleCreate);

    return () => {
      // Defensive check: Ensure PM still available during cleanup
      if (map.pm) {
        map.off('pm:create', handleCreate);
      }
    };
  }, [map, layersRef, shapesRef, setShapes, onShapesChange, onShapeLimitReached, onShapeCreated, onLayerClick, onLayerContextMenu]);

  /**
   * Event Handler: pm:edit
   * Called when user edits an existing shape
   */
  useEffect(() => {
    // Defensive check: Ensure PM is available before registering event
    if (!map.pm) {
      console.warn('[useShapeEventHandlers] Leaflet.PM not available, skipping pm:edit handler');
      return;
    }

    const handleEdit = (e: PmEvent) => {
      const layer = e.layer;

      if (!isGeoJsonLayer(layer)) {
        return;
      }

      const updatedGeoJson = layer.toGeoJSON() as GeoJSON.Feature;

      // Extract updated text content for Text markers
      const textContent = extractTextContent(layer);

      // Find shape by layer
      const shapeId = updatedGeoJson.properties?.id;
      if (!shapeId) return;

      // Update shape in collection (use shapesRef.current)
      const updatedShapes: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: shapesRef.current.features.map((feature) => {
          if (feature.properties?.id === shapeId) {
            return {
              ...feature,
              geometry: updatedGeoJson.geometry,
              properties: {
                ...feature.properties,
                // Update text property if this is a Text marker
                ...(textContent && { text: textContent }),
              },
            };
          }
          return feature;
        }),
      };
      setShapes(updatedShapes);
      onShapesChange(updatedShapes);
    };

    map.on('pm:edit', handleEdit);

    return () => {
      // Defensive check: Ensure PM still available during cleanup
      if (map.pm) {
        map.off('pm:edit', handleEdit);
      }
    };
  }, [map, shapesRef, setShapes, onShapesChange]);

  /**
   * Event Handler: pm:remove
   * Called when user deletes a shape
   */
  useEffect(() => {
    // Defensive check: Ensure PM is available before registering event
    if (!map.pm) {
      console.warn('[useShapeEventHandlers] Leaflet.PM not available, skipping pm:remove handler');
      return;
    }

    const handleRemove = (e: PmEvent) => {
      const layer = e.layer;

      if (!isGeoJsonLayer(layer)) {
        return;
      }

      const geoJson = layer.toGeoJSON() as GeoJSON.Feature;
      const shapeId = geoJson.properties?.id;

      if (!shapeId) return;

      // Remove from tracking
      layersRef.current.delete(shapeId);

      // Remove from shapes collection (use shapesRef.current)
      const updatedShapes: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: shapesRef.current.features.filter((feature) => feature.properties?.id !== shapeId),
      };
      setShapes(updatedShapes);
      onShapesChange(updatedShapes);
    };

    map.on('pm:remove', handleRemove);

    return () => {
      // Defensive check: Ensure PM still available during cleanup
      if (map.pm) {
        map.off('pm:remove', handleRemove);
      }
    };
  }, [map, layersRef, shapesRef, setShapes, onShapesChange]);
};
