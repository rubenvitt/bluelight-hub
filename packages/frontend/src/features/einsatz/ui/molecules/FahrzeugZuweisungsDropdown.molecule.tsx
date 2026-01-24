import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { PiTruck, PiCheck, PiCaretUpDown } from 'react-icons/pi';
import { FmsStatusBadge } from '../atoms/FmsStatusBadge.atom';
import { cn } from '@/shared/ui/cn';

interface FahrzeugZuweisungsDropdownProps {
  /** Aktuell zugewiesene Fahrzeug-ID (null = keine Zuweisung) */
  currentFahrzeugId?: string | null;
  /** Liste verfügbarer Fahrzeuge des Einsatzes */
  fahrzeuge: Array<{ id: string; funkrufname: string; fmsStatus: number }>;
  /** Callback bei Zuweisung (null = Zuweisung entfernen) */
  onAssign: (fahrzeugId: string | null) => void;
  /** Loading State während API-Call */
  isLoading?: boolean;
  /** Dropdown deaktivieren */
  disabled?: boolean;
  /** Zusätzliche CSS-Klassen */
  className?: string;
}

/**
 * Dropdown zur Zuweisung einer Person zu einem Fahrzeug.
 *
 * Zeigt alle Fahrzeuge des Einsatzes mit Funkrufname und FMS-Status.
 * Erste Option ermöglicht Entfernung der Zuweisung.
 *
 * @example
 * ```tsx
 * <FahrzeugZuweisungsDropdown
 *   currentFahrzeugId={person.fahrzeugId}
 *   fahrzeuge={einsatzFahrzeuge}
 *   onAssign={(id) => updatePersonFahrzeug({ personId: person.id, fahrzeugId: id })}
 * />
 * ```
 */
export function FahrzeugZuweisungsDropdown({ currentFahrzeugId, fahrzeuge, onAssign, isLoading = false, disabled = false, className = '' }: FahrzeugZuweisungsDropdownProps) {
  const currentFahrzeug = currentFahrzeugId ? fahrzeuge.find((f) => f.id === currentFahrzeugId) : null;

  const buttonLabel = isLoading ? '...' : currentFahrzeug ? currentFahrzeug.funkrufname : 'Zuweisen';

  const buttonClasses = cn(
    'relative w-full cursor-pointer rounded-lg py-2 pr-10 pl-3 text-left shadow-sm ring-1 ring-inset focus:outline-none focus:ring-2 focus:ring-primary-500 sm:text-sm',
    currentFahrzeug ? 'bg-blue-100 text-blue-800 ring-blue-200' : 'bg-gray-100 text-gray-600 ring-gray-300',
    (disabled || isLoading) && 'cursor-not-allowed opacity-50',
  );

  return (
    <Listbox value={currentFahrzeugId ?? null} onChange={onAssign} disabled={disabled || isLoading}>
      <div className={cn('relative', className)}>
        <ListboxButton className={buttonClasses} aria-label={`Fahrzeug: ${buttonLabel}`}>
          <span className="flex items-center gap-2 truncate font-medium">
            <PiTruck className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {buttonLabel}
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <PiCaretUpDown className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </span>
        </ListboxButton>

        <ListboxOptions
          transition
          className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 transition duration-100 ease-in focus:outline-none data-[closed]:opacity-0 sm:text-sm dark:bg-gray-800 dark:text-gray-100"
        >
          {/* Erste Option: Zuweisung entfernen */}
          <ListboxOption
            value={null}
            className={({ focus }) => cn('relative cursor-pointer select-none py-2 pr-4 pl-10', focus ? 'bg-gray-100 dark:bg-gray-700' : '', 'text-gray-600 dark:text-gray-400')}
          >
            {({ selected }) => (
              <>
                <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>Keine Zuweisung</span>
                {selected && (
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <PiCheck className="h-5 w-5" aria-hidden="true" />
                  </span>
                )}
              </>
            )}
          </ListboxOption>

          {/* Fahrzeug-Optionen */}
          {fahrzeuge.map((fahrzeug) => (
            <ListboxOption key={fahrzeug.id} value={fahrzeug.id} className={({ focus }) => cn('relative cursor-pointer select-none py-2 pr-4 pl-10', focus ? 'bg-blue-50 dark:bg-blue-900/20' : '')}>
              {({ selected }) => (
                <>
                  <span className={`flex items-center gap-2 truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                    <PiTruck className="h-4 w-4 flex-shrink-0 text-gray-500" aria-hidden="true" />
                    <span>{fahrzeug.funkrufname}</span>
                    <FmsStatusBadge status={fahrzeug.fmsStatus} />
                  </span>
                  {selected && (
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600 dark:text-blue-400">
                      <PiCheck className="h-5 w-5" aria-hidden="true" />
                    </span>
                  )}
                </>
              )}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
