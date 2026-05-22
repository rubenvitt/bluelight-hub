import type { BehandlungsstatusEnum, SkEnum, TransportstatusEnum } from '@bluelight-hub/shared/client';
import { clsx } from 'clsx';
import { WarningOctagon } from '@phosphor-icons/react';
import { KpiTile, type KpiTileIntent } from '@/shared/ui';
import { useKpiAggregat } from '../api/use-kpi-aggregat';
import {
  BEHANDLUNG_DISPLAY_ORDER,
  BEHANDLUNG_ICON_MAP,
  BEHANDLUNG_LABELS,
  SK_DISPLAY_ORDER,
  SK_ICON_MAP,
  SK_LABELS,
  TRANSPORT_DISPLAY_ORDER,
  TRANSPORT_ICON_MAP,
  TRANSPORT_LABELS,
} from '../constants';

interface KpiStripProps {
  einsatzId: string;
  className?: string;
}

const SK_INTENT: Record<SkEnum, KpiTileIntent> = {
  SK_I: 'sk-rot',
  SK_II: 'sk-gelb',
  SK_III: 'sk-gruen',
  SK_IV: 'sk-blau',
  TOT: 'sk-schwarz',
};

// Intent-Mapping (Story-1.5-Code-Review): Innerhalb jeder Sektion ist jede
// Tile farblich eindeutig. Zwischen den Sektionen re-usen `TRANSPORTBEREIT`
// (Behandlung) und `IM_KRANKENHAUS` (Transport) bewusst das gleiche Token
// `patient-status-abtransportiert` — beides bedeutet „Patient ist versorgt
// und außer Haus". `patient-status-sichtung` wird für `VERSORGT` genutzt,
// damit kein Token brachliegt. Konsistent mit `patient-status-color-map.ts`.
const BEHANDLUNG_INTENT: Record<BehandlungsstatusEnum, KpiTileIntent> = {
  UNVERSORGT: 'patient-status-eintreffend',
  IN_BEHANDLUNG: 'patient-status-behandlung',
  VERSORGT: 'patient-status-sichtung',
  TRANSPORTBEREIT: 'patient-status-abtransportiert',
};

const TRANSPORT_INTENT: Record<TransportstatusEnum, KpiTileIntent> = {
  WARTEND: 'patient-status-transport-wartend',
  IM_TRANSPORT: 'patient-status-im-transport',
  IM_KRANKENHAUS: 'patient-status-abtransportiert',
};

/**
 * Feature-Komponente `KpiStrip` (Story 1.5, AC8) — komponiert 12 `KpiTile`s
 * aus `useKpiAggregat(einsatzId)` in der spezifizierten Reihenfolge:
 *
 *  1. SK-Sektion (5 Tiles, variant=solid): SK_I, SK_II, SK_III, SK_IV, TOT
 *  2. Behandlungs-Sektion (4 Tiles, variant=tint): UNVERSORGT,
 *     IN_BEHANDLUNG, VERSORGT, TRANSPORTBEREIT
 *  3. Transport-Sektion (3 Tiles, variant=tint): WARTEND, IM_TRANSPORT,
 *     IM_KRANKENHAUS
 *
 * Loading-State: alle 12 Tiles im Skeleton (kein Layout-Shift); `value` wird
 * dabei `undefined` durchgereicht — das Tile rendert keinen Großzahl-Text,
 * sondern den Skeleton-Block. So leakt selbst bei künftigem Loading-Refactor
 * keine fälschliche „0" als echter Stand-Wert.
 *
 * Live-Region: ein einziger `aria-live="polite"`-Wrapper am Strip-Level
 * konsolidiert Screenreader-Announcements; die Tiles selbst tragen kein
 * `aria-live` (verhindert 12-fach-Announcement-Spam bei jedem Update).
 *
 * Error-State: Inline-Fallback mit Phosphor-WarningOctagon + Klartext —
 * kein Sentinel-Code-Leak (Pattern aus Story 1.4 USER_FACING_MESSAGES).
 */
export function KpiStrip({ einsatzId, className }: KpiStripProps) {
  const { data, isLoading, isError } = useKpiAggregat(einsatzId);

  if (isError) {
    return (
      <section role="alert" aria-live="assertive" className={clsx('flex items-center gap-3 rounded-panel border-2 border-sk-rot-border bg-sk-rot-surface p-4 text-sk-rot-text', className)}>
        <WarningOctagon aria-hidden={true} className="h-6 w-6 shrink-0" weight="fill" />
        <span className="text-body-md">KPI-Lagebild konnte nicht geladen werden — bitte Verbindung prüfen.</span>
      </section>
    );
  }

  const skSection = SK_DISPLAY_ORDER.map((sk) => {
    const Icon = SK_ICON_MAP[sk];
    return <KpiTile key={`sk-${sk}`} intent={SK_INTENT[sk]} variant="solid" label={SK_LABELS[sk].shortLabel} value={data?.sk[sk]} icon={Icon} loading={isLoading} testId={`kpi-sk-${sk}`} />;
  });

  const behandlungSection = BEHANDLUNG_DISPLAY_ORDER.map((status) => {
    const Icon = BEHANDLUNG_ICON_MAP[status];
    return (
      <KpiTile
        key={`behandlung-${status}`}
        intent={BEHANDLUNG_INTENT[status]}
        variant="tint"
        label={BEHANDLUNG_LABELS[status].shortLabel}
        value={data?.behandlung[status]}
        icon={Icon}
        loading={isLoading}
        testId={`kpi-behandlung-${status}`}
      />
    );
  });

  const transportSection = TRANSPORT_DISPLAY_ORDER.map((status) => {
    const Icon = TRANSPORT_ICON_MAP[status];
    return (
      <KpiTile
        key={`transport-${status}`}
        intent={TRANSPORT_INTENT[status]}
        variant="tint"
        label={TRANSPORT_LABELS[status].shortLabel}
        value={data?.transport[status]}
        icon={Icon}
        loading={isLoading}
        testId={`kpi-transport-${status}`}
      />
    );
  });

  // Responsive Layout gemaess AC8 (UX-Spec Z. 860–874):
  //  - <640 px (eng, z. B. Tablet-Hochkant 360 px): 2 Spalten / Sektion —
  //    `text-title-xxl` (clamp 2.5rem–4.5rem) braucht mindestens ~140 px
  //    Tile-Innenbreite für 3-stellige Werte; `grid-cols-3` würde überlaufen.
  //  - 640–1023 px (Tablet Portrait): 1 Spalte, vertikal gestapelt
  //  - 1024–1279 px: 2 Spalten
  //  - >=1280 px: voller horizontaler Strip (5/4/3 Tiles in einer Reihe pro Sektion)
  return (
    <div data-testid="kpi-strip" className={clsx('flex flex-col gap-shell', className)} aria-live="polite" aria-atomic="false">
      <section role="group" aria-label="Sichtungskategorien" className="grid grid-cols-2 gap-cluster sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-5">
        {skSection}
      </section>
      <section role="group" aria-label="Behandlungs-Status" className="grid grid-cols-2 gap-cluster sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-4">
        {behandlungSection}
      </section>
      <section role="group" aria-label="Transport-Status" className="grid grid-cols-2 gap-cluster sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {transportSection}
      </section>
    </div>
  );
}
