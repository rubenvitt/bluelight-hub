/**
 * TeamFilterDropdown Komponente fuer Team-Erinnerungen Filterung
 *
 * Dropdown zur Filterung der Team-Erinnerungsliste nach Zuweisung.
 * Nutzt Headless UI Listbox fuer accessibility-konforme Implementierung.
 *
 * **Story 3.6 Task 2:**
 * - AC1: Filter-Dropdown mit allen Optionen
 * - AC2: Visuelles Feedback bei aktivem Filter
 * - AC5: Filter-Reset auf "Alle"
 */

import { cn } from '@/shared/ui/cn';
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { useCallback, useMemo } from 'react';
import { PiCaretDown, PiCheck, PiFunnel, PiUser, PiUsers } from 'react-icons/pi';
import { createTeamFilter, teamFilterToValue, type TeamFilterType, type Teilnehmer } from '../../stores';

export interface TeamFilterDropdownProps {
  /** Aktuell ausgewaehlter Filter */
  selectedFilter: TeamFilterType;
  /** Callback bei Filter-Aenderung */
  onFilterChange: (filter: TeamFilterType) => void;
  /** Liste der verfuegbaren Einsatz-Teilnehmer */
  teilnehmer: Teilnehmer[];
  /** ID des aktuellen Benutzers (fuer "Meine" Filter) */
  currentUserId: string;
  /** Deaktiviert das Dropdown */
  disabled?: boolean;
  /** Zusaetzliche CSS-Klassen */
  className?: string;
}

/** Basis-Filter-Optionen (immer sichtbar) */
interface FilterOption {
  /** String-Wert fuer Listbox (intern) */
  value: string;
  /** Anzeige-Label */
  label: string;
  /** Optional: Icon-Element */
  icon?: React.ReactNode;
}

const BASE_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'Alle', icon: <PiUsers className="h-4 w-4" /> },
  { value: 'mine', label: 'Meine', icon: <PiUser className="h-4 w-4" /> },
  { value: 'unassigned', label: 'Unzugewiesen', icon: <PiFunnel className="h-4 w-4" /> },
];

/**
 * TeamFilterDropdown - Dropdown zur Filterung von Team-Erinnerungen
 *
 * Zeigt Basis-Optionen (Alle, Meine, Unzugewiesen) und dynamisch geladene
 * Einsatz-Teilnehmer zur Filterung nach spezifischen Personen.
 */
export function TeamFilterDropdown({ selectedFilter, onFilterChange, teilnehmer, currentUserId, disabled = false, className }: TeamFilterDropdownProps) {
  /** Konvertiert TeamFilterType zu String fuer Listbox */
  const selectedValue = useMemo(() => teamFilterToValue(selectedFilter), [selectedFilter]);

  /** Ermittelt das Label fuer den aktuellen Filter */
  const currentLabel = useMemo(() => {
    // Basis-Optionen pruefen
    const baseOption = BASE_OPTIONS.find((opt) => opt.value === selectedValue);
    if (baseOption) return baseOption.label;

    // Teilnehmer-Name suchen (fuer user-Filter)
    if (selectedFilter.type === 'user') {
      const teilnehmerMatch = teilnehmer.find((t) => t.id === selectedFilter.userId);
      if (teilnehmerMatch) return teilnehmerMatch.name;
    }

    // Fallback fuer unbekannte Filter
    return 'Filter';
  }, [selectedFilter, selectedValue, teilnehmer]);

  /** Teilnehmer-Optionen fuer das Dropdown */
  const teilnehmerOptions: FilterOption[] = useMemo(
    () =>
      teilnehmer
        .filter((t) => t.id !== currentUserId) // Eigenen User ausschliessen (ist bereits in "Meine")
        .map((t) => ({
          value: t.id,
          label: t.name,
          icon: <PiUser className="h-4 w-4" />,
        })),
    [teilnehmer, currentUserId],
  );

  /** Alle Optionen kombiniert */
  const _allOptions = useMemo(() => [...BASE_OPTIONS, ...teilnehmerOptions], [teilnehmerOptions]);

  /** Ist ein aktiver Filter gesetzt (nicht "Alle")? */
  const isFilterActive = selectedFilter.type !== 'all';

  /** Handler der String-Wert zu TeamFilterType konvertiert */
  const handleChange = useCallback(
    (value: string) => {
      onFilterChange(createTeamFilter(value));
    },
    [onFilterChange],
  );

  return (
    <Listbox value={selectedValue} onChange={handleChange} disabled={disabled}>
      <div className={cn('relative', className)}>
        <ListboxButton
          className={cn(
            'relative flex w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            // Aktiver Filter: Primary-Farben
            isFilterActive
              ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-600 dark:bg-primary-900/30 dark:text-primary-300'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
          )}
        >
          <PiFunnel className={cn('h-4 w-4 flex-shrink-0', isFilterActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400')} aria-hidden="true" />
          <span className="block truncate font-medium">{currentLabel}</span>
          <PiCaretDown className={cn('ml-auto h-4 w-4 flex-shrink-0', isFilterActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400')} aria-hidden="true" />
        </ListboxButton>

        <ListboxOptions
          transition
          className={cn(
            'absolute z-20 mt-1 max-h-60 w-full min-w-[180px] overflow-auto rounded-lg bg-white py-1 text-sm shadow-lg',
            'border border-gray-200',
            'ring-1 ring-black ring-opacity-5 focus:outline-none',
            'data-[closed]:data-[leave]:opacity-0 data-[leave]:transition data-[leave]:duration-100 data-[leave]:ease-in',
            'dark:border-gray-700 dark:bg-gray-800',
          )}
        >
          {/* Basis-Optionen */}
          {BASE_OPTIONS.map((option) => (
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

          {/* Divider wenn Teilnehmer vorhanden */}
          {teilnehmerOptions.length > 0 && <div className="my-1 border-gray-200 border-t dark:border-gray-700" />}

          {/* Teilnehmer-Optionen */}
          {teilnehmerOptions.map((option) => (
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
