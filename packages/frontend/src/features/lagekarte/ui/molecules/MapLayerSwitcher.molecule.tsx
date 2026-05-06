/**
 * MapLayerSwitcher - Floating Button mit Popover zur Auswahl der Kartengrundlage
 *
 * Positioniert unten links auf der Karte. Ermöglicht das Umschalten zwischen
 * Grundkarten (OSM, Topo, Satellit) und das Aktivieren von Overlays (DWD Wetterwarnungen).
 */

import { cn } from '@/shared/ui/cn';
import { Switch } from '@/shared/ui/atoms/switch.atom';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { PiCloudRain, PiGlobeHemisphereWest, PiMapTrifold, PiMegaphone, PiMountains, PiPoliceCarFill, PiShieldCheck, PiShieldWarning, PiSiren, PiStack, PiWaves } from 'react-icons/pi';
import type { BaseLayerConfig, BaseLayerId } from '../../utils/map-config';
import type { NinaOverlayState, NinaSource } from '../../stores/map-layer.store';
import { setBaseLayer, setDwdOverlay, setNinaOverlay } from '../../stores/map-layer.store';

/** Konfiguration für die NINA-Overlay-Toggles */
const NINA_OVERLAY_CONFIG: { source: NinaSource; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { source: 'katwarn', label: 'KATWARN', icon: PiSiren },
  { source: 'biwapp', label: 'BIWAPP', icon: PiMegaphone },
  { source: 'mowas', label: 'MOWAS', icon: PiShieldWarning },
  { source: 'lhp', label: 'Hochwasser', icon: PiWaves },
  { source: 'police', label: 'Polizei', icon: PiPoliceCarFill },
];

interface MapLayerSwitcherProps {
  /** Verfügbare Kartengrundlagen */
  availableLayers: BaseLayerConfig[];
  /** Aktuell ausgewählte Grundkarte */
  selectedBaseLayer: BaseLayerId;
  /** DWD-Overlay aktiv */
  dwdOverlayEnabled: boolean;
  /** NINA-Overlay-Einstellungen */
  ninaOverlays: NinaOverlayState;
}

const LAYER_ICONS: Record<BaseLayerId, React.ReactNode> = {
  osm: <PiMapTrifold className="h-4 w-4" />,
  topo: <PiMountains className="h-4 w-4" />,
  satellite: <PiGlobeHemisphereWest className="h-4 w-4" />,
};

export function MapLayerSwitcher({ availableLayers, selectedBaseLayer, dwdOverlayEnabled, ninaOverlays }: MapLayerSwitcherProps) {
  return (
    <Popover className="absolute bottom-4 left-4 z-10">
      <PopoverButton
        className={cn(
          'flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-panel px-3 py-2 text-sm font-medium text-text-primary shadow-lg',
          'transition-all duration-200',
          'hover:bg-action-secondary',
          'focus-visible:shadow-focus-ring focus-visible:outline-none',
        )}
        aria-label="Kartengrundlage wechseln"
      >
        <PiStack className="h-4 w-4 text-text-muted" aria-hidden="true" />
        <span>Karte</span>
      </PopoverButton>

      <PopoverPanel
        anchor="top start"
        transition
        className={cn(
          'z-20 mb-2 w-56 rounded-lg border border-border-subtle bg-surface-panel py-2 shadow-lg',
          'ring-1 ring-border-subtle/50 focus-visible:outline-none',
          'transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0',
        )}
      >
        {/* Grundkarten-Auswahl */}
        <div className="px-3 pb-1.5 text-xs font-semibold tracking-wide text-text-muted uppercase" id="base-layer-label">
          Grundkarte
        </div>
        <div className="px-1" role="radiogroup" aria-labelledby="base-layer-label">
          {availableLayers.map((layer) => {
            const isSelected = layer.id === selectedBaseLayer;
            return (
              <button
                key={layer.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setBaseLayer(layer.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm',
                  'transition-colors duration-100',
                  'focus-visible:shadow-focus-ring focus-visible:outline-none',
                  isSelected ? 'bg-action-secondary font-medium text-action-primary' : 'text-text-primary hover:bg-action-secondary',
                )}
              >
                <span className={cn('flex-shrink-0', isSelected ? 'text-action-primary' : 'text-text-muted')}>{LAYER_ICONS[layer.id]}</span>
                <span>{layer.label}</span>
              </button>
            );
          })}
        </div>

        {/* Separator */}
        <div className="my-2 border-t border-border-subtle" />

        {/* Overlay-Toggles */}
        <div className="px-3 pb-1.5 text-xs font-semibold tracking-wide text-text-muted uppercase">Overlays</div>
        <div className="px-3">
          <label className="flex cursor-pointer items-center justify-between py-1.5">
            <span className="flex items-center gap-2 text-sm text-text-primary">
              <PiCloudRain className={cn('h-4 w-4', dwdOverlayEnabled ? 'text-action-primary' : 'text-text-muted')} aria-hidden="true" />
              Wetterwarnungen
            </span>
            <Switch checked={dwdOverlayEnabled} onChange={setDwdOverlay} description="DWD-Wetterwarnungen ein-/ausblenden" />
          </label>
        </div>

        {/* Separator */}
        <div className="my-2 border-t border-border-subtle" />

        {/* NINA Warnungen */}
        <div className="px-3 pb-1.5 text-xs font-semibold tracking-wide text-text-muted uppercase">NINA Warnungen</div>
        <div className="space-y-0.5 px-3">
          {NINA_OVERLAY_CONFIG.map(({ source, label, icon: Icon }) => (
            <label key={source} className="flex cursor-pointer items-center justify-between py-1.5">
              <span className="flex items-center gap-2 text-sm text-text-primary">
                <Icon className={cn('h-4 w-4', ninaOverlays[source] ? 'text-action-primary' : 'text-text-muted')} aria-hidden="true" />
                {label}
              </span>
              <Switch checked={ninaOverlays[source]} onChange={(checked) => setNinaOverlay(source, checked)} description={`${label}-Warnungen ein-/ausblenden`} />
            </label>
          ))}
        </div>

        {/* Legende */}
        <section className="mt-2 border-t border-border-subtle px-3 pt-2">
          <p className="mb-1.5 text-xs font-semibold text-text-muted uppercase">Legende</p>
          <div className="flex items-center gap-2 px-1 py-1" data-testid="map-legend-sicherungsposten">
            <span aria-hidden="true" className="inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#1d4ed8] bg-white">
              <PiShieldCheck className="h-3 w-3 text-[#1d4ed8]" />
            </span>
            <span className="text-sm text-text-primary">Sicherungsposten</span>
          </div>
        </section>
      </PopoverPanel>
    </Popover>
  );
}
