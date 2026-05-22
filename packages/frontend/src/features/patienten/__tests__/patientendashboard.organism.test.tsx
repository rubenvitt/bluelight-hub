import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PatientenDashboard } from '../ui/patientendashboard.organism';
import type { PatientListItemDto } from '@bluelight-hub/shared/client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// Viewport mocken
const useSmViewportSpy = vi.fn();
vi.mock('@/features/eigenschutz/hooks/use-lg-viewport', () => ({
  useSmViewport: () => useSmViewportSpy(),
}));

// API Hook mocken
const usePatientenListSpy = vi.fn();
vi.mock('../api/use-patienten-list', () => ({
  usePatientenList: (einsatzId: string, filters: any, options?: any) => usePatientenListSpy(einsatzId, filters, options),
}));

// KpiStrip mocken
vi.mock('../ui/kpi-strip', () => ({
  KpiStrip: ({ einsatzId }: { einsatzId: string }) => <div data-testid="mock-kpi-strip">KPI Strip für Einsatz {einsatzId}</div>,
}));

// PatientenListe mocken
vi.mock('../ui/patientenliste.organism', () => ({
  PatientenListe: ({ einsatzId, filters }: { einsatzId: string; filters: any }) => <div data-testid="mock-patientenliste">PatientenListe für Einsatz {einsatzId}</div>,
}));

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

const mockPatients: PatientListItemDto[] = [
  {
    id: 'pat_1',
    patientennummer: 'P-001',
    aktuelleSk: 'SK_I',
    behandlungsstatus: 'IN_BEHANDLUNG',
    transportstatus: 'WARTEND',
    erfasstAm: new Date().toISOString(),
    eventVersion: 1,
  },
  {
    id: 'pat_2',
    patientennummer: 'P-002',
    aktuelleSk: 'SK_II',
    behandlungsstatus: 'VERSORGT',
    transportstatus: 'IM_KRANKENHAUS',
    erfasstAm: new Date().toISOString(),
    eventVersion: 1,
  },
];

describe('PatientenDashboard', () => {
  beforeEach(() => {
    useSmViewportSpy.mockReset();
    usePatientenListSpy.mockReset();
  });

  it('rendert im Desktop-Modus (isSm = true) das KpiStrip, den EntityFlowStrip und die PatientenListe', () => {
    useSmViewportSpy.mockReturnValue(true);
    usePatientenListSpy.mockReturnValue({
      data: { items: mockPatients },
      isPending: false,
    });

    const onFiltersChange = vi.fn();

    render(<PatientenDashboard einsatzId="einsatz_123" filters={{}} onFiltersChange={onFiltersChange} />, { wrapper: buildWrapper() });

    // KpiStrip gerendert
    expect(screen.getByTestId('mock-kpi-strip')).toBeInTheDocument();

    // EntityFlowStrip gerendert (durch die Spalten der Phasen erkennbar)
    expect(screen.getByRole('region', { name: 'Patient-Flow' })).toBeInTheDocument();
    // Prüfen, ob Patienten-Pillen gerendert werden im Flow
    expect(screen.getByText('P-001')).toBeInTheDocument();
    expect(screen.getByText('P-002')).toBeInTheDocument();

    // PatientenListe gerendert
    expect(screen.getByTestId('mock-patientenliste')).toBeInTheDocument();
  });

  it('rendert im Mobile-Modus (isSm = false) nur das KpiStrip und die PatientenListe (ohne Flow)', () => {
    useSmViewportSpy.mockReturnValue(false);
    usePatientenListSpy.mockReturnValue({
      data: { items: mockPatients },
      isPending: false,
    });

    const onFiltersChange = vi.fn();

    render(<PatientenDashboard einsatzId="einsatz_123" filters={{}} onFiltersChange={onFiltersChange} />, { wrapper: buildWrapper() });

    // KpiStrip gerendert
    expect(screen.getByTestId('mock-kpi-strip')).toBeInTheDocument();

    // EntityFlowStrip darf NICHT gerendert werden
    expect(screen.queryByRole('region', { name: 'Patient-Flow' })).not.toBeInTheDocument();
    expect(screen.queryByText('P-001')).not.toBeInTheDocument();

    // PatientenListe gerendert
    expect(screen.getByTestId('mock-patientenliste')).toBeInTheDocument();
  });

  it('übergibt dem EntityFlowStrip einen Ladeindikator, wenn die Patientenliste geladen wird', () => {
    useSmViewportSpy.mockReturnValue(true);
    usePatientenListSpy.mockReturnValue({
      data: undefined,
      isPending: true,
    });

    const onFiltersChange = vi.fn();

    const { container } = render(<PatientenDashboard einsatzId="einsatz_123" filters={{}} onFiltersChange={onFiltersChange} />, { wrapper: buildWrapper() });

    // Skeleton-Elemente sollten animiert pulsieren
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
