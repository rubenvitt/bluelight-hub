/**
 * EinheitMultiCombobox - Multi-Select-Combobox für taktische Einheiten.
 *
 * Ergänzt die `EinheitCombobox` um die Mehrfach-Auswahl mit Chips,
 * client-seitiger Filterung und vollständiger Tastatur-Navigation.
 * Strukturell orientiert sich die Komponente an `EmpfaengerCombobox`
 * (Chips + Headless UI Combobox), nutzt jedoch die lokale Einheiten-Liste
 * via `useEinsatzEinheiten` ohne Backend-Suche.
 *
 * @module features/kraefte/ui/molecules
 */

import { cn } from '@/shared/ui/cn';
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import { useMemo, useRef, useState } from 'react';
import { PiX } from 'react-icons/pi';

import { useEinsatzEinheiten } from '../../api';
import { EinheitTypBadge } from './EinheitTypBadge';

export interface EinheitMultiComboboxProps {
  /** CUID2 des Einsatzes */
  einsatzId: string;
  /** Aktuell ausgewählte Einheit-IDs */
  values: string[];
  /** Callback bei Änderung der Auswahl */
  onChange: (einheitIds: string[]) => void;
  /** Callback bei Blur */
  onBlur?: () => void;
  /** Deaktiviert die Combobox */
  disabled?: boolean;
  /** Fehler-Nachricht */
  error?: string;
  /** Label über dem Input. Default: "Einheiten". */
  label?: string;
  /** Placeholder im Input */
  placeholder?: string;
  /** data-testid für den Container */
  testId?: string;
}

interface EinheitOption {
  id: string;
  name: string;
  typ: string;
}

/**
 * Multi-Select-Combobox für taktische Einsatz-Einheiten.
 *
 * Zeigt ausgewählte Einheiten als entfernbare Chips über dem Eingabefeld
 * und lässt weitere Einheiten via Such-Filter hinzufügen.
 * Backspace im leeren Eingabefeld entfernt den letzten Chip.
 */
