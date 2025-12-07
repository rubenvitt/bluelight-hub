import { Input } from '@atoms/input.atom';
import { Label } from '@atoms/label.atom';
import { cn } from '@/utils/cn';
import { forwardRef } from 'react';

export interface ColorPickerProps {
  /** Aktueller Farbwert (Hex-Format, z.B. "#3b82f6") */
  value: string;
  /** Callback wenn Farbe geändert wird */
  onChange: (color: string) => void;
  /** Label-Text */
  label?: string;
  /** ID für Accessibility */
  id?: string;
  /** Zusätzliche CSS-Klassen */
  className?: string;
  /** Disabled State */
  disabled?: boolean;
}

/**
 * ColorPicker Molecule Component
 *
 * Kombiniert einen nativen Color Picker mit einem Text-Input für Hex-Werte.
 * Ermöglicht sowohl visuelle als auch textuelle Farbeingabe.
 *
 * @example
 * ```tsx
 * <ColorPicker
 *   label="Farbe"
 *   value="#3b82f6"
 *   onChange={(color) => setColor(color)}
 * />
 * ```
 */
export const ColorPicker = forwardRef<HTMLInputElement, ColorPickerProps>(({ value, onChange, label, id, className, disabled }, ref) => {
  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="flex gap-2">
        {/* Native Color Picker */}
        <input
          id={id}
          ref={ref}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-10 w-20 rounded-lg border-2 border-gray-300 hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:hover:border-gray-600"
          aria-label={label ? `${label} - Farbwähler` : 'Farbwähler'}
        />

        {/* Hex Input Field */}
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="flex-1 font-mono"
          placeholder="#000000"
          maxLength={7}
          pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
          aria-label={label ? `${label} - Hex-Code` : 'Hex-Code'}
        />
      </div>
    </div>
  );
});

ColorPicker.displayName = 'ColorPicker';
