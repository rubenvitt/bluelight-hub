/**
 * TeamSortDropdown Komponente fuer Team-Erinnerungen Sortierung
 *
 * Dropdown zur Sortierung der Team-Erinnerungsliste.
 * Nutzt Headless UI Listbox fuer accessibility-konforme Implementierung.
 *
 * **Story 3.8:**
 * - Sortier-Optionen: Fälligkeit, Erstellt-Datum, Status
 * - Visuelles Feedback bei aktiver Sortierung
 */

import { cn } from '@/shared/ui/cn';
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { PiCaretDown, PiCheck, PiSortAscending, PiClock, PiCalendar, PiShieldCheck } from 'react-icons/pi';
import type { TeamSortType } from '../../stores';

export interface TeamSortDropdownProps {
  /** Aktuell ausgewaehlte Sortierung */
  selectedSort: TeamSortType;
  /** Callback bei Sortier-Aenderung */
  onSortChange: (sort: TeamSortType) => void;
  /** Deaktiviert das Dropdown */
  disabled?: boolean;
  /** Zusaetzliche CSS-Klassen */
  className?: string;
}

interface SortOption {
  value: TeamSortType;
  label: string;
  icon: React.ReactNode;
}

const SORT_OPTIONS: SortOption[] = [
  { value: 'faelligkeit', label: 'Fälligkeit', icon: <PiClock className="h-4 w-4" /> },
  { value: 'erstellt', label: 'Erstellt-Datum', icon: <PiCalendar className="h-4 w-4" /> },
  { value: 'status', label: 'Status', icon: <PiShieldCheck className="h-4 w-4" /> },
];

/**
 * TeamSortDropdown - Dropdown zur Sortierung von Team-Erinnerungen
 */
export function TeamSortDropdown({ selectedSort, onSortChange, disabled = false, className }: TeamSortDropdownProps) {
  const currentOption = SORT_OPTIONS.find((opt) => opt.value === selectedSort) || SORT_OPTIONS[0];

  return (
    <Listbox value={selectedSort} onChange={onSortChange} disabled={disabled}>
      <div className={cn('relative', className)}>
        <ListboxButton
          className={cn(
            'relative flex w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
          )}
        >
          <PiSortAscending className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden="true" />
          <span className="block truncate font-medium">{currentOption.label}</span>
          <PiCaretDown className="ml-auto h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden="true" />
        </ListboxButton>

        <ListboxOptions
          transition
          className={cn(
            'absolute z-20 mt-1 max-h-60 w-full min-w-[160px] overflow-auto rounded-lg bg-white py-1 text-sm shadow-lg',
            'border border-gray-200',
            'ring-1 ring-black ring-opacity-5 focus:outline-none',
            'data-[closed]:data-[leave]:opacity-0 data-[leave]:transition data-[leave]:duration-100 data-[leave]:ease-in',
            'dark:border-gray-700 dark:bg-gray-800',
          )}
        >
          {SORT_OPTIONS.map((option) => (
            <ListboxOption
              key={option.value}
              value={option.value}
              className={cn(
                'relative flex cursor-pointer select-none items-center gap-2 px-3 py-2',
                'text-gray-900 dark:text-gray-100',
                'data-[focus]:bg-primary-50 data-[focus]:text-primary-900',
                'dark:data-[focus]:bg-primary-900/30 dark:data-[focus]:text-primary-100',
              )}
            >
              {({ selected }) => (
                <>
                  {option.icon}
                  <span className={cn('block truncate', selected && 'font-semibold')}>{option.label}</span>
                  {selected && <PiCheck className="ml-auto h-4 w-4 text-primary-600 dark:text-primary-400" aria-hidden="true" />}
                </>
              )}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
