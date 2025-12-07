import type { ColorMode } from '@/components/ui/color-mode';
import { useColorMode } from '@/hooks/use-color-mode';
import { cn } from '@/utils/cn';
import { Button } from '@atoms/button.atom';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { useEffect, useState } from 'react';
import { PiCaretDown, PiCheck, PiDesktop, PiMoon, PiSun } from 'react-icons/pi';

interface ColorModeOption {
  value: ColorMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

interface ColorModeMenuProps {
  /**
   * Vertikale Platzierung des Dropdown-Menüs
   * @default 'bottom'
   */
  placement?: 'top' | 'bottom';
  /**
   * Horizontale Ausrichtung des Dropdown-Menüs
   * @default 'right'
   */
  align?: 'left' | 'right';
}

const colorModeOptions: ColorModeOption[] = [
  {
    value: 'light',
    label: 'Hell',
    icon: PiSun,
    description: 'Helles Theme',
  },
  {
    value: 'dark',
    label: 'Dunkel',
    icon: PiMoon,
    description: 'Dunkles Theme',
  },
  {
    value: 'system',
    label: 'System',
    icon: PiDesktop,
    description: 'Systemeinstellung verwenden',
  },
];

/**
 * Color Mode Menu - Dropdown-Menü zur Auswahl des Farbmodus
 *
 * Bietet eine erweiterte UI zur Auswahl zwischen Hell-, Dunkel- und System-Modus
 * mit visueller Rückmeldung und Beschreibungen.
 *
 * @param placement - Bestimmt ob sich das Menü nach oben oder unten öffnet
 * @param align - Bestimmt die horizontale Ausrichtung des Menüs
 */
export function ColorModeMenu({ placement = 'bottom', align = 'right' }: ColorModeMenuProps) {
  const { colorMode, setColorMode, resolvedColorMode } = useColorMode();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-9 w-32 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />;
  }

  const currentOption = colorModeOptions.find((opt) => opt.value === colorMode) || colorModeOptions[2];
  const CurrentIcon = currentOption.icon;

  return (
    <Menu as="div" className="relative">
      <MenuButton
        className={cn(
          'inline-flex items-center gap-2 rounded-lg px-3 py-2',
          'border border-gray-200 bg-white text-gray-700',
          'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          'dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700',
          'transition-colors duration-200',
        )}
      >
        <CurrentIcon className="h-4 w-4" />
        <span className="font-medium text-sm">{currentOption.label}</span>
        <PiCaretDown className="h-3 w-3" />
      </MenuButton>

      <MenuItems
        className={cn(
          'absolute z-10 w-56 rounded-lg',
          'border border-gray-200 bg-white shadow-lg',
          'dark:border-gray-700 dark:bg-gray-800',
          'focus:outline-none',
          // Vertikale Platzierung
          placement === 'top' ? 'bottom-full mb-2' : 'mt-2',
          // Horizontale Ausrichtung und Transform-Origin
          align === 'left' ? `left-0 ${placement === 'top' ? 'origin-bottom-left' : 'origin-top-left'}` : `right-0 ${placement === 'top' ? 'origin-bottom-right' : 'origin-top-right'}`,
        )}
      >
        <div className="p-1">
          {colorModeOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = colorMode === option.value;
            const isSystemActive = option.value === 'system' && isSelected;

            return (
              <MenuItem key={option.value}>
                {({ focus }) => (
                  <Button
                    appearance="minimal"
                    onClick={() => setColorMode(option.value)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm',
                      'transition-colors duration-150',
                      focus && 'bg-gray-100 dark:bg-gray-700',
                      isSelected && 'text-blue-600 dark:text-blue-400',
                      !isSelected && 'text-gray-700 dark:text-gray-200',
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <div className="flex flex-1 flex-col items-start">
                      <span className="font-medium">{option.label}</span>
                      <span className={cn('text-xs', isSelected ? 'text-blue-600/70 dark:text-blue-400/70' : 'text-gray-500 dark:text-gray-400')}>
                        {option.description}
                        {isSystemActive && <span className="ml-1">({resolvedColorMode === 'dark' ? 'Dunkel' : 'Hell'})</span>}
                      </span>
                    </div>
                    {isSelected && <PiCheck className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />}
                  </Button>
                )}
              </MenuItem>
            );
          })}
        </div>
      </MenuItems>
    </Menu>
  );
}
