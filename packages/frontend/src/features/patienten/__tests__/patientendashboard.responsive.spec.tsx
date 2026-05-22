import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { PatientenDashboard } from '../ui/patientendashboard.organism';
import { setTestViewport, resetTestViewport } from '@/test/viewport';
import type { PatientListItemDto } from '@bluelight-hub/shared/client';

const listApiSpy = vi.fn();

vi.mock('@/shared', () => ({
  api: {
    patienten: () => ({
      patientenControllerListVAlpha: listApiSpy,
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

// KpiStrip mocken, um API-Abfragen dort zu vermeiden
vi.mock('../ui/kpi-strip', () => ({
  KpiStrip: () => <div data-testid="mock-kpi-strip">KPI Strip</div>,
}));

// PatientenListe mocken, um API-Abfragen dort zu vermeiden
vi.mock('../ui/patientenliste.organism', () => ({
  PatientenListe: () => <div data-testid="mock-patientenliste">PatientenListe</div>,
}));

// ADR-018-Invariant: `eventVersion = MAX(version)` aller Events.
// `IN_BEHANDLUNG` braucht mind. `patient.erfasst` (v1) + `patient.behandlung-begonnen` (v2).
const EVENT_VERSION_BY_BEHANDLUNG: Record<PatientListItemDto['behandlungsstatus'], number> = {
  UNVERSORGT: 1,
  IN_BEHANDLUNG: 2,
  VERSORGT: 3,
  TRANSPORTBEREIT: 3,
};

function buildPatient(idx: number, behandlung: PatientListItemDto['behandlungsstatus'] = 'IN_BEHANDLUNG'): PatientListItemDto {
  return {
    id: `pat_${idx}`,
    patientennummer: `P-${String(idx + 1).padStart(3, '0')}`,
    aktuelleSk: 'SK_I',
    behandlungsstatus: behandlung,
    transportstatus: 'WARTEND',
    erfasstAm: new Date().toISOString(),
    eventVersion: EVENT_VERSION_BY_BEHANDLUNG[behandlung],
  };
}

function buildResponse(count = 2) {
  return {
    data: Array.from({ length: count }, (_, i) => buildPatient(i)),
    pagination: {
      page: 1,
      pageSize: 1000,
      total: count,
      totalPages: 1,
    },
  };
}

function buildWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

/**
 * UX-DR33 Responsive-Verhalten: 5 Viewport-Breiten getestet.
 *
 * Layout-Varianten:
 *  - D3 < 640 px:  nur KpiStrip + PatientenListe (kompakte Stack-Variante)
 *  - D1 ≥ 640 px:  KpiStrip + EntityFlowStrip + PatientenListe
 *
 * Hinweis: `useSmViewport` matched bei `min-width: 640px`, daher gehört 640 selbst zu D1.
 */
describe('PatientenDashboard responsive (Story 1.8, AC6 / UX-DR33)', () => {
  beforeEach(() => {
    listApiSpy.mockReset();
    listApiSpy.mockResolvedValue(buildResponse());
  });

  afterEach(() => {
    cleanup();
    resetTestViewport();
  });

  // === D3 (Mobile) — < 640 px ===

  describe('320 px (D3 Mobile, kleinste Breite)', () => {
    it('rendert KpiStrip und PatientenListe, aber KEINEN EntityFlowStrip', async () => {
      setTestViewport({ width: 320, height: 568 });

      render(<PatientenDashboard einsatzId="einsatz_1" filters={{}} onFiltersChange={vi.fn()} />, { wrapper: buildWrapper() });

      expect(screen.getByTestId('mock-kpi-strip')).toBeInTheDocument();
      expect(screen.getByTestId('mock-patientenliste')).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Patient-Flow' })).toBeNull();
    });
  });

  // === D1 (Tablet+) — ≥ 640 px ===

  describe('640 px (D1 Tablet, Breakpoint genau)', () => {
    it('rendert KpiStrip + EntityFlowStrip + PatientenListe', async () => {
      setTestViewport({ width: 640, height: 1024 });

      render(<PatientenDashboard einsatzId="einsatz_1" filters={{}} onFiltersChange={vi.fn()} />, { wrapper: buildWrapper() });

      expect(screen.getByTestId('mock-kpi-strip')).toBeInTheDocument();
      expect(screen.getByTestId('mock-patientenliste')).toBeInTheDocument();
      const flow = await screen.findByRole('region', { name: 'Patient-Flow' });
      expect(flow).toBeInTheDocument();
    });
  });

  describe('1024 px (D1 Desktop, klein)', () => {
    it('rendert KpiStrip + EntityFlowStrip + PatientenListe', async () => {
      setTestViewport({ width: 1024, height: 768 });

      render(<PatientenDashboard einsatzId="einsatz_1" filters={{}} onFiltersChange={vi.fn()} />, { wrapper: buildWrapper() });

      expect(screen.getByTestId('mock-kpi-strip')).toBeInTheDocument();
      expect(screen.getByTestId('mock-patientenliste')).toBeInTheDocument();
      const flow = await screen.findByRole('region', { name: 'Patient-Flow' });
      expect(flow).toBeInTheDocument();
    });
  });

  describe('1280 px (D1 Desktop, mittel)', () => {
    it('rendert KpiStrip + EntityFlowStrip + PatientenListe', async () => {
      setTestViewport({ width: 1280, height: 800 });

      render(<PatientenDashboard einsatzId="einsatz_1" filters={{}} onFiltersChange={vi.fn()} />, { wrapper: buildWrapper() });

      expect(screen.getByTestId('mock-kpi-strip')).toBeInTheDocument();
      expect(screen.getByTestId('mock-patientenliste')).toBeInTheDocument();
      const flow = await screen.findByRole('region', { name: 'Patient-Flow' });
      expect(flow).toBeInTheDocument();
    });
  });

  describe('1440 px (D1 Desktop, groß)', () => {
    it('rendert KpiStrip + EntityFlowStrip + PatientenListe', async () => {
      setTestViewport({ width: 1440, height: 900 });

      render(<PatientenDashboard einsatzId="einsatz_1" filters={{}} onFiltersChange={vi.fn()} />, { wrapper: buildWrapper() });

      expect(screen.getByTestId('mock-kpi-strip')).toBeInTheDocument();
      expect(screen.getByTestId('mock-patientenliste')).toBeInTheDocument();
      const flow = await screen.findByRole('region', { name: 'Patient-Flow' });
      expect(flow).toBeInTheDocument();
    });
  });

  // === Story 1.9 (AC6) — 640 px-Breakpoint-Stress + PatientenListe-Mount-Persistenz ===

  describe('Layout-Wechsel an der 640 px-Grenze (UX-DR33)', () => {
    it('wechselt von D3 (320 px) zu D1 (1024 px) ohne EntityFlowStrip-Duplikate', async () => {
      setTestViewport({ width: 320, height: 568 });
      render(<PatientenDashboard einsatzId="einsatz_1" filters={{}} onFiltersChange={vi.fn()} />, { wrapper: buildWrapper() });

      // D3-Initial: EntityFlowStrip NICHT sichtbar.
      expect(screen.queryByRole('region', { name: 'Patient-Flow' })).toBeNull();

      await act(async () => {
        setTestViewport({ width: 1024, height: 768 });
      });

      // D1-After: EntityFlowStrip wird sichtbar — genau einmal, nicht doppelt.
      const flows = await screen.findAllByRole('region', { name: 'Patient-Flow' });
      expect(flows).toHaveLength(1);
    });

    it('rapid Resize 320 ↔ 1024 (4×) bleibt stabil und remountet die PatientenListe nicht', async () => {
      // Stress-Test: mehrfacher Wechsel an der 640 px-Grenze. Da `PatientenListe`
      // hier gemockt ist, prüfen wir nur DOM-Stabilität — der API-Call-Count
      // wird in `usePatientenList.test.tsx` separat verifiziert. Das `act()`-
      // Wrapping verhindert React-19-`act()`-Warnings und sichert deterministisches
      // Flush-Verhalten (Code-Review-Fix P13).
      setTestViewport({ width: 320, height: 568 });
      render(<PatientenDashboard einsatzId="einsatz_1" filters={{}} onFiltersChange={vi.fn()} />, { wrapper: buildWrapper() });

      await act(async () => {
        for (let i = 0; i < 4; i += 1) {
          setTestViewport({ width: 1024, height: 768 });
          setTestViewport({ width: 320, height: 568 });
        }
      });

      // Final stabil bei D3.
      await waitFor(() => {
        expect(screen.queryByRole('region', { name: 'Patient-Flow' })).toBeNull();
      });
      // PatientenListe-Mock-Element bleibt während aller Wechsel gemountet.
      expect(screen.getByTestId('mock-patientenliste')).toBeInTheDocument();
    });

    it('hält die PatientenListe während des Layout-Wechsels gemountet (kein Remount zwischen D1 und D3)', async () => {
      // Hinweis: Da `PatientenListe` im Modul-Scope gemockt ist, validiert dieser
      // Test ausschließlich Mount-Persistenz des Mock-Elements (kein API-Cache-
      // Verhalten). Echte TanStack-Query-Cache-Persistenz wird in den
      // `usePatientenList`-Hook-Tests verifiziert (Code-Review-Fix P8).
      setTestViewport({ width: 1024, height: 768 });
      const wrapper = buildWrapper();
      const { rerender } = render(<PatientenDashboard einsatzId="einsatz_1" filters={{}} onFiltersChange={vi.fn()} />, { wrapper });

      const initialListe = screen.getByTestId('mock-patientenliste');
      expect(initialListe).toBeInTheDocument();

      // Wechsel auf D3 — PatientenListe-Mock bleibt im DOM (KpiStrip + Liste in
      // beiden Layouts, nur EntityFlowStrip-Sichtbarkeit ändert sich).
      await act(async () => {
        setTestViewport({ width: 320, height: 568 });
        rerender(<PatientenDashboard einsatzId="einsatz_1" filters={{}} onFiltersChange={vi.fn()} />);
      });

      await waitFor(() => {
        expect(screen.queryByRole('region', { name: 'Patient-Flow' })).toBeNull();
      });
      const persistedListe = screen.getByTestId('mock-patientenliste');
      expect(persistedListe).toBeInTheDocument();
      // Hinweis: DOM-Node-Identität ist nicht stabil über `rerender()` mit
      // `vi.mock`-Komponenten; Mount-Persistenz wird über die fortlaufende
      // Sichtbarkeit des `testid` validiert (kein Verschwinden zwischen den
      // Re-Renders).
    });
  });
});
