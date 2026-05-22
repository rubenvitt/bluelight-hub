import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';

const kpisApiSpy = vi.fn();

vi.mock('@/shared', () => ({
  api: {
    patienten: () => ({
      patientenControllerKpisVAlpha: kpisApiSpy,
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

const { useKpiAggregat } = await import('../api/use-kpi-aggregat');
const { PATIENT_QUERY_KEYS } = await import('../api/queries');

function buildWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function buildKpiDto() {
  return {
    sk: { SK_I: 12, SK_II: 48, SK_III: 130, SK_IV: 55, TOT: 5 },
    behandlung: { UNVERSORGT: 60, IN_BEHANDLUNG: 80, VERSORGT: 70, TRANSPORTBEREIT: 40 },
    transport: { WARTEND: 200, IM_TRANSPORT: 30, IM_KRANKENHAUS: 20 },
    totalPatienten: 250,
    stand: '2026-05-20T14:23:01.234Z',
  };
}

describe('useKpiAggregat', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    kpisApiSpy.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, refetchOnWindowFocus: false },
      },
    });
  });

  it('lädt KPIs und nutzt PATIENT_QUERY_KEYS.kpis als Query-Key', async () => {
    kpisApiSpy.mockResolvedValueOnce({ data: buildKpiDto() });

    const { result } = renderHook(() => useKpiAggregat('einsatz-1'), { wrapper: buildWrapper(queryClient) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(buildKpiDto());
    expect(kpisApiSpy).toHaveBeenCalledWith({ einsatzId: 'einsatz-1' });

    const cached = queryClient.getQueryData(PATIENT_QUERY_KEYS.kpis('einsatz-1'));
    expect(cached).toEqual(buildKpiDto());
  });

  it('zeigt isLoading=true im initial render und switched dann auf success', async () => {
    kpisApiSpy.mockReturnValueOnce(new Promise(() => {})); // pending

    const { result } = renderHook(() => useKpiAggregat('einsatz-1'), { wrapper: buildWrapper(queryClient) });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('reicht API-Fehler als isError + error durch', async () => {
    kpisApiSpy.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useKpiAggregat('einsatz-1'), { wrapper: buildWrapper(queryClient) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('Query bleibt disabled bei leerer einsatzId', async () => {
    const { result } = renderHook(() => useKpiAggregat(''), { wrapper: buildWrapper(queryClient) });

    expect(result.current.fetchStatus).toBe('idle');
    expect(kpisApiSpy).not.toHaveBeenCalled();
  });
});
