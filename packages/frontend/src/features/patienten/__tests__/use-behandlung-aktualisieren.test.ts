import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';

const aktualisiereBehandlungApiSpy = vi.fn();

vi.mock('@/shared', () => ({
  api: {
    patienten: () => ({
      patientenControllerAktualisiereBehandlungVAlpha: aktualisiereBehandlungApiSpy,
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

const { useBehandlungAktualisieren } = await import('../api/use-behandlung-aktualisieren');
const { PATIENT_QUERY_KEYS } = await import('../api/queries');

function buildWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function buildPatientDto(overrides: Partial<{ id: string; behandlungsstatus: string; eventVersion: number }> = {}) {
  return {
    id: overrides.id ?? 'pat-1',
    einsatzId: 'einsatz-1',
    patientennummer: 'P-003',
    aktuelleSk: 'SK_II',
    behandlungsstatus: overrides.behandlungsstatus ?? 'IN_BEHANDLUNG',
    transportstatus: 'WARTEND',
    erfasstAm: '2026-05-19T10:00:00.000Z',
    erfasserRef: { type: 'user', userId: 'user-1' },
    eventVersion: overrides.eventVersion ?? 2,
  };
}

describe('useBehandlungAktualisieren (Story 1.4 — Optimistic-UI + Rollback)', () => {
  beforeEach(() => {
    aktualisiereBehandlungApiSpy.mockReset();
  });

  it('Happy-Path: ruft API-Spy mit korrektem DTO auf', async () => {
    aktualisiereBehandlungApiSpy.mockResolvedValue({ data: buildPatientDto({ behandlungsstatus: 'IN_BEHANDLUNG' }) });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { result } = renderHook(() => useBehandlungAktualisieren({ einsatzId: 'einsatz-1', patientId: 'pat-1' }), { wrapper: buildWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({ neuerStatus: 'IN_BEHANDLUNG' });
    });

    expect(aktualisiereBehandlungApiSpy).toHaveBeenCalledWith({
      einsatzId: 'einsatz-1',
      patientId: 'pat-1',
      aktualisiereBehandlungDto: { neuerStatus: 'IN_BEHANDLUNG' },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('Optimistic-Patch: setzt behandlungsstatus in detail-Cache vor Server-Response', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    queryClient.setQueryData(PATIENT_QUERY_KEYS.detail('einsatz-1', 'pat-1'), buildPatientDto({ behandlungsstatus: 'UNVERSORGT' }));

    let resolveApi: ((value: { data: ReturnType<typeof buildPatientDto> }) => void) | null = null;
    aktualisiereBehandlungApiSpy.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveApi = resolve;
        }),
    );

    const { result } = renderHook(() => useBehandlungAktualisieren({ einsatzId: 'einsatz-1', patientId: 'pat-1' }), { wrapper: buildWrapper(queryClient) });
    act(() => {
      void result.current.mutate({ neuerStatus: 'IN_BEHANDLUNG' });
    });

    await waitFor(() => {
      const detail = queryClient.getQueryData<ReturnType<typeof buildPatientDto>>(PATIENT_QUERY_KEYS.detail('einsatz-1', 'pat-1'));
      expect(detail?.behandlungsstatus).toBe('IN_BEHANDLUNG');
    });

    resolveApi?.({ data: buildPatientDto({ behandlungsstatus: 'IN_BEHANDLUNG' }) });
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('Rollback ohne previousList: ruft `removeQueries` NICHT für den List-Key auf (P4 — Restore-Pfad)', async () => {
    // P4 — Defensiv-Tracking via `listPatched`: aktuell schützt `if (previousList)`
    // den optimistischen List-Patch; daher bleibt `listPatched === false` wenn die
    // Liste vor dem Mutate nicht im Cache war → `removeQueries` darf nicht
    // ausgelöst werden.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const initialDetail = buildPatientDto({ behandlungsstatus: 'UNVERSORGT' });
    queryClient.setQueryData(PATIENT_QUERY_KEYS.detail('einsatz-1', 'pat-1'), initialDetail);
    // KEINE Liste im Cache.

    const removeSpy = vi.spyOn(queryClient, 'removeQueries');
    aktualisiereBehandlungApiSpy.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useBehandlungAktualisieren({ einsatzId: 'einsatz-1', patientId: 'pat-1' }), { wrapper: buildWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync({ neuerStatus: 'VERSORGT' }).catch(() => undefined);
    });

    const listKey = PATIENT_QUERY_KEYS.list('einsatz-1');
    const removedListKey = removeSpy.mock.calls.some(
      ([arg]) => Array.isArray((arg as { queryKey?: unknown[] } | undefined)?.queryKey) && JSON.stringify((arg as { queryKey: unknown[] }).queryKey) === JSON.stringify(listKey),
    );
    expect(removedListKey).toBe(false);

    // Der defensive Pfad (`previousList === undefined && listPatched === true`)
    // ist durch den `if (previousList)`-Guard im Hook aktuell unerreichbar; siehe
    // Kommentar im `onError`-Block. Eine explizite Coverage-Assertion wäre nur
    // möglich, wenn der Guard entfernt würde. Bewusst deferred, analog zum
    // bestehenden Deferred-Pattern in `use-transport-aktualisieren.test.ts`.
  });

  it('Rollback bei Server-Fehler', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const initialDetail = buildPatientDto({ behandlungsstatus: 'UNVERSORGT' });
    queryClient.setQueryData(PATIENT_QUERY_KEYS.detail('einsatz-1', 'pat-1'), initialDetail);

    aktualisiereBehandlungApiSpy.mockRejectedValue(new Error('BusinessRule:BehandlungUngueltigerUebergang'));

    const { result } = renderHook(() => useBehandlungAktualisieren({ einsatzId: 'einsatz-1', patientId: 'pat-1' }), { wrapper: buildWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync({ neuerStatus: 'VERSORGT' }).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(PATIENT_QUERY_KEYS.detail('einsatz-1', 'pat-1'))).toEqual(initialDetail);
  });
});
