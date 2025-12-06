import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { Button } from '@/components/atoms/button.atom';
import { POI_ICON_MAP, type PoiCategory } from '@/utils/poi-icons';
import type React from 'react';
import { PiCaretDown } from 'react-icons/pi';

interface PoiToolbarProps {
  /**
   * Callback wenn ein POI-Typ ausgewählt wird
   */
  onPoiTypeSelect: (type: PoiCategory) => void;
  /**
   * Aktuell ausgewählter POI-Typ (für Active State)
   */
  selectedType: PoiCategory | null;
}

/**
 * POI-Toolbar-Komponente für Lagekarte
 *
 * Zeigt POI-Typen als Buttons an, die der User auswählen kann um
 * einen POI auf der Karte zu platzieren.
 *
 * @param onPoiTypeSelect - Callback wenn Typ ausgewählt wird
 * @param selectedType - Aktuell ausgewählter Typ (für Active State)
 *
 * @remarks
 * - Häufige POI-Typen werden direkt als Buttons angezeigt
 * - Erweiterte Typen sind in einem Headless UI Dropdown-Menü
 * - Active State: bg-blue-100 dark:bg-blue-900 für ausgewählten Typ
 * - Desktop: Vertical sidebar (left side)
 * - Mobile: Horizontal toolbar (bottom) - siehe Task 9
 *
 * @example
 * ```tsx
 * <PoiToolbar
 *   onPoiTypeSelect={(type) => setSelectedPoiType(type)}
 *   selectedType={selectedPoiType}
 * />
 * ```
 */
export const PoiToolbar: React.FC<PoiToolbarProps> = ({ onPoiTypeSelect, selectedType }) => {
  // Häufige POI-Typen (Haupt-Buttons) - neue CQRS-Kategorien (DRK-Standard)
  const frequentTypes: PoiCategory[] = ['EINSATZSTELLE', 'BEREITSTELLUNGSRAUM', 'GEFAHRENSTELLE', 'WASSERENTNAHMESTELLE', 'SONSTIGES'];

  // Erweiterte POI-Typen (Dropdown-Menü) - für zukünftige Erweiterungen
  const extendedTypes: PoiCategory[] = [];

  /**
   * Rendert einen POI-Typ-Button
   */
  const renderPoiButton = (type: PoiCategory) => {
    const config = POI_ICON_MAP[type];
    const isActive = selectedType === type;

    return (
      <Button
        type="button"
        key={type}
        onClick={() => onPoiTypeSelect(type)}
        intent={isActive ? 'primary' : 'secondary'}
        appearance="outline"
        size="md"
        className="w-full justify-start gap-2"
        aria-label={`POI-Typ auswählen: ${type}`}
        aria-pressed={isActive}
      >
        {/* Icon */}
        <config.Icon size={20} color={config.color} aria-hidden="true" />

        {/* Label */}
        <span className="font-medium text-sm">{formatPoiTypeLabel(type)}</span>
      </Button>
    );
  };

  return (
    <>
      {/* Desktop: Vertical Sidebar (left side) */}
      <div className="absolute top-20 left-4 z-50 hidden flex-col gap-2 md:flex">
        {/* Häufige POI-Typen */}
        {frequentTypes.map(renderPoiButton)}

        {/* Erweiterte POI-Typen (Dropdown) */}
        <Menu as="div" className="relative">
          {({ open }) => (
            <>
              <MenuButton
                className={`flex w-full items-center justify-between gap-2 rounded-lg border-2 px-3 py-2 transition-all hover:shadow-md ${
                  open
                    ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/50'
                    : 'border-gray-300 bg-white hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500'
                }
                `}
                aria-label="Erweiterte POI-Typen"
              >
                <span className="font-medium text-gray-900 text-sm dark:text-gray-100">Erweitert</span>
                <PiCaretDown className={`h-4 w-4 text-gray-600 transition-transform dark:text-gray-400 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
              </MenuButton>

              <MenuItems
                className="absolute top-full left-0 z-50 mt-1 w-56 origin-top-left rounded-lg border border-gray-300 bg-white py-1 shadow-lg transition focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                anchor="bottom start"
              >
                {extendedTypes.map((type) => {
                  const config = POI_ICON_MAP[type];
                  const isActive = selectedType === type;

                  return (
                    <MenuItem key={type}>
                      {() => (
                        <Button
                          type="button"
                          onClick={() => onPoiTypeSelect(type)}
                          intent={isActive ? 'primary' : 'secondary'}
                          appearance="ghost"
                          size="md"
                          className="w-full justify-start gap-3"
                          aria-label={`POI-Typ auswählen: ${type}`}
                          aria-pressed={isActive}
                        >
                          {/* Icon */}
                          <config.Icon size={20} color={config.color} aria-hidden="true" />

                          {/* Label */}
                          <span className="font-medium text-sm">{formatPoiTypeLabel(type)}</span>
                        </Button>
                      )}
                    </MenuItem>
                  );
                })}
              </MenuItems>
            </>
          )}
        </Menu>
      </div>

      {/* Mobile: Horizontal Bottom Bar */}
      <div className="absolute right-4 bottom-4 left-4 z-50 flex gap-2 overflow-x-auto md:hidden">
        {/* Compact Menu für alle POI-Typen auf Mobile */}
        <Menu as="div" className="relative w-full">
          {({ open }) => (
            <>
              <MenuButton
                className={`flex w-full items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 transition-all hover:shadow-md ${
                  open
                    ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/50'
                    : 'border-gray-300 bg-white hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500'
                }
                `}
                aria-label="POI platzieren"
              >
                <span className="font-medium text-base text-gray-900 dark:text-gray-100">{selectedType ? formatPoiTypeLabel(selectedType) : 'POI platzieren'}</span>
                <PiCaretDown className={`h-5 w-5 text-gray-600 transition-transform dark:text-gray-400 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
              </MenuButton>

              <MenuItems
                className="absolute right-0 bottom-full left-0 z-50 mb-2 max-h-64 origin-bottom overflow-y-auto rounded-lg border border-gray-300 bg-white py-1 shadow-lg transition focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                anchor="top start"
              >
                {/* Alle POI-Typen (häufig + erweitert) auf Mobile */}
                {[...frequentTypes, ...extendedTypes].map((type) => {
                  const config = POI_ICON_MAP[type];
                  const isActive = selectedType === type;

                  return (
                    <MenuItem key={type}>
                      {() => (
                        <Button
                          type="button"
                          onClick={() => onPoiTypeSelect(type)}
                          intent={isActive ? 'primary' : 'secondary'}
                          appearance="ghost"
                          size="lg"
                          className="w-full justify-start gap-3"
                          aria-label={`POI-Typ auswählen: ${type}`}
                          aria-pressed={isActive}
                        >
                          {/* Icon */}
                          <config.Icon size={24} color={config.color} aria-hidden="true" />

                          {/* Label */}
                          <span className="font-medium text-base">{formatPoiTypeLabel(type)}</span>
                        </Button>
                      )}
                    </MenuItem>
                  );
                })}
              </MenuItems>
            </>
          )}
        </Menu>
      </div>
    </>
  );
};

/**
 * Formatiert POI-Typ zu lesbarem Label
 *
 * @param type - POI-Typ
 * @returns Formatiertes Label (z.B. "EINSATZSTELLE" → "Einsatzstelle")
 */
const formatPoiTypeLabel = (type: PoiCategory): string => {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};
