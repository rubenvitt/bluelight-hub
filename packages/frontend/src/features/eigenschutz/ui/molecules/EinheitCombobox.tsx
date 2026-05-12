/**
 * `EinheitCombobox` — Name-basierte Auswahl einer taktischen Einheit (Trupp,
 * Staffel, Gruppe, Zug, Abschnitt) im Eigenschutz-Kontext.
 *
 * Ersetzt rohe Einheit-ID-Eingaben in Drawern/Dialogen. Intern wird weiter
 * die CUID2 als `value` gespeichert — der User sieht und sucht nur den
 * Einheit-Namen (z. B. „Sani-Trupp 1", „Charlie-21").
 *
 * Architektur: Thin-Adapter über den projektweiten {@link Combobox} aus
 * `shared/ui/headless` (Headless UI v2). Lookup läuft über
 * {@link useEinheitSuche} mit 250 ms Debounce. Tastatur-Navigation
 * (Pfeil↑/↓, Enter, Escape), ARIA-Combobox-Pattern (Label, ListBox,
 * `aria-activedescendant`, Live-Region für Fehler) liefert die Headless-
 * Komponente.
 *
 * Empty-State-Differenzierung:
 * - `rawCount === 0` → „Keine Einheiten in diesem Einsatz" (Konfigurations-
 *   Hinweis, nicht „nichts gefunden").
 * - `rawCount > 0` & gefilterte Liste leer → Standard-Combobox-Meldung
 *   „Keine Ergebnisse gefunden".
 */

import { useMemo } from 'react';
import { Combobox } from '@/shared/ui/headless/combobox';
import { useEinheitSuche } from '../../hooks/use-einheit-suche';

export interface EinheitComboboxProps {
  readonly einsatzId: string | undefined;
  /** Aktuelle Einheit-ID (intern). */
  readonly value: string | null | undefined;
  /** Callback mit neuer Einheit-ID (oder leer-String beim Löschen). */
  readonly onChange: (einheitId: string) => void;
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

const DEFAULT_LABEL = 'Einheit';
const DEFAULT_PLACEHOLDER = 'Einheit suchen…';

export function EinheitCombobox({
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
}: EinheitComboboxProps) {
  const { items, isLoading, isError, rawCount, setQuery } = useEinheitSuche(einsatzId);

  /**
   * Combobox erwartet eine veränderbare Liste; wir kopieren das `ReadonlyArray`
   * in einen plain `Array` (Adapter-Pflicht). Das mutiert nichts — `items`
   * stammt aus dem Hook und bleibt unverändert.
   */
  const mutableItems = useMemo(() => [...items], [items]);

  const effectiveHelper = useMemo(() => {
    if (error) return undefined; // error hat Vorrang
    if (isLoading) return 'Einheiten werden geladen…';
    if (isError) return 'Einheiten konnten nicht geladen werden.';
    if (rawCount === 0) return 'Keine Einheiten in diesem Einsatz.';
    return helperText;
  }, [error, isLoading, isError, rawCount, helperText]);

  return (
    <div data-testid={testId} data-einheit-combobox-loading={isLoading ? 'true' : undefined} data-einheit-combobox-error={isError ? 'true' : undefined}>
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
