import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';

const listApiSpy = vi.fn();

vi.mock('@/shared', () => ({
  api: {
    patienten: () => ({
      patientenControllerListVAlpha: listApiSpy,
    }),
  },
  ResponseError: class ResponseError extends Error {
    override name = 'ResponseError' as const;
    constructor(
      public response: Response,
      msg?: string,
    ) {
      super(msg);
    }
  },
}));

const { usePatientenList } = await import('../api/use-patienten-list');

function buildWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function buildListResponse(overrides: { items?: unknown[]; total?: number; page?: number; pageSize?: number } = {}) {
  const items =
    overrides.items ??
    Array.from({ length: 3 }, (_, i) => ({
      id: `pat_${i}`,
      patientennummer: `P-${String(i + 1).padStart(3, '0')}`,
      diviVakNummer: null,
      name: null,
      aktuelleSk: 'SK_II',
      behandlungsstatus: 'UNVERSORGT',
      transportstatus: 'WARTEND',
      erfasstAm: '2026-05-20T10:00:00.000Z',
      eventVersion: 1,
    }));
  return {
    data: items,
    pagination: {
      page: overrides.page ?? 1,
      pageSize: overrides.pageSize ?? 50,
      total: overrides.total ?? items.length,
      totalPages: Math.ceil((overrides.total ?? items.length) / (overrides.pageSize ?? 50)),
    },
  };
}

describe('usePatientenList (Story 1.6)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    listApiSpy.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, refetchOnWindowFocus: false },
      },
    });
  });

  it('lädt Patientenliste und übergibt einsatzId an den Client', async () => {
    listApiSpy.mockResolvedValueOnce(buildListResponse());

    const { result } = renderHook(() => usePatientenList('ein_1', {}), { wrapper: buildWrapper(queryClient) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items).toHaveLength(3);
    expect(result.current.data?.pagination.page).toBe(1);
    expect(listApiSpy).toHaveBeenCalledWith({
      einsatzId: 'ein_1',
      sk: undefined,
      behandlungsstatus: undefined,
      transportstatus: undefined,
      search: undefined,
      sortBy: undefined,
      sortDir: undefined,
      page: undefined,
      pageSize: undefined,
    });
  });

  it('serialisiert Multi-Select-Filter als CSV', async () => {
    listApiSpy.mockResolvedValueOnce(buildListResponse({ items: [] }));

    renderHook(
      () =>
        usePatientenList('ein_1', {
          sk: ['SK_I', 'SK_II'] as never,
          behandlungsstatus: ['TRANSPORTBEREIT'] as never,
          transportstatus: ['WARTEND'] as never,
          search: 'Mueller',
          sortBy: 'zeit',
          sortDir: 'desc',
          page: 2,
          pageSize: 25,
        }),
      { wrapper: buildWrapper(queryClient) },
    );

    await waitFor(() => expect(listApiSpy).toHaveBeenCalled());

    expect(listApiSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sk: 'SK_I,SK_II',
        behandlungsstatus: 'TRANSPORTBEREIT',
        transportstatus: 'WARTEND',
        search: 'Mueller',
        sortBy: 'zeit',
        sortDir: 'desc',
        page: 2,
        pageSize: 25,
      }),
    );
  });

  it('Query bleibt disabled bei leerer einsatzId', async () => {
    const { result } = renderHook(() => usePatientenList('  ', {}), { wrapper: buildWrapper(queryClient) });

    expect(result.current.fetchStatus).toBe('idle');
    expect(listApiSpy).not.toHaveBeenCalled();
  });

  it('reicht API-Fehler als isError durch', async () => {
    listApiSpy.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => usePatientenList('ein_1', {}), { wrapper: buildWrapper(queryClient) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('triggert Re-Fetch bei Filter-Wechsel (Query-Key enthält Filter)', async () => {
    listApiSpy.mockResolvedValue(buildListResponse());

    const { rerender, result } = renderHook(({ filters }: { filters: Parameters<typeof usePatientenList>[1] }) => usePatientenList('ein_1', filters), {
      wrapper: buildWrapper(queryClient),
      initialProps: { filters: { sk: ['SK_I'] as never } },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listApiSpy).toHaveBeenCalledTimes(1);

    rerender({ filters: { sk: ['SK_II'] as never } });

    await waitFor(() => expect(listApiSpy).toHaveBeenCalledTimes(2));
  });
});