export function EinheitMultiCombobox({ einsatzId, values, onChange, onBlur, disabled, error, label = 'Einheiten', placeholder = 'Einheit suchen…', testId }: EinheitMultiComboboxProps) {
  const { data: einheiten, isLoading, isError } = useEinsatzEinheiten(einsatzId);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const optionsById = useMemo(() => {
    const map = new Map<string, EinheitOption>();
    for (const e of einheiten ?? []) {
      map.set(e.id, { id: e.id, name: e.name, typ: e.typ });
    }
    return map;
  }, [einheiten]);

  const selectedOptions: EinheitOption[] = useMemo(() => values.map((id) => optionsById.get(id)).filter((e): e is EinheitOption => Boolean(e)), [values, optionsById]);

  const filteredAvailable: EinheitOption[] = useMemo(() => {
    const selectedSet = new Set(values);
    const q = query.trim().toLowerCase();
    return Array.from(optionsById.values())
      .filter((e) => !selectedSet.has(e.id))
      .filter((e) => (q === '' ? true : e.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }, [optionsById, values, query]);

  const handleAdd = (option: EinheitOption | null) => {
    // Defensiver Guard: Headless UI v2's Combobox kann onChange unter bestimmten
    // Transitions (Blur ohne Selection, Reset) mit einem unvollständigen Wert
    // aufrufen. Wir akzeptieren nur Optionen mit einer plausiblen CUID, damit
    // kein `undefined` in den Form-State landet (sonst schlägt das Submit-
    // Schema mit „expected string, received undefined" fehl).
    if (!option || typeof option.id !== 'string' || option.id.length === 0) return;
    if (!values.includes(option.id)) {
      onChange([...values, option.id]);
    }
    setQuery('');
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    inputRef.current?.focus();
  };

  const handleRemove = (id: string) => {
    onChange(values.filter((v) => v !== id));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && query === '' && values.length > 0) {
      handleRemove(values[values.length - 1]);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-1" data-testid={testId}>
        {label && <div className="h-5 w-24 animate-pulse rounded bg-surface-raised" />}
        <div className="h-10 animate-pulse rounded-control bg-surface-raised" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-1" data-testid={testId}>
        {label && <span className="block text-sm font-medium text-text-secondary">{label}</span>}
        <div role="alert" aria-live="assertive" className="rounded-panel border border-status-danger-border bg-status-danger-surface px-3 py-2 text-sm text-status-danger-text">
          Einheiten konnten nicht geladen werden — bitte erneut versuchen.
        </div>
      </div>
    );
  }

  if (einheiten && einheiten.length === 0) {
    return (
      <div className="space-y-1" data-testid={testId}>
        {label && <span className="block text-sm font-medium text-text-secondary">{label}</span>}
        <output className="block rounded-panel border border-status-warning-border bg-status-warning-surface px-3 py-2 text-sm text-status-warning-text">Dieser Einsatz hat keine Einheiten.</output>
      </div>
    );
  }

  return (
    <div className="w-full" data-testid={testId}>
      {label && <span className="mb-1 block text-sm font-medium text-text-secondary">{label}</span>}

      {selectedOptions.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Ausgewählte Einheiten">
          {selectedOptions.map((option) => (
            <span key={option.id} className="inline-flex items-center gap-1.5 rounded-full bg-status-info-surface px-2.5 py-0.5 text-sm font-medium text-status-info-text">
              <span>{option.name}</span>
              <EinheitTypBadge typ={option.typ} className="bg-surface-panel" />
              <button
                type="button"
                onClick={() => handleRemove(option.id)}
                disabled={disabled}
                className="ml-0.5 inline-flex items-center rounded-full p-0.5 text-status-info-text hover:bg-status-info-surface hover:text-action-primary disabled:opacity-50"
                aria-label={`${option.name} entfernen`}
              >
                <PiX className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Combobox value={null} onChange={handleAdd} disabled={disabled} immediate>
        <div className="relative">
          <ComboboxInput
            ref={inputRef}
            aria-label={label}
            aria-invalid={!!error}
            className={cn(
              'block w-full rounded-control border bg-surface-panel px-3 py-1.5 text-sm font-medium text-text-primary',
              'transition-all duration-200',
              'border-border-subtle hover:border-border-strong',
              'placeholder:text-text-muted',
              'focus:border-action-primary focus-visible:shadow-focus-ring focus-visible:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-status-danger-border focus:border-status-danger-text',
            )}
            autoCorrect="off"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            data-1p-ignore="true"
            data-lpignore="true"
            data-form-type="other"
            placeholder={selectedOptions.length === 0 ? placeholder : 'Weitere Einheit hinzufügen…'}
            displayValue={() => query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={onBlur}
            disabled={disabled}
          />

          <ComboboxOptions
            transition
            anchor={{ to: 'bottom start', gap: 4 }}
            className={cn(
              'z-50 w-[var(--input-width)] overflow-auto rounded-panel border border-border-subtle bg-surface-panel py-1 text-base shadow-panel',
              '[max-height:min(var(--anchor-max-height,15rem),24rem)]',
              'data-[closed]:pointer-events-none data-[closed]:hidden',
              'data-[leave]:transition data-[leave]:duration-100 data-[leave]:ease-in data-[closed]:data-[leave]:opacity-0',
              'sm:text-sm',
            )}
          >
            {filteredAvailable.length === 0 ? (
              <div className="px-3 py-2 text-sm text-text-muted">{query.length > 0 ? 'Keine Treffer gefunden' : 'Alle Einheiten sind bereits ausgewählt'}</div>
            ) : (
              filteredAvailable.map((option) => (
                <ComboboxOption
                  key={option.id}
                  value={option}
                  className={cn('group cursor-default px-3 py-2 text-text-primary select-none', 'data-[focus]:bg-action-secondary data-[focus]:text-text-primary data-[focus]:outline-none')}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span>{option.name}</span>
                    <EinheitTypBadge typ={option.typ} />
                  </span>
                </ComboboxOption>
              ))
            )}
          </ComboboxOptions>
        </div>
      </Combobox>

      {error && (
        <p aria-live="polite" className="mt-2 text-sm text-status-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}
