/**
 * `PersonCombobox` — Name-basierte Auswahl einer Person im
 * Eigenschutz-Kontext. Ersetzt rohe User-CUID-Eingaben in den Personal-
 * Listen des `SicherungspostenDrawer` und den Beteiligte-Reihen des
 * `VorfallMeldenDrawer`. Wording orientiert sich am `BesetzeRolleDialog`
 * („Person auswählen…").
 *
 * Intern wird weiter die User-CUID2 als `value` gespeichert — der Anwender
 * sucht und sieht ausschließlich den Personennamen.
 *
 * Architektur: Thin-Adapter über den projektweiten {@link Combobox} aus
 * `shared/ui/headless` (Headless UI v2). Lookup über {@link usePersonSuche}
 * mit 250 ms Debounce. Keyboard-Navigation und ARIA-Combobox-Pattern
 * (Label, ListBox, `aria-activedescendant`, Live-Region für Fehler) sind
 * von der Headless-Komponente abgedeckt.
 *
 * Empty-State-Differenzierung:
 * - `rawCount === 0` → „Keine Personen verfügbar" (Berechtigung/Setup-
 *   Hinweis statt „nichts gefunden").
 * - `rawCount > 0` & gefilterte Liste leer → Standard-Combobox-Meldung.
 */

import { useMemo } from 'react';
import { Combobox } from '@/shared/ui/headless/combobox';
import { usePersonSuche } from '../../hooks/use-person-suche';

export interface PersonComboboxProps {
  /** Aktuelle User-ID (intern). */
  readonly value: string | null | undefined;
  /** Callback mit neuer User-ID (oder leer-String beim Löschen). */
  readonly onChange: (userId: string) => void;
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
  const { items, isLoading, isError, rawCount, setQuery } = usePersonSuche();

  const mutableItems = useMemo(() => [...items], [items]);

  const effectiveHelper = useMemo(() => {
    if (error) return undefined;
    if (isLoading) return 'Personen werden geladen…';
    if (isError) return 'Personen konnten nicht geladen werden.';
    if (rawCount === 0) return 'Keine Personen verfügbar.';
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
        disabled={disabled || isLoading}
        autoFocus={autoFocus}
        className={className}
        openOnFocus
      />
    </div>
  );
}
