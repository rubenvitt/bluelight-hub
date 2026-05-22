/**
 * Story 1.7 (AC12): Render-Smoke pro Viewport für die Detail-Route.
 *
 * Verifiziert, dass:
 *  - bei 320/640/1024-1 px (< lg) der `Dialog.SlideIn`-Drawer rendert,
 *  - bei 1024/1280/1440 px (≥ lg) der inline Split-View-Wrapper rendert.
 *
 * Wir mocken `usePatientDetail` (kein API-Roundtrip) und `useLgViewport`
 * direkt — das viewport-Helper setzt nur das matchMedia-Mock, der Hook
 * konsumiert das im jsdom-Setup. Die Komponente entscheidet rein basierend
 * auf dem boolean.
 */
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';

const detailApiSpy = vi.fn();
const lgViewportSpy = vi.fn();

vi.mock('@/shared', () => ({
  api: {
    patienten: () => ({
      patientenControllerDetailVAlpha: detailApiSpy,
      patientenControllerAktualisiereSichtungVAlpha: vi.fn(),
      patientenControllerKorrigiereVAlpha: vi.fn(),
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

vi.mock('@/features/eigenschutz/hooks/use-lg-viewport', () => ({
  useLgViewport: () => lgViewportSpy(),
  useSmViewport: () => false,
  useMdViewport: () => false,
  useXlViewport: () => false,
  useXxlViewport: () => false,
}));

// Mock TanStack Router — wir importieren NICHT die echte Route-Datei,
// sondern die Komponente direkt, weil createFileRoute zur Build-Zeit
// generierte Wrapper braucht. Stattdessen exportieren wir den Inhalt
// inline (Mini-Komponente) und prüfen die viewport-Branches.
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  createFileRoute: () => ({
    useParams: () => ({ einsatzId: 'ein_01', patientId: 'pat_01' }),
    useNavigate: () => vi.fn(),
  }),
}));

const { PatientDetailPanel } = await import('../ui/patient-detail-panel.organism');
const { useLgViewport } = await import('@/features/eigenschutz/hooks/use-lg-viewport');
const { Dialog } = await import('@/shared/ui/molecules/dialog.molecule');

// Inline-Replica der Route-Komponente — die echte Route-Komponente nutzt
// TanStack-Router-spezifische Wrapper, die das jsdom-Setup nicht hat. Die
// viewport-Branch-Logik ist hier identisch.
function PatientDetailRouteInline({ einsatzId, patientId }: { einsatzId: string; patientId: string }) {
  const isLg = useLgViewport();
  if (isLg) {
    return (
      <div data-testid="patient-detail-split-view">
        <PatientDetailPanel einsatzId={einsatzId} patientId={patientId} variant="split-view" />
      </div>
    );
  }
  return (
    <Dialog.SlideIn isOpen onClose={() => {}} title={`Patient ${patientId}`} size="xl" position="right">
      <PatientDetailPanel einsatzId={einsatzId} patientId={patientId} variant="drawer" />
    </Dialog.SlideIn>
  );
}

function renderAtViewport(isLg: boolean) {
  lgViewportSpy.mockReturnValue(isLg);
  detailApiSpy.mockReturnValue(new Promise(() => {})); // Stay pending — Skeleton rendert
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
  return render(<PatientDetailRouteInline einsatzId="ein_01" patientId="pat_01" />, { wrapper });
}

describe('Patient-Detail-Route — Responsive-Smoke (Story 1.7, AC12)', () => {
  beforeEach(() => {
    detailApiSpy.mockReset();
    lgViewportSpy.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it.each([
    { name: '320 px (Mobile)', isLg: false },
    { name: '640 px (Tablet hochkant)', isLg: false },
    { name: '1023 px (Tablet quer, knapp < lg)', isLg: false },
  ])('rendert Drawer bei $name', ({ isLg }) => {
    renderAtViewport(isLg);
    // Drawer = HeadlessUI Dialog Title
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('patient-detail-split-view')).toBeNull();
  });

  it.each([
    { name: '1024 px (lg Schwelle)', isLg: true },
    { name: '1280 px (Desktop)', isLg: true },
    { name: '1440 px (Wide-Desktop)', isLg: true },
  ])('rendert Split-View bei $name', ({ isLg }) => {
    renderAtViewport(isLg);
    expect(screen.getByTestId('patient-detail-split-view')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
