import { cn } from '@/utils/cn';
import { formatPoiTypeLabel } from '@/utils/formatPoiTypeLabel';
import { POI_ICON_MAP, type PoiType } from '@/utils/poi-icons';
import type React from 'react';
import { Button } from './button.atom';

export interface PoiTypeButtonProps {
  /**
   * Der POI-Typ, der angezeigt werden soll
   */
  type: PoiType;

  /**
   * Callback wenn der Button geklickt wird
   */
  onClick: (type: PoiType) => void;

  /**
   * Ob dieser POI-Typ aktuell ausgewählt ist
   */
  isActive?: boolean;

  /**
   * Button-Größe
   * @default "sm"
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Icon-Größe in Pixeln
   * @default 20
   */
  iconSize?: number;

  /**
   * Ob der Button die volle Breite einnehmen soll
   * @default false
   */
  fullWidth?: boolean;

  /**
   * Zusätzliche CSS-Klassen
   */
  className?: string;

  /**
   * Ob der Button in einem kompakten Modus (nur Icon) gerendert werden soll
   * @default false
   */
  compact?: boolean;

  /**
   * Ob der Fokus-State angezeigt werden soll (für Dropdown-Menüs)
   * @default false
   */
  showFocusState?: boolean;
}

/**
 * Wiederverwendbarer Button für POI-Type-Auswahl
 *
 * Features:
 * - Zeigt POI-Icon und formatiertes Label an
 * - Active/Inactive States mit visuellen Unterschieden
 * - Unterstützt Dark Mode
 * - Hover-Animationen
 * - Accessibility (ARIA-Label, aria-pressed)
 * - Flexibel: Kompakter Modus (nur Icon) verfügbar
 *
 * @example
 * ```tsx
 * <PoiTypeButton
 *   type="FAHRZEUG"
 *   onClick={(type) => console.log(type)}
 *   isActive={true}
 * />
 * ```
 */
export const PoiTypeButton: React.FC<PoiTypeButtonProps> = ({ type, onClick, isActive = false, size = 'sm', iconSize = 20, fullWidth = false, className, compact = false, showFocusState = false }) => {
  const config = POI_ICON_MAP[type];

  const handleClick = () => {
    onClick(type);
  };

  return (
    <Button
      onClick={handleClick}
      intent={isActive ? 'info' : 'secondary'}
      appearance={isActive ? 'filled' : 'ghost'}
      size={size}
      fullWidth={fullWidth}
      className={cn(
        'justify-start gap-2 text-left transition-all duration-200',
        // Active state enhancements (blue glow)
        isActive && 'shadow-blue-500/50 shadow-lg ring-2 ring-blue-400 dark:ring-blue-500',
        // Hover scale animation
        !compact && 'hover:scale-[1.02]',
        // Focus state (for dropdown items)
        showFocusState && 'focus:bg-gray-50 dark:focus:bg-gray-700',
        // Compact mode: Square button
        compact && 'aspect-square justify-center',
        className,
      )}
      aria-label={`POI-Typ auswählen: ${formatPoiTypeLabel(type)}`}
      aria-pressed={isActive}
    >
      {/* Icon */}
      <config.Icon size={iconSize} color={isActive ? '#ffffff' : config.color} aria-hidden="true" />

      {/* Label (nicht im kompakten Modus) */}
      {!compact && <span className="truncate">{formatPoiTypeLabel(type)}</span>}
    </Button>
  );
};
