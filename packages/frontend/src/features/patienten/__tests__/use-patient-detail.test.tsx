import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';

const detailApiSpy = vi.fn();

vi.mock('@/shared', () => ({
  api: {
    patienten: () => ({
      patientenControllerDetailVAlpha: detailApiSpy,
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

const { usePatientDetail } = await import('../api/use-patient-detail');

function buildWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function buildDetailResponse() {
  return {
    data: {
      id: 'pat_01',
      einsatzId: 'ein_01',
      patientennummer: 'P-001',
      diviVakNummer: undefined,
      aktuelleSk: 'SK_II',
      behandlungsstatus: 'UNVERSORGT',
      transportstatus: 'WARTEND',
      erfasstAm: '2026-05-20T10:00:00.000Z',
      erfasserRef: { type: 'user', userId: 'usr-42' },
      eventVersion: 1,
      clockDriftSeconds: undefined,
      notiz: null,
      events: [
        {
          id: 'evt_01',
          eventVersion: 1,
          eventType: 'patient.erfasst',
          occurredAt: '2026-05-20T10:00:00.000Z',
          recordedAt: '2026-05-20T10:00:00.500Z',
          actorUserId: 'usr-42',
          actorDeviceId: null,
          originSessionId: null,
          clockDriftSeconds: null,
          payload: { kind: 'patient.erfasst', patientennummer: 'P-001' },
        },
      ],
    },
    meta: { timestamp: '2026-05-20T10:00:01.000Z', version: 'v-alpha', requestId: 'req_01' },
  };
}

describe('usePatientDetail (Story 1.7, AC10)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    detailApiSpy.mockReset();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('lädt PatientDetailDto über generierten Shared-Client (response.data wird gemappt)', async () => {
    detailApiSpy.mockResolvedValueOnce(buildDetailResponse());

    const { result } = renderHook(() => usePatientDetail('ein_01', 'pat_01'), { wrapper: buildWrapper(queryClient) });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data?.patientennummer).toBe('P-001');
    expect(result.current.data?.events).toHaveLength(1);
    expect(detailApiSpy).toHaveBeenCalledWith({ einsatzId: 'ein_01', patientId: 'pat_01' });
  });

  it('disabled bei leerem einsatzId (kein API-Call)', async () => {
    const { result } = renderHook(() => usePatientDetail('   ', 'pat_01'), { wrapper: buildWrapper(queryClient) });
    expect(detailApiSpy).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
  });

  it('disabled bei leerem patientId (kein API-Call)', async () => {
    const { result } = renderHook(() => usePatientDetail('ein_01', ''), { wrapper: buildWrapper(queryClient) });
    expect(detailApiSpy).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
  });

  it('propagiert ResponseError als isError', async () => {
    const err = new (class extends Error {})('NotFound');
    detailApiSpy.mockRejectedValueOnce(err);

    const { result } = renderHook(() => usePatientDetail('ein_01', 'pat_01'), { wrapper: buildWrapper(queryClient) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(err);
  });

  it('nutzt PATIENT_QUERY_KEYS.detail-Cache-Key', async () => {
    detailApiSpy.mockResolvedValue(buildDetailResponse());

    const { result } = renderHook(() => usePatientDetail('ein_01', 'pat_01'), { wrapper: buildWrapper(queryClient) });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    const cached = queryClient.getQueryData(['patienten', 'einsatz', 'ein_01', 'detail', 'pat_01']);
    expect(cached).toBeDefined();
  });
});
