import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findAllEinsatzPersonenMock = vi.fn();

vi.mock('@/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/shared');
  return {
    ...actual,
    api: {
      einsatzPersonen: () => ({
        einsatzPersonenControllerFindAllVAlpha: findAllEinsatzPersonenMock,
      }),
    },
  };
});

import { usePersonSuche } from '../use-person-suche';

const makeClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

const wrapper =
  (client: QueryClient) =>
  ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

const TEST_EINSATZ_ID = 'cl9einsatz12345678901234';

const PERSONEN = [
  { id: 'person-1', vorname: 'Steffi', nachname: 'Müller', funkrufname: 'Florian Mitte 1' },
  { id: 'person-2', vorname: 'Hans', nachname: 'Maier', funkrufname: null },
  { id: 'person-3', vorname: 'Steffi', nachname: 'Schulz', funkrufname: null },
];

describe('usePersonSuche', () => {
  beforeEach(() => {
    findAllEinsatzPersonenMock.mockReset();
    findAllEinsatzPersonenMock.mockResolvedValue({ data: PERSONEN });
  });

  it('projiziert EinsatzPersonen auf ComboboxItems mit value=id und label="Vorname Nachname [(Funkrufname)]"', async () => {
    const { result } = renderHook(() => usePersonSuche(TEST_EINSATZ_ID, { debounceMs: 0 }), { wrapper: wrapper(makeClient()) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items).toHaveLength(3);
    // alphabetisch (de) sortiert: Hans Maier, Steffi Müller (Florian Mitte 1), Steffi Schulz
    expect(result.current.items.map((i) => i.label)).toEqual(['Hans Maier', 'Steffi Müller (Florian Mitte 1)', 'Steffi Schulz']);
    expect(result.current.rawCount).toBe(3);
  });

  it('filtert client-side nach Sub-String im Namen (case-insensitive)', async () => {
    const { result } = renderHook(() => usePersonSuche(TEST_EINSATZ_ID, { debounceMs: 0 }), { wrapper: wrapper(makeClient()) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setQuery('steffi'));
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.items.map((i) => i.label).sort()).toEqual(['Steffi Müller (Florian Mitte 1)', 'Steffi Schulz']);
  });

  it('liefert rawCount=0 wenn keine Personen registriert sind', async () => {
    findAllEinsatzPersonenMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => usePersonSuche(TEST_EINSATZ_ID, { debounceMs: 0 }), { wrapper: wrapper(makeClient()) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.rawCount).toBe(0);
    expect(result.current.items).toHaveLength(0);
  });
});
