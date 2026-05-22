import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';

const detailApiSpy = vi.fn();
const sichtungApiSpy = vi.fn();
const korrigiereApiSpy = vi.fn();

vi.mock('@/shared', () => ({
  api: {
    patienten: () => ({
      patientenControllerDetailVAlpha: detailApiSpy,
      patientenControllerAktualisiereSichtungVAlpha: sichtungApiSpy,
      patientenControllerKorrigiereVAlpha: korrigiereApiSpy,
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

const { PatientDetailPanel } = await import('../ui/patient-detail-panel.organism');
const { expectNoAxeViolations } = await import('@/test/a11y');

function buildWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function buildDetail(notiz: string | null = null) {
  return {
    data: {
      id: 'pat_01',
      einsatzId: 'ein_01',
      patientennummer: 'P-001',
      diviVakNummer: 'DIVI-2026-0042',
      aktuelleSk: 'SK_II',
      behandlungsstatus: 'UNVERSORGT',
      transportstatus: 'WARTEND',
      erfasstAm: '2026-05-20T10:00:00.000Z',
      erfasserRef: { type: 'user', userId: 'usr-42' },
      eventVersion: 1,
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
          payload: { kind: 'patient.erfasst', initialeSk: 'SK_II' },
        },
      ],
    },
    meta: { timestamp: '2026-05-20T10:00:01.000Z', version: 'v-alpha', requestId: 'req_01' },
  };
}

describe('PatientDetailPanel (Story 1.7, AC7)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    detailApiSpy.mockReset();
    sichtungApiSpy.mockReset();
    korrigiereApiSpy.mockReset();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('rendert Loading-Skeleton solange usePatientDetail pending ist', () => {
    // Promise nicht resolven → Hook bleibt pending
    detailApiSpy.mockReturnValue(new Promise(() => {}));
    const Wrapper = buildWrapper(queryClient);
    render(<PatientDetailPanel einsatzId="ein_01" patientId="pat_01" variant="split-view" />, { wrapper: Wrapper });
    expect(screen.getByTestId('patient-detail-loading')).toBeInTheDocument();
  });

  it('rendert Error-State bei Fehler', async () => {
    detailApiSpy.mockRejectedValueOnce(new Error('NotFound'));
    const Wrapper = buildWrapper(queryClient);
    render(<PatientDetailPanel einsatzId="ein_01" patientId="pat_01" variant="split-view" />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByTestId('patient-detail-error')).toBeInTheDocument());
  });

  it('rendert Patient-Header (Patientennummer + SkBadge + DIVI-VAK + CopyButton)', async () => {
    detailApiSpy.mockResolvedValue(buildDetail('Vorhandene Notiz'));
    const Wrapper = buildWrapper(queryClient);
    render(<PatientDetailPanel einsatzId="ein_01" patientId="pat_01" variant="split-view" />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByTestId('patient-detail-panel')).toBeInTheDocument());
    expect(screen.getByText('P-001')).toBeInTheDocument();
    expect(screen.getByText(/DIVI-VAK: DIVI-2026-0042/)).toBeInTheDocument();
    expect(screen.getByText('Link kopieren')).toBeInTheDocument();
  });

  it('mountet PatientEreignisListe + PatientNotizFeld + SkUpgradePillGroup', async () => {
    detailApiSpy.mockResolvedValue(buildDetail(null));
    const Wrapper = buildWrapper(queryClient);
    render(<PatientDetailPanel einsatzId="ein_01" patientId="pat_01" variant="split-view" />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByTestId('patient-detail-panel')).toBeInTheDocument());
    expect(screen.getByTestId('patient-ereignis-liste')).toBeInTheDocument();
    expect(screen.getByTestId('patient-notiz-feld')).toBeInTheDocument();
    expect(screen.getByText('Sichtungs-Reevaluierung')).toBeInTheDocument();
  });

  it('axe-clean — keine WCAG 2.1 AA-Verstöße im Loaded-State (Story 1.7, AC12)', async () => {
    detailApiSpy.mockResolvedValue(buildDetail('Verdacht SHT'));
    const Wrapper = buildWrapper(queryClient);
    const { container } = render(<PatientDetailPanel einsatzId="ein_01" patientId="pat_01" variant="split-view" />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByTestId('patient-detail-panel')).toBeInTheDocument());
    await expectNoAxeViolations(container);
  });
});
