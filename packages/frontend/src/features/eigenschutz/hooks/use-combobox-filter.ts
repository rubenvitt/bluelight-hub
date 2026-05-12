/**
 * `useComboboxFilter` — gemeinsamer Filter-Kern für die Combobox-Lookups
 * im Eigenschutz (`useEinheitSuche`, `usePersonSuche`).
 *
 * Erwartet eine bereits geladene `ComboboxItem`-Liste und stellt einen
 * debounced Such-Filter bereit (Default 250 ms gemäß A11y-Audit-Vorgabe).
 * Filterung läuft client-side über `label.toLowerCase().includes(query)` —
 * das Backend liefert aktuell keinen Server-side-Search.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComboboxItem } from '@/shared/ui/headless/combobox';

const DEFAULT_DEBOUNCE_MS = 250;

export interface UseComboboxFilterOptions {
  /** Override des Debounce-Intervalls (Default 250 ms). Nur für Tests. */
  readonly debounceMs?: number;
}

export interface UseComboboxFilterResult {
  readonly items: ReadonlyArray<ComboboxItem>;
  readonly setQuery: (query: string) => void;
}

export function useComboboxFilter(allItems: ReadonlyArray<ComboboxItem>, options?: UseComboboxFilterOptions): UseComboboxFilterResult {
  const { debounceMs = DEFAULT_DEBOUNCE_MS } = options ?? {};
  const [rawQuery, setRawQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setDebouncedQuery(rawQuery.trim().toLowerCase());
    }, debounceMs);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [rawQuery, debounceMs]);

  const items = useMemo<ReadonlyArray<ComboboxItem>>(() => {
    if (debouncedQuery.length === 0) return allItems;
    return allItems.filter((item) => item.label.toLowerCase().includes(debouncedQuery));
  }, [allItems, debouncedQuery]);

  return { items, setQuery: setRawQuery };
}
