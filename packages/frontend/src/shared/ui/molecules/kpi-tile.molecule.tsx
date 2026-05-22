import { clsx } from 'clsx';
import type { ComponentType, ReactNode } from 'react';

/**
 * Intent-Familien für `KpiTile` (Story 1.5, AC7).
 *
 * SK-Intents nutzen die `sk-{rot,gelb,gruen,blau,schwarz}-*`-Tokens
 * (DIN 13050 / SiKoKo), Patient-Status-Intents die `patient-status-*-*`-
 * Tokens. `neutral` ist der Fallback für fachneutrale KPIs (z. B. Gesamt-
 * zahlen).
 */
export type KpiTileIntent =
  | 'sk-rot'
  | 'sk-gelb'
  | 'sk-gruen'
  | 'sk-blau'
  | 'sk-schwarz'
  | 'patient-status-eintreffend'
  | 'patient-status-sichtung'
  | 'patient-status-behandlung'
  | 'patient-status-transport-wartend'
  | 'patient-status-im-transport'
  | 'patient-status-abtransportiert'
  | 'neutral';

export type KpiTileVariant = 'tint' | 'solid';
export type KpiTileSize = 'sm' | 'md' | 'lg';

export interface KpiTileProps {
  label: string;
  /**
   * Großzahl-Wert. `undefined` ist erlaubt und bedeutet „kein Wert" — das
   * Tile rendert dann den Skeleton-Block (typischerweise zusammen mit
   * `loading={true}`), damit Loading-Pfade keine fälschliche „0" leaken.
   */
  value?: number | string;
  /**
   * Phosphor-Icon-Komponente (pflicht für multi-sensorische Codierung —
   * UX-DR5, NFR-A4). Wird mit `aria-hidden="true"` und Token-Farbe gerendert.
   */
  icon: ComponentType<{ className?: string; weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'; 'aria-hidden'?: boolean }>;
  intent: KpiTileIntent;
  /** `tint` = surface+border+text, `solid` = fill + Weiß. Default `tint`. */
  variant?: KpiTileVariant;
  /**
   * Slot für Sparkline-Trend — **Post-MVP** (UX-Spec Z. 295/1355).
   * Story 1.5 reserviert den Slot, rendert ihn jedoch noch nicht.
   */
  trend?: ReadonlyArray<number>;
  /** Optionaler Meta-Text unter der Großzahl (z. B. „Trend +5"). */
  meta?: string;
  loading?: boolean;
  size?: KpiTileSize;
  testId?: string;
  className?: string;
  children?: ReactNode;
}

const TINT_KLASS: Record<KpiTileIntent, string> = {
  'sk-rot': 'bg-sk-rot-surface border-sk-rot-border text-sk-rot-text',
  'sk-gelb': 'bg-sk-gelb-surface border-sk-gelb-border text-sk-gelb-text',
  'sk-gruen': 'bg-sk-gruen-surface border-sk-gruen-border text-sk-gruen-text',
  'sk-blau': 'bg-sk-blau-surface border-sk-blau-border text-sk-blau-text',
  'sk-schwarz': 'bg-sk-schwarz-surface border-sk-schwarz-border text-sk-schwarz-text',
  'patient-status-eintreffend': 'bg-patient-status-eintreffend-surface border-patient-status-eintreffend-border text-patient-status-eintreffend-text',
  'patient-status-sichtung': 'bg-patient-status-sichtung-surface border-patient-status-sichtung-border text-patient-status-sichtung-text',
  'patient-status-behandlung': 'bg-patient-status-behandlung-surface border-patient-status-behandlung-border text-patient-status-behandlung-text',
  'patient-status-transport-wartend': 'bg-patient-status-transport-wartend-surface border-patient-status-transport-wartend-border text-patient-status-transport-wartend-text',
  'patient-status-im-transport': 'bg-patient-status-im-transport-surface border-patient-status-im-transport-border text-patient-status-im-transport-text',
  'patient-status-abtransportiert': 'bg-patient-status-abtransportiert-surface border-patient-status-abtransportiert-border text-patient-status-abtransportiert-text',
  neutral: 'bg-surface-panel border-border-subtle text-text-primary',
};

const SOLID_KLASS: Partial<Record<KpiTileIntent, string>> = {
  'sk-rot': 'bg-sk-rot-fill border-sk-rot-fill text-white',
  'sk-gelb': 'bg-sk-gelb-fill border-sk-gelb-fill text-white',
  'sk-gruen': 'bg-sk-gruen-fill border-sk-gruen-fill text-white',
  'sk-blau': 'bg-sk-blau-fill border-sk-blau-fill text-white',
  'sk-schwarz': 'bg-sk-schwarz-fill border-sk-schwarz-fill text-white',
};

const SIZE_PADDING: Record<KpiTileSize, string> = {
  sm: 'p-3 min-h-[88px]',
  md: 'p-4 min-h-[112px]',
  lg: 'p-5 min-h-[136px]',
};

const VALUE_SIZE: Record<KpiTileSize, string> = {
  sm: 'text-title-lg',
  md: 'text-title-xxl',
  lg: 'text-title-xxl',
};

const ICON_SIZE: Record<KpiTileSize, string> = {
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  lg: 'h-7 w-7',
};

/**
 * Generische, read-only KPI-Tile mit multi-sensorischer Codierung (Story 1.5,
 * AC7) — Farbe + Phosphor-Icon + Text-Label gleichzeitig, sodass Screenreader-
 * Nutzer und sehende Nutzer dieselbe Information bekommen.
 *
 * Touch-Target ≥ 44 px (BITV 2.0, NFR-A1) durch `min-h`-Padding pro Größe.
 * `role="status"` markiert die Tile als Status-Anzeige; das `aria-live` lebt
 * bewusst **eine Ebene höher** im `KpiStrip`-Wrapper, damit 12 gleichzeitige
 * Loading→Success-Übergänge nicht in 12-fach-Screenreader-Spam münden
 * (Story-1.5-Code-Review).
 */
export function KpiTile(props: KpiTileProps) {
  const { label, value, icon: Icon, intent, variant = 'tint', meta, loading = false, size = 'md', testId, className, children } = props;

  const tileClass = clsx(
    'flex flex-col gap-2 rounded-panel border-2',
    'transition-colors duration-150',
    SIZE_PADDING[size],
    variant === 'solid' ? (SOLID_KLASS[intent] ?? TINT_KLASS[intent]) : TINT_KLASS[intent],
    className,
  );

  if (loading) {
    return (
      <div data-testid={testId ?? `kpi-tile-${intent}-loading`} className={clsx(tileClass, 'animate-pulse opacity-70')} role="status" aria-busy="true" aria-label={`${label}: lädt`}>
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className={clsx(ICON_SIZE[size], 'rounded-sm bg-current opacity-20')} />
          <span className="text-title-sm font-semibold opacity-40">{label}</span>
        </div>
        <span className={clsx(VALUE_SIZE[size], 'h-12 w-16 rounded-sm bg-current opacity-20')} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div data-testid={testId ?? `kpi-tile-${intent}`} className={tileClass} role="status" aria-label={`${label}: ${value ?? ''}`}>
      <div className="flex items-center gap-2">
        <Icon aria-hidden={true} className={clsx(ICON_SIZE[size], 'shrink-0')} weight="fill" />
        <span className="text-title-sm font-semibold">{label}</span>
      </div>
      {value !== undefined ? <span className={clsx(VALUE_SIZE[size], 'leading-none font-bold tabular-nums')}>{value}</span> : null}
      {meta ? <span className="text-body-sm opacity-80">{meta}</span> : null}
      {children}
    </div>
  );
}
