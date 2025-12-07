import { useDeletePoi, usePois, useUpdatePoi } from '@/api/hooks/useLagekarteApi';
import { Button } from '@/components/atoms/button.atom';
import { Spinner } from '@/components/atoms/spinner.atom';
import { getPoiIcon } from '@/utils/poi-icons';
import { getApiErrorMessage } from '@/utils/apiErrorHandler';
import { formatMgrs } from '@/utils/lagekarte/mgrs';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import React, { useMemo, useState } from 'react';
import { PiTrash, PiWarning, PiXCircle } from 'react-icons/pi';
import { Marker, Popup } from 'react-leaflet';
import { toast } from 'sonner';
import type { LeafletMouseEvent } from 'leaflet';
import type { PoiDto } from '@bluelight-hub/shared/client';

interface PoiLayerProps {
  lagekarteId: string | undefined;
}

/**
 * PoiLayer-Komponente für Lagekarte
 *
 * Rendert alle POIs (Points of Interest) als Marker auf der Karte.
 * - Fetcht POIs via TanStack Query Hook
 * - Verwendet typenspezifische Icons aus react-icons
 * - Zeigt Popup mit POI-Details bei Klick
 * - Behandelt Loading- und Error-States
 * - Performance-optimiert mit React.memo() und useMemo()
 * - Barrierefrei mit ARIA-Labels für Screen Reader
 *
 * @param lagekarteId - ID der aktuellen Lagekarte
 *
 * @remarks
 * Performance-Optimierungen:
 * - React.memo() verhindert unnötige Re-Renders
 * - useMemo() cached POI-Validierung und Icon-Berechnung
 * - Story 48.6 wird Marker-Clustering für >3 POIs in Nähe implementieren
 *
 * Performance-Ziel (IV3):
 * - <2 Sekunden Ladezeit bei 20 POIs (auf 4G Verbindung)
 * - Messung: Chrome DevTools Performance Tab → Measure First Contentful Paint
 */
