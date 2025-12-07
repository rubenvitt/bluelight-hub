import { Label } from '@atoms/label.atom';
import { cn } from '@/utils/cn';
import { forwardRef } from 'react';

export interface RangeSliderProps {
  /** Aktueller Wert */
  value: number;
  /** Callback wenn Wert geändert wird */
  onChange: (value: number) => void;
  /** Minimaler Wert */
  min: number;
  /** Maximaler Wert */
  max: number;
  /** Schrittweite */
  step?: number;
  /** Label-Text (kann Template-String sein, z.B. "Linienstärke: {value}px") */
  label?: string;
  /** Funktion zur Formatierung des angezeigten Werts */
  formatValue?: (value: number) => string;
  /** ID für Accessibility */
  id?: string;
  /** Zusätzliche CSS-Klassen */
  className?: string;
  /** Disabled State */
  disabled?: boolean;
}

/**
 * RangeSlider Molecule Component
 *
 * Range Input mit Label und dynamischer Wertanzeige.
 * Unterstützt Template-Strings im Label oder custom Formatierung.
 *
 * @example
 * ```tsx
 * // Mit Template-String
 * <RangeSlider
 *   label="Linienstärke: {value}px"
 *   value={2}
 *   min={1}
 *   max={10}
 *   onChange={(val) => setStrokeWidth(val)}
 * />
 *
 * // Mit custom Formatierung
 * <RangeSlider
 *   label="Transparenz"
 *   value={0.5}
 *   min={0}
 *   max={1}
 *   step={0.1}
 *   formatValue={(val) => `${Math.round(val * 100)}%`}
 *   onChange={(val) => setOpacity(val)}
 * />
 * ```
 */
export const RangeSlider = forwardRef<HTMLInputElement, RangeSliderProps>(({ value, onChange, min, max, step = 1, label, formatValue, id, className, disabled }, ref) => {
  // Format value for display
  const displayValue = formatValue ? formatValue(value) : value.toString();

  // Replace {value} placeholder in label if present
  const displayLabel = label?.replace('{value}', displayValue) ?? '';

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label htmlFor={id}>{displayLabel}</Label>}
      <input
        id={id}
        ref={ref}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full accent-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={label ? displayLabel : undefined}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      />
    </div>
  );
});

RangeSlider.displayName = 'RangeSlider';
