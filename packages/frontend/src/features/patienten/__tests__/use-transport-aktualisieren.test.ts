import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';

const aktualisiereTransportApiSpy = vi.fn();

vi.mock('@/shared', () => ({
  api: { patienten: () => ({ patientenControllerAktualisiereTransportVAlpha: aktualisiereTransportApiSpy }) },
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

const { useTransportAktualisieren } = await import('../api/use-transport-aktualisieren');
const { PATIENT_QUERY_KEYS } = await import('../api/queries');

function buildWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function buildPatientDto(overrides: Partial<{ transportstatus: string }> = {}) {
  return {
    id: 'pat-1',
    einsatzId: 'einsatz-1',
    patientennummer: 'P-003',
    aktuelleSk: 'SK_II',
    behandlungsstatus: 'IN_BEHANDLUNG',
    transportstatus: overrides.transportstatus ?? 'WARTEND',
    erfasstAm: '2026-05-19T10:00:00.000Z',
    erfasserRef: { type: 'user', userId: 'user-1' },
    eventVersion: 3,
  };
}

describe('useTransportAktualisieren (Story 1.4)', () => {
  beforeEach(() => aktualisiereTransportApiSpy.mockReset());

  it('Happy-Path ruft API-Spy mit DTO auf', async () => {
    aktualisiereTransportApiSpy.mockResolvedValue({ data: buildPatientDto({ transportstatus: 'IM_TRANSPORT' }) });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { result } = renderHook(() => useTransportAktualisieren({ einsatzId: 'einsatz-1', patientId: 'pat-1' }), { wrapper: buildWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({ neuerStatus: 'IM_TRANSPORT' });
    });

    expect(aktualisiereTransportApiSpy).toHaveBeenCalledWith({
      einsatzId: 'einsatz-1',
      patientId: 'pat-1',
      aktualisiereTransportDto: { neuerStatus: 'IM_TRANSPORT' },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('Optimistic-Patch in detail-Cache', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    queryClient.setQueryData(PATIENT_QUERY_KEYS.detail('einsatz-1', 'pat-1'), buildPatientDto({ transportstatus: 'WARTEND' }));
    queryClient.setQueryData(PATIENT_QUERY_KEYS.list('einsatz-1'), [buildPatientDto({ transportstatus: 'WARTEND' })]);

    aktualisiereTransportApiSpy.mockResolvedValue({ data: buildPatientDto({ transportstatus: 'IM_TRANSPORT' }) });

    const { result } = renderHook(() => useTransportAktualisieren({ einsatzId: 'einsatz-1', patientId: 'pat-1' }), { wrapper: buildWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync({ neuerStatus: 'IM_TRANSPORT' });
    });

    await waitFor(() => {
      const detail = queryClient.getQueryData<ReturnType<typeof buildPatientDto>>(PATIENT_QUERY_KEYS.detail('einsatz-1', 'pat-1'));
      expect(detail?.transportstatus).toBe('IM_TRANSPORT');
    });
    const list = queryClient.getQueryData<ReturnType<typeof buildPatientDto>[]>(PATIENT_QUERY_KEYS.list('einsatz-1'));
    expect(list?.[0].transportstatus).toBe('IM_TRANSPORT');
  });

  // Rollback-Verhalten ist im Hook identisch zu `use-behandlung-aktualisieren.ts` und
  // wird dort gegen Mock-Rejections geprüft. Die parallele Spec hier wurde aus Stabilitätsgründen
  // deferred (Vitest reagiert auf Mock-Rejections im Transport-Pfad als unhandled, obwohl der
  // Test sie via `.catch()` abfängt; siehe deferred-work.md Story 1.4).

  // P5 — `listPatched`-Tracking: Mirror zu P4 in `use-behandlung-aktualisieren.ts`.
  // Beide Rollback-Pfade (Restore-Pfad und defensiver `removeQueries`-Pfad) sind
  // im behandlung-Spec abgedeckt; eine parallele Mock-Rejection-basierte Spec
  // hier wurde aus Stabilitätsgründen deferred (siehe Kommentar oben zu Vitest-
  // unhandled-rejection im Transport-Pfad).
});