export const PoiLayer: React.FC<PoiLayerProps> = React.memo(({ lagekarteId }) => {
  const { data: pois, isLoading, error } = usePois(lagekarteId);
  const updatePoiMutation = useUpdatePoi();
  const deletePoiMutation = useDeletePoi();

  // Delete Confirmation Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [poiToDelete, setPoiToDelete] = useState<PoiDto | null>(null);

  /**
   * Zentralisiertes Error-Handling für POI-Mutationen
   * @param err - API Error
   * @param fallbackMessage - Fallback-Nachricht falls keine spezifische Nachricht verfügbar
   * @param title - Toast-Titel
   */
  const handleMutationError = async (err: unknown, fallbackMessage: string, title: string) => {
    const message = await getApiErrorMessage(err, fallbackMessage);
    toast.error(title, {
      description: message,
    });
  };

  // Berechne gültige und ungültige POIs (Performance-optimiert mit useMemo)
  // WICHTIG: Muss VOR allen early returns stehen (React Hooks Rules)
  const { validPois, skippedCount } = useMemo(() => {
    if (!pois || pois.length === 0) {
      return { validPois: [], skippedCount: 0 };
    }

    const valid: typeof pois = [];
    let skipped = 0;

    for (const poi of pois) {
      const lat = poi.coordinate?.lat;
      const lng = poi.coordinate?.lng;
      if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
        console.warn(`POI ${poi.id} has invalid coordinates:`, {
          lat,
          lng,
        });
        skipped++;
      } else {
        valid.push(poi);
      }
    }

    return { validPois: valid, skippedCount: skipped };
  }, [pois]);

  // Loading-State: Spinner in oberer rechter Ecke
  if (isLoading) {
    return (
      <div className="absolute top-4 right-4 z-50 rounded-lg bg-white p-3 shadow-lg dark:bg-gray-800">
        <Spinner size="sm" type="ring" />
      </div>
    );
  }

  // Error-State: Error-Badge in Map-Ecke
  if (error) {
    console.error('POI-Fetch-Fehler:', error);
    return (
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2 rounded-lg border-2 border-red-500 bg-red-50 p-3 shadow-lg dark:border-red-400 dark:bg-red-900/50">
        <PiXCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
        <p className="font-medium text-red-700 text-sm dark:text-red-300">POIs konnten nicht geladen werden</p>
      </div>
    );
  }

  // Keine POIs vorhanden
  if (!pois || pois.length === 0) {
    return null;
  }

  /**
   * Handler für Drag-End-Event (POI verschieben)
   * @param e - Leaflet Drag-End Event
   * @param poiId - ID des POI der verschoben wurde
   */
  const handleDragEnd = (e: LeafletMouseEvent, poiId: string) => {
    if (!lagekarteId) return;

    const marker = e.target;
    const { lat, lng } = marker.getLatLng();

    // Finde den POI um den Namen zu bekommen
    const poi = validPois.find((p) => p.id === poiId);

    // Update POI mit neuen Koordinaten
    updatePoiMutation.mutate(
      {
        poiId,
        lagekarteId,
        data: {
          coordinate: { lat, lng },
        },
      },
      {
        onSuccess: () => {
          toast.success('POI verschoben', {
            description: poi ? `"${poi.name}" wurde an neue Position verschoben.` : 'Die Position wurde aktualisiert.',
          });
        },
        onError: (err) => {
          handleMutationError(err, 'Der POI konnte nicht verschoben werden.', 'Fehler beim Verschieben');
        },
      },
    );
  };

  /**
   * Handler für Rechtsklick auf POI (Löschen-Dialog öffnen)
   * @param e - Leaflet Mouse Event
   * @param poi - POI der gelöscht werden soll
   */
  const handleRightClick = (e: LeafletMouseEvent, poi: PoiDto) => {
    e.originalEvent.preventDefault(); // Verhindere natives Context-Menü
    setPoiToDelete(poi);
    setDeleteDialogOpen(true);
  };

  /**
   * Handler für POI-Löschen (nach Bestätigung)
   */
  const handleDeleteConfirm = () => {
    if (!poiToDelete || !lagekarteId) return;

    deletePoiMutation.mutate(
      {
        poiId: poiToDelete.id,
        lagekarteId,
      },
      {
        onSuccess: () => {
          toast.success('POI gelöscht', {
            description: `"${poiToDelete.name}" wurde erfolgreich entfernt.`,
          });
        },
        onError: (err) => {
          handleMutationError(err, 'Der POI konnte nicht gelöscht werden.', 'Fehler beim Löschen');
        },
      },
    );

    // Dialog schließen
    setDeleteDialogOpen(false);
    setPoiToDelete(null);
  };

  /**
   * Handler für Löschen-Abbruch
   */
  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setPoiToDelete(null);
  };

  return (
    <>
      {/* Warning-Badge für übersprungene POIs */}
      {skippedCount > 0 && (
        <div className="absolute right-4 bottom-4 z-50 flex items-center gap-2 rounded-lg border-2 border-orange-500 bg-orange-50 p-3 shadow-lg dark:border-orange-400 dark:bg-orange-900/50">
          <PiWarning className="h-5 w-5 text-orange-500 dark:text-orange-400" />
          <p className="font-medium text-orange-700 text-sm dark:text-orange-300">
            {skippedCount} POI{skippedCount > 1 ? 's' : ''} konnten nicht angezeigt werden (ungültige Koordinaten)
          </p>
        </div>
      )}

      {/* Render gültige POI-Marker */}
      {validPois.map((poi) => {
        const icon = getPoiIcon(poi.category);
        // ACCESSIBILITY: Create descriptive ARIA label for screen readers
        const ariaLabel = `${poi.category}: ${poi.name}${poi.beschreibung ? ` - ${poi.beschreibung}` : ''}`;

        return (
          <Marker
            key={poi.id}
            position={[poi.coordinate.lat, poi.coordinate.lng]}
            icon={icon}
            draggable={true}
            eventHandlers={{
              dragend: (e) => handleDragEnd(e, poi.id),
              contextmenu: (e) => handleRightClick(e, poi),
            }}
            title={ariaLabel}
            alt={ariaLabel}
            aria-label={ariaLabel}
          >
            <Popup className="poi-popup">
              <div className="rounded-lg bg-white p-4 shadow-lg dark:bg-gray-800 dark:text-white">
                {/* POI-Name */}
                <h3 className="mb-2 font-semibold text-lg">{poi.name}</h3>

                {/* POI-Kategorie */}
                <p className="mb-1 text-gray-600 text-sm dark:text-gray-400">{poi.category}</p>

                {/* MGRS-Koordinaten (Primary Display) - nur wenn verfügbar */}
                {poi.coordinate.mgrs && (
                  <div className="mb-2 rounded bg-gray-50 p-2 dark:bg-gray-700">
                    <p className="font-medium text-gray-700 text-xs dark:text-gray-300">MGRS</p>
                    <p className="font-mono text-gray-900 text-sm dark:text-gray-100">{formatMgrs(poi.coordinate.mgrs)}</p>
                  </div>
                )}

                {/* Lat/Lng (Secondary Display) */}
                <div className="mb-2">
                  <p className="font-medium text-gray-700 text-xs dark:text-gray-300">Lat/Lng</p>
                  <p className="font-mono text-gray-600 text-xs dark:text-gray-400">
                    {poi.coordinate.lat.toFixed(6)}, {poi.coordinate.lng.toFixed(6)}
                  </p>
                </div>

                {/* Beschreibung (optional) */}
                {poi.beschreibung && <p className="text-gray-700 text-sm dark:text-gray-300">{poi.beschreibung}</p>}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel} className="relative z-[9999]">
        <DialogBackdrop className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-lg border border-gray-300 bg-white p-6 shadow-xl transition-all dark:border-gray-600 dark:bg-gray-800">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <PiTrash className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
              </div>

              <div className="flex-1">
                <DialogTitle as="h3" className="font-semibold text-gray-900 text-lg dark:text-gray-100">
                  POI löschen?
                </DialogTitle>

                <p className="mt-2 text-gray-600 text-sm dark:text-gray-400">
                  Möchten Sie <span className="font-semibold">{poiToDelete?.name || 'diesen POI'}</span> wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button intent="secondary" appearance="outlined" size="md" onClick={handleDeleteCancel}>
                Abbrechen
              </Button>

              <Button intent="danger" appearance="filled" size="md" onClick={handleDeleteConfirm} disabled={deletePoiMutation.isPending}>
                {deletePoiMutation.isPending ? (
                  <>
                    <Spinner size="sm" type="ring" />
                    <span className="ml-2">Löschen...</span>
                  </>
                ) : (
                  'Löschen'
                )}
              </Button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
});
