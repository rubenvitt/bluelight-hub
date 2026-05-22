import type { SkEnum } from '@bluelight-hub/shared/client';
import { clsx } from 'clsx';
import { useCallback } from 'react';
import { SK_COLOR_MAP } from '../constants/sk-color-map';
import { SK_DISPLAY_ORDER, SK_LABELS } from '../constants/sk-labels';

interface SkSelectorProps {
  value: SkEnum | undefined;
  onChange: (value: SkEnum) => void;
  /** Optional: Disabled state für laufende Submits. */
  disabled?: boolean;
  /** Label für ARIA, default „Initiale Sichtungskategorie". */
  ariaLabel?: string;
  /** Optionale ID des sichtbaren Label-Elements (verknüpft via `aria-labelledby`). */
  labelledBy?: string;
  /** Optionale DOM-ID der RadioGroup (z. B. für `<label htmlFor>`-Verknüpfung). */
  id?: string;
}

/**
 * RadioGroup mit 5 SK-Pills (Story 1.2, UX-Spec).
 *
 * Verwendet keine Headless-UI-`RadioGroup`, damit der Pill-Look komplett
 * gestaltbar bleibt; ARIA wird manuell verdrahtet. Touch-Target ≥ 48 px
 * (Mobile) / 96×96 px (Tablet-Defining-Experience) — Tailwind `min-h-12`
 * (48 px) deckt den Mobile-Branch ab; die Tablet-Variante kommt in Story 1.5.
 */
export function SkSelector({ value, onChange, disabled = false, ariaLabel = 'Initiale Sichtungskategorie', labelledBy, id }: SkSelectorProps) {
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      const currentIndex = value ? SK_DISPLAY_ORDER.indexOf(value) : -1;
      let nextIndex: number | null = null;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % SK_DISPLAY_ORDER.length;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        nextIndex = currentIndex < 0 ? SK_DISPLAY_ORDER.length - 1 : (currentIndex - 1 + SK_DISPLAY_ORDER.length) % SK_DISPLAY_ORDER.length;
      }
      if (nextIndex !== null) {
        event.preventDefault();
        onChange(SK_DISPLAY_ORDER[nextIndex]);
      }
    },
    [disabled, onChange, value],
  );

  return (
    <div role="radiogroup" id={id} aria-label={labelledBy ? undefined : ariaLabel} aria-labelledby={labelledBy} className="flex flex-wrap gap-2" onKeyDown={onKeyDown}>
      {SK_DISPLAY_ORDER.map((sk) => {
        const checked = value === sk;
        const colors = SK_COLOR_MAP[sk];
        const labels = SK_LABELS[sk];

        return (
          <button
            key={sk}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={labels.label}
            data-testid={`sk-selector-pill-${sk}`}
            disabled={disabled}
            onClick={() => onChange(sk)}
            className={clsx(
              'min-h-12 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              colors.klass,
              checked ? 'shadow-sm ring-2 ring-offset-2' : 'opacity-70 hover:opacity-100',
              disabled && 'cursor-not-allowed opacity-50',
            )}
            style={checked ? { boxShadow: `inset 0 0 0 2px ${colors.border}` } : undefined}
            tabIndex={checked || (!value && sk === SK_DISPLAY_ORDER[0]) ? 0 : -1}
          >
            <span aria-hidden="true" className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: colors.fill }} />
            {labels.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
