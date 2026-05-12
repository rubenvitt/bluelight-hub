/**
 * `PersonCombobox` — Name-basierte Auswahl einer im jeweiligen Einsatz
 * registrierten Person (EinsatzPerson) im Eigenschutz-Kontext. Ersetzt
 * rohe ID-Eingaben in den Personal-Listen des `SicherungspostenDrawer`
 * und den Beteiligte-Reihen des `VorfallMeldenDrawer`. Wording und
 * Datenquelle sind 1:1 zur Rollenbesetzung (`EinsatzPersonenPicker` aus
 * `features/kraefte`).
 *
 * Intern wird die EinsatzPerson-CUID2 als `value` gespeichert — der
 * Anwender sucht und sieht „Vorname Nachname (Funkrufname)".
 *
 * Architektur: Thin-Adapter über den projektweiten {@link Combobox} aus
 * `shared/ui/headless` (Headless UI v2). Lookup über {@link usePersonSuche}
 * mit 250 ms Debounce. Keyboard-Navigation und ARIA-Combobox-Pattern
 * (Label, ListBox, `aria-activedescendant`, Live-Region für Fehler) sind
 * von der Headless-Komponente abgedeckt.
 *
 * Empty-State-Differenzierung:
 * - `rawCount === 0` → „Keine Personen registriert" (Hinweis auf
 *   fehlende EinsatzPerson-Registrierung statt „nichts gefunden").
 * - `rawCount > 0` & gefilterte Liste leer → Standard-Combobox-Meldung.
 */

import { useMemo } from 'react';
import { Combobox } from '@/shared/ui/headless/combobox';
import { usePersonSuche } from '../../hooks/use-person-suche';

export interface PersonComboboxProps {
  /** CUID2 des aktiven Einsatzes — Datenquelle der EinsatzPersonen. */
  readonly einsatzId: string | null | undefined;
  /** Aktuelle EinsatzPerson-ID (intern). */
  readonly value: string | null | undefined;
  /** Callback mit neuer EinsatzPerson-ID (oder leer-String beim Löschen). */
  readonly onChange: (einsatzPersonId: string) => void;
  readonly label?: string;
  readonly placeholder?: string;
  readonly helperText?: string;
  readonly error?: string;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly autoFocus?: boolean;
  readonly className?: string;
  readonly testId?: string;
}

const DEFAULT_LABEL = 'Person';
const DEFAULT_PLACEHOLDER = 'Person auswählen…';

export function PersonCombobox({
  einsatzId,
  value,
  onChange,
  label = DEFAULT_LABEL,
  placeholder = DEFAULT_PLACEHOLDER,
  helperText,
  error,
  disabled = false,
  required = false,
  autoFocus = false,
  className,
  testId,
}: PersonComboboxProps) {
  const { items, isLoading, isError, rawCount, setQuery } = usePersonSuche(einsatzId);

  const mutableItems = useMemo(() => [...items], [items]);

  const effectiveHelper = useMemo(() => {
    if (error) return undefined;
    if (isLoading) return 'Personen werden geladen…';
    if (isError) return 'Personen konnten nicht geladen werden.';
    if (rawCount === 0) return 'Keine Personen registriert.';
    return helperText;
  }, [error, isLoading, isError, rawCount, helperText]);

  return (
    <div data-testid={testId} data-person-combobox-loading={isLoading ? 'true' : undefined} data-person-combobox-error={isError ? 'true' : undefined}>
      <Combobox
        items={mutableItems}
        value={value ?? ''}
        onChange={(next) => onChange(next)}
        onInputChange={(input) => setQuery(input)}
        label={label && required ? `${label} *` : label}
        placeholder={placeholder}
        helperText={effectiveHelper}
        error={error}
        disabled={disabled || isLoading || !einsatzId}
        autoFocus={autoFocus}
        className={className}
        openOnFocus
      />
    </div>
  );
}
