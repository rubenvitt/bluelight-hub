/**
 * `usePersonSuche` — Lookup-Hook für die EinsatzPerson-Combobox im
 * Eigenschutz (Personal-Listen in `SicherungspostenDrawer` und Beteiligte
 * im `VorfallMeldenDrawer`).
 *
 * Wrappt {@link useEinsatzPersonen} (alle im jeweiligen Einsatz registrierten
 * Personen) und projiziert auf `ComboboxItem`
 * (`value = einsatzPerson.id`, `label = "Vorname Nachname [(Funkrufname)]"`).
 * Wording und Datenquelle sind 1:1 zur Rollenbesetzung
 * (`EinsatzPersonenPicker` / `BesetzeRolleDialog`).
 *
 * Wie {@link useEinheitSuche} läuft der Filter client-side mit 250 ms
 * Debounce über den gemeinsamen {@link useComboboxFilter} — Server-side-
 * Search ist als Folge-Story dokumentiert (PR-Body).
 */

import { useMemo } from 'react';
import { useEinsatzPersonen } from '@/features/einsatz/api';
import type { ComboboxItem } from '@/shared/ui/headless/combobox';
import { useComboboxFilter, type UseComboboxFilterOptions } from './use-combobox-filter';

export interface UsePersonSucheResult {
  readonly items: ReadonlyArray<ComboboxItem>;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly rawCount: number;
  readonly setQuery: (query: string) => void;
}

export type UsePersonSucheOptions = UseComboboxFilterOptions;

export function usePersonSuche(einsatzId: string | null | undefined, options?: UsePersonSucheOptions): UsePersonSucheResult {
  const personenQuery = useEinsatzPersonen(einsatzId ?? null);

  const allItems = useMemo<ReadonlyArray<ComboboxItem>>(() => {
    const data = personenQuery.data ?? [];
    return data
      .map((person) => ({
        value: person.id,
        label: person.funkrufname ? `${person.vorname} ${person.nachname} (${person.funkrufname})` : `${person.vorname} ${person.nachname}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'de'));
  }, [personenQuery.data]);

  const { items, setQuery } = useComboboxFilter(allItems, options);

  return {
    items,
    isLoading: personenQuery.isLoading,
    isError: personenQuery.isError,
    rawCount: allItems.length,
    setQuery,
  };
}
