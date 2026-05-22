import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';

const korrigiereApiSpy = vi.fn();

vi.mock('@/shared', () => ({
  api: { patienten: () => ({ patientenControllerKorrigiereVAlpha: korrigiereApiSpy }) },
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

const { useKorrigierePatient } = await import('../api/use-korrigiere-patient');
const { PATIENT_QUERY_KEYS } = await import('../api/queries');

function buildWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useKorrigierePatient (Story 1.4, FR42)', () => {
  beforeEach(() => korrigiereApiSpy.mockReset());

  it('ruft API mit feld/neuerWert/grund auf', async () => {
    korrigiereApiSpy.mockResolvedValue({
      data: {
        id: 'pat-1',
        einsatzId: 'einsatz-1',
        patientennummer: 'P-003',
        aktuelleSk: 'SK_II',
        behandlungsstatus: 'IN_BEHANDLUNG',
        transportstatus: 'WARTEND',
        erfasstAm: '2026-05-19T10:00:00.000Z',
        erfasserRef: { type: 'user', userId: 'user-1' },
        eventVersion: 4,
      },
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { result } = renderHook(() => useKorrigierePatient({ einsatzId: 'einsatz-1', patientId: 'pat-1' }), { wrapper: buildWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({ feld: 'behandlungsstatus', neuerWert: 'IN_BEHANDLUNG', grund: 'Falschmeldung Team C' });
    });

    expect(korrigiereApiSpy).toHaveBeenCalledWith({
      einsatzId: 'einsatz-1',
      patientId: 'pat-1',
      korrigierePatientDto: { feld: 'behandlungsstatus', neuerWert: 'IN_BEHANDLUNG', grund: 'Falschmeldung Team C' },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('Kein Optimistic-Update: Cache wird erst nach Server-Response durch invalidateQueries gepatcht', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const initial = {
      id: 'pat-1',
      einsatzId: 'einsatz-1',
      patientennummer: 'P-003',
      aktuelleSk: 'SK_III',
      behandlungsstatus: 'VERSORGT',
      transportstatus: 'WARTEND',
      erfasstAm: '2026-05-19T10:00:00.000Z',
      erfasserRef: { type: 'user', userId: 'user-1' },
      eventVersion: 4,
    };
    queryClient.setQueryData(PATIENT_QUERY_KEYS.detail('einsatz-1', 'pat-1'), initial);
    // setQueryData-Spy: prüft, dass der Hook während onMutate NICHT die Detail-Daten patcht (kein Optimistic).
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    korrigiereApiSpy.mockResolvedValue({ data: { ...initial, behandlungsstatus: 'IN_BEHANDLUNG', eventVersion: 5 } });

    const { result } = renderHook(() => useKorrigierePatient({ einsatzId: 'einsatz-1', patientId: 'pat-1' }), { wrapper: buildWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync({ feld: 'behandlungsstatus', neuerWert: 'IN_BEHANDLUNG', grund: 'Falschmeldung' });
    });

    // Bewusst kein optimistic update: setQueryData wurde während onMutate nicht aufgerufen
    // (nur die initiale setQueryData aus dem Test selbst zählt)
    const optimisticCalls = setQueryDataSpy.mock.calls.filter((call) => {
      const key = call[0] as readonly unknown[];
      return Array.isArray(key) && key.includes('detail');
    });
    expect(optimisticCalls).toHaveLength(0);
  });

  it('Story 1.4 Code-Review Feature 2: `bestaetigeTotKorrektur=true` wird an Backend durchgereicht', async () => {
    korrigiereApiSpy.mockResolvedValue({
      data: {
        id: 'pat-1',
        einsatzId: 'einsatz-1',
        patientennummer: 'P-003',
        aktuelleSk: 'TOT',
        behandlungsstatus: 'VERSORGT',
        transportstatus: 'WARTEND',
        erfasstAm: '2026-05-19T10:00:00.000Z',
        erfasserRef: { type: 'user', userId: 'user-1' },
        eventVersion: 5,
      },
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { result } = renderHook(() => useKorrigierePatient({ einsatzId: 'einsatz-1', patientId: 'pat-1' }), { wrapper: buildWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({ feld: 'sichtung', neuerWert: 'TOT', grund: 'Patient verstorben', bestaetigeTotKorrektur: true });
    });

    expect(korrigiereApiSpy).toHaveBeenCalledWith({
      einsatzId: 'einsatz-1',
      patientId: 'pat-1',
      korrigierePatientDto: {
        feld: 'sichtung',
        neuerWert: 'TOT',
        grund: 'Patient verstorben',
        bestaetigeTotKorrektur: true,
      },
    });
  });

  it('Story 1.4 Code-Review Feature 2: ohne Flag wird `bestaetigeTotKorrektur` **nicht** ans Backend gesendet (Default-Safe)', async () => {
    korrigiereApiSpy.mockResolvedValue({
      data: {
        id: 'pat-1',
        einsatzId: 'einsatz-1',
        patientennummer: 'P-003',
        aktuelleSk: 'SK_II',
        behandlungsstatus: 'VERSORGT',
        transportstatus: 'WARTEND',
        erfasstAm: '2026-05-19T10:00:00.000Z',
        erfasserRef: { type: 'user', userId: 'user-1' },
        eventVersion: 5,
      },
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const { result } = renderHook(() => useKorrigierePatient({ einsatzId: 'einsatz-1', patientId: 'pat-1' }), { wrapper: buildWrapper(queryClient) });

    await act(async () => {
      await result.current.mutateAsync({ feld: 'sichtung', neuerWert: 'SK_II', grund: 'Falschmeldung' });
    });

    const dtoArg = korrigiereApiSpy.mock.calls[0][0].korrigierePatientDto;
    expect(dtoArg).not.toHaveProperty('bestaetigeTotKorrektur');
  });

  it('Invalidiert detail/list/kpis nach Settled', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    korrigiereApiSpy.mockResolvedValue({
      data: {
        id: 'pat-1',
        einsatzId: 'einsatz-1',
        patientennummer: 'P-003',
        aktuelleSk: 'SK_II',
        behandlungsstatus: 'IN_BEHANDLUNG',
        transportstatus: 'WARTEND',
        erfasstAm: '2026-05-19T10:00:00.000Z',
        erfasserRef: { type: 'user', userId: 'user-1' },
        eventVersion: 5,
      },
    });

    const { result } = renderHook(() => useKorrigierePatient({ einsatzId: 'einsatz-1', patientId: 'pat-1' }), { wrapper: buildWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync({ feld: 'sichtung', neuerWert: 'SK_II', grund: 'Korrektur' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const calls = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(calls.some((c) => c.includes('detail'))).toBe(true);
    expect(calls.some((c) => c.includes('list'))).toBe(true);
    expect(calls.some((c) => c.includes('kpis'))).toBe(true);
  });
});
