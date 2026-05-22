import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';

const erfassePatientApiSpy = vi.fn();

vi.mock('@/shared', () => ({
  api: {
    patienten: () => ({
      patientenControllerErfassePatientVAlpha: erfassePatientApiSpy,
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

const { useErfassePatientForm } = await import('../hooks/use-erfasse-patient-form');

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useErfassePatientForm', () => {
  beforeEach(() => {
    erfassePatientApiSpy.mockReset();
  });

  it('setzt lastErfasstePatientennummer nach erfolgreicher Mutation und ruft den API-Spy mit DTO auf', async () => {
    erfassePatientApiSpy.mockResolvedValue({
      data: {
        id: 'pat-1',
        einsatzId: 'einsatz-1',
        patientennummer: 'P-042',
        aktuelleSk: 'SK_II',
        behandlungsstatus: 'UNVERSORGT',
        transportstatus: 'WARTEND',
        erfasstAm: '2026-05-19T10:00:00.000Z',
        erfasserRef: { type: 'user', userId: 'user-1' },
        eventVersion: 1,
      },
    });

    const { result } = renderHook(() => useErfassePatientForm({ einsatzId: 'einsatz-1' }), { wrapper });

    expect(result.current.lastErfasstePatientennummer).toBeNull();

    // Form mit gültigem State submitten
    await act(async () => {
      result.current.form.setFieldValue('initialeSk', 'SK_II');
    });

    await act(async () => {
      await result.current.form.handleSubmit();
    });

    await waitFor(() => {
      expect(result.current.lastErfasstePatientennummer).toBe('P-042');
    });

    expect(erfassePatientApiSpy).toHaveBeenCalledWith({
      einsatzId: 'einsatz-1',
      erfassePatientDto: { initialeSk: 'SK_II', diviVakNummer: undefined, notiz: undefined },
    });
  });

  it('liefert Mutation-Spy mit isPending/isError-Flags', () => {
    const { result } = renderHook(() => useErfassePatientForm({ einsatzId: 'einsatz-2' }), { wrapper });
    expect(result.current.mutation.isPending).toBe(false);
    expect(result.current.mutation.isError).toBe(false);
  });
});
