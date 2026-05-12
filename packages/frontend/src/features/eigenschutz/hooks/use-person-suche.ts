/**
 * `usePersonSuche` — Lookup-Hook für die Personen/User-Combobox im
 * Eigenschutz (Personal-Listen in `SicherungspostenDrawer` und Beteiligte
 * im `VorfallMeldenDrawer`).
 *
 * Wrappt {@link useUsers} (alle Benutzer der Organisation, `UserBasicDto`-
 * Liste) und projiziert auf `ComboboxItem` (`value=user.id`,
 * `label=user.username`). Wie {@link useEinheitSuche} läuft der Filter
 * client-side mit 250 ms Debounce über den gemeinsamen
 * {@link useComboboxFilter} — Server-side-Search ist als Folge-Story
 * dokumentiert (PR-Body).
 */

import { useMemo } from 'react';
import { useUsers } from '@/features/auth/api';
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

export function usePersonSuche(options?: UsePersonSucheOptions): UsePersonSucheResult {
  const usersQuery = useUsers();

  const allItems = useMemo<ReadonlyArray<ComboboxItem>>(() => {
    const data = usersQuery.data ?? [];
    return data.map((user) => ({ value: user.id, label: user.username }));
  }, [usersQuery.data]);

  const { items, setQuery } = useComboboxFilter(allItems, options);

  return {
    items,
    isLoading: usersQuery.isLoading,
    isError: usersQuery.isError,
    rawCount: allItems.length,
    setQuery,
  };
}
