import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';

const aktualisiereBehandlungApiSpy = vi.fn();

vi.mock('@/shared', () => ({
  api: { patienten: () => ({ patientenControllerAktualisiereBehandlungVAlpha: aktualisiereBehandlungApiSpy }) },
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

const { BehandlungsStatusPillGroup } = await import('../ui/behandlungs-status-pill-group');

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

function renderGroup(overrides: Partial<{ currentStatus: 'UNVERSORGT' | 'IN_BEHANDLUNG' | 'VERSORGT' | 'TRANSPORTBEREIT' }> = {}) {
  return render(<BehandlungsStatusPillGroup einsatzId="einsatz-1" patientId="pat-1" patientennummer="P-003" currentStatus={overrides.currentStatus ?? 'UNVERSORGT'} />, { wrapper });
}

describe('BehandlungsStatusPillGroup (Story 1.4, AC5)', () => {
  beforeEach(() => aktualisiereBehandlungApiSpy.mockReset());

  it('rendert 4 Pills, aktive Pill ist aria-pressed=true und disabled', () => {
    renderGroup({ currentStatus: 'IN_BEHANDLUNG' });
    const pills = ['UNVERSORGT', 'IN_BEHANDLUNG', 'VERSORGT', 'TRANSPORTBEREIT'].map((s) => screen.getByTestId(`behandlungs-pill-${s}`));
    expect(pills).toHaveLength(4);
    const active = screen.getByTestId('behandlungs-pill-IN_BEHANDLUNG');
    expect(active).toHaveAttribute('aria-pressed', 'true');
    expect(active).toBeDisabled();
  });

  it('Illegale Übergangs-Pills sind aria-disabled und disabled (kein Modal nutzbar)', () => {
    renderGroup({ currentStatus: 'UNVERSORGT' });
    // UNVERSORGT erlaubt nur → IN_BEHANDLUNG; VERSORGT / TRANSPORTBEREIT illegal
    expect(screen.getByTestId('behandlungs-pill-VERSORGT')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('behandlungs-pill-TRANSPORTBEREIT')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('behandlungs-pill-IN_BEHANDLUNG')).toHaveAttribute('aria-disabled', 'false');
  });

  it('Confirm-Flow: Tap → Confirm-Pill → Bestätigen löst Mutation aus', async () => {
    aktualisiereBehandlungApiSpy.mockResolvedValue({
      data: {
        id: 'pat-1',
        einsatzId: 'einsatz-1',
        patientennummer: 'P-003',
        aktuelleSk: 'SK_II',
        behandlungsstatus: 'IN_BEHANDLUNG',
        transportstatus: 'WARTEND',
        erfasstAm: '2026-05-19T10:00:00.000Z',
        erfasserRef: { type: 'user', userId: 'user-1' },
        eventVersion: 2,
      },
    });
    const user = userEvent.setup();
    renderGroup({ currentStatus: 'UNVERSORGT' });

    expect(screen.queryByTestId('behandlungs-confirm')).toBeNull();
    await user.click(screen.getByTestId('behandlungs-pill-IN_BEHANDLUNG'));
    await screen.findByTestId('behandlungs-confirm');
    await user.click(screen.getByTestId('behandlungs-confirm-button'));
    await waitFor(() => expect(aktualisiereBehandlungApiSpy).toHaveBeenCalledTimes(1));
    expect(aktualisiereBehandlungApiSpy).toHaveBeenCalledWith({
      einsatzId: 'einsatz-1',
      patientId: 'pat-1',
      aktualisiereBehandlungDto: { neuerStatus: 'IN_BEHANDLUNG' },
    });
  });

  // Inline-Fehler-Pill bei Server-Reject deferred — Vitest behandelt die Mock-Rejection im
  // Optimistic-UI-Pfad als unhandled (siehe deferred-work.md Story 1.4). Die Fehler-Logik
  // selbst (Inline-Pill mit aria-live="assertive") ist parallel zu `SkUpgradePillGroup`
  // (Story 1.3) und dort getestet.
  //
  // Story 1.4 Code-Review Feature 1: Die neue `code`-Match-Logik
  // (`extractErrorCode` + `enrichResponseErrorWithCode`) ist unit-getestet in
  // `extract-error-code.test.ts`; die Component-Integration bleibt aus dem
  // bestehenden Vitest-Unhandled-Rejection-Grund deferred.
});
