import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findAllBasicMock = vi.fn();

vi.mock('@/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/shared');
  return {
    ...actual,
    api: {
      users: () => ({
        userControllerFindAllBasicVAlpha: findAllBasicMock,
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

const USERS = [
  { id: 'user-1', username: 'Steffi Müller' },
  { id: 'user-2', username: 'Hans Maier' },
  { id: 'user-3', username: 'Steffi Schulz' },
];

describe('usePersonSuche (G7)', () => {
  beforeEach(() => {
    findAllBasicMock.mockReset();
    findAllBasicMock.mockResolvedValue({ data: USERS });
  });

  it('projiziert Benutzer auf ComboboxItems mit value=id und label=username', async () => {
    const { result } = renderHook(() => usePersonSuche({ debounceMs: 0 }), { wrapper: wrapper(makeClient()) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items).toHaveLength(3);
    expect(result.current.items[0]).toEqual({ value: 'user-1', label: 'Steffi Müller' });
    expect(result.current.rawCount).toBe(3);
  });

  it('filtert client-side nach Sub-String im Namen (case-insensitive)', async () => {
    const { result } = renderHook(() => usePersonSuche({ debounceMs: 0 }), { wrapper: wrapper(makeClient()) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setQuery('steffi'));
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.items.map((i) => i.label).sort()).toEqual(['Steffi Müller', 'Steffi Schulz']);
  });

  it('liefert rawCount=0 wenn keine Benutzer geladen sind', async () => {
    findAllBasicMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => usePersonSuche({ debounceMs: 0 }), { wrapper: wrapper(makeClient()) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.rawCount).toBe(0);
    expect(result.current.items).toHaveLength(0);
  });
});
