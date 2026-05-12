import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findAllMock = vi.fn();

vi.mock('@/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/shared');
  return {
    ...actual,
    api: {
      einsatzEinheiten: () => ({
        einsatzEinheitenControllerFindAllVAlpha: findAllMock,
      }),
    },
  };
});

import { useEinheitSuche } from '../use-einheit-suche';

const makeClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

const wrapper =
  (client: QueryClient) =>
  ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

const EINHEITEN = [
  { id: 'einheit-a', name: 'Sani-Trupp 1' },
  { id: 'einheit-b', name: 'Charlie-21' },
  { id: 'einheit-c', name: 'Sani-Trupp 2' },
];

describe('useEinheitSuche (G7)', () => {
  beforeEach(() => {
    findAllMock.mockReset();
    findAllMock.mockResolvedValue({ data: EINHEITEN });
  });

  it('projiziert Einheiten auf ComboboxItems mit value=id und label=name', async () => {
    const { result } = renderHook(() => useEinheitSuche('einsatz-1', { debounceMs: 0 }), { wrapper: wrapper(makeClient()) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items).toHaveLength(3);
    expect(result.current.items[0]).toEqual({ value: 'einheit-a', label: 'Sani-Trupp 1' });
    expect(result.current.rawCount).toBe(3);
  });

  it('filtert client-side nach Sub-String im Namen (case-insensitive)', async () => {
    const { result } = renderHook(() => useEinheitSuche('einsatz-1', { debounceMs: 0 }), { wrapper: wrapper(makeClient()) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setQuery('sani'));
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.items.map((i) => i.label)).toEqual(['Sani-Trupp 1', 'Sani-Trupp 2']);
  });

  it('liefert leeres Items-Array bei deaktiviertem Query (kein einsatzId)', async () => {
    const { result } = renderHook(() => useEinheitSuche(undefined, { debounceMs: 0 }), { wrapper: wrapper(makeClient()) });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.rawCount).toBe(0);
  });

  it('debounct die Eingabe — Filter wirkt erst nach der konfigurierten Verzögerung', async () => {
    const { result } = renderHook(() => useEinheitSuche('einsatz-1', { debounceMs: 80 }), { wrapper: wrapper(makeClient()) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setQuery('charlie'));
    // Direkt nach setQuery ist die Filterung noch nicht angewandt (Debounce läuft).
    expect(result.current.items).toHaveLength(3);

    // Nach Ablauf des Debounce: gefiltert.
    await waitFor(() => expect(result.current.items).toHaveLength(1), { timeout: 1000 });
    expect(result.current.items[0]?.label).toBe('Charlie-21');
  });
});
