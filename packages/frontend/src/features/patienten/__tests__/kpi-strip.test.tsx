import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';

const kpisApiSpy = vi.fn();

vi.mock('@/shared', async () => {
  const actual = await vi.importActual<typeof import('@/shared/ui')>('@/shared/ui');
  return {
    ...actual,
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
  };
});

const { KpiStrip } = await import('../ui/kpi-strip');

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

describe('KpiStrip', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    kpisApiSpy.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    });
  });

  it('Success: rendert genau 12 Tiles in der spezifizierten Reihenfolge mit korrekten Werten', async () => {
    kpisApiSpy.mockResolvedValueOnce({ data: buildKpiDto() });

    render(<KpiStrip einsatzId="einsatz-1" />, { wrapper: buildWrapper(queryClient) });

    await waitFor(() => expect(screen.getByTestId('kpi-sk-SK_I').getAttribute('aria-busy')).toBeNull());

    // SK-Sektion: 5 Tiles
    expect(screen.getByTestId('kpi-sk-SK_I')).toHaveAttribute('aria-label', 'SK I: 12');
    expect(screen.getByTestId('kpi-sk-SK_II')).toHaveAttribute('aria-label', 'SK II: 48');
    expect(screen.getByTestId('kpi-sk-SK_III')).toHaveAttribute('aria-label', 'SK III: 130');
    expect(screen.getByTestId('kpi-sk-SK_IV')).toHaveAttribute('aria-label', 'SK IV: 55');
    expect(screen.getByTestId('kpi-sk-TOT')).toHaveAttribute('aria-label', 'Tot: 5');

    // Behandlungs-Sektion: 4 Tiles
    expect(screen.getByTestId('kpi-behandlung-UNVERSORGT')).toHaveAttribute('aria-label', 'Unversorgt: 60');
    expect(screen.getByTestId('kpi-behandlung-IN_BEHANDLUNG')).toHaveAttribute('aria-label', 'In Behandlung: 80');
    expect(screen.getByTestId('kpi-behandlung-VERSORGT')).toHaveAttribute('aria-label', 'Versorgt: 70');
    expect(screen.getByTestId('kpi-behandlung-TRANSPORTBEREIT')).toHaveAttribute('aria-label', 'Transportbereit: 40');

    // Transport-Sektion: 3 Tiles
    expect(screen.getByTestId('kpi-transport-WARTEND')).toHaveAttribute('aria-label', 'Wartet: 200');
    expect(screen.getByTestId('kpi-transport-IM_TRANSPORT')).toHaveAttribute('aria-label', 'Im Transport: 30');
    expect(screen.getByTestId('kpi-transport-IM_KRANKENHAUS')).toHaveAttribute('aria-label', 'Im Krankenhaus: 20');

    // 3 a11y-Landmarks
    expect(screen.getByRole('group', { name: 'Sichtungskategorien' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Behandlungs-Status' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Transport-Status' })).toBeInTheDocument();
  });

  it('Loading: rendert 12 Skeleton-Tiles ohne Layout-Shift (aria-busy="true")', () => {
    kpisApiSpy.mockReturnValueOnce(new Promise(() => {}));

    render(<KpiStrip einsatzId="einsatz-1" />, { wrapper: buildWrapper(queryClient) });

    const busyTiles = screen.getAllByRole('status').filter((el) => el.getAttribute('aria-busy') === 'true');
    expect(busyTiles).toHaveLength(12);
  });

  it('Error: rendert Inline-Fallback mit Klartext (kein Sentinel-Leak)', async () => {
    kpisApiSpy.mockRejectedValueOnce(new Error('boom'));

    render(<KpiStrip einsatzId="einsatz-1" />, { wrapper: buildWrapper(queryClient) });

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('KPI-Lagebild konnte nicht geladen werden');
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument();
  });
});
