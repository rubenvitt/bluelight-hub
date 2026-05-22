import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const { TransportStatusPillGroup } = await import('../ui/transport-status-pill-group');

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

function renderGroup(overrides: Partial<{ currentStatus: 'WARTEND' | 'IM_TRANSPORT' | 'IM_KRANKENHAUS' }> = {}) {
  return render(<TransportStatusPillGroup einsatzId="einsatz-1" patientId="pat-1" patientennummer="P-003" currentStatus={overrides.currentStatus ?? 'WARTEND'} />, { wrapper });
}

describe('TransportStatusPillGroup (Story 1.4, AC5)', () => {
  beforeEach(() => aktualisiereTransportApiSpy.mockReset());

  it('rendert 3 Pills, aktive Pill ist aria-pressed=true und disabled', () => {
    renderGroup({ currentStatus: 'IM_TRANSPORT' });
    const active = screen.getByTestId('transport-pill-IM_TRANSPORT');
    expect(active).toHaveAttribute('aria-pressed', 'true');
    expect(active).toBeDisabled();
  });

  it('Illegaler Direkt-Sprung WARTEND → IM_KRANKENHAUS: Pill disabled', () => {
    renderGroup({ currentStatus: 'WARTEND' });
    expect(screen.getByTestId('transport-pill-IM_KRANKENHAUS')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('transport-pill-IM_TRANSPORT')).toHaveAttribute('aria-disabled', 'false');
  });

  it('Confirm-Flow + Mutation', async () => {
    aktualisiereTransportApiSpy.mockResolvedValue({
      data: {
        id: 'pat-1',
        einsatzId: 'einsatz-1',
        patientennummer: 'P-003',
        aktuelleSk: 'SK_II',
        behandlungsstatus: 'IN_BEHANDLUNG',
        transportstatus: 'IM_TRANSPORT',
        erfasstAm: '2026-05-19T10:00:00.000Z',
        erfasserRef: { type: 'user', userId: 'user-1' },
        eventVersion: 3,
      },
    });
    const user = userEvent.setup();
    renderGroup({ currentStatus: 'WARTEND' });

    await user.click(screen.getByTestId('transport-pill-IM_TRANSPORT'));
    await screen.findByTestId('transport-confirm');
    await user.click(screen.getByTestId('transport-confirm-button'));
    await waitFor(() => expect(aktualisiereTransportApiSpy).toHaveBeenCalledTimes(1));
  });

  // Inline-Fehler-Pill bei Server-Reject deferred — analog `BehandlungsStatusPillGroup` und
  // `SkUpgradePillGroup` (Story 1.3, dort getestet).
  //
  // Story 1.4 Code-Review Feature 1: Die neue `code`-Match-Logik ist
  // unit-getestet in `extract-error-code.test.ts`.
});
