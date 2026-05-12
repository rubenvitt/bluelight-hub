/**
 * `useEinheitSuche` — Lookup-Hook für die Einheiten-Combobox im Eigenschutz.
 *
 * Wrappt {@link useEinsatzEinheiten} (alle Einheiten eines Einsatzes) und
 * projiziert die Liste auf `ComboboxItem`-Tupel (`value=id`, `label=name`).
 * Der lokale Such-Filter (250 ms Debounce) läuft client-side über den
 * gemeinsamen {@link useComboboxFilter} — Server-side-Search-Endpoint ist
 * als Folge-Story dokumentiert (PR-Body).
 *
 * @param einsatzId - Aktive Einsatz-ID. Wenn `undefined`, ist der Query
 *   deaktiviert (`useEinsatzEinheiten` enforced `enabled: !!einsatzId`).
 */

import { useMemo } from 'react';
import { useEinsatzEinheiten } from '@/features/kraefte/api/use-einsatz-einheiten';
import type { ComboboxItem } from '@/shared/ui/headless/combobox';
import { useComboboxFilter, type UseComboboxFilterOptions } from './use-combobox-filter';

export interface UseEinheitSucheResult {
  readonly items: ReadonlyArray<ComboboxItem>;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly rawCount: number;
  readonly setQuery: (query: string) => void;
}

export type UseEinheitSucheOptions = UseComboboxFilterOptions;

export function useEinheitSuche(einsatzId: string | undefined, options?: UseEinheitSucheOptions): UseEinheitSucheResult {
  const einheitenQuery = useEinsatzEinheiten(einsatzId);

  const allItems = useMemo<ReadonlyArray<ComboboxItem>>(() => {
    const data = einheitenQuery.data ?? [];
    return data.map((einheit) => ({ value: einheit.id, label: einheit.name }));
  }, [einheitenQuery.data]);

  const { items, setQuery } = useComboboxFilter(allItems, options);

  return {
    items,
    isLoading: einheitenQuery.isLoading,
    isError: einheitenQuery.isError,
    rawCount: allItems.length,
    setQuery,
  };
}
