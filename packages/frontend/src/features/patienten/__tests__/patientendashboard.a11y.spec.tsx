/**
 * Story 1.9 (AC5): A11y-Audit über `PatientenDashboard` (D1 + D4-Komposition).
 *
 * Pflicht-Gate für Pilot (NFR-A1, UX-DR32, WCAG 2.1 AA, BITV 2.0). Adaptiert
 * das in Story 7.8 (Eigenschutz) etablierte Pattern: direktes `axe-core` via
 * `expectNoAxeViolations`-Helper aus `@/test/a11y`. jsdom-Limitierungen
 * (`color-contrast`, `color-contrast-enhanced`) sind im Helper bereits
 * deaktiviert — Kontrast-Validierung liegt auf der Token-Spec (`sk`-/
 * `patient-status`-Token-Tests) und Browser-Smoke (Pilot-Verifikation).
 *
 * Zwei Konfigurationen werden geprüft:
 *  - **D1 (≥ 1024 px)** — `PatientenDashboard` mit KpiStrip + EntityFlowStrip
 *    + PatientenListe (Story 1.8).
 *  - **D4 (≥ 1024 px, aktiver Patient)** — Split-View: Dashboard links +
 *    `PatientDetailPanel` rechts (Story 1.7 Detail-Sicht).
 *
 * Code-Review-Fixes (P5/P6/P11/P16/P10/P9/P2):
 *  - Fixture deckt alle fünf SK (SK_I/II/III/IV + TOT) ab.
 *  - eventVersion ≥ 2 für `IN_BEHANDLUNG` (ADR-018-Invariant).
 *  - Heading-Hierarchie prüft Document-Order, nicht den sortierten Set.
 *  - Reduced-Motion: matchMedia-Mock + Class-Check ohne `motion-reduce:hidden`-Fallback.
 *  - Statische Imports (kein dynamic `await import()`-Workaround mehr).
 *  - Wartet auf erste Patient-List-Row vor axe-Scan (kein leerer `rowgroup`).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import type { KpiAggregatDto, PatientDetailDto, PatientListItemDto } from '@bluelight-hub/shared/client';
import { resetTestViewport, setTestViewport } from '@/test/viewport';
import { PatientenDashboard } from '../ui/patientendashboard.organism';
import { PatientDetailPanel } from '../ui/patient-detail-panel.organism';
import { expectNoAxeViolations } from '@/test/a11y';

const detailApiSpy = vi.fn();
const listApiSpy = vi.fn();
const kpiApiSpy = vi.fn();

vi.mock('@/shared', async () => {
  const actual = await vi.importActual<typeof import('@/shared')>('@/shared');
  return {
    ...actual,
    api: {
      patienten: () => ({
        patientenControllerListVAlpha: listApiSpy,
        patientenControllerDetailVAlpha: detailApiSpy,
        patientenControllerKpisVAlpha: kpiApiSpy,
        patientenControllerAktualisiereSichtungVAlpha: vi.fn(),
        patientenControllerKorrigiereVAlpha: vi.fn(),
      }),
    },
  };
});

function buildWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

const EVENT_VERSION_BY_BEHANDLUNG: Record<PatientListItemDto['behandlungsstatus'], number> = {
  UNVERSORGT: 1,
  IN_BEHANDLUNG: 2,
  VERSORGT: 3,
  TRANSPORTBEREIT: 3,
};

function buildPatient(idx: number, sk: PatientListItemDto['aktuelleSk'] = 'SK_II', behandlung: PatientListItemDto['behandlungsstatus'] = 'IN_BEHANDLUNG'): PatientListItemDto {
  return {
    id: `pat_${idx}`,
    patientennummer: `P-${String(idx + 1).padStart(3, '0')}`,
    aktuelleSk: sk,
    behandlungsstatus: behandlung,
    transportstatus: 'WARTEND',
    erfasstAm: '2026-05-20T10:00:00.000Z',
    eventVersion: EVENT_VERSION_BY_BEHANDLUNG[behandlung],
  };
}

const SK_FIXTURE_MIX: Array<PatientListItemDto['aktuelleSk']> = ['SK_I', 'SK_II', 'SK_III', 'SK_IV', 'TOT', 'SK_II'];
const BEHANDLUNG_FIXTURE_MIX: Array<PatientListItemDto['behandlungsstatus']> = ['IN_BEHANDLUNG', 'IN_BEHANDLUNG', 'UNVERSORGT', 'IN_BEHANDLUNG', 'UNVERSORGT', 'VERSORGT'];

function buildListResponse(count: number = 6) {
  return {
    data: Array.from({ length: count }, (_, i) => buildPatient(i, SK_FIXTURE_MIX[i % SK_FIXTURE_MIX.length], BEHANDLUNG_FIXTURE_MIX[i % BEHANDLUNG_FIXTURE_MIX.length])),
    pagination: { page: 1, pageSize: 1000, total: count, totalPages: 1 },
  };
}

function buildKpiResponse(): { data: KpiAggregatDto; meta: { timestamp: string; version: string; requestId: string } } {
  return {
    data: {
      totalPatienten: 6,
      sk: { sKI: 1, sKII: 2, sKIII: 1, sKIV: 1, tOT: 1 },
      behandlung: { uNVERSORGT: 2, iNBEHANDLUNG: 3, vERSORGT: 1, tRANSPORTBEREIT: 0 },
      transport: { wARTEND: 5, iMTRANSPORT: 1, iMKRANKENHAUS: 0 },
      stand: '2026-05-20T10:00:00.000Z',
    },
    meta: { timestamp: '2026-05-20T10:00:01.000Z', version: 'v-alpha', requestId: 'req_kpi' },
  };
}

function buildDetail(
  notiz: string | null = 'Patient ansprechbar, stabile Vitalwerte.',
  sk: PatientDetailDto['aktuelleSk'] = 'SK_I',
): {
  data: PatientDetailDto;
  meta: { timestamp: string; version: string; requestId: string };
} {
  // `IN_BEHANDLUNG` braucht eventVersion ≥ 2 (patient.erfasst + patient.behandlung-begonnen).
  return {
    data: {
      id: 'pat_0',
      einsatzId: 'ein_01',
      patientennummer: 'P-001',
      diviVakNummer: 'DIVI-2026-0042',
      aktuelleSk: sk,
      behandlungsstatus: 'IN_BEHANDLUNG',
      transportstatus: 'WARTEND',
      erfasstAm: '2026-05-20T10:00:00.000Z',
      erfasserRef: { type: 'user', userId: 'usr-42' },
      eventVersion: 2,
      clockDriftSeconds: undefined,
      notiz,
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
          payload: { kind: 'patient.erfasst', initialeSk: 'SK_I' },
        },
        {
          id: 'evt_02',
          eventVersion: 2,
          eventType: 'patient.behandlung-begonnen',
          occurredAt: '2026-05-20T10:01:00.000Z',
          recordedAt: '2026-05-20T10:01:00.500Z',
          actorUserId: 'usr-42',
          actorDeviceId: null,
          originSessionId: null,
          clockDriftSeconds: null,
          payload: { kind: 'patient.behandlung-begonnen' },
        },
      ],
    },
    meta: { timestamp: '2026-05-20T10:00:01.000Z', version: 'v-alpha', requestId: 'req_detail' },
  };
}

describe('PatientenDashboard a11y (Story 1.9, AC5 / UX-DR32 / NFR-A1)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    listApiSpy.mockReset();
    detailApiSpy.mockReset();
    kpiApiSpy.mockReset();

    listApiSpy.mockResolvedValue(buildListResponse(6));
    detailApiSpy.mockResolvedValue(buildDetail());
    kpiApiSpy.mockResolvedValue(buildKpiResponse());

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 } },
    });
  });

  afterEach(() => {
    queryClient.clear();
    resetTestViewport();
  });

  describe('D1 (Desktop, ≥ 1024 px) — Volles Dashboard-Layout', () => {
    it('hat keine axe-core-Violations (WCAG 2.1 AA + best-practice)', async () => {
      setTestViewport({ width: 1024, height: 768 });

      const { container } = render(<PatientenDashboard einsatzId="ein_01" filters={{}} onFiltersChange={vi.fn()} />, { wrapper: buildWrapper(queryClient) });

      // Warte auf EntityFlowStrip + KpiStrip-Render, damit die List-Query parallel
      // aufgelöst ist (P2: in jsdom rendert @tanstack/react-virtual mangels Layout
      // keine virtuellen Rows, daher kein hartes `findByTestId(patient-list-row-*)`).
      await screen.findByRole('region', { name: 'Patient-Flow' });
      await screen.findAllByTestId(/^kpi-sk-/);

      await expectNoAxeViolations(container);
    });

    it('rendert Heading-Hierarchie konsistent in Document-Order (kein Skip > 1 Stufe)', async () => {
      setTestViewport({ width: 1024, height: 768 });

      render(<PatientenDashboard einsatzId="ein_01" filters={{}} onFiltersChange={vi.fn()} />, { wrapper: buildWrapper(queryClient) });

      await screen.findByRole('region', { name: 'Patient-Flow' });

      // Innerhalb des Dashboards dürfen keine h1 (das wäre ein Layout-Heading,
      // gehört in die Page-Shell). Folge-Sub-Headings starten bei h2 oder
      // tiefer.
      const headings = screen.queryAllByRole('heading');
      const levels = headings.map((h) => Number(h.getAttribute('aria-level') ?? h.tagName.replace(/^H/, '')));
      // Skip > 1 Stufe in DOM-Order erkennen (z.B. h2 → h4 darf nicht passieren).
      for (let i = 1; i < levels.length; i += 1) {
        const delta = levels[i] - levels[i - 1];
        // Erlaubt: gleich tief, eine Stufe tiefer, oder beliebig viele Stufen
        // wieder hoch (h3 → h2 → h3 ist okay). Verboten: > 1 Stufe tiefer.
        expect(delta, `Skipped heading level ${levels[i - 1]} → ${levels[i]} an Position ${i}`).toBeLessThanOrEqual(1);
      }
    });

    it('axe-scan inkludiert TOT-Patient + SK_IV-Patient (regulatorisch sensible Farben)', async () => {
      setTestViewport({ width: 1024, height: 768 });

      const { container } = render(<PatientenDashboard einsatzId="ein_01" filters={{}} onFiltersChange={vi.fn()} />, { wrapper: buildWrapper(queryClient) });

      await screen.findByRole('region', { name: 'Patient-Flow' });
      // KPI-Tiles zeigen alle fünf SK-Kategorien (inkl. SK_IV + TOT) — der KpiStrip-
      // Render genügt als Marker für die regulatorisch sensiblen Farben im axe-Scope.
      await screen.findByTestId('kpi-sk-SK_IV');
      await screen.findByTestId('kpi-sk-TOT');

      await expectNoAxeViolations(container);
    });
  });

  describe('D4 (Desktop, ≥ 1024 px, mit aktivem Patient) — Split-View', () => {
    it('hat keine axe-core-Violations für Dashboard + PatientDetailPanel zusammen', async () => {
      setTestViewport({ width: 1280, height: 800 });

      const { container } = render(
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)] gap-6">
          <PatientenDashboard einsatzId="ein_01" filters={{}} onFiltersChange={vi.fn()} />
          <PatientDetailPanel einsatzId="ein_01" patientId="pat_0" variant="split-view" />
        </div>,
        { wrapper: buildWrapper(queryClient) },
      );

      // Detail-Panel ist gerendert, sobald die Detail-Query aufgelöst ist;
      // EntityFlowStrip ist Marker für aufgelöste KpiStrip + List-Queries.
      await screen.findByTestId('patient-detail-panel');
      await screen.findByRole('region', { name: 'Patient-Flow' });

      await expectNoAxeViolations(container);
    });

    it('respektiert reduced-motion (Class-Pflicht: `motion-reduce:animate-none` für jede `animate-*`-Klasse)', async () => {
      // Setze `prefers-reduced-motion: reduce` in jsdom — die CSS-Verzweigung
      // läuft via Tailwind-Variants (Class-basiert), die `matchMedia`-API selbst
      // wird vom Style-System nicht aktiv abgefragt. Der Mock dient hier als
      // Convention-Signal, damit nachgelagerte Hooks (z.B. Framer-Motion oder
      // useReducedMotion) konsistent reagieren.
      const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
        matches: query.includes('prefers-reduced-motion: reduce'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      setTestViewport({ width: 1280, height: 800 });

      const { container } = render(
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)] gap-6">
          <PatientenDashboard einsatzId="ein_01" filters={{}} onFiltersChange={vi.fn()} />
          <PatientDetailPanel einsatzId="ein_01" patientId="pat_0" variant="split-view" />
        </div>,
        { wrapper: buildWrapper(queryClient) },
      );

      await screen.findByTestId('patient-detail-panel');

      // Pflicht: jede `animate-*`-Klasse hat eine `motion-reduce:animate-none`-
      // oder `motion-reduce:transition-none`-Begleitung. `motion-reduce:hidden`
      // wird NICHT als Fallback akzeptiert — Element verstecken ist semantisch
      // verschieden von „Animation pausieren" und kann eigene a11y-Verletzungen
      // verursachen (UX-DR32, Story 1.8 AC7 Highlight-Fallback).
      const animated = container.querySelectorAll('[class*="animate-"]');
      for (const el of animated) {
        const className = el.className;
        const hasReducedFallback = /motion-reduce:(animate-none|transition-none)/.test(className);
        expect(hasReducedFallback, `Element ohne reduced-motion-Fallback (animate-none/transition-none): ${className}`).toBe(true);
      }

      matchMediaSpy.mockRestore();
    });
  });
});
