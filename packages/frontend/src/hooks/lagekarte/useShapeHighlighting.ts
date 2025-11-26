import { useEffect } from 'react';
import type * as L from 'leaflet';
import type { LayerWithStyle, OriginalStyle } from '@/utils/lagekarte/types';

interface UseShapeHighlightingProps {
  selectedShapeId: string | null;
  layersRef: React.MutableRefObject<Map<string, L.Layer>>;
  originalStylesRef: React.MutableRefObject<Map<string, OriginalStyle>>;
}

const isLayerWithStyle = (layer: L.Layer): layer is LayerWithStyle => {
  return 'setStyle' in layer && typeof (layer as LayerWithStyle).setStyle === 'function';
};

/**
 * Apply/Remove highlighting when selectedShapeId changes
 * Manages visual highlight state for selected shapes
 */
export const useShapeHighlighting = ({ selectedShapeId, layersRef, originalStylesRef }: UseShapeHighlightingProps) => {
  useEffect(() => {
    // Remove highlight from all shapes
    layersRef.current.forEach((layer, shapeId) => {
      const originalStyle = originalStylesRef.current.get(shapeId);
      if (originalStyle && isLayerWithStyle(layer)) {
        layer.setStyle(originalStyle);
        originalStylesRef.current.delete(shapeId);
      }
    });

    // Apply highlight to selected shape
    if (selectedShapeId) {
      const selectedLayer = layersRef.current.get(selectedShapeId);
      if (selectedLayer && isLayerWithStyle(selectedLayer)) {
        // Store original style
        const currentStyle = selectedLayer.options;
        originalStylesRef.current.set(selectedShapeId, {
          color: currentStyle.color,
          weight: currentStyle.weight,
          opacity: currentStyle.opacity,
          fillOpacity: currentStyle.fillOpacity,
        });

        // Apply highlight
        selectedLayer.setStyle({
          color: '#3b82f6', // blue-500
          weight: 4,
          opacity: 1.0,
          fillOpacity: 0.5,
        });
      }
    }
  }, [selectedShapeId, layersRef, originalStylesRef]);
};
