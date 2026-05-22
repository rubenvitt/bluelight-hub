import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const { SkUpgradePillGroup } = await import('../ui/sk-upgrade-pill-group');

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

function renderGroup(overrides: Partial<{ currentSk: 'SK_I' | 'SK_II' | 'SK_III' | 'SK_IV' | 'TOT' }> = {}) {
  return render(<SkUpgradePillGroup einsatzId="einsatz-1" patientId="pat-1" patientennummer="P-003" currentSk={overrides.currentSk ?? 'SK_III'} />, { wrapper });
}

describe('SkUpgradePillGroup (Story 1.3, UX-DR10)', () => {
  beforeEach(() => {
    aktualisiereSichtungApiSpy.mockReset();
  });

  it('rendert 5 Pills + hebt die aktuelle SK hervor (aria-pressed=true, disabled)', () => {
    renderGroup({ currentSk: 'SK_II' });
    const pills = ['SK_I', 'SK_II', 'SK_III', 'SK_IV', 'TOT'].map((sk) => screen.getByTestId(`sk-upgrade-pill-${sk}`));
    expect(pills).toHaveLength(5);
    const aktuelle = screen.getByTestId('sk-upgrade-pill-SK_II');
    expect(aktuelle).toHaveAttribute('aria-pressed', 'true');
    expect(aktuelle).toBeDisabled();
    expect(screen.getByTestId('sk-upgrade-pill-SK_I')).toHaveAttribute('aria-pressed', 'false');
  });

  it('Confirm-Flow: 1st Tap auf inaktive Pill öffnet Bestätigungs-Pill, 2nd Tap löst Mutation aus', async () => {
    aktualisiereSichtungApiSpy.mockResolvedValue({
      data: {
        id: 'pat-1',
        einsatzId: 'einsatz-1',
        patientennummer: 'P-003',
        aktuelleSk: 'SK_I',
        behandlungsstatus: 'UNVERSORGT',
        transportstatus: 'WARTEND',
        erfasstAm: '2026-05-19T10:00:00.000Z',
        erfasserRef: { type: 'user', userId: 'user-1' },
        eventVersion: 2,
      },
    });
    const user = userEvent.setup();
    renderGroup({ currentSk: 'SK_III' });

    expect(screen.queryByTestId('sk-upgrade-confirm')).toBeNull();
    await user.click(screen.getByTestId('sk-upgrade-pill-SK_I'));
    const confirm = await screen.findByTestId('sk-upgrade-confirm');
    expect(within(confirm).getByText(/Neue Sichtungskategorie/)).toBeInTheDocument();

    await user.click(screen.getByTestId('sk-upgrade-confirm-button'));

    await waitFor(() => {
      expect(aktualisiereSichtungApiSpy).toHaveBeenCalledTimes(1);
    });
    expect(aktualisiereSichtungApiSpy).toHaveBeenCalledWith({
      einsatzId: 'einsatz-1',
      patientId: 'pat-1',
      aktualisiereSichtungDto: { neueSk: 'SK_I', sichtungArt: 'aerztlich', grund: undefined },
    });
    await waitFor(() => expect(screen.queryByTestId('sk-upgrade-confirm')).toBeNull());
  });

  it('Abbrechen schließt die Bestätigungs-Pill ohne Mutation', async () => {
    const user = userEvent.setup();
    renderGroup({ currentSk: 'SK_III' });
    await user.click(screen.getByTestId('sk-upgrade-pill-SK_II'));
    await user.click(screen.getByTestId('sk-upgrade-cancel-button'));
    expect(screen.queryByTestId('sk-upgrade-confirm')).toBeNull();
    expect(aktualisiereSichtungApiSpy).not.toHaveBeenCalled();
  });

  it('grund-Disclosure: Toggle expandiert Textarea und sendet getrimmten Wert mit', async () => {
    aktualisiereSichtungApiSpy.mockResolvedValue({
      data: {
        id: 'pat-1',
        einsatzId: 'einsatz-1',
        patientennummer: 'P-003',
        aktuelleSk: 'SK_I',
        behandlungsstatus: 'UNVERSORGT',
        transportstatus: 'WARTEND',
        erfasstAm: '2026-05-19T10:00:00.000Z',
        erfasserRef: { type: 'user', userId: 'user-1' },
        eventVersion: 2,
      },
    });
    const user = userEvent.setup();
    renderGroup({ currentSk: 'SK_III' });

    await user.click(screen.getByTestId('sk-upgrade-pill-SK_I'));
    await user.click(screen.getByTestId('sk-upgrade-grund-toggle'));
    const grundInput = await screen.findByTestId('sk-upgrade-grund-input');
    await user.type(grundInput, '  Vitalwerte verschlechtert  ');
    await user.click(screen.getByTestId('sk-upgrade-confirm-button'));

    await waitFor(() => expect(aktualisiereSichtungApiSpy).toHaveBeenCalledTimes(1));
    expect(aktualisiereSichtungApiSpy.mock.calls[0][0].aktualisiereSichtungDto.grund).toBe('Vitalwerte verschlechtert');
  });

  it('Server-Reject (TOT-Block) zeigt Inline-Fehler-Pill mit ARIA-assertive', async () => {
    aktualisiereSichtungApiSpy.mockRejectedValue(Object.assign(new Error('BusinessRule:SichtungVonTotNichtErlaubt:TOT->SK_I'), { name: 'ResponseError' }));
    const user = userEvent.setup();
    renderGroup({ currentSk: 'TOT' });
    // TOT-Pill ist aktiv (disabled); klicke SK_I als neuen Wert
    await user.click(screen.getByTestId('sk-upgrade-pill-SK_I'));
    await user.click(screen.getByTestId('sk-upgrade-confirm-button'));

    const errorPill = await screen.findByTestId('sk-upgrade-error');
    expect(errorPill).toHaveAttribute('aria-live', 'assertive');
    expect(errorPill).toHaveTextContent(/Patient ist als TOT markiert/);
  });

  it('Sichtungsart-Toggle: Vorsichtung wird mitgesendet', async () => {
    aktualisiereSichtungApiSpy.mockResolvedValue({
      data: {
        id: 'pat-1',
        einsatzId: 'einsatz-1',
        patientennummer: 'P-003',
        aktuelleSk: 'SK_I',
        behandlungsstatus: 'UNVERSORGT',
        transportstatus: 'WARTEND',
        erfasstAm: '2026-05-19T10:00:00.000Z',
        erfasserRef: { type: 'user', userId: 'user-1' },
        eventVersion: 2,
      },
    });
    const user = userEvent.setup();
    renderGroup({ currentSk: 'SK_III' });
    await user.click(screen.getByTestId('sk-upgrade-pill-SK_I'));
    await user.click(screen.getByTestId('sk-upgrade-sichtungart-vorsichtung'));
    await user.click(screen.getByTestId('sk-upgrade-confirm-button'));

    await waitFor(() => expect(aktualisiereSichtungApiSpy).toHaveBeenCalledTimes(1));
    expect(aktualisiereSichtungApiSpy.mock.calls[0][0].aktualisiereSichtungDto.sichtungArt).toBe('vorsichtung');
  });
});
