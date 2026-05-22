import type { SkEnum } from '@bluelight-hub/shared/client';
import { clsx } from 'clsx';
import { SK_COLOR_MAP } from '../constants/sk-color-map';
import { SK_LABELS } from '../constants/sk-labels';

type SkBadgeSize = 'sm' | 'md' | 'lg';

interface SkBadgeProps {
  sk: SkEnum;
  size?: SkBadgeSize;
  /** Optional: nur den Kurztext zeigen (für sehr enge Plätze). */
  compact?: boolean;
}

const SIZE_CLASSES: Record<SkBadgeSize, string> = {
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-sm px-3 py-1 gap-1.5',
  lg: 'text-base px-4 py-1.5 gap-2',
};

const FILL_CLASS: Record<SkEnum, string> = {
  SK_I: 'bg-sk-rot-fill',
  SK_II: 'bg-sk-gelb-fill',
  SK_III: 'bg-sk-gruen-fill',
  SK_IV: 'bg-sk-blau-fill',
  TOT: 'bg-sk-schwarz-fill',
};

/**
 * Atom-Component für SK-Anzeige (Story 1.2, UX-Spec Dreifach-Signal).
 *
 * Liefert Farbe + Label + Icon (Pille) — die Farbtokens stammen aus
 * `SK_COLOR_MAP`. `SK_IV` ist verbindlich Blau, `TOT` Schwarz (Memory
 * `project_manv_sichtungskategorien_farben`). Story 1.5 hat den Inline-
 * `style={{ backgroundColor: colors.fill }}` auf `bg-sk-{intent}-fill`-
 * Tailwind-Klassen umgestellt (AC4-Token-Migration).
 */
export function SkBadge({ sk, size = 'md', compact = false }: SkBadgeProps) {
  const colors = SK_COLOR_MAP[sk];
  const labels = SK_LABELS[sk];

  return (
    <span data-testid={`sk-badge-${sk}`} className={clsx('inline-flex items-center rounded-full border font-medium', SIZE_CLASSES[size], colors.klass)} aria-label={labels.label}>
      <span aria-hidden="true" className={clsx('inline-block h-2 w-2 rounded-full', FILL_CLASS[sk])} />
      {compact ? labels.shortLabel : labels.label}
    </span>
  );
}
