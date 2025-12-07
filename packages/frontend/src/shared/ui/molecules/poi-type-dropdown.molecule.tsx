import { cn } from '@/utils/cn';
import type { PoiType } from '@/utils/poi-icons';
import { PoiTypeButton } from '@atoms/poi-type-button.atom';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import type React from 'react';
import { PiCaretDown } from 'react-icons/pi';

export interface PoiTypeDropdownProps {
  /**
   * Liste der POI-Types, die im Dropdown angezeigt werden sollen
   */
  types: PoiType[];

  /**
   * Callback wenn ein POI-Typ ausgewählt wird
   */
  onSelect: (type: PoiType) => void;

  /**
   * Aktuell ausgewählter POI-Typ
   */
  selectedType: PoiType | null;

  /**
   * Label für den Dropdown-Button
   * @default "Erweitert"
   */
  label?: string;

  /**
   * Zusätzliche CSS-Klassen für den Container
   */
  className?: string;

  /**
   * Icon-Größe für die POI-Type-Buttons
   * @default 18
   */
  iconSize?: number;
}

/**
 * Wiederverwendbares Dropdown-Menü für POI-Type-Auswahl
 *
 * Features:
 * - Verwendet Headless UI Menu für Accessibility
 * - Zeigt POI-Types als PoiTypeButton-Komponenten
 * - Smooth Open/Close-Animationen (Caret-Rotation)
 * - Active State für aktuell ausgewählten Type
 * - Focus States für Keyboard-Navigation
 * - Dark Mode Support
 * - Responsive: Dropdown passt sich an Container an
 *
 * @example
 * ```tsx
 * <PoiTypeDropdown
 *   types={["POLIZEI", "RW", "THW"]}
 *   onSelect={(type) => console.log(type)}
 *   selectedType={null}
 *   label="Erweitert"
 * />
 * ```
 */
export const PoiTypeDropdown: React.FC<PoiTypeDropdownProps> = ({ types, onSelect, selectedType, label = 'Erweitert', className, iconSize = 18 }) => {
  return (
    <Menu as="div" className={cn('relative', className)}>
      {({ open }) => (
        <>
          {/* Dropdown-Button */}
          <MenuButton
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 transition-all duration-200',
              'font-medium text-sm',
              // Open State: Blue with ring
              open
                ? 'bg-blue-50 text-blue-900 shadow-md ring-2 ring-blue-500 dark:bg-blue-900/50 dark:text-blue-100 dark:ring-blue-400'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
            )}
            aria-label={`${label} POI-Typen`}
          >
            <span>{label}</span>
            <PiCaretDown className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-180')} aria-hidden="true" />
          </MenuButton>

          {/* Dropdown-Items - öffnet sich nach OBEN */}
          <MenuItems
            className={cn(
              'absolute right-0 bottom-full left-0 z-50 mb-1',
              'origin-bottom-left rounded-lg border border-gray-200 bg-white p-1',
              'shadow-xl transition focus:outline-none',
              'dark:border-gray-700 dark:bg-gray-800',
              // Smooth entrance animation (von unten nach oben)
              'data-[closed]:scale-95 data-[closed]:opacity-0',
              'data-[enter]:duration-100 data-[leave]:duration-75',
              // Max height mit Scroll für viele Items
              'max-h-64 overflow-y-auto',
            )}
          >
            {types.map((type) => {
              const isActive = selectedType === type;

              return (
                <MenuItem key={type}>
                  {({ focus }) => (
                    <div
                      className={cn(
                        'rounded-md transition-colors',
                        // Focus state (keyboard navigation)
                        focus && 'bg-gray-50 dark:bg-gray-700',
                      )}
                    >
                      <PoiTypeButton
                        type={type}
                        onClick={onSelect}
                        isActive={isActive}
                        size="sm"
                        iconSize={iconSize}
                        fullWidth
                        showFocusState={focus}
                        className={cn(
                          'font-medium',
                          // Override default hover scale for dropdown items
                          'hover:scale-100',
                        )}
                      />
                    </div>
                  )}
                </MenuItem>
              );
            })}
          </MenuItems>
        </>
      )}
    </Menu>
  );
};
