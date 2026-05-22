import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';

const aktualisiereSichtungApiSpy = vi.fn();

vi.mock('@/shared', () => ({
  api: {
    patienten: () => ({
      patientenControllerAktualisiereSichtungVAlpha: aktualisiereSichtungApiSpy,
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

const { useSichtungAktualisieren } = await import('../api/use-sichtung-aktualisieren');
const { PATIENT_QUERY_KEYS } = await import('../api/queries');

function buildWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function buildPatientDto(overrides: Partial<{ id: string; aktuelleSk: string; eventVersion: number; einsatzId: string }> = {}) {
  return {
    id: overrides.id ?? 'pat-1',
    einsatzId: overrides.einsatzId ?? 'einsatz-1',
    patientennummer: 'P-003',
    aktuelleSk: overrides.aktuelleSk ?? 'SK_I',
    behandlungsstatus: 'UNVERSORGT',
    transportstatus: 'WARTEND',
    erfasstAm: '2026-05-19T10:00:00.000Z',
    erfasserRef: { type: 'user', userId: 'user-1' },
    eventVersion: overrides.eventVersion ?? 2,
  };
}

describe('useSichtungAktualisieren (Story 1.3 — Optimistic-UI + Rollback)', () => {
  beforeEach(() => {
    aktualisiereSichtungApiSpy.mockReset();
  });

  it('Happy-Path: ruft den generierten API-Spy mit DTO auf', async () => {
    aktualisiereSichtungApiSpy.mockResolvedValue({ data: buildPatientDto({ aktuelleSk: 'SK_I' }) });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { result } = renderHook(() => useSichtungAktualisieren({ einsatzId: 'einsatz-1', patientId: 'pat-1' }), { wrapper: buildWrapper(queryClient) });

    let mutationResult: Awaited<ReturnType<typeof result.current.mutateAsync>> | null = null;
    await act(async () => {
      mutationResult = await result.current.mutateAsync({ neueSk: 'SK_I', sichtungArt: 'aerztlich' });
    });

    expect(aktualisiereSichtungApiSpy).toHaveBeenCalledWith({
      einsatzId: 'einsatz-1',
      patientId: 'pat-1',
      aktualisiereSichtungDto: { neueSk: 'SK_I', sichtungArt: 'aerztlich', grund: undefined },
    });
    expect(mutationResult).not.toBeNull();
    expect(mutationResult!.aktuelleSk).toBe('SK_I');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('Optimistic-Patch: setzt aktuelleSk in detail- und list-Cache schon vor Server-Response', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    queryClient.setQueryData(PATIENT_QUERY_KEYS.detail('einsatz-1', 'pat-1'), buildPatientDto({ aktuelleSk: 'SK_III' }));
    queryClient.setQueryData(PATIENT_QUERY_KEYS.list('einsatz-1'), [buildPatientDto({ aktuelleSk: 'SK_III' })]);

    let resolveApi: ((value: { data: ReturnType<typeof buildPatientDto> }) => void) | null = null;
    aktualisiereSichtungApiSpy.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveApi = resolve;
        }),
    );

    const { result } = renderHook(() => useSichtungAktualisieren({ einsatzId: 'einsatz-1', patientId: 'pat-1' }), { wrapper: buildWrapper(queryClient) });

    act(() => {
      void result.current.mutate({ neueSk: 'SK_II', sichtungArt: 'aerztlich' });
    });

    await waitFor(() => {
      const detail = queryClient.getQueryData<ReturnType<typeof buildPatientDto>>(PATIENT_QUERY_KEYS.detail('einsatz-1', 'pat-1'));
      expect(detail?.aktuelleSk).toBe('SK_II');
    });
    const list = queryClient.getQueryData<ReturnType<typeof buildPatientDto>[]>(PATIENT_QUERY_KEYS.list('einsatz-1'));
    expect(list?.[0].aktuelleSk).toBe('SK_II');

    // Server antwortet, Cache wird via onSettled invalidiert
    resolveApi?.({ data: buildPatientDto({ aktuelleSk: 'SK_II' }) });
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('Rollback bei Server-Fehler: previousDetail wird wiederhergestellt', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const initialDetail = buildPatientDto({ aktuelleSk: 'SK_III' });
    queryClient.setQueryData(PATIENT_QUERY_KEYS.detail('einsatz-1', 'pat-1'), initialDetail);

    aktualisiereSichtungApiSpy.mockRejectedValue(new Error('BusinessRule:SichtungVonTotNichtErlaubt:TOT->SK_I'));

    const { result } = renderHook(() => useSichtungAktualisieren({ einsatzId: 'einsatz-1', patientId: 'pat-1' }), { wrapper: buildWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({ neueSk: 'SK_I', sichtungArt: 'aerztlich' }).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const detail = queryClient.getQueryData(PATIENT_QUERY_KEYS.detail('einsatz-1', 'pat-1'));
    expect(detail).toEqual(initialDetail);
  });
});
